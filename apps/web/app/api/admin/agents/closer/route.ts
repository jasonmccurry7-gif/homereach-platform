import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// ─────────────────────────────────────────────────────────────────────────────
// Closer Agent — Follow-up & Payment Link Delivery
// POST /api/admin/agents/closer
//
// Identifies warm leads showing interest and sends payment/conversion messages
// with exclusive link to get started.
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CloserLead {
  id: string;
  business_name: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  assigned_agent_id: string | null;
  status: "replied" | "interested";
  last_reply_at: string | null;
}

interface AgentIdentity {
  name: string;
  email: string;
  phone: string;
}

interface CloserResult {
  success: boolean;
  summary: {
    leads_processed: number;
    follow_ups_sent: number;
    payment_links_sent: number;
    errors: number;
  };
  details?: Array<{
    lead_id: string;
    status: "sent" | "skipped" | "error";
    reason?: string;
  }>;
}

// ─── Territory → Agent Mapping (Hardcoded Fallback) ────────────────────────────

const TERRITORY_AGENT_MAP: Record<string, AgentIdentity> = {
  "Wooster": { name: "Heather", email: "heather@home-reach.com", phone: "+13306626331" },
  "Medina": { name: "Heather", email: "heather@home-reach.com", phone: "+13306626331" },
  "Massillon": { name: "Josh", email: "josh@home-reach.com", phone: "+13304224396" },
  "Ravenna": { name: "Josh", email: "josh@home-reach.com", phone: "+13304224396" },
  "Green": { name: "Chris", email: "chris@home-reach.com", phone: "+13305949713" },
  "Stow": { name: "Chris", email: "chris@home-reach.com", phone: "+13305949713" },
  "Cuyahoga Falls": { name: "Jason", email: "jason@home-reach.com", phone: "+13303044916" },
  "Hudson": { name: "Jason", email: "jason@home-reach.com", phone: "+13303044916" },
  "Canton": { name: "Jason", email: "jason@home-reach.com", phone: "+13303044916" },
  "Akron": { name: "Jason", email: "jason@home-reach.com", phone: "+13303044916" },
};

const DEFAULT_AGENT: AgentIdentity = {
  name: "Jason",
  email: "jason@home-reach.com",
  phone: "+13303044916",
};

// ─── Helper: Resolve Agent Identity ───────────────────────────────────────────

async function resolveAgentIdentity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  lead: CloserLead
): Promise<AgentIdentity> {
  // Try agent_identities table first
  if (lead.assigned_agent_id) {
    try {
      const { data } = await supabase
        .from("agent_identities")
        .select("from_name, from_email, twilio_phone")
        .eq("agent_id", lead.assigned_agent_id)
        .eq("is_active", true)
        .single()
        .catch(() => ({ data: null }));

      if (data) {
        return {
          name: data.from_name || "HomeReach",
          email: data.from_email || DEFAULT_AGENT.email,
          phone: data.twilio_phone || DEFAULT_AGENT.phone,
        };
      }
    } catch (err) {
      console.log("[closer] agent_identities lookup failed, using territory map");
    }
  }

  // Fall back to territory map
  if (lead.city) {
    return TERRITORY_AGENT_MAP[lead.city] || DEFAULT_AGENT;
  }

  return DEFAULT_AGENT;
}

// ─── Helper: Check if payment link already sent recently ──────────────────────

async function hasRecentPaymentLink(
  supabase: Awaited<ReturnType<typeof createClient>>,
  leadId: string
): Promise<boolean> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from("sales_events")
    .select("id")
    .eq("lead_id", leadId)
    .eq("action_type", "payment_link_created")
    .gte("created_at", sevenDaysAgo)
    .limit(1)
    .single()
    .catch(() => ({ data: null }));

  return !!data;
}

// ─── Helper: Send via /api/admin/sales/event ─────────────────────────────────

