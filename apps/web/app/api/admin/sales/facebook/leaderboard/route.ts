import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/sales/facebook/leaderboard
//
// Returns Facebook performance scores for all agents for today (or ?date=YYYY-MM-DD).
// Joins with agent_identities to resolve names.
// Falls back gracefully if facebook_performance_scores table doesn't exist yet.
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") ?? new Date().toISOString().split("T")[0];

  const supabase = createServiceClient();

  // ── Fetch today's scores ─────────────────────────────────────────────────
  let scores: Array<{
    agent_id: string;
    overall_score: number;
    visibility_score: number;
    engagement_score: number;
    conversion_score: number;
    revenue_opp_score: number;
    posts_completed: number;
    comments_completed: number;
    dm_converted_count: number;
    biz_owner_interactions: number;
    streak_days: number;
  }> = [];

  try {
    const { data } = await supabase
      .from("facebook_performance_scores")
      .select(`
        agent_id,
        overall_score,
        visibility_score,
        engagement_score,
        conversion_score,
        revenue_opp_score,
        posts_completed,
        comments_completed,
        dm_converted_count,
        biz_owner_interactions,
        streak_days
      `)
      .eq("score_date", date)
      .order("overall_score", { ascending: false });

    scores = data ?? [];
  } catch {
    // Table not yet created — return empty leaderboard
  }

  // ── Resolve agent names from agent_identities ────────────────────────────
  let identityMap: Record<string, string> = {};
  try {
    const agentIds = scores.map(s => s.agent_id);
    if (agentIds.length > 0) {
      const { data: identities } = await supabase
        .from("agent_identities")
        .select("agent_id, from_name")
        .in("agent_id", agentIds);

      identityMap = Object.fromEntries(
        (identities ?? []).map(i => [i.agent_id, i.from_name ?? "Unknown Rep"])
      );
    }
  } catch {}

  // ── Build leaderboard entries ────────────────────────────────────────────
  const leaderboard = scores.map((s, i) => ({
    rank: i + 1,
    agent_id: s.agent_id,
    name: identityMap[s.agent_id] ?? "Rep",
    overall_score: s.overall_score,
    visibility_score: s.visibility_score,
    engagement_score: s.engagement_score,
    conversion_score: s.conversion_score,
    revenue_opp_score: s.revenue_opp_score,
    posts_completed: s.posts_completed,
    comments_completed: s.comments_completed,
    dm_converted_count: s.dm_converted_count,
    biz_owner_interactions: s.biz_owner_interactions,
    streak_days: s.streak_days,
    // Badges
    is_top_performer: i === 0 && s.overall_score > 0,
    is_on_streak: s.streak_days >= 3,
    has_biz_owner_win: s.biz_owner_interactions > 0,
  }));

  // ── Team summary stats ───────────────────────────────────────────────────
  const teamAvg = leaderboard.length > 0
    ? Math.round(leaderboard.reduce((s, r) => s + r.overall_score, 0) / leaderboard.length)
    : 0;

  const totalDmConversions = leaderboard.reduce((s, r) => s + r.dm_converted_count, 0);
  const totalBizOwnerWins  = leaderboard.reduce((s, r) => s + r.biz_owner_interactions, 0);
  const activeStreaks       = leaderboard.filter(r => r.is_on_streak).length;

  return NextResponse.json({
    date,
    leaderboard,
    team_summary: {
      avg_overall_score: teamAvg,
      total_dm_conversions: totalDmConversions,
      total_biz_owner_interactions: totalBizOwnerWins,
      active_streaks: activeStreaks,
      reps_active: leaderboard.filter(r => r.overall_score > 0).length,
    },
  });
}
