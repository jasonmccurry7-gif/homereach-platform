import { createServiceClient } from "@/lib/supabase/service";
import { requireAdminOrSalesAgent } from "@/lib/auth/api-guards";
import { NextResponse } from "next/server";
import {
  auditDeliverabilityCopy,
  buildOutreachSourceAttribution,
  buildOutreachThrottleStatus,
  scoreNextBestAction,
  type GovernedOutreachChannel,
} from "@/lib/sales-engine/outreach-governance";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/sales/todays-tasks
// Returns today's task queue for the authenticated agent.
// All messages use the agent's real identity — NO hardcoded names.
// Leads are filtered to the agent's assigned cities.
// 20 SMS + 20 Email per assigned city (scales with territory).
// ─────────────────────────────────────────────────────────────────────────────

const TASKS_PER_CITY = 20; // 20 SMS + 20 email per city

// ─── Agent identity type ──────────────────────────────────────────────────────
interface AgentIdentity {
  first_name:   string;
  full_name:    string;
  from_email:   string;
  twilio_phone: string;
  from_name:    string;
  phone_display: string; // formatted for signatures
}

// ─── Message templates (all dynamic — zero hardcoded names) ──────────────────

function smsDraft(
  agent: AgentIdentity,
  businessName: string,
  city: string,
  category: string,
  contactName?: string | null
): string {
  const first = contactName?.split(" ")[0] ?? null;
  const hi  = first ? `Hi ${first}` : "Hi there";
  const loc = city || "your area";
  const me  = agent.first_name;

  const templates: Record<string, string> = {
    "Restaurant & Food":
      `${hi}, I'm ${me} with HomeReach. We help local restaurants stay visible with nearby homeowners through reviewed postcard campaigns in ${loc}. Want the simple coverage details? Reply YES or STOP to opt out.`,
    "Home Services":
      `${hi}, ${me} with HomeReach. We help home service businesses keep a clear local presence with homeowners in ${loc}. Want me to send the coverage option? Reply YES or STOP to opt out.`,
    "Health & Wellness":
      `${hi}, I'm ${me} with HomeReach. We help wellness businesses stay easy to remember in their local market through postcard campaigns in ${loc}. Want details? Reply YES or STOP to opt out.`,
    "Automotive":
      `${hi}, ${me} with HomeReach. We help auto shops put a clean local message in front of nearby homeowners in ${loc}. Want the short breakdown? Reply YES or STOP to opt out.`,
    "Real Estate":
      `${hi}, I'm ${me} with HomeReach. We help real estate professionals stay visible with homeowners in ${loc} through reviewed postcard campaigns. Want the simple option? Reply YES or STOP to opt out.`,
    "Cleaning Services":
      `${hi}, ${me} with HomeReach. We help cleaning businesses keep a local presence with homeowners in ${loc}. Want me to send the campaign overview? Reply YES or STOP to opt out.`,
    "Plumbing":
      `${hi}, ${me} from HomeReach. We help plumbers stay visible with local homeowners before a repair is urgent. Want the ${loc} coverage details? Reply YES or STOP to opt out.`,
    "HVAC":
      `${hi}, ${me} with HomeReach. We help HVAC businesses stay remembered by homeowners in ${loc} without adding another complex ad channel. Want details? Reply YES or STOP to opt out.`,
    "Roofing":
      `${hi}, ${me} with HomeReach. We help roofing companies keep a trusted local presence with homeowners in ${loc}. Want the simple campaign breakdown? Reply YES or STOP to opt out.`,
    "Landscaping":
      `${hi}, ${me} with HomeReach. We help landscaping businesses stay visible as homeowners plan local projects in ${loc}. Want the coverage details? Reply YES or STOP to opt out.`,
  };

  return (
    templates[category] ??
    `${hi}, I'm ${me} with HomeReach. We help local businesses like ${businessName} stay visible with homeowners in ${loc}. Want the simple coverage details? Reply YES or STOP to opt out.`
  );
}

