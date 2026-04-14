import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// ─────────────────────────────────────────────────────────────────────────────
// Echo Agent — Outbound Sales Messaging Engine
// POST /api/admin/agents/echo
//
// Routes leads to agents based on territory assignment, determines channel
// (SMS or Email), builds personalized messages, and sends via /api/admin/sales/event
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgentIdentity {
  id: string;
  name: string;
  email: string;
  phone: string;
}

interface EchoLead {
  id: string;
  business_name: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  category: string | null;
  assigned_agent_id: string | null;
}

interface EchoResult {
  success: boolean;
  summary: {
    leads_processed: number;
    sms_sent: number;
    emails_sent: number;
    errors: number;
  };
  details?: Array<{
    lead_id: string;
    status: "sent" | "error";
    channel: "sms" | "email";
    error?: string;
  }>;
}

// ─── Territory → Agent Mapping (Hardcoded Fallback) ────────────────────────────

const TERRITORY_AGENT_MAP: Record<string, AgentIdentity> = {
  // Heather's territory
  "Wooster": {
    id: "heather-agent-id",
    name: "Heather",
    email: "heather@home-reach.com",
    phone: "+13306626331",
  },
  "Medina": {
    id: "heather-agent-id",
    name: "Heather",
    email: "heather@home-reach.com",
    phone: "+13306626331",
  },
  // Josh's territory
  "Massillon": {
    id: "josh-agent-id",
    name: "Josh",
    email: "josh@home-reach.com",
    phone: "+13304224396",
  },
  "Ravenna": {
    id: "josh-agent-id",
    name: "Josh",
    email: "josh@home-reach.com",
    phone: "+13304224396",
  },
  // Chris's territory
  "Green": {
    id: "chris-agent-id",
    name: "Chris",
    email: "chris@home-reach.com",
    phone: "+13305949713",
  },
  "Stow": {
    id: "chris-agent-id",
    name: "Chris",
    email: "chris@home-reach.com",
    phone: "+13305949713",
  },
  // Jason's territory (largest)
  "Cuyahoga Falls": {
    id: "jason-agent-id",
    name: "Jason",
    email: "jason@home-reach.com",
    phone: "+13303044916",
  },
  "Hudson": {
    id: "jason-agent-id",
    name: "Jason",
    email: "jason@home-reach.com",
    phone: "+13303044916",
  },
  "Canton": {
    id: "jason-agent-id",
    name: "Jason",
    email: "jason@home-reach.com",
    phone: "+13303044916",
  },
  "Akron": {
    id: "jason-agent-id",
    name: "Jason",
    email: "jason@home-reach.com",
    phone: "+13303044916",
  },
};

// Default agent (Jason) for unmapped cities
const DEFAULT_AGENT: AgentIdentity = {
  id: "jason-agent-id",
  name: "Jason",
  email: "jason@home-reach.com",
  phone: "+13303044916",
};

// ─── SMS & Email Templates ────────────────────────────────────────────────────

function buildSmsMessage(
  businessName: string,
  agentName: string,
  category: string,
  city: string
): string {
  const base = `Hi ${businessName}! I'm ${agentName} with HomeReach — we help local ${category} businesses get in front of homeowners in ${city} via direct mail. Interested? Reply YES.`;

  // Keep under 160 chars (including STOP message added by /api/admin/sales/event)
  if (base.length > 140) {
    return base.substring(0, 140);
  }
  return base;
}

function buildEmailSubject(city: string, category: string): string {
  return `Exclusive ${city} ${category} spot — HomeReach`;
}

function buildEmailBody(
  businessName: string,
  agentName: string,
  category: string,
  city: string,
  agentPhone: string,
  agentEmail: string
): string {
  return `Hi ${businessName},

My name is ${agentName} and I help ${category} businesses in ${city} grow through targeted direct mail to homeowners.

We have one exclusive spot remaining for a ${category} business in ${city}. Once it's taken, no other ${category} business in the area can advertise through us.

Interested in learning more? Just reply to this email or call me directly.

${agentName}
HomeReach
${agentPhone}
${agentEmail}`;
}

// ─── Helper: Resolve Agent Identity ───────────────────────────────────────────

async function resolveAgentIdentity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  lead: EchoLead
): Promise<AgentIdentity | null> {
  // Try to look up from agent_identities table if assigned_agent_id exists
  if (lead.assigned_agent_id) {
    try {
      // Note: agent_identities table may not exist yet, gracefully fall back
      const { data } = await supabase
        .from("agent_identities")
        .select("from_name, from_email, twilio_phone")
        .eq("agent_id", lead.assigned_agent_id)
        .eq("is_active", true)
        .single()
        .catch(() => ({ data: null }));

      if (data) {
        return {
          id: lead.assigned_agent_id,
          name: data.from_name || "HomeReach",
          email: data.from_email || DEFAULT_AGENT.email,
          phone: data.twilio_phone || DEFAULT_AGENT.phone,
        };
      }
    } catch (err) {
      console.log("[echo] agent_identities lookup failed, using territory map");
    }
  }

  // Fall back to territory map
  if (lead.city) {
    return TERRITORY_AGENT_MAP[lead.city] || DEFAULT_AGENT;
  }

  return DEFAULT_AGENT;
}

// ─── Helper: Send via /api/admin/sales/event ─────────────────────────────────

