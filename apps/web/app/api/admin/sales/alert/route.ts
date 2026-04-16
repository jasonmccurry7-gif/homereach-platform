import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { leadId } = await req.json();
    if (!leadId) {
      return NextResponse.json({ error: "leadId required" }, { status: 400 });
    }

    const db = createServiceClient();

    // Fetch the lead to get assigned agent
    const { data: lead, error: leadError } = await db
      .from("sales_leads")
      .select("id, business_name, assigned_agent_id")
      .eq("id", leadId)
      .maybeSingle();

    if (leadError || !lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    if (!lead.assigned_agent_id) {
      return NextResponse.json({ error: "Lead not assigned to agent" }, { status: 400 });
    }

    // Fetch agent profile
    const { data: agentProfile } = await db
      .from("profiles")
      .select("id, full_name, metadata")
      .eq("id", lead.assigned_agent_id)
      .maybeSingle();

    if (!agentProfile) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Log the alert as a sales event
    await db.from("sales_events").insert({
      agent_id: lead.assigned_agent_id,
      lead_id: leadId,
      action_type: "message_sent",
      channel: "sms",
      message: `ALERT: Hot lead "${lead.business_name}" replied — check now!`,
      metadata: { alert_type: "hot_lead_alert" },
    });

    // TODO: Send SMS to agent via Twilio
    // This would require the agent's phone number from metadata or profiles table
    // For now, we log the alert and return success

    return NextResponse.json({
      ok: true,
      message: `Alert sent to agent ${agentProfile.full_name}`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[sales alert] error:`, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
