import { createServiceClient } from "@/lib/supabase/service";
import { requireAdminOrSalesAgent } from "@/lib/auth/api-guards";
import { buildOutreachMarketingIntelligence, OUTREACH_SENT_ACTIONS } from "@/lib/marketing-intelligence/outreach";
import { NextResponse } from "next/server";

// GET /api/admin/sales/insights
// Identifies best channels, cities, categories, bottlenecks, proof opportunities, and pattern memory.

const SENT_ACTIONS = OUTREACH_SENT_ACTIONS;

type Guidance = {
  type: string;
  message: string;
  priority: "high" | "medium" | "low";
};

export async function GET(request: Request) {
  try {
    const guard = await requireAdminOrSalesAgent();
    if (!guard.ok) return guard.response;

    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    const since = searchParams.get("since") ?? new Date(Date.now() - 86400000 * 7).toISOString();

    const { data: events, error } = await supabase
      .from("sales_events")
      .select("id, action_type, channel, city, category, revenue_cents, lead_id, message, metadata, created_at")
      .gte("created_at", since);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (!events || events.length === 0) {
      return NextResponse.json({
        insights: [],
        message: "No data yet - start logging approved outreach and replies.",
        marketing_intelligence: buildOutreachMarketingIntelligence([], []),
      });
    }

    const leadIds = Array.from(new Set(events.map((event) => event.lead_id).filter(Boolean)));
    const { data: leads } = leadIds.length > 0
      ? await supabase
          .from("sales_leads")
          .select("id,business_name,contact_name,city,category,status,priority,score,rating,reviews_count,last_reply_at,updated_at")
          .in("id", leadIds)
      : { data: [] };

    const marketingIntelligence = buildOutreachMarketingIntelligence(events, leads ?? []);
    const insights: string[] = [];

    const channelStats: Record<string, { sent: number; replies: number; deals: number }> = {};
    for (const ev of events) {
      const ch = ev.channel ?? "unknown";
      if (!channelStats[ch]) channelStats[ch] = { sent: 0, replies: 0, deals: 0 };
      if (SENT_ACTIONS.has(ev.action_type)) channelStats[ch].sent += 1;
      if (ev.action_type === "reply_received") channelStats[ch].replies += 1;
      if (ev.action_type === "deal_closed") channelStats[ch].deals += 1;
    }

    const channelRates = Object.entries(channelStats)
      .filter(([, stats]) => stats.sent > 5)
      .map(([ch, stats]) => ({
        ch,
        replyRate: stats.sent > 0 ? stats.replies / stats.sent : 0,
        closeRate: stats.sent > 0 ? stats.deals / stats.sent : 0,
        ...stats,
      }))
      .sort((a, b) => b.replyRate - a.replyRate);

    if (channelRates.length >= 2) {
      const best = channelRates[0]!;
      const worst = channelRates[channelRates.length - 1]!;
      const ratio = worst.replyRate > 0 ? (best.replyRate / worst.replyRate).toFixed(1) : "infinite";
      insights.push(`${capitalize(best.ch)} converts ${ratio}x higher reply rate than ${capitalize(worst.ch)}`);
    }
    const topChannel = channelRates[0];
    if (topChannel && topChannel.deals > 0) {
      insights.push(`${capitalize(topChannel.ch)} is your best closing channel - ${topChannel.deals} deals this week`);
    }

    const cityStats: Record<string, { sent: number; deals: number; revenue: number }> = {};
    for (const ev of events) {
      const city = ev.city ?? "Unknown";
      if (!cityStats[city]) cityStats[city] = { sent: 0, deals: 0, revenue: 0 };
      if (SENT_ACTIONS.has(ev.action_type)) cityStats[city].sent += 1;
      if (ev.action_type === "deal_closed") {
        cityStats[city].deals += 1;
        cityStats[city].revenue += ev.revenue_cents ?? 20000;
      }
    }

    const topCity = Object.entries(cityStats).sort((a, b) => b[1].deals - a[1].deals)[0];
    if (topCity && topCity[1].deals > 0) {
      insights.push(`${topCity[0]} leads close fastest - ${topCity[1].deals} deals, $${(topCity[1].revenue / 100).toFixed(0)} revenue`);
    }
    const highestConvCity = Object.entries(cityStats)
      .filter(([, stats]) => stats.sent > 5)
      .sort((a, b) => (b[1].deals / b[1].sent) - (a[1].deals / a[1].sent))[0];
    if (highestConvCity && highestConvCity[1].deals > 0) {
      insights.push(`${highestConvCity[0]} has highest close rate at ${(highestConvCity[1].deals / highestConvCity[1].sent * 100).toFixed(1)}%`);
    }

    const catStats: Record<string, { sent: number; replies: number; deals: number }> = {};
    for (const ev of events) {
      const category = ev.category ?? "Unknown";
      if (!catStats[category]) catStats[category] = { sent: 0, replies: 0, deals: 0 };
      if (SENT_ACTIONS.has(ev.action_type)) catStats[category].sent += 1;
      if (ev.action_type === "reply_received") catStats[category].replies += 1;
      if (ev.action_type === "deal_closed") catStats[category].deals += 1;
    }

    const topCatByReplies = Object.entries(catStats)
      .filter(([, stats]) => stats.sent > 3)
      .sort((a, b) => b[1].replies - a[1].replies)[0];
    if (topCatByReplies && topCatByReplies[1].replies > 0) {
      insights.push(`${topCatByReplies[0]} generates the most replies - high intent category`);
    }
    const topCatByDeals = Object.entries(catStats).sort((a, b) => b[1].deals - a[1].deals)[0];
    if (topCatByDeals && topCatByDeals[1].deals > 0) {
      insights.push(`${topCatByDeals[0]} closes the most deals - prioritize this category`);
    }

    const sent = events.filter((event) => SENT_ACTIONS.has(event.action_type)).length;
    const replied = events.filter((event) => event.action_type === "reply_received").length;
    const convo = events.filter((event) => event.action_type === "conversation_started").length;
    const deals = events.filter((event) => event.action_type === "deal_closed").length;
    const payLinks = events.filter((event) => event.action_type === "payment_link_created").length;

    if (sent > 20 && replied / sent < 0.03) {
      insights.push(`LOW reply rate (${(replied / sent * 100).toFixed(1)}%) - try switching channels or refining opener scripts`);
    }
    if (replied > 5 && convo / replied < 0.3) {
      insights.push("Replies not converting to conversations - follow up faster on replies");
    }
    if (payLinks > 0 && deals / payLinks < 0.3) {
      insights.push("Payment links sent but low close rate - follow up with sent-payment leads immediately");
    }

    const guidance: Guidance[] = [];
    if (sent < 20) guidance.push({ type: "volume", message: "Send 20 more messages now", priority: "high" });
    if (sent > 30 && replied / sent < 0.02) guidance.push({ type: "channel_switch", message: "Switch channels or refresh the opener - reply rate is too low", priority: "high" });
    if (replied > convo) guidance.push({ type: "respond", message: `Stop messaging. Respond to ${replied - convo} unworked replies`, priority: "high" });
    if (payLinks > deals) guidance.push({ type: "close", message: `Follow up on ${payLinks - deals} payment links - close these deals now`, priority: "high" });

    for (const item of marketingIntelligence.recommendations) {
      guidance.push({
        type: "marketing_intelligence",
        message: `${item.title}: ${item.nextAction}`,
        priority: item.priority,
      });
    }

    return NextResponse.json({
      insights,
      guidance,
      stats: { sent, replied, convo, deals, payLinks, channelStats, cityStats, catStats },
      marketing_intelligence: marketingIntelligence,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[insights] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
