import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/crm/leaderboard?period=today|week|month|all_time
// Returns ranked agents with commission + tier data
// POST /api/admin/crm/leaderboard  { period, date } — triggers cache refresh
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const period = req.nextUrl.searchParams.get("period") ?? "today";
  const today  = new Date().toISOString().slice(0, 10);

  // Try cache first
  const { data: cached } = await supabase
    .from("crm_leaderboard_cache")
    .select(`
      agent_id, period, period_date, messages_sent, replies,
      deals_closed, revenue_cents, reply_rate, close_rate,
      avg_deal_cents, rank_overall, rank_revenue, rank_close_rate,
      commission_cents, tier_name, refreshed_at,
      profiles:agent_id ( full_name, email )
    `)
    .eq("period", period)
    .eq("period_date", today)
    .order("rank_overall", { ascending: true });

  // If cache is stale (>15 min) or empty, refresh
  const isStale = !cached?.length ||
    (new Date().getTime() - new Date(cached[0].refreshed_at).getTime()) > 15 * 60 * 1000;

  if (isStale) {
    await supabase.rpc("refresh_leaderboard", { p_period: period, p_date: today });
    const { data: fresh } = await supabase
      .from("crm_leaderboard_cache")
      .select(`
        agent_id, period, period_date, messages_sent, replies,
        deals_closed, revenue_cents, reply_rate, close_rate,
        avg_deal_cents, rank_overall, rank_revenue, rank_close_rate,
        commission_cents, tier_name, refreshed_at,
        profiles:agent_id ( full_name, email )
      `)
      .eq("period", period)
      .eq("period_date", today)
      .order("rank_overall", { ascending: true });

    return NextResponse.json({ period, date: today, rows: fresh ?? [] });
  }

  // Commission tiers for context
  const { data: tiers } = await supabase
    .from("crm_commission_tiers")
    .select("*")
    .order("min_deals");

  // Agent-specific commission history (last 3 months)
  const agentIds = (cached ?? []).map(r => r.agent_id);
  const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data: commissions } = await supabase
    .from("crm_commissions")
    .select("agent_id, period_start, commission_amt, bonus_amt, tier_name, paid_at")
    .in("agent_id", agentIds)
    .gte("period_start", threeMonthsAgo)
    .order("period_start", { ascending: false });

  // Add flags
  const rows = (cached ?? []).map(r => {
    const isHighActivityLowConversion = r.messages_sent >= 20 && r.close_rate < 5;
    const hasUnfollowedReplies = r.replies > r.deals_closed + 2;
    return {
      ...r,
      flags: {
        high_activity_low_conversion: isHighActivityLowConversion,
        has_unfollowed_replies: hasUnfollowedReplies,
      },
    };
  });

  return NextResponse.json({
    period, date: today,
    rows,
    tiers: tiers ?? [],
    commission_history: commissions ?? [],
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { period = "today", date } = await req.json();
  const targetDate = date ?? new Date().toISOString().slice(0, 10);

  await supabase.rpc("refresh_leaderboard", { p_period: period, p_date: targetDate });

  return NextResponse.json({ ok: true, refreshed: { period, date: targetDate } });
}
