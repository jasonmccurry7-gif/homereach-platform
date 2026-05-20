import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// Horizon Agent — Strategic Planning + Roadmap Visibility
// POST /api/admin/agents/horizon
//
// Compiles forward-looking strategic snapshot:
// - Revenue trajectory to targets
// - City expansion sequencing
// - Highest-leverage next actions
// - 30/60/90 day outlook
// ─────────────────────────────────────────────────────────────────────────────

export async function POST() {
  const supabase = createServiceClient();
  const runAt = new Date().toISOString();

  try {
    // ── Revenue data ─────────────────────────────────────────────────────────
    const { data: activeOrders } = await supabase
      .from("orders")
      .select("id, locked_price_cents, created_at, city_id, status")
      .eq("status", "active");

    const mrr = (activeOrders ?? []).reduce((sum, o) => sum + (o.locked_price_cents ?? 0), 0) / 100;
    const arr = mrr * 12;

    // ── Lead pipeline data ───────────────────────────────────────────────────
    const { data: leads } = await supabase
      .from("sales_leads")
      .select("status, city, category")
      .not("status", "eq", "closed_lost")
      .not("status", "eq", "do_not_contact");

    const pipeline = (leads ?? []).reduce((acc: Record<string, number>, l) => {
      acc[l.status] = (acc[l.status] ?? 0) + 1;
      return acc;
    }, {});

    const hotLeads = (pipeline.verbal_yes ?? 0) + (pipeline.interested ?? 0) + (pipeline.pricing_sent ?? 0);

    // ── Strategic milestones ─────────────────────────────────────────────────
    const MRR_TARGETS = [
      { label: "First $5K MRR", target: 5000, description: "~25 back-tier spots filled" },
      { label: "$10K MRR",      target: 10000, description: "~50 spots or mix of tiers" },
      { label: "$25K MRR",      target: 25000, description: "Wooster + Medina saturated" },
      { label: "$50K MRR",      target: 50000, description: "10 cities averaging 5 spots each" },
      { label: "$100K MRR",     target: 100000, description: "Full Ohio saturation" },
    ];

    const nextTarget = MRR_TARGETS.find(t => t.target > mrr);
    const gapToNext = nextTarget ? nextTarget.target - mrr : 0;
    const spotsNeeded = Math.ceil(gapToNext / 200); // back-tier equivalent

    // ── 30/60/90 day outlook ─────────────────────────────────────────────────
    const outlook = {
      "30_days": {
        focus: "Close first 10 paying subscribers. Establish Wooster + Medina as anchor markets.",
        target_mrr: Math.min(mrr + 2000, 5000),
        key_actions: [
          "Activate calling on 1,646 scraped leads",
          "Close all verbal_yes + interested pipeline",
          "Run Facebook ad Variant A in Wooster + Medina",
          "Confirm Stripe + APEX Twilio live end-to-end",
        ],
      },
      "60_days": {
        focus: "Scale to $5K MRR. Begin city #3 and #4.",
        target_mrr: 5000,
        key_actions: [
          "Add 3 more Ohio cities",
          "Launch Property Intelligence Leads founding campaign",
          "Set up self-serve Targeted Campaign checkout",
          "Referral program for existing subscribers",
        ],
      },
      "90_days": {
        focus: "$10K MRR. Platform self-serve. Agent team scaling.",
        target_mrr: 10000,
        key_actions: [
          "Full self-serve funnel (no agent needed to close)",
          "11 cities at 40%+ fill rate",
          "Client portal with postcard proof approvals",
          "First national Targeted Campaign push",
        ],
      },
    };

    return NextResponse.json({
      agent: "Horizon",
      run_at: runAt,
      financial: {
        current_mrr: mrr,
        current_arr: arr,
        active_subscribers: activeOrders?.length ?? 0,
        next_milestone: nextTarget ?? { label: "Beyond roadmap", target: 100000, description: "National scale" },
        gap_to_next_milestone: gapToNext,
        spots_needed_to_next: spotsNeeded,
      },
      pipeline: {
        total_active_leads: leads?.length ?? 0,
        hot_leads: hotLeads,
        by_stage: pipeline,
      },
      outlook,
      strategic_recommendation: nextTarget
        ? `Close ${spotsNeeded} more spots to hit "${nextTarget.label}". Focus on hot leads first (${hotLeads} available now).`
        : "On track — focus on maintaining growth rate and entering new cities.",
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Horizon] Error:", msg);
    return NextResponse.json({ agent: "Horizon", error: msg, run_at: runAt }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ agent: "Horizon", status: "ready", description: "POST to run strategic planning analysis" });
}
