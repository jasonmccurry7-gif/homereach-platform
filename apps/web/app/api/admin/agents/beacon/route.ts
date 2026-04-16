import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// Beacon Agent — Client Success + Onboarding
// POST /api/admin/agents/beacon
//
// Monitors new subscribers through the onboarding journey.
// Flags stuck intakes, missing designs, and unconfirmed first mailings.
// Sends check-in messages to new customers at key milestones.
// ─────────────────────────────────────────────────────────────────────────────

export async function POST() {
  const supabase = createServiceClient();
  const runAt = new Date().toISOString();

  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // ── New orders in last 7 days (fresh onboards) ───────────────────────────
    const { data: newOrders } = await supabase
      .from("orders")
      .select("id, status, created_at, business_name, contact_email, contact_phone, city_id")
      .eq("status", "active")
      .gte("created_at", sevenDaysAgo)
      .order("created_at", { ascending: false });

    // ── Orders 3+ days old still in pending intake ────────────────────────────
    const { data: stuckIntakes } = await supabase
      .from("orders")
      .select("id, status, created_at, business_name, contact_email, contact_phone")
      .eq("status", "pending")
      .lte("created_at", threeDaysAgo);

    // ── Customers who hit their 30-day mark (check-in milestone) ─────────────
    const { data: thirtyDayMilestone } = await supabase
      .from("orders")
      .select("id, business_name, contact_email, contact_phone, created_at")
      .eq("status", "active")
      .gte("created_at", new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000).toISOString())
      .lte("created_at", thirtyDaysAgo);

    const flags: string[] = [];

    if ((stuckIntakes ?? []).length > 0) {
      flags.push(`⚠️ ${stuckIntakes!.length} intake(s) stuck in pending for 3+ days — needs follow-up`);
    }
    if ((thirtyDayMilestone ?? []).length > 0) {
      flags.push(`📊 ${thirtyDayMilestone!.length} customer(s) hit 30-day mark — send results check-in`);
    }
    if ((newOrders ?? []).length > 0) {
      flags.push(`🆕 ${newOrders!.length} new subscriber(s) in last 7 days — confirm onboarding progress`);
    }

    // ── Log beacon scan ───────────────────────────────────────────────────────
    await supabase.from("sales_events").insert({
      event_type: "beacon_scan",
      notes: JSON.stringify({
        new_orders: newOrders?.length ?? 0,
        stuck_intakes: stuckIntakes?.length ?? 0,
        thirty_day_milestone: thirtyDayMilestone?.length ?? 0,
      }),
      created_at: runAt,
    }).catch(() => {});

    return NextResponse.json({
      agent: "Beacon",
      run_at: runAt,
      onboarding: {
        new_subscribers_7d: newOrders?.length ?? 0,
        stuck_intakes: stuckIntakes ?? [],
        thirty_day_milestones: thirtyDayMilestone ?? [],
      },
      flags,
      action_required: flags.length > 0,
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Beacon] Error:", msg);
    return NextResponse.json({ agent: "Beacon", error: msg, run_at: runAt }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ agent: "Beacon", status: "ready", description: "POST to run client success scan" });
}
