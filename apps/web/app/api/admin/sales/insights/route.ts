import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/admin/sales/insights
// Identifies: best channel, best city, best category, lead quality, bottleneck stage

// Canonical outbound action types (must match event/route.ts SEND_ACTIONS)
const SENT_ACTIONS = new Set(["sms_sent", "email_sent", "fb_message_sent", "follow_up_sent"]);

export async function GET(request: Request) {
  try {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const since = searchParams.get("since") ?? new Date(Date.now() - 86400000 * 7).toISOString(); // default 7 days

  const { data: events, error } = await supabase
    .from("sales_events")
    .select("action_type, channel, city, category, revenue_cents, lead_id, created_at")
    .gte("created_at", since);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!events || events.length === 0) {
    return NextResponse.json({ insights: [], message: "No data yet — start sending messages!" });
  }

  const insights: string[] = [];

  // Channel performance
  const channelStats: Record<string, { sent: number; replies: number; deals: number }> = {};
  for (const ev of events) {
    const ch = ev.channel ?? "unknown";
    if (!channelStats[ch]) channelStats[ch] = { sent: 0, replies: 0, deals: 0 };
    if (SENT_ACTIONS.has(ev.action_type)) channelStats[ch].sent++;
    if (ev.action_type === "reply_received") channelStats[ch].replies++;
    if (ev.action_type === "deal_closed")    channelStats[ch].deals++;
  }

  const channelRates = Object.entries(channelStats)
    .filter(([,s]) => s.sent > 5)
    .map(([ch, s]) => ({ ch, replyRate: s.sent > 0 ? s.replies/s.sent : 0, closeRate: s.sent > 0 ? s.deals/s.sent : 0, ...s }))
    .sort((a,b) => b.replyRate - a.replyRate);

  if (channelRates.length >= 2) {
    const best = channelRates[0];
    const worst = channelRates[channelRates.length - 1];
    const ratio = worst.replyRate > 0 ? (best.replyRate / worst.replyRate).toFixed(1) : "∞";
    insights.push(`${capitalize(best.ch)} converts ${ratio}x higher reply rate than ${capitalize(worst.ch)}`);
  }
  if (channelRates.length > 0 && channelRates[0].deals > 0) {
    insights.push(`${capitalize(channelRates[0].ch)} is your best closing channel — ${channelRates[0].deals} deals this week`);
  }

  // City performance
  const cityStats: Record<string, { sent: number; deals: number; revenue: number }> = {};
  for (const ev of events) {
    const c = ev.city ?? "Unknown";
    if (!cityStats[c]) cityStats[c] = { sent: 0, deals: 0, revenue: 0 };
    if (SENT_ACTIONS.has(ev.action_type)) cityStats[c].sent++;
    if (ev.action_type === "deal_closed") { cityStats[c].deals++; cityStats[c].revenue += ev.revenue_cents ?? 20000; }
  }
  const topCity = Object.entries(cityStats).sort((a,b) => b[1].deals - a[1].deals)[0];
  if (topCity && topCity[1].deals > 0) {
    insights.push(`${topCity[0]} leads close fastest — ${topCity[1].deals} deals, $${(topCity[1].revenue/100).toFixed(0)} revenue`);
  }
  const highestConvCity = Object.entries(cityStats)
    .filter(([,s]) => s.sent > 5)
    .sort((a,b) => (b[1].deals/b[1].sent) - (a[1].deals/a[1].sent))[0];
  if (highestConvCity && highestConvCity[1].deals > 0) {
    insights.push(`${highestConvCity[0]} has highest close rate at ${(highestConvCity[1].deals/highestConvCity[1].sent*100).toFixed(1)}%`);
  }

  // Category performance
  const catStats: Record<string, { sent: number; replies: number; deals: number }> = {};
  for (const ev of events) {
    const cat = ev.category ?? "Unknown";
    if (!catStats[cat]) catStats[cat] = { sent: 0, replies: 0, deals: 0 };
    if (SENT_ACTIONS.has(ev.action_type)) catStats[cat].sent++;
    if (ev.action_type === "reply_received") catStats[cat].replies++;
    if (ev.action_type === "deal_closed") catStats[cat].deals++;
  }
  const topCatByReplies = Object.entries(catStats).filter(([,s]) => s.sent > 3).sort((a,b) => b[1].replies - a[1].replies)[0];
  if (topCatByReplies && topCatByReplies[1].replies > 0) {
    insights.push(`${topCatByReplies[0]} generates the most replies — high intent category`);
  }
  const topCatByDeals = Object.entries(catStats).sort((a,b) => b[1].deals - a[1].deals)[0];
  if (topCatByDeals && topCatByDeals[1].deals > 0) {
    insights.push(`${topCatByDeals[0]} closes the most deals — prioritize this category`);
  }

  // Bottleneck detection
  const sent = events.filter(e => SENT_ACTIONS.has(e.action_type)).length;
  const replied = events.filter(e => e.action_type === "reply_received").length;
  const convo = events.filter(e => e.action_type === "conversation_started").length;
  const deals = events.filter(e => e.action_type === "deal_closed").length;
  const payLinks = events.filter(e => e.action_type === "payment_link_created").length;

  if (sent > 20 && replied / sent < 0.03) {
    insights.push(`LOW reply rate (${(replied/sent*100).toFixed(1)}%) — try switching channels or refining opener scripts`);
  }
  if (replied > 5 && convo / replied < 0.3) {
    insights.push(`Replies not converting to conversations — follow up faster on replies`);
  }
  if (payLinks > 0 && deals / payLinks < 0.3) {
    insights.push(`Payment links sent but low close rate — follow up with sent-payment leads immediately`);
  }

  // Realtime guidance
  const guidance: { type: string; message: string; priority: "high" | "medium" | "low" }[] = [];
  if (sent < 20) guidance.push({ type: "volume", message: "Send 20 more messages now", priority: "high" });
  if (sent > 30 && replied / sent < 0.02) guidance.push({ type: "channel_switch", message: "Switch to SMS — email reply rate is too low", priority: "high" });
  if (replied > convo) guidance.push({ type: "respond", message: `Stop messaging. Respond to ${replied - convo} unworked replies`, priority: "high" });
  if (payLinks > deals) guidance.push({ type: "close", message: `Follow up on ${payLinks - deals} payment links — close these deals now`, priority: "high" });

  return NextResponse.json({ insights, guidance, stats: { sent, replied, convo, deals, payLinks, channelStats, cityStats, catStats } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[insights] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
