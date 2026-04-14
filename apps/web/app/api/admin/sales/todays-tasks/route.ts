import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

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
      `${hi}, I'm ${me} with HomeReach — we run postcard campaigns targeting thousands of homeowners near your restaurant in ${loc}. Would you be open to a quick chat? Reply YES to learn more or STOP to opt out.`,
    "Home Services":
      `${hi}, ${me} here from HomeReach. We connect home service businesses with local homeowners through targeted postcard ads in ${loc}. Interested? Reply YES or STOP to opt out.`,
    "Health & Wellness":
      `${hi}, I'm ${me} with HomeReach. We run hyper-local postcard campaigns reaching homeowners near your business in ${loc}. Want to hear more? Reply YES or STOP to opt out.`,
    "Automotive":
      `${hi}, ${me} with HomeReach — we help auto shops reach thousands of nearby homeowners with postcards in ${loc}. Open to a quick chat? Reply YES or STOP to opt out.`,
    "Real Estate":
      `${hi}, I'm ${me} with HomeReach. We run targeted postcard campaigns for real estate professionals in ${loc}. Great way to stay top-of-mind with local homeowners. Reply YES or STOP to opt out.`,
    "Cleaning Services":
      `${hi}, ${me} with HomeReach here. We run postcard campaigns targeting homeowners in ${loc} — perfect for cleaning businesses. Interested? Reply YES or STOP to opt out.`,
    "Plumbing":
      `${hi}, ${me} from HomeReach. We help plumbers reach thousands of local homeowners with direct-mail in ${loc}. Interested in more calls? Reply YES or STOP to opt out.`,
    "HVAC":
      `${hi}, ${me} with HomeReach. We run postcard campaigns targeting homeowners in ${loc} — great for HVAC businesses looking for more installs. Reply YES or STOP to opt out.`,
    "Roofing":
      `${hi}, ${me} here from HomeReach. We get roofing companies in front of thousands of local homeowners via direct mail in ${loc}. Want to learn more? Reply YES or STOP to opt out.`,
    "Landscaping":
      `${hi}, ${me} with HomeReach. We help landscaping businesses reach verified homeowners with postcards in ${loc}. Interested? Reply YES or STOP to opt out.`,
  };

  return (
    templates[category] ??
    `${hi}, I'm ${me} with HomeReach. We run targeted postcard ads to homeowners in ${loc} — perfect for businesses like ${businessName}. Interested? Reply YES or STOP to opt out.`
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
  const subject  = `Grow ${businessName} with targeted homeowner ads in ${loc}`;

  const body = `${greeting}

My name is ${agent.full_name} with HomeReach. We run direct-mail postcard campaigns targeting verified homeowners in ${loc} and surrounding neighborhoods.

Each campaign reaches thousands of homeowners in your local market. Businesses in our campaigns typically see strong response rates — especially in categories like ${category || "your industry"}.

We have a few spots left for our next campaign cycle and I think ${businessName} could be a great fit.

Would you have 10 minutes this week for a quick call? Happy to walk you through exactly what we do and what it would cost.

— ${agent.full_name}
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

  return `${hi} My name is ${agent.first_name} and I'm with HomeReach — we do direct-mail postcard campaigns reaching thousands of homeowners in the ${loc} area. I came across ${businessName} and thought you might be a great fit for our next campaign. We have a few spots left! Would you be open to hearing more? 😊`;
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

  return `${hi}, just following up on my message from ${days} about HomeReach postcard advertising in ${loc}. Still interested in reaching more local homeowners? Reply YES or STOP to opt out. — ${agent.first_name}`;
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
    subject: `Following up — HomeReach advertising for ${businessName}`,
    body:    `${greeting}

I wanted to follow up on my previous note about HomeReach's postcard campaigns in ${loc}.

I know things get busy — just didn't want this to fall through the cracks. We have limited spots available for the current campaign cycle and I think ${businessName} would be a great fit.

Worth a quick 10-minute call this week?

— ${agent.full_name}
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

  return `${hi}! Thanks for getting back to me. I'd love to tell you more about how HomeReach works for businesses in ${loc}. Are you available for a quick 10-minute call sometime this week? I can send a calendar link if that's easier. — ${agent.first_name}`;
}

// ─── Format phone for signature (e.g. +13303044916 → (330) 304-4916) ─────────
function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const d = digits.length === 11 ? digits.slice(1) : digits;
  if (d.length === 10) return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
  return raw;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const sessionClient = await createClient();
    const db            = createServiceClient();

    const { data: { user } } = await sessionClient.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const url             = new URL(request.url);
    const agentIdOverride = url.searchParams.get("agent_id");
    const effectiveUserId = agentIdOverride ?? user.id;

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
    const cityFilter = (query: ReturnType<typeof db.from>) => {
      if (hasTerritories) {
        return (query as any).in("city", assignedCities);
      }
      return query;
    };

    // ── Parallel data fetch ───────────────────────────────────────────────────
    const [
      { data: replyLeads },
      { data: followUpLeads },
      { data: textLeads },
      { data: emailLeads },
      { data: fbDmLeads },
      { data: todayEvents },
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
    ]);

    // ── Build tasks with AGENT-SPECIFIC messages ──────────────────────────────

    const replies = (replyLeads ?? []).map(lead => ({
      lead,
      last_reply_at:     lead.last_reply_at,
      suggested_response: replyResponseDraft(agent, lead.business_name, lead.city ?? "", lead.contact_name),
    }));

    const followups = (followUpLeads ?? []).map(lead => {
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
      };
    });

    const texts        = (textLeads ?? []).map(lead => ({
      lead,
      draft: { body: smsDraft(agent, lead.business_name, lead.city ?? "", lead.category ?? "", lead.contact_name) },
    }));

    const emails       = (emailLeads ?? []).map(lead => ({
      lead,
      draft: emailDraft(agent, lead.business_name, lead.city ?? "", lead.category ?? "", lead.contact_name),
    }));

    const facebook_dms = (fbDmLeads ?? []).map(lead => ({
      lead,
      draft: { body: fbDmDraft(agent, lead.business_name, lead.city ?? "", lead.contact_name) },
    }));

    // Group posts — use agent name, show only assigned cities
    const targetCities = hasTerritories ? assignedCities : ["Wooster", "Medina", "Massillon", "Cuyahoga Falls"];
    const group_posts  = targetCities.slice(0, 4).map(city => ({
      id:           `gp_${city.toLowerCase().replace(/\s+/g, "_")}`,
      group_name:   `${city} Ohio Community Board`,
      city,
      post_copy:    `🏠 Hey ${city} business owners! HomeReach is running its spring postcard campaign targeting thousands of homeowners in the area. We have a few ad spots left — comment below or visit home-reach.com to learn more! — ${agent.full_name}`,
      scheduled_for: null,
    }));

    // ── Today's stats (correct action_type mapping) ───────────────────────────
    const events         = todayEvents ?? [];
    const smsSentToday   = events.filter(e => e.action_type === "text_sent"     || (e.action_type === "follow_up_sent" && e.channel === "sms")).length;
    const emailSentToday = events.filter(e => e.action_type === "email_sent"    || (e.action_type === "follow_up_sent" && e.channel === "email")).length;
    const fbSentToday    = events.filter(e => e.action_type === "facebook_sent").length;
    const sentToday      = smsSentToday + emailSentToday + fbSentToday;
    const dealsToday     = events.filter(e => e.action_type === "deal_closed").length;
    const revenueToday   = events.filter(e => e.action_type === "deal_closed").reduce((s, e) => s + (e.revenue_cents ?? 0), 0);

    const totalTasks = replies.length + followups.length + texts.length + emails.length + facebook_dms.length + group_posts.length;

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
        sms_daily:   40,
        email_daily: 40,
      },
    });
  } catch (err) {
    console.error("[todays-tasks] error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
