import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

// GET /api/admin/sales/leaderboard
export async function GET(request: Request) {
  try {
  const supabase = createServiceClient();
  const { searchParams } = new URL(request.url);
  const since = searchParams.get("since") ?? new Date(Date.now() - 86400000).toISOString(); // default: today

  // Get all events
  const { data: events, error: evError } = await supabase
    .from("sales_events")
    .select("agent_id, action_type, channel, revenue_cents, created_at, lead_id")
    .gte("created_at", since);

  if (evError) return NextResponse.json({ error: evError.message }, { status: 500 });

  // Get all profiles + agent identities for name lookup
  const [{ data: profiles }, { data: identities }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email"),
    supabase.from("agent_identities").select("agent_id, from_name"),
  ]);

  // Build name map: prefer profiles.full_name, fallback to agent_identities.from_name, then email prefix
  const profileMap: Record<string, string> = {};
  for (const p of profiles ?? []) {
    if (p.full_name?.trim()) {
      profileMap[p.id] = p.full_name.trim();
    } else if (p.email) {
      profileMap[p.id] = p.email.split("@")[0]; // e.g. josh@home-reach.com → josh
    }
  }
  // Override with agent_identities.from_name if it has a real name
  for (const ai of identities ?? []) {
    if (ai.from_name?.trim() && ai.agent_id) {
      profileMap[ai.agent_id] = ai.from_name.trim();
    }
  }

  if (!events || events.length === 0) {
    return NextResponse.json({ leaderboard: [] });
  }

  // Aggregate per agent
  const agentStats: Record<string, {
    agent_id: string;
    name: string;
    messages: number;
    replies: number;
    conversations: number;
    follow_ups: number;
    payment_links: number;
    deals: number;
    revenue_cents: number;
    leads_viewed: number;
    first_event: string;
    last_event: string;
  }> = {};

  for (const ev of events) {
    const aid = ev.agent_id ?? "unknown";
    if (!agentStats[aid]) {
      agentStats[aid] = {
        agent_id: aid,
        name: profileMap[aid] ?? `Agent (${aid.slice(0, 8)})`,
        messages: 0, replies: 0, conversations: 0,
        follow_ups: 0, payment_links: 0, deals: 0,
        revenue_cents: 0, leads_viewed: 0,
        first_event: ev.created_at, last_event: ev.created_at,
      };
    }
    const s = agentStats[aid];
    if (ev.created_at < s.first_event) s.first_event = ev.created_at;
    if (ev.created_at > s.last_event)  s.last_event  = ev.created_at;

    switch (ev.action_type) {
      case "lead_loaded":        s.leads_viewed++; break;
      case "message_sent":
      case "email_sent":
      case "text_sent":
      case "facebook_sent":      s.messages++; break;
      case "reply_received":     s.replies++; break;
      case "conversation_started": s.conversations++; break;
      case "follow_up_sent":     s.follow_ups++; break;
      case "payment_link_created": s.payment_links++; break;
      case "deal_closed":
        s.deals++;
        s.revenue_cents += ev.revenue_cents ?? 20000; // default $200 if not set
        break;
    }
  }

  const leaderboard = Object.values(agentStats).map(s => {
    const replyRate  = s.messages > 0 ? +(s.replies / s.messages * 100).toFixed(1) : 0;
    const closeRate  = s.messages > 0 ? +(s.deals   / s.messages * 100).toFixed(1) : 0;
    const flags: string[] = [];
    if (s.messages > 50 && replyRate < 2) flags.push("high_activity_low_conversion");
    if (s.messages < 10) flags.push("low_activity");
    if (s.replies > 0 && s.conversations === 0) flags.push("replies_not_followed_up");
    return { ...s, reply_rate: replyRate, close_rate: closeRate, flags };
  });

  // Sort by deals desc, then revenue desc, then messages desc
  leaderboard.sort((a, b) => b.deals - a.deals || b.revenue_cents - a.revenue_cents || b.messages - a.messages);

  // Tag top performers
  if (leaderboard.length > 0) {
    leaderboard[0].flags = [...(leaderboard[0].flags ?? []), "top_closer"];
    const bestConverter = [...leaderboard].sort((a,b) => b.reply_rate - a.reply_rate)[0];
    if (bestConverter) bestConverter.flags = [...(bestConverter.flags ?? []), "best_converter"];
    const mostActive = [...leaderboard].sort((a,b) => b.messages - a.messages)[0];
    if (mostActive) mostActive.flags = [...(mostActive.flags ?? []), "most_active"];
  }

  return NextResponse.json({ leaderboard, since });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[route] error:`, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

}