function emailDraft(
  agent: AgentIdentity,
  businessName: string,
  city: string,
  category: string,
  contactName?: string | null
): { subject: string; body: string } {
  const first    = contactName?.split(" ")[0] ?? null;
  const greeting = first ? `Hi ${first},` : "Hi there,";
  const loc      = city || "your area";
  const subject  = `Local visibility option for ${businessName} in ${loc}`;

  const body = `${greeting}

My name is ${agent.full_name} with HomeReach. We help local businesses stay visible with homeowners in ${loc} through reviewed direct-mail postcard campaigns.

The goal is simple: a clear local message, a clean next step, and less marketing complexity for the owner. I noticed ${businessName} and thought the ${category || "local business"} category may be worth reviewing.

Would you have 10 minutes this week for a quick call? I can walk you through coverage, format, and current pricing so you can decide if it is useful.

${agent.full_name}
HomeReach
${agent.phone_display} | home-reach.com`;

  return { subject, body };
}

function fbDmDraft(
  agent: AgentIdentity,
  businessName: string,
  city: string,
  contactName?: string | null
): string {
  const first = contactName?.split(" ")[0] ?? null;
  const hi    = first ? `Hi ${first}!` : "Hi there!";
  const loc   = city || "your area";

  return `${hi} My name is ${agent.first_name} and I'm with HomeReach. We help local businesses stay visible with homeowners in the ${loc} area through reviewed postcard campaigns. I came across ${businessName} and wanted to see if a simple coverage overview would be useful.`;
}

function followUpSmsDraft(
  agent: AgentIdentity,
  businessName: string,
  city: string,
  daysSince: number,
  contactName?: string | null
): string {
  const first = contactName?.split(" ")[0] ?? null;
  const hi    = first ? `Hi ${first}` : "Hi";
  const loc   = city || "your area";
  const days  = daysSince === 1 ? "yesterday" : `${daysSince} days ago`;

  return `${hi}, quick follow-up on my note from ${days} about HomeReach postcard visibility in ${loc}. Should I send the simple coverage details or close the loop? Reply YES or STOP to opt out. ${agent.first_name}`;
}

function followUpEmailDraft(
  agent: AgentIdentity,
  businessName: string,
  city: string,
  daysSince: number,
  contactName?: string | null
): { subject: string; body: string } {
  const first    = contactName?.split(" ")[0] ?? null;
  const greeting = first ? `Hi ${first},` : "Hi there,";
  const loc      = city || "your area";

  return {
    subject: `Following up on ${businessName} in ${loc}`,
    body:    `${greeting}

I wanted to follow up on my previous note about HomeReach's postcard campaigns in ${loc}.

I know things get busy, and I do not want to add noise. If local visibility is still worth reviewing, I can send the simple coverage and cost breakdown.

Would you like me to send that over, or should I close the loop for now?

${agent.full_name}
HomeReach | ${agent.phone_display}`,
  };
}

function replyResponseDraft(
  agent: AgentIdentity,
  businessName: string,
  city: string,
  contactName?: string | null
): string {
  const first = contactName?.split(" ")[0] ?? null;
  const hi    = first ? `Hi ${first}` : "Hi";
  const loc   = city || "your area";

  return `${hi}! Thanks for getting back to me. I can keep this simple: HomeReach helps local businesses stay visible with homeowners in ${loc}. Want me to send coverage and pricing details, or would a quick call be easier? ${agent.first_name}`;
}

// ─── Format phone for signature (e.g. +13302069639 -> (330) 206-9639) ─────────
function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const d = digits.length === 11 ? digits.slice(1) : digits;
  if (d.length === 10) return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
  return raw;
}

