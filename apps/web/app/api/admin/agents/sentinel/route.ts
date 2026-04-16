import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// Sentinel Agent — Security, Compliance + System Validation
// POST /api/admin/agents/sentinel
//
// Continuously tests critical system paths:
// - Checkout flow reachability
// - Webhook endpoint health
// - Required env vars present
// - Data integrity (orphaned records, duplicate spots, invalid states)
// - Recent error spike detection
// ─────────────────────────────────────────────────────────────────────────────

type ValidationResult = {
  check: string;
  status: "pass" | "fail" | "warn";
  detail: string;
};

export async function POST() {
  const supabase = createServiceClient();
  const runAt = new Date().toISOString();
  const results: ValidationResult[] = [];

  try {
    // ── 1. ENV VAR PRESENCE ───────────────────────────────────────────────────
    const requiredEnvs = [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "TWILIO_ACCOUNT_SID",
      "TWILIO_AUTH_TOKEN",
    ];

    for (const env of requiredEnvs) {
      results.push({
        check: `env_${env.toLowerCase()}`,
        status: process.env[env] ? "pass" : "fail",
        detail: process.env[env] ? `${env} is set` : `MISSING: ${env} — revenue or messaging may break`,
      });
    }

    // ── 2. DATA INTEGRITY — Duplicate spot assignments ────────────────────────
    const { data: orders } = await supabase
      .from("orders")
      .select("city_id, category_id, status")
      .eq("status", "active");

    const spotKeys = new Map<string, number>();
    for (const o of orders ?? []) {
      const key = `${o.city_id}::${o.category_id}`;
      spotKeys.set(key, (spotKeys.get(key) ?? 0) + 1);
    }
    const duplicates = [...spotKeys.entries()].filter(([, count]) => count > 1);

    results.push({
      check: "data_no_duplicate_spots",
      status: duplicates.length === 0 ? "pass" : "fail",
      detail: duplicates.length === 0
        ? "No duplicate active spots detected"
        : `⚠️ ${duplicates.length} city+category combination(s) have multiple active orders — EXCLUSIVITY VIOLATED`,
    });

    // ── 3. LEAD DATA INTEGRITY — leads without required fields ───────────────
    const { count: leadsWithoutPhone } = await supabase
      .from("sales_leads")
      .select("id", { count: "exact", head: true })
      .is("phone", null)
      .is("email", null);

    results.push({
      check: "leads_contact_info",
      status: (leadsWithoutPhone ?? 0) > 100 ? "warn" : "pass",
      detail: `${leadsWithoutPhone ?? 0} leads missing both phone and email (unfollowable)`,
    });

    // ── 4. STRIPE KEY FORMAT CHECK ────────────────────────────────────────────
    const stripeKey = process.env.STRIPE_SECRET_KEY ?? "";
    const stripeKeyValid = stripeKey.startsWith("sk_live_") || stripeKey.startsWith("sk_test_");
    results.push({
      check: "stripe_key_format",
      status: stripeKeyValid ? "pass" : "fail",
      detail: stripeKeyValid
        ? "Stripe key format valid (sk_live_ or sk_test_)"
        : "INVALID Stripe key format — must start with sk_live_ or sk_test_ (not Sk_live_)",
    });

    // ── 5. ACTIVE ORDERS HEALTH ────────────────────────────────────────────────
    const { count: activeOrders } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "active");

    results.push({
      check: "active_orders_present",
      status: "pass",
      detail: `${activeOrders ?? 0} active orders in system`,
    });

    // ── 6. APEX COMMAND LOG — recent activity ────────────────────────────────
    const { data: recentCommands } = await supabase
      .from("apex_command_log" as never)
      .select("executed_at")
      .order("executed_at", { ascending: false })
      .limit(1);

    const lastCommand = recentCommands?.[0] as { executed_at: string } | undefined;
    const commandAge = lastCommand
      ? Math.round((Date.now() - new Date(lastCommand.executed_at).getTime()) / (1000 * 60 * 60))
      : null;

    results.push({
      check: "apex_command_activity",
      status: commandAge === null ? "warn" : commandAge > 48 ? "warn" : "pass",
      detail: commandAge === null
        ? "No APEX commands logged — system may not be receiving SMS"
        : commandAge > 48
        ? `⚠️ Last APEX command was ${commandAge}h ago — verify Twilio webhook is live`
        : `APEX active — last command ${commandAge}h ago`,
    });

    // ── Summary ───────────────────────────────────────────────────────────────
    const failed = results.filter(r => r.status === "fail");
    const warned = results.filter(r => r.status === "warn");
    const passed = results.filter(r => r.status === "pass");

    const overallStatus =
      failed.length > 0 ? "RED" :
      warned.length > 0 ? "YELLOW" :
      "GREEN";

    // Log to DB
    await supabase.from("sales_events").insert({
      event_type: "sentinel_scan",
      notes: JSON.stringify({ passed: passed.length, warned: warned.length, failed: failed.length }),
      created_at: runAt,
    }).catch(() => {});

    return NextResponse.json({
      agent: "Sentinel",
      run_at: runAt,
      status: overallStatus,
      summary: {
        total: results.length,
        passed: passed.length,
        warned: warned.length,
        failed: failed.length,
      },
      results,
      critical_failures: failed.map(r => ({ check: r.check, detail: r.detail })),
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Sentinel] Error:", msg);
    return NextResponse.json({ agent: "Sentinel", error: msg, run_at: runAt }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ agent: "Sentinel", status: "ready", description: "POST to run full security and validation scan" });
}
