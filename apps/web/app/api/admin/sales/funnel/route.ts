import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/admin/sales/funnel
// Returns full conversion funnel: leads viewed → sent → replied → closed
// Optionally scoped by agent_id or date range
export async function GET(request: Request) {
  try {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const agent_id = searchParams.get("agent_id");
  const since    = searchParams.get("since") ?? new Date(Date.now() - 86400000 * 30).toISOString();

  let q = supabase
    .from("sales_events")
    .select("action_type, channel, city, category, revenue_cents, agent_id, lead_id")
    .gte("created_at", since);

  if (agent_id) q = q.eq("agent_id", agent_id);
  const { data: events, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!events) return NextResponse.json({ funnel: buildFunnel([]) });

  return NextResponse.json({ funnel: buildFunnel(events), events_count: events.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[route] error:`, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

}

type Event = {
  action_type: string;
  channel: string | null;
  city: string | null;
  category: string | null;
  revenue_cents: number | null;
  agent_id: string | null;
  lead_id: string | null;
};

function buildFunnel(events: Event[]) {
  const leadsViewed       = events.filter(e => e.action_type === "lead_loaded").length;
  const leadsSkipped      = events.filter(e => e.action_type === "lead_skipped").length;
  const messagesSent      = events.filter(e => ["message_sent","email_sent","text_sent","facebook_sent"].includes(e.action_type)).length;
  const replies           = events.filter(e => e.action_type === "reply_received").length;
  const conversations     = events.filter(e => e.action_type === "conversation_started").length;
  const followUps         = events.filter(e => e.action_type === "follow_up_sent").length;
  const paymentLinks      = events.filter(e => e.action_type === "payment_link_created").length;
  const deals             = events.filter(e => e.action_type === "deal_closed").length;
  const totalRevenue      = events.filter(e => e.action_type === "deal_closed").reduce((s,e) => s + (e.revenue_cents ?? 0), 0);

  // Channel breakdown
  const byChannel: Record<string, { sent: number; replies: number; deals: number; revenue: number }> = {};
  for (const e of events) {
    const ch = e.channel ?? "unknown";
    if (!byChannel[ch]) byChannel[ch] = { sent: 0, replies: 0, deals: 0, revenue: 0 };
    if (["message_sent","email_sent","text_sent","facebook_sent"].includes(e.action_type)) byChannel[ch].sent++;
    if (e.action_type === "reply_received") byChannel[ch].replies++;
    if (e.action_type === "deal_closed") { byChannel[ch].deals++; byChannel[ch].revenue += (e.revenue_cents ?? 0); }
  }

  // City breakdown
  const byCity: Record<string, { sent: number; deals: number; revenue: number }> = {};
  for (const e of events) {
    const c = e.city ?? "unknown";
    if (!byCity[c]) byCity[c] = { sent: 0, deals: 0, revenue: 0 };
    if (["message_sent","email_sent","text_sent","facebook_sent"].includes(e.action_type)) byCity[c].sent++;
    if (e.action_type === "deal_closed") { byCity[c].deals++; byCity[c].revenue += (e.revenue_cents ?? 0); }
  }

  // Category breakdown
  const byCategory: Record<string, { sent: number; deals: number; revenue: number }> = {};
  for (const e of events) {
    const cat = e.category ?? "unknown";
    if (!byCategory[cat]) byCategory[cat] = { sent: 0, deals: 0, revenue: 0 };
    if (["message_sent","email_sent","text_sent","facebook_sent"].includes(e.action_type)) byCategory[cat].sent++;
    if (e.action_type === "deal_closed") { byCategory[cat].deals++; byCategory[cat].revenue += (e.revenue_cents ?? 0); }
  }

  const replyRate        = messagesSent > 0 ? (replies / messagesSent * 100).toFixed(1) : "0.0";
  const conversationRate = replies > 0      ? (conversations / replies * 100).toFixed(1) : "0.0";
  const closeRate        = messagesSent > 0 ? (deals / messagesSent * 100).toFixed(1) : "0.0";
  const revenuePerLead   = leadsViewed > 0  ? (totalRevenue / leadsViewed / 100).toFixed(2) : "0.00";
  const revenuePerMsg    = messagesSent > 0 ? (totalRevenue / messagesSent / 100).toFixed(2) : "0.00";

  return {
    stages: {
      leads_viewed:    leadsViewed,
      leads_skipped:   leadsSkipped,
      messages_sent:   messagesSent,
      replies:         replies,
      conversations:   conversations,
      follow_ups:      followUps,
      payment_links:   paymentLinks,
      deals_closed:    deals,
    },
    rates: {
      reply_rate:         replyRate + "%",
      conversation_rate:  conversationRate + "%",
      close_rate:         closeRate + "%",
      revenue_per_lead:   "$" + revenuePerLead,
      revenue_per_msg:    "$" + revenuePerMsg,
    },
    revenue_total_cents: totalRevenue,
    by_channel:   byChannel,
    by_city:      byCity,
    by_category:  byCategory,
  };
}
