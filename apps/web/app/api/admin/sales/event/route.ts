import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// POST /api/admin/sales/event
// Log every agent action — track everything
export async function POST(request: Request) {
  const supabase = await createClient();
  const body = await request.json();
  const { agent_id, lead_id, action_type, channel, city, category, message, revenue_cents, metadata } = body;

  if (!action_type) {
    return NextResponse.json({ error: "action_type required" }, { status: 400 });
  }

  // Insert the event
  const { data: event, error: eventError } = await supabase
    .from("sales_events")
    .insert({ agent_id, lead_id, action_type, channel, city, category, message, revenue_cents, metadata: metadata ?? {} })
    .select()
    .single();

  if (eventError) return NextResponse.json({ error: eventError.message }, { status: 500 });

  // Update lead status + counters based on action type
  if (lead_id) {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (["message_sent", "email_sent", "text_sent", "facebook_sent"].includes(action_type)) {
      updates.status = "contacted";
      updates.last_contacted_at = new Date().toISOString();
      // Increment total_messages_sent
      await supabase.rpc("increment_lead_messages", { lead_uuid: lead_id });
    }
    if (action_type === "reply_received" || action_type === "conversation_started") {
      updates.status = "replied";
      updates.last_reply_at = new Date().toISOString();
      await supabase.rpc("increment_lead_replies", { lead_uuid: lead_id });
    }
    if (action_type === "payment_link_created") {
      updates.status = "payment_sent";
    }
    if (action_type === "deal_closed") {
      updates.status = "closed";
    }

    if (Object.keys(updates).length > 1) {
      await supabase.from("sales_leads").update(updates).eq("id", lead_id);
    }
  }

  return NextResponse.json({ event });
}
