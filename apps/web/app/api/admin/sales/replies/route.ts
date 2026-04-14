import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/sales/replies
// Returns inbound SMS/email replies from the last 24 hours.
// Polls to show live conversations on the agent dashboard.
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";

interface Reply {
  id: string;
  lead_id: string;
  business_name: string;
  phone: string | null;
  email: string | null;
  message: string;
  channel: "sms" | "email";
  received_at: string;
  city: string;
  category: string;
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    // Get timestamp for 24 hours ago
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Query events with action_type "reply_received" from the last 24 hours
    const { data: replyEvents, error: replyError } = await supabase
      .from("sales_events")
      .select("lead_id, channel, message, created_at")
      .eq("action_type", "reply_received")
      .gte("created_at", twentyFourHoursAgo)
      .order("created_at", { ascending: false });

    if (replyError) {
      return NextResponse.json({ error: replyError.message }, { status: 500 });
    }

    if (!replyEvents || replyEvents.length === 0) {
      return NextResponse.json({ replies: [] });
    }

    // Get unique lead_ids from reply events
    const leadIds = [...new Set(replyEvents.map((e) => e.lead_id))];

    // Fetch lead details
    const { data: leads, error: leadsError } = await supabase
      .from("sales_leads")
      .select("id, business_name, phone, email, city, category")
      .in("id", leadIds);

    if (leadsError) {
      return NextResponse.json({ error: leadsError.message }, { status: 500 });
    }

    // Build a map of lead data
    const leadMap: Record<string, any> = {};
    for (const lead of leads ?? []) {
      leadMap[lead.id] = lead;
    }

    // Construct reply objects
    const replies: Reply[] = replyEvents
      .map((ev) => {
        const lead = leadMap[ev.lead_id];
        if (!lead) return null;

        return {
          id: `${ev.lead_id}-${ev.created_at}`,
          lead_id: ev.lead_id,
          business_name: lead.business_name || "Unknown Business",
          phone: lead.phone || null,
          email: lead.email || null,
          message: ev.message || "",
          channel: (ev.channel as "sms" | "email") || "sms",
          received_at: ev.created_at,
          city: lead.city || "",
          category: lead.category || "",
        };
      })
      .filter((r) => r !== null) as Reply[];

    return NextResponse.json({ replies });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[replies route] error:`, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