function buildDraftGovernance(input: {
  lead: any;
  channel: GovernedOutreachChannel;
  body: string;
  subject?: string | null;
  workflow: string;
  templateId: string;
  destination?: string | null;
}) {
  const nextBestAction = scoreNextBestAction(input.lead, {
    channel: input.channel,
    defaultAction: "Prepare approval-ready outreach draft",
  });
  const deliverability = auditDeliverabilityCopy(
    input.subject ? `${input.subject}\n\n${input.body}` : input.body,
    input.channel,
  );
  const sourceAttribution = buildOutreachSourceAttribution({
    workflow: input.workflow,
    channel: input.channel,
    lead: input.lead,
    destination: input.destination ?? null,
    templateId: input.templateId,
    action: nextBestAction.action,
    nextAction: nextBestAction.action,
    sources: ["sales_events", "agent_identities", "system_controls"],
  });

  return {
    approval: {
      required: true,
      status: "needs_review" as const,
      reason: "Human approval is required before sending, posting, scheduling, or changing campaign state.",
    },
    source_attribution: sourceAttribution,
    next_best_action: nextBestAction,
    deliverability,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const guard = await requireAdminOrSalesAgent();
    if (!guard.ok) return guard.response;
    const user = guard.user;
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const isSalesAgent = user.app_metadata?.user_role === "sales_agent";

    const db = createServiceClient();

    const url             = new URL(request.url);
    const agentIdOverride = url.searchParams.get("agent_id");
    const effectiveUserId = isSalesAgent ? user.id : (agentIdOverride ?? user.id);

    // ── Load agent profile ────────────────────────────────────────────────────
    const { data: profile } = await db
      .from("profiles")
      .select("id, full_name, role")
      .eq("id", effectiveUserId)
      .maybeSingle();

    // ── Load agent identity (sending credentials) ─────────────────────────────
    const { data: identityRow } = await db
      .from("agent_identities")
      .select("from_email, from_name, twilio_phone, is_active")
      .eq("agent_id", effectiveUserId)
      .maybeSingle();

    // Build resolved identity — NEVER fall back to Jason
    const agentFullName  = profile?.full_name ?? "HomeReach Agent";
    const agentFirstName = agentFullName.split(" ")[0];
    const agentPhone     = identityRow?.twilio_phone ?? process.env.TWILIO_PHONE_NUMBER ?? "";
    const agentEmail     = identityRow?.from_email   ?? process.env.MAILGUN_FROM_EMAIL ?? "";

    const agent: AgentIdentity = {
      first_name:    agentFirstName,
      full_name:     agentFullName,
      from_email:    agentEmail,
      from_name:     identityRow?.from_name ?? agentFullName,
      twilio_phone:  agentPhone,
      phone_display: formatPhone(agentPhone),
    };

    // ── Load agent's assigned cities ──────────────────────────────────────────
    const { data: territories } = await db
      .from("agent_territories")
      .select("city")
      .eq("agent_id", effectiveUserId);

    // If agent has assigned cities, filter leads to those cities only.
    // Admins with no territory assignment see all leads.
    const assignedCities = territories?.map(t => t.city).filter(Boolean) ?? [];
    const hasTerritories = assignedCities.length > 0;

    const now        = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    // ── Per-city task budget (20 per city per channel) ────────────────────────
    // If agent has territories: fetch TASKS_PER_CITY leads per city per channel
    // If no territories (admin): fetch up to 200 total
    const totalCap = hasTerritories
      ? assignedCities.length * TASKS_PER_CITY
      : 200;

    // ── Build base query with city filter ────────────────────────────────────
    const cityFilter = (query: any) => {
      let scopedQuery = query as any;
      if (hasTerritories) {
        scopedQuery = scopedQuery.in("city", assignedCities);
      }
      if (isSalesAgent) {
        scopedQuery = scopedQuery.or(`assigned_agent_id.is.null,assigned_agent_id.eq.${effectiveUserId}`);
      }
      return scopedQuery;
    };

    // ── Parallel data fetch ───────────────────────────────────────────────────
    const [
      { data: replyLeads },
      { data: followUpLeads },
      { data: textLeads },
      { data: emailLeads },
      { data: fbDmLeads },
      { data: todayEvents },
      { data: systemControls },
    ] = await Promise.all([
      // Replies — need response
      cityFilter(db.from("sales_leads").select("*")
        .eq("status", "replied")
        .eq("do_not_contact", false)
        .order("last_reply_at", { ascending: true })
        .limit(50)),

      // Follow-ups due
      cityFilter(db.from("sales_leads").select("*")
        .lte("next_follow_up_at", now.toISOString())
        .not("next_follow_up_at", "is", null)
        .eq("do_not_contact", false)
        .not("status", "in", "(closed,dead)")
        .order("next_follow_up_at", { ascending: true })
        .limit(50)),

      // SMS outreach — 20 per city
      cityFilter(db.from("sales_leads").select("*")
        .eq("status", "queued")
        .eq("do_not_contact", false)
        .eq("sms_opt_out", false)
        .not("phone", "is", null)
        .not("phone", "eq", "")
        .order("buying_signal", { ascending: false })
        .order("score", { ascending: false })
        .limit(totalCap)),

      // Email outreach — 20 per city
      cityFilter(db.from("sales_leads").select("*")
        .eq("status", "queued")
        .eq("do_not_contact", false)
        .not("email", "is", null)
        .not("email", "eq", "")
        .order("buying_signal", { ascending: false })
        .order("score", { ascending: false })
        .limit(totalCap)),

      // Facebook DMs
      cityFilter(db.from("sales_leads").select("*")
        .in("status", ["queued", "contacted"])
        .eq("do_not_contact", false)
        .not("facebook_url", "is", null)
        .not("facebook_url", "eq", "")
        .order("score", { ascending: false })
        .limit(hasTerritories ? assignedCities.length * 10 : 50)),

      // Today's events for this agent
      db.from("sales_events")
        .select("action_type, lead_id, revenue_cents, channel")
        .eq("agent_id", effectiveUserId)
        .gte("created_at", todayStart.toISOString()),

      db.from("system_controls")
        .select("daily_sms_cap, daily_email_cap_per_sender, automation_batch_limit, manual_approval_mode")
        .eq("id", 1)
        .maybeSingle(),
    ]);

    // ── Build tasks with AGENT-SPECIFIC messages ──────────────────────────────

    const replies = (replyLeads ?? []).map((lead: any) => {
      const suggestedResponse = replyResponseDraft(agent, lead.business_name, lead.city ?? "", lead.contact_name);
      return {
        lead,
        last_reply_at:     lead.last_reply_at,
        suggested_response: suggestedResponse,
        ...buildDraftGovernance({
          lead,
          channel: lead.phone ? "sms" : "email",
          body: suggestedResponse,
          workflow: "admin_sales_todays_tasks_reply",
          templateId: "reply_response_safe_v2",
          destination: lead.phone ?? lead.email ?? null,
        }),
      };
    });

    const followups = (followUpLeads ?? []).map((lead: any) => {
      const lastContacted = lead.last_contacted_at ? new Date(lead.last_contacted_at) : null;
      const daysSince     = lastContacted
        ? Math.max(1, Math.floor((now.getTime() - lastContacted.getTime()) / 86_400_000))
        : 3;
      const hasPhone = !!(lead.phone?.trim());
      const draft    = hasPhone
        ? { body: followUpSmsDraft(agent, lead.business_name, lead.city ?? "", daysSince, lead.contact_name) }
        : followUpEmailDraft(agent, lead.business_name, lead.city ?? "", daysSince, lead.contact_name);

      return {
        lead,
        draft,
        channel: (hasPhone ? "sms" : "email") as "sms" | "email",
        days_since: daysSince,
        overdue:    lead.next_follow_up_at ? new Date(lead.next_follow_up_at) < now : false,
        ...buildDraftGovernance({
          lead,
          channel: hasPhone ? "sms" : "email",
          body: draft.body,
          subject: "subject" in draft ? draft.subject : null,
          workflow: "admin_sales_todays_tasks_followup",
          templateId: hasPhone ? "followup_sms_safe_v2" : "followup_email_safe_v2",
          destination: hasPhone ? lead.phone : lead.email,
        }),
      };
    });

    const texts        = (textLeads ?? []).map((lead: any) => {
      const draft = { body: smsDraft(agent, lead.business_name, lead.city ?? "", lead.category ?? "", lead.contact_name) };
      return {
        lead,
        draft,
        ...buildDraftGovernance({
          lead,
          channel: "sms",
          body: draft.body,
          workflow: "admin_sales_todays_tasks_first_touch_sms",
          templateId: "first_touch_sms_safe_v2",
          destination: lead.phone ?? null,
        }),
      };
    });

    const emails       = (emailLeads ?? []).map((lead: any) => {
      const draft = emailDraft(agent, lead.business_name, lead.city ?? "", lead.category ?? "", lead.contact_name);
      return {
        lead,
        draft,
        ...buildDraftGovernance({
          lead,
          channel: "email",
          body: draft.body,
          subject: draft.subject,
          workflow: "admin_sales_todays_tasks_first_touch_email",
          templateId: "first_touch_email_safe_v2",
          destination: lead.email ?? null,
        }),
      };
    });

    const facebook_dms = (fbDmLeads ?? []).map((lead: any) => {
      const draft = { body: fbDmDraft(agent, lead.business_name, lead.city ?? "", lead.contact_name) };
      return {
        lead,
        draft,
        ...buildDraftGovernance({
          lead,
          channel: "facebook_dm",
          body: draft.body,
          workflow: "admin_sales_todays_tasks_facebook_dm",
          templateId: "facebook_dm_safe_v2",
          destination: lead.facebook_url ?? null,
        }),
      };
    });

    // Group posts — use agent name, show only assigned cities
    const targetCities = hasTerritories ? assignedCities : ["Wooster", "Medina", "Massillon", "Cuyahoga Falls"];
    const group_posts  = targetCities.slice(0, 4).map(city => {
      const postCopy = `Hey ${city} business owners, HomeReach helps local companies stay visible with nearby homeowners through reviewed postcard campaigns. If you want the simple coverage and pricing overview for ${city}, comment or visit home-reach.com. ${agent.full_name}`;
      const leadContext = {
        id: `group-post-${city.toLowerCase().replace(/\s+/g, "_")}`,
        business_name: `${city} business owners`,
        city,
        category: "Local businesses",
      };
      return {
        id:           `gp_${city.toLowerCase().replace(/\s+/g, "_")}`,
        group_name:   `${city} Ohio Community Board`,
        city,
        post_copy:    postCopy,
        scheduled_for: null,
        ...buildDraftGovernance({
          lead: leadContext,
          channel: "facebook",
          body: postCopy,
          workflow: "admin_sales_todays_tasks_facebook_group_post",
          templateId: "facebook_group_post_safe_v2",
          destination: `${city} Ohio Community Board`,
        }),
      };
    });

    // ── Today's stats (correct action_type mapping) ───────────────────────────
    const events         = todayEvents ?? [];
    const smsSentToday   = events.filter(e => e.action_type === "text_sent"     || (e.action_type === "follow_up_sent" && e.channel === "sms")).length;
    const emailSentToday = events.filter(e => e.action_type === "email_sent"    || (e.action_type === "follow_up_sent" && e.channel === "email")).length;
    const fbSentToday    = events.filter(e => e.action_type === "facebook_sent").length;
    const sentToday      = smsSentToday + emailSentToday + fbSentToday;
    const dealsToday     = events.filter(e => e.action_type === "deal_closed").length;
    const revenueToday   = events.filter(e => e.action_type === "deal_closed").reduce((s, e) => s + (e.revenue_cents ?? 0), 0);

    const totalTasks = replies.length + followups.length + texts.length + emails.length + facebook_dms.length + group_posts.length;
    const smsDailyCap = Number(systemControls?.daily_sms_cap ?? 30);
    const emailDailyCap = Number(systemControls?.daily_email_cap_per_sender ?? 30);
    const automationBatchLimit = Number(systemControls?.automation_batch_limit ?? 10);
    const smsRequested = texts.length + followups.filter((task: { channel: string }) => task.channel === "sms").length;
    const emailRequested = emails.length + followups.filter((task: { channel: string }) => task.channel === "email").length;
    const facebookRequested = facebook_dms.length + group_posts.length;
    const throttle = {
      sms: buildOutreachThrottleStatus({
        channel: "sms",
        cap: Number.isFinite(smsDailyCap) ? smsDailyCap : 30,
        sentToday: smsSentToday,
        requested: smsRequested,
      }),
      email: buildOutreachThrottleStatus({
        channel: "email",
        cap: Number.isFinite(emailDailyCap) ? emailDailyCap : 30,
        sentToday: emailSentToday,
        requested: emailRequested,
      }),
      facebook: buildOutreachThrottleStatus({
        channel: "facebook",
        cap: Number.isFinite(automationBatchLimit) ? automationBatchLimit : 10,
        sentToday: fbSentToday,
        requested: facebookRequested,
      }),
    };

    return NextResponse.json({
      date: now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
      agent: {
        id:            effectiveUserId,
        name:          agent.full_name,
        first_name:    agent.first_name,
        email:         agent.from_email,
        phone:         agent.phone_display,
        assigned_cities: assignedCities,
      },
      sections: { replies, followups, texts, emails, facebook_dms, group_posts },
      totals: {
        total_tasks:         totalTasks,
        sent_today:          sentToday,
        sms_sent_today:      smsSentToday,
        email_sent_today:    emailSentToday,
        fb_sent_today:       fbSentToday,
        deals_today:         dealsToday,
        revenue_today_cents: revenueToday,
      },
      targets: {
        sms_daily:   throttle.sms.cap,
        email_daily: throttle.email.cap,
        facebook_review_batch: throttle.facebook.cap,
      },
      throttle,
      approval_policy: {
        outbound_status: "needs_review",
        manual_approval_mode: Boolean(systemControls?.manual_approval_mode),
        note: "Tasks are drafts only. Human approval is required before SMS, email, Facebook DM, or group post use.",
      },
    });
  } catch (err) {
    console.error("[todays-tasks] error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