async function sendFollowUp(
  supabase: Awaited<ReturnType<typeof createClient>>,
  lead: CloserLead,
  agent: AgentIdentity
): Promise<{ success: boolean; error?: string }> {
  try {
    const message = `Hi ${lead.business_name}! This is ${agent.name} from HomeReach. Ready to lock in your exclusive ${lead.city || "your area"} spot? Here's your link: https://home-reach.com/get-started Reply STOP to opt out.`;

    const payload = {
      agent_id: lead.assigned_agent_id,
      lead_id: lead.id,
      action_type: "follow_up_sent",
      channel: "sms",
      city: lead.city,
      message,
    };

    const response = await fetch(
      `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/admin/sales/event`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return {
        success: false,
        error: `Event endpoint returned ${response.status}: ${error}`,
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
  const details: CloserResult["summary"] = {
    leads_processed: 0,
    follow_ups_sent: 0,
    payment_links_sent: 0,
    errors: 0,
  };

  const detailLog: CloserResult["details"] = [];

  try {
    // 1. Fetch warm leads (replied or interested, with recent activity)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    const { data: leads, error: leadsError } = await supabase
      .from("sales_leads")
      .select(
        `
        id,
        business_name,
        phone,
        email,
        city,
        assigned_agent_id,
        status,
        last_reply_at
        `
      )
      .in("status", ["replied", "interested"])
      .gte("last_reply_at", twoHoursAgo)
      .eq("do_not_contact", false)
      .eq("sms_opt_out", false)
      .order("last_reply_at", { ascending: false })
      .limit(50);

    if (leadsError) {
      throw new Error(`Failed to fetch leads: ${leadsError.message}`);
    }

    if (!leads || leads.length === 0) {
      return NextResponse.json({
        success: true,
        summary: details,
        message: "No warm leads to follow up",
      });
    }

    // 2. Process each lead
    for (const lead of leads) {
      const typedLead = lead as CloserLead;
      details.leads_processed++;

      try {
        // Check if we already sent a payment link in the last 7 days
        const hasRecent = await hasRecentPaymentLink(supabase, typedLead.id);
        if (hasRecent) {
          detailLog.push({
            lead_id: typedLead.id,
            status: "skipped",
            reason: "Payment link sent in last 7 days",
          });
          continue;
        }

        // Verify phone exists for SMS
        if (!typedLead.phone) {
          details.errors++;
          detailLog.push({
            lead_id: typedLead.id,
            status: "error",
            reason: "No phone number for SMS",
          });
          continue;
        }

        // Resolve agent
        const agent = await resolveAgentIdentity(supabase, typedLead);

        // Send follow-up
        const result = await sendFollowUp(supabase, typedLead, agent);

        if (result.success) {
          details.follow_ups_sent++;
          details.payment_links_sent++;
          detailLog.push({
            lead_id: typedLead.id,
            status: "sent",
          });
        } else {
          details.errors++;
          detailLog.push({
            lead_id: typedLead.id,
            status: "error",
            reason: result.error,
          });
        }
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        console.error(`[closer] error processing lead ${typedLead.id}:`, error);
        details.errors++;
        detailLog.push({
          lead_id: typedLead.id,
          status: "error",
          reason: error,
        });
      }
    }

    return NextResponse.json({
      success: true,
      summary: details,
      details: detailLog,
    } as CloserResult);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[closer] fatal error:", error);
    return NextResponse.json(
      { success: false, error, summary: details },
      { status: 500 }
    );
  }
}

// ─── GET Handler: Closer Status ───────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient();

    // Count warm leads
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    const { count: warmCount } = await supabase
      .from("sales_leads")
      .select("id", { count: "exact" })
      .in("status", ["replied", "interested"])
      .gte("last_reply_at", twoHoursAgo)
      .eq("do_not_contact", false)
      .eq("sms_opt_out", false);

    return NextResponse.json({
      status: "operational",
      warm_leads_ready: warmCount ?? 0,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[closer] status check failed:", error);
    return NextResponse.json(
      { status: "error", error },
      { status: 500 }
    );
  }
}