async function sendOutreachEvent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  lead: EchoLead,
  agent: AgentIdentity,
  channel: "sms" | "email",
  message: string,
  emailSubject?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const payload: Record<string, unknown> = {
      agent_id: agent.id,
      lead_id: lead.id,
      action_type: channel === "sms" ? "text_sent" : "email_sent",
      channel,
      city: lead.city,
      category: lead.category,
      message,
      ...(channel === "email" && emailSubject ? { subject: emailSubject } : {}),
    };

    // Call the sales event endpoint
    const eventResponse = await fetch(
      `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/admin/sales/event`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    if (!eventResponse.ok) {
      const error = await eventResponse.text();
      return {
        success: false,
        error: `Event endpoint returned ${eventResponse.status}: ${error}`,
      };
    }

    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, error };
  }
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

export async function POST() {
  const supabase = await createClient();
  const details: EchoResult["summary"] = {
    leads_processed: 0,
    sms_sent: 0,
    emails_sent: 0,
    errors: 0,
  };

  const detailLog: EchoResult["details"] = [];

  try {
    // 1. Fetch up to 20 queued leads with agent assignment
    const { data: leads, error: leadsError } = await supabase
      .from("sales_leads")
      .select(
        `
        id,
        business_name,
        phone,
        email,
        city,
        category,
        assigned_agent_id
        `
      )
      .eq("status", "queued")
      .not("assigned_agent_id", "is", null)
      .eq("do_not_contact", false)
      .eq("sms_opt_out", false)
      .order("created_at", { ascending: true })
      .limit(20);

    if (leadsError) {
      throw new Error(`Failed to fetch leads: ${leadsError.message}`);
    }

    if (!leads || leads.length === 0) {
      return NextResponse.json({
        success: true,
        summary: details,
        message: "No queued leads to process",
      });
    }

    // 2. Process each lead
    for (const lead of leads) {
      const typedLead = lead as EchoLead;
      details.leads_processed++;

      try {
        // Resolve agent identity
        const agent = await resolveAgentIdentity(supabase, typedLead);
        if (!agent) {
          throw new Error("Could not resolve agent identity");
        }

        // Determine channel: prefer SMS if phone exists, else email
        const channel = typedLead.phone ? "sms" : "email";

        if (channel === "sms" && !typedLead.phone) {
          details.errors++;
          detailLog.push({
            lead_id: typedLead.id,
            status: "error",
            channel: "sms",
            error: "No phone number",
          });
          continue;
        }

        if (channel === "email" && !typedLead.email) {
          details.errors++;
          detailLog.push({
            lead_id: typedLead.id,
            status: "error",
            channel: "email",
            error: "No email address",
          });
          continue;
        }

        // Build message
        let message: string;
        let emailSubject: string | undefined;

        if (channel === "sms") {
          message = buildSmsMessage(
            typedLead.business_name,
            agent.name,
            typedLead.category || "local",
            typedLead.city || "your area"
          );
        } else {
          message = buildEmailBody(
            typedLead.business_name,
            agent.name,
            typedLead.category || "local",
            typedLead.city || "your area",
            agent.phone,
            agent.email
          );
          emailSubject = buildEmailSubject(
            typedLead.city || "your area",
            typedLead.category || "local"
          );
        }

        // Send via /api/admin/sales/event
        const sendResult = await sendOutreachEvent(
          supabase,
          typedLead,
          agent,
          channel,
          message,
          emailSubject
        );

        if (sendResult.success) {
          if (channel === "sms") {
            details.sms_sent++;
          } else {
            details.emails_sent++;
          }
          detailLog.push({
            lead_id: typedLead.id,
            status: "sent",
            channel,
          });
        } else {
          details.errors++;
          detailLog.push({
            lead_id: typedLead.id,
            status: "error",
            channel,
            error: sendResult.error,
          });
        }
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        console.error(`[echo] error processing lead ${typedLead.id}:`, error);
        details.errors++;
        detailLog.push({
          lead_id: typedLead.id,
          status: "error",
          channel: typedLead.phone ? "sms" : "email",
          error,
        });
      }
    }

    // 3. Log agent run
    try {
      await supabase.from("sales_events").insert({
        agent_id: null,
        lead_id: null,
        action_type: "lead_loaded",
        channel: null,
        city: null,
        category: null,
        message: `Echo run: ${details.leads_processed} leads, ${details.sms_sent} SMS, ${details.emails_sent} emails`,
        metadata: { echo_summary: details },
      });
    } catch (logErr) {
      console.error("[echo] failed to log run:", logErr);
    }

    return NextResponse.json({
      success: true,
      summary: details,
      details: detailLog,
    } as EchoResult);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[echo] fatal error:", error);
    return NextResponse.json(
      { success: false, error, summary: details },
      { status: 500 }
    );
  }
}

// ─── GET Handler: Echo Status ─────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient();

    // Count queued leads
    const { count: queuedCount } = await supabase
      .from("sales_leads")
      .select("id", { count: "exact" })
      .eq("status", "queued")
      .not("assigned_agent_id", "is", null)
      .eq("do_not_contact", false)
      .eq("sms_opt_out", false);

    // Get last run from sales_events
    const { data: lastRun } = await supabase
      .from("sales_events")
      .select("created_at, metadata")
      .eq("action_type", "lead_loaded")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    return NextResponse.json({
      status: "operational",
      queue_size: queuedCount ?? 0,
      last_run_at: lastRun?.created_at,
      last_run_summary: lastRun?.metadata,
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[echo] status check failed:", error);
    return NextResponse.json(
      { status: "error", error },
      { status: 500 }
    );
  }
}
