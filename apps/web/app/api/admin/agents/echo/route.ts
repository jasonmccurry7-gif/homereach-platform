import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// ─────────────────────────────────────────────────────────────────────────────
// Echo Agent — Outbound Sales Messaging Engine
// POST /api/admin/agents/echo
//
// Routes leads to agents based on territory assignment, determines channel
// (SMS or Email), builds personalized messages, and sends directly via
// Twilio SMS and Mailgun Email APIs without internal HTTP calls.
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
  score?: number;
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

// ─── Helper: Send SMS via Twilio REST API ─────────────────────────────────

async function sendViaTwilio(
  toPhone: string,
  fromPhone: string,
  body: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      return {
        success: false,
        error: "TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN not configured",
      };
    }

    const form = new URLSearchParams();
    form.append("To", toPhone);
    form.append("From", fromPhone);
    form.append("Body", body);

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

    const response = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `Twilio error ${response.status}: ${errorText}`,
      };
    }

    const data = (await response.json()) as { sid?: string };
    return { success: true, messageId: data.sid };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, error };
  }
}

// ─── Helper: Send Email via Mailgun REST API ──────────────────────────────

async function sendViaMailgun(
  toEmail: string,
  fromEmail: string,
  fromName: string,
  subject: string,
  text: string,
  html?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const apiKey = process.env.MAILGUN_API_KEY;
    const domain = process.env.MAILGUN_DOMAIN;

    if (!apiKey || !domain) {
      return {
        success: false,
        error: "MAILGUN_API_KEY or MAILGUN_DOMAIN not configured",
      };
    }

    const form = new URLSearchParams();
    form.append("from", `${fromName} <${fromEmail}>`);
    form.append("to", toEmail);
    form.append("subject", subject);
    form.append("text", text);
    if (html) {
      form.append("html", html);
    }

    const auth = Buffer.from(`api:${apiKey}`).toString("base64");

    const response = await fetch(
      `https://api.mailgun.net/v3/${domain}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `Mailgun error ${response.status}: ${errorText}`,
      };
    }

    const data = (await response.json()) as { id?: string };
    return { success: true, messageId: data.id };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, error };
  }
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

export async function POST() {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  const details: EchoResult["summary"] = {
    leads_processed: 0,
    sms_sent: 0,
    emails_sent: 0,
    errors: 0,
  };

  const detailLog: EchoResult["details"] = [];

  try {
    supabase = await createClient();

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
        assigned_agent_id,
        score
        `
      )
      .eq("status", "queued")
      .eq("do_not_contact", false)
      .eq("sms_opt_out", false)
      .order("score", { ascending: false }) // highest quality leads first
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
        let emailHtml: string | undefined;

        if (channel === "sms") {
          message = buildSmsMessage(
            typedLead.business_name,
            agent.name,
            typedLead.category || "local",
            typedLead.city || "your area"
          );
          // Add STOP message if not present
          if (!message.includes("STOP")) {
            message = `${message}\n\nReply STOP to unsubscribe.`;
          }
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
          // Build HTML version
          emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px;">
              <p>${message.replace(/\n/g, "<br>")}</p>
              <hr style="margin-top: 30px; border: none; border-top: 1px solid #eee;">
              <p style="color: #999; font-size: 12px;">
                You're receiving this because your business was identified as a match for HomeReach advertising.
                <a href="https://home-reach.com/unsubscribe?email=${encodeURIComponent(typedLead.email || "")}">Unsubscribe</a>
              </p>
            </div>
          `;
        }

        // Send directly via Twilio or Mailgun
        let sendResult: { success: boolean; messageId?: string; error?: string };

        if (channel === "sms") {
          sendResult = await sendViaTwilio(
            typedLead.phone!,
            agent.phone,
            message
          );
        } else {
          sendResult = await sendViaMailgun(
            typedLead.email!,
            agent.email,
            agent.name,
            emailSubject!,
            message,
            emailHtml
          );
        }

        if (sendResult.success) {
          // Log to sales_events
          try {
            await supabase.from("sales_events").insert({
              lead_id: typedLead.id,
              action_type: channel === "sms" ? "text_sent" : "email_sent",
              channel,
              message,
              ...(channel === "email" && emailSubject
                ? { metadata: { subject: emailSubject } }
                : {}),
            });
          } catch (logErr) {
            console.error(`[echo] failed to log event for lead ${typedLead.id}:`, logErr);
          }

          // Update lead status
          try {
            await supabase
              .from("sales_leads")
              .update({
                status: "contacted",
                pipeline_stage: "contacted",
                last_contacted_at: new Date().toISOString(),
              })
              .eq("id", typedLead.id);
          } catch (updateErr) {
            console.error(`[echo] failed to update lead ${typedLead.id}:`, updateErr);
          }

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
