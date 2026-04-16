import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/sales/facebook/scorecard?agent_id=xxx
// Returns comprehensive Facebook performance scorecard for an agent.
// Reads from facebook_activity_logs if available, falls back to sales_events.
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get("agent_id");

  if (!agentId) {
    return NextResponse.json({ error: "agent_id required" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const today    = new Date().toISOString().split("T")[0];
  const week7d   = new Date(Date.now() - 86400000 * 7).toISOString();

  // ── Today's activity from facebook_activity_logs ──────────────────────────
  let todayLogs: Array<{
    task_type: string; quality_score: number; dm_converted: boolean;
    business_owner_interaction: boolean; thread_depth: number;
    created_at: string; city: string | null; category: string | null;
  }> = [];

  try {
    const { data } = await supabase
      .from("facebook_activity_logs")
      .select("task_type, quality_score, dm_converted, business_owner_interaction, thread_depth, created_at, city, category")
      .eq("agent_id", agentId)
      .gte("created_at", `${today}T00:00:00.000Z`);
    todayLogs = data ?? [];
  } catch {
    // Table not yet created — use sales_events fallback
  }

  // ── Fallback: count facebook_sent from sales_events for today ─────────────
  let fbSentToday = 0;
  try {
    const { count } = await supabase
      .from("sales_events")
      .select("*", { count: "exact", head: true })
      .eq("agent_id", agentId)
      .eq("channel", "facebook")
      .gte("created_at", `${today}T00:00:00.000Z`);
    fbSentToday = count ?? 0;
  } catch {}

  // ── 7-day history for streak ──────────────────────────────────────────────
  let weekLogs: Array<{ created_at: string; quality_score: number }> = [];
  try {
    const { data } = await supabase
      .from("facebook_activity_logs")
      .select("created_at, quality_score")
      .eq("agent_id", agentId)
      .gte("created_at", week7d)
      .order("created_at", { ascending: false });
    weekLogs = data ?? [];
  } catch {}

  // ── Score calculations ────────────────────────────────────────────────────
  const byType = (type: string) => todayLogs.filter(l => l.task_type === type);

  const posts         = byType("authority_post").length;
  const comments      = byType("power_comment").length;
  const conversations = byType("conversation_builder").length;
  const dmConversions = byType("dm_conversion").length;
  const groupPosts    = byType("group_contribution").length;
  const salesFollowups = byType("sales_opportunity_followup").length;

  const dmConvertedCount       = todayLogs.filter(l => l.dm_converted).length;
  const bizOwnerInteractions   = todayLogs.filter(l => l.business_owner_interaction).length;
  const avgThreadDepth         = todayLogs.length > 0
    ? todayLogs.reduce((s, l) => s + (l.thread_depth ?? 1), 0) / todayLogs.length
    : 0;
  const avgQualityScore        = todayLogs.length > 0
    ? todayLogs.reduce((s, l) => s + (l.quality_score ?? 50), 0) / todayLogs.length
    : 0;

  // Visibility Score (0–100)
  const visScore = Math.min(100, Math.round(
    (posts / 2) * 40 +
    (groupPosts / 2) * 30 +
    (comments / 10) * 30
  ));

  // Engagement Score (0–100)
  const engScore = Math.min(100, Math.round(
    (conversations / 5) * 40 +
    (avgThreadDepth / 3) * 30 +
    (comments / 10) * 30
  ));

  // Conversion Score (0–100)
  const convScore = Math.min(100, Math.round(
    (dmConversions / 5) * 50 +
    (dmConvertedCount / 3) * 30 +
    (salesFollowups / 5) * 20
  ));

  // Revenue Opportunity Score (0–100)
  const revScore = Math.min(100, Math.round(
    (bizOwnerInteractions / 3) * 50 +
    (salesFollowups / 5) * 30 +
    (dmConvertedCount / 3) * 20
  ));

  // Overall engagement score
  const overallScore = Math.round((visScore + engScore + convScore + revScore) / 4);

  // ── Streak calculation ────────────────────────────────────────────────────
  const activeDays = new Set(weekLogs.map(l => l.created_at.split("T")[0]));
  let streak = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(Date.now() - 86400000 * i).toISOString().split("T")[0];
    if (activeDays.has(d)) streak++;
    else if (i > 0) break; // gap in streak
  }

  // ── Achievement momentum estimates ────────────────────────────────────────
  // Based on engagement behavior patterns, not direct Facebook badge data
  const weekPostCount = weekLogs.filter(l => l.task_type === "authority_post").length;
  const weekCommentCount = weekLogs.filter(l => l.task_type === "power_comment").length;

  const breakoutPostProgress     = Math.min(100, Math.round((weekPostCount / 10) * 100));
  const epicCommentProgress      = Math.min(100, Math.round((weekCommentCount / 50) * 100));
  const superstarEngagement      = Math.min(100, Math.round((weekLogs.length / 70) * 100));
  const trustMomentum            = Math.min(100, Math.round((streak / 7) * 100 * 0.6 + (avgQualityScore / 100) * 40));
  const visibilityMomentum       = Math.min(100, visScore * 0.7 + (weekPostCount / 10) * 30);
  const conversionMomentum       = Math.min(100, convScore * 0.8 + (dmConvertedCount / 5) * 20);

  // ── Suggested next actions for warm threads ───────────────────────────────
  const nextActions = [];
  if (dmConversions < 3)      nextActions.push({ action: "Convert a public thread to DM", priority: "high", icon: "📩" });
  if (comments < 5)           nextActions.push({ action: "Post 5 more power comments", priority: "high", icon: "💬" });
  if (posts < 1)              nextActions.push({ action: "Post your authority post for today", priority: "high", icon: "📣" });
  if (salesFollowups < 3)     nextActions.push({ action: "Follow up on warm Facebook prospects", priority: "medium", icon: "🎯" });
  if (conversations < 3)      nextActions.push({ action: "Re-engage 3 existing public threads", priority: "medium", icon: "🔁" });
  if (groupPosts < 1)         nextActions.push({ action: "Post in a local business group", priority: "low", icon: "📢" });

  return NextResponse.json({
    date: today,
    agent_id: agentId,

    // Today's counts
    today: {
      posts,
      comments,
      conversations,
      dm_conversions: dmConversions,
      group_posts: groupPosts,
      sales_followups: salesFollowups,
      dm_converted_count: dmConvertedCount,
      biz_owner_interactions: bizOwnerInteractions,
      avg_thread_depth: Math.round(avgThreadDepth * 10) / 10,
      avg_quality_score: Math.round(avgQualityScore),
      fb_sent_fallback: fbSentToday, // from sales_events if no FB logs yet
    },

    // Scores
    scores: {
      visibility:   visScore,
      engagement:   engScore,
      conversion:   convScore,
      revenue_opp:  revScore,
      overall:      overallScore,
    },

    // Streak
    streak: {
      current: streak,
      active_days_this_week: activeDays.size,
    },

    // Achievement momentum (estimated, not direct FB badge data)
    momentum: {
      breakout_post_progress:    breakoutPostProgress,
      epic_comment_progress:     epicCommentProgress,
      superstar_engagement:      superstarEngagement,
      trust_momentum:            Math.round(trustMomentum),
      visibility_momentum:       Math.round(visibilityMomentum),
      conversion_momentum:       Math.round(conversionMomentum),
    },

    // Next actions
    next_actions: nextActions,
  });
}
