import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/sales/facebook/daily-score
//
// Called by the APEX orchestrator (Step 10) each morning.
// Computes and persists Facebook performance scores for ALL active agents.
// Uses the compute_facebook_daily_score stored function from migration 045.
//
// Returns:
//   { agents_processed, scores_computed, errors, date }
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  // Allow cron secret or internal calls
  const cronSecret = req.headers.get("x-cron-secret");
  if (cronSecret !== process.env.CRON_SECRET && cronSecret !== "internal") {
    console.warn("[FB-DAILY-SCORE] Running without cron secret");
  }

  const supabase   = createServiceClient();
  const today      = new Date().toISOString().split("T")[0];
  const errors: string[] = [];
  let agentsProcessed = 0;
  let scoresComputed  = 0;

  // ── 1. Fetch all active agent_identities ────────────────────────────────
  const { data: identities, error: idErr } = await supabase
    .from("agent_identities")
    .select("agent_id")
    .eq("is_active", true);

  if (idErr || !identities || identities.length === 0) {
    // Fallback: try auth.users-based approach via a known admin list
    return NextResponse.json({
      ok: false,
      error: idErr?.message ?? "No active agents found",
      agents_processed: 0,
      scores_computed: 0,
      date: today,
    });
  }

  agentsProcessed = identities.length;

  // ── 2. Call compute_facebook_daily_score for each agent ─────────────────
  for (const { agent_id } of identities) {
    try {
      const { error } = await supabase.rpc("compute_facebook_daily_score", {
        p_agent_id: agent_id,
        p_date: today,
      });

      if (error) {
        errors.push(`${agent_id}: ${error.message}`);
      } else {
        scoresComputed++;
      }
    } catch (err) {
      errors.push(`${agent_id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // ── 3. Read computed scores back for summary ─────────────────────────────
  const { data: scores } = await supabase
    .from("facebook_performance_scores")
    .select("agent_id, overall_score, visibility_score, engagement_score, conversion_score, revenue_opp_score")
    .eq("score_date", today)
    .order("overall_score", { ascending: false });

  // ── 4. Build top performer summary ──────────────────────────────────────
  const topAgent = scores?.[0] ?? null;
  const avgOverall = scores && scores.length > 0
    ? Math.round(scores.reduce((s, r) => s + r.overall_score, 0) / scores.length)
    : 0;

  return NextResponse.json({
    ok: true,
    date: today,
    agents_processed: agentsProcessed,
    scores_computed: scoresComputed,
    errors: errors.length > 0 ? errors : undefined,
    avg_overall_score: avgOverall,
    top_agent_id: topAgent?.agent_id ?? null,
    top_agent_score: topAgent?.overall_score ?? 0,
    scores: scores ?? [],
  });
}

// GET — status
export async function GET() {
  return NextResponse.json({
    route: "Facebook Daily Score",
    description: "POST to compute today's Facebook performance scores for all active agents.",
    called_by: "APEX orchestrator (Step 10)",
  });
}
