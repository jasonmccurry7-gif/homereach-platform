import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/sales/todays-tasks
// Returns today's task queue organized into 6 sections with pre-written drafts.
// Called by the agent execution dashboard on load and refresh.
// ─────────────────────────────────────────────────────────────────────────────

// ── Message template generators ───────────────────────────────────────────────

function smsDraft(businessName: string, city: string, category: string, contactName?: string | null): string {
  const first = contactName ? contactName.split(" ")[0] : null;
  const hi = first ? `Hi ${first}` : "Hi there";
  const loc = city || "your area";

  const templates: Record<string, string> = {
    "Restaurant & Food":
      `${hi}, I'm Jason with HomeReach — we run postcard campaigns targeting thousands of homeowners near your restaurant in ${loc}. Would you be open to a quick chat? Reply YES to learn more or STOP to opt out.`,
    "Home Services":
      `${hi}, Jason here from HomeReach. We connect home service businesses with local homeowners through targeted postcard ads in ${loc}. Interested? Reply YES or STOP to opt out.`,
    "Health & Wellness":
      `${hi}, I'm Jason with HomeReach. We run hyper-local postcard campaigns reaching homeowners near your business in ${loc}. Want to hear more? Reply YES or STOP to opt out.`,
    "Automotive":
      `${hi}, Jason with HomeReach — we help auto shops reach thousands of nearby homeowners with postcards in ${loc}. Open to a quick chat? Reply YES or STOP to opt out.`,
    "Real Estate":
      `${hi}, I'm Jason with HomeReach. We run targeted postcard campaigns for real estate professionals in ${loc}. Great way to stay top-of-mind with local homeowners. Reply YES or STOP to opt out.`,
    "Cleaning Services":
      `${hi}, Jason with HomeReach here. We run postcard campaigns targeting homeowners in ${loc} — perfect for cleaning businesses. Interested? Reply YES or STOP to opt out.`,
  };

  return templates[category] ??
    `${hi}, I'm Jason with HomeReach. We run targeted postcard ads to homeowners in ${loc} — perfect for businesses like ${businessName}. Interested? Reply YES or STOP to opt out.`;
}

function emailDraft(businessName: string, city: string, category: string, contactName?: string | null): { subject: string; body: string } {
  const first = contactName ? contactName.split(" ")[0] : null;
  const greeting = first ? `Hi ${first},` : "Hi there,";
  const loc = city || "your area";
  const subject = `Grow ${businessName} with targeted homeowner ads in ${loc}`;

  const body = `${greeting}

My name is Jason McCurry, founder of HomeReach. We run direct-mail postcard campaigns targeting verified homeowners in ${loc} and surrounding neighborhoods.

Each campaign reaches 10,000+ homeowners in your local market. Businesses in our campaigns typically see strong response rates — especially in categories like ${category || "your industry"}.

We have a few spots left for our next campaign cycle and I think ${businessName} could be a great fit.

Would you have 10 minutes this week for a quick call? Happy to walk you through exactly what we do and what it would cost.

— Jason McCurry
Founder, HomeReach
(330) 304-4916 | home-reach.com`;

  return { subject, body };
}

function fbDmDraft(businessName: string, city: string, contactName?: string | null): string {
  const first = contactName ? contactName.split(" ")[0] : null;
  const hi = first ? `Hi ${first}!` : "Hi there!";
  const loc = city || "your area";

  return `${hi} My name is Jason and I run HomeReach — we do direct-mail postcard campaigns reaching thousands of homeowners in the ${loc} area. I came across ${businessName} and thought you might be a great fit for our next campaign. We have a few spots left! Would you be open to hearing more? 😊`;
}

function followUpSmsDraft(businessName: string, city: string, daysSince: number, contactName?: string | null): string {
  const first = contactName ? contactName.split(" ")[0] : null;
  const hi = first ? `Hi ${first}` : "Hi";
  const loc = city || "your area";
  const days = daysSince === 1 ? "yesterday" : `${daysSince} days ago`;

  return `${hi}, just following up on my message from ${days} about HomeReach postcard advertising in ${loc}. Still interested in reaching more local homeowners? Reply YES or STOP to opt out.`;
}

function followUpEmailDraft(businessName: string, city: string, daysSince: number, contactName?: string | null): { subject: string; body: string } {
  const first = contactName ? contactName.split(" ")[0] : null;
  const greeting = first ? `Hi ${first},` : "Hi there,";
  const loc = city || "your area";

  return {
    subject: `Following up — HomeReach advertising for ${businessName}`,
    body: `${greeting}

I wanted to follow up on my previous note about HomeReach's postcard campaigns in ${loc}.

I know things get busy — just didn't want this to fall through the cracks. We have limited spots available for the current campaign cycle and I think ${businessName} would be a great fit.

Worth a quick 10-minute call this week?

— Jason McCurry
HomeReach | (330) 304-4916`,
  };
}

function replyResponseDraft(businessName: string, city: string, contactName?: string | null): string {
  const first = contactName ? contactName.split(" ")[0] : null;
  const hi = first ? `Hi ${first}` : "Hi";
  const loc = city || "your area";

  return `${hi}! Thanks for getting back to me. I'd love to tell you more about how HomeReach works for businesses in ${loc}. Are you available for a quick 10-minute call sometime this week? I can send a calendar link if that's easier.`;
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .eq("id", user.id)
      .single();

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    // ── Parallel queries ────────────────────────────────────────────────────
    const [
      { data: replyLeads },
      { data: followUpLeads },
      { data: textLeads },
      { data: emailLeads },
      { data: fbDmLeads },
      { data: todayEvents },
    ] = await Promise.all([
      // 1. Leads who replied — need response
      supabase
        .from("sales_leads")
        .select("*")
        .eq("status", "replied")
        .eq("do_not_contact", false)
        .order("last_reply_at", { ascending: true })
        .limit(30),

      // 2. Follow-ups due today or overdue
      supabase
        .from("sales_leads")
        .select("*")
        .lte("next_follow_up_at", now.toISOString())
        .not("next_follow_up_at", "is", null)
        .eq("do_not_contact", false)
        .not("status", "in", "(closed,dnc,bad_number,invalid_email)")
        .order("next_follow_up_at", { ascending: true })
        .limit(30),

      // 3. Fresh SMS outreach — queued leads with phone
      supabase
        .from("sales_leads")
        .select("*")
        .eq("status", "queued")
        .eq("do_not_contact", false)
        .eq("sms_opt_out", false)
        .not("phone", "is", null)
        .not("phone", "eq", "")
        .order("buying_signal", { ascending: false })
        .order("score", { ascending: false })
        .limit(40),

      // 4. Fresh email outreach — queued leads with email
      supabase
        .from("sales_leads")
        .select("*")
        .eq("status", "queued")
        .eq("do_not_contact", false)
        .not("email", "is", null)
        .not("email", "eq", "")
        .order("buying_signal", { ascending: false })
        .order("score", { ascending: false })
        .limit(40),

      // 5. Facebook DMs — leads with fb URL
      supabase
        .from("sales_leads")
        .select("*")
        .in("status", ["queued", "contacted"])
        .eq("do_not_contact", false)
        .not("facebook_url", "is", null)
        .not("facebook_url", "eq", "")
        .order("score", { ascending: false })
        .limit(25),

      // 6. Today's events for stats
      supabase
        .from("sales_events")
        .select("action_type, lead_id, revenue_cents")
        .eq("agent_id", user.id)
        .gte("created_at", todayStart.toISOString()),
    ]);

    // ── Build typed task lists ──────────────────────────────────────────────

    const replies = (replyLeads ?? []).map((lead) => ({
      lead,
      last_reply_at: lead.last_reply_at,
      suggested_response: replyResponseDraft(lead.business_name, lead.city ?? "", lead.contact_name),
    }));

    const followups = (followUpLeads ?? []).map((lead) => {
      const lastContacted = lead.last_contacted_at ? new Date(lead.last_contacted_at) : null;
      const daysSince = lastContacted
        ? Math.max(1, Math.floor((now.getTime() - lastContacted.getTime()) / 86_400_000))
        : 3;
      const hasPhone = !!(lead.phone && lead.phone.trim());
      const draft = hasPhone
        ? { body: followUpSmsDraft(lead.business_name, lead.city ?? "", daysSince, lead.contact_name) }
        : followUpEmailDraft(lead.business_name, lead.city ?? "", daysSince, lead.contact_name);

      return {
        lead,
        draft,
        channel: (hasPhone ? "sms" : "email") as "sms" | "email",
        days_since: daysSince,
        overdue: lead.next_follow_up_at ? new Date(lead.next_follow_up_at) < now : false,
      };
    });

    const texts = (textLeads ?? []).map((lead) => ({
      lead,
      draft: { body: smsDraft(lead.business_name, lead.city ?? "", lead.category ?? "", lead.contact_name) },
    }));

    const emails = (emailLeads ?? []).map((lead) => ({
      lead,
      draft: emailDraft(lead.business_name, lead.city ?? "", lead.category ?? "", lead.contact_name),
    }));

    const facebook_dms = (fbDmLeads ?? []).map((lead) => ({
      lead,
      draft: { body: fbDmDraft(lead.business_name, lead.city ?? "", lead.contact_name) },
    }));

    // Static group posts — expand to DB table later
    const group_posts = [
      {
        id: "gp_wooster",
        group_name: "Wooster Ohio Community Board",
        city: "Wooster",
        post_copy: `🏠 Hey Wooster business owners! HomeReach is running its spring postcard campaign targeting 10,000+ homeowners in the Wayne County area. We have a few ad spots left — comment below or visit home-reach.com to learn more!`,
        scheduled_for: null,
      },
      {
        id: "gp_medina",
        group_name: "Medina County Local Business Network",
        city: "Medina",
        post_copy: `📮 Attention Medina area businesses! Our HomeReach postcard campaign is filling up. We target verified homeowners directly — great for home services, restaurants, health & wellness, and more. Visit home-reach.com to claim your spot!`,
        scheduled_for: null,
      },
      {
        id: "gp_massillon",
        group_name: "Massillon Ohio Businesses & Services",
        city: "Massillon",
        post_copy: `📬 Massillon business owners — HomeReach is launching a postcard campaign reaching thousands of local homeowners in the Massillon area. Limited spots available. Learn more at home-reach.com or drop a comment below!`,
        scheduled_for: null,
      },
      {
        id: "gp_cuyahoga",
        group_name: "Cuyahoga Falls Community",
        city: "Cuyahoga Falls",
        post_copy: `🏡 Cuyahoga Falls business owners! We're running a HomeReach direct-mail postcard campaign targeting homeowners throughout the area. A few ad spots remain for this campaign — visit home-reach.com to see if it's a fit for your business!`,
        scheduled_for: null,
      },
    ];

    // ── Today's stats ────────────────────────────────────────────────────────
    const events = todayEvents ?? [];
    const sentToday = events.filter((e) =>
      ["sms_sent", "email_sent", "fb_message_sent", "follow_up_sent"].includes(e.action_type)
    ).length;
    const dealsToday = events.filter((e) => e.action_type === "deal_closed").length;
    const revenueToday = events
      .filter((e) => e.action_type === "deal_closed")
      .reduce((sum, e) => sum + (e.revenue_cents ?? 0), 0);

    const totalTasks =
      replies.length +
      followups.length +
      texts.length +
      emails.length +
      facebook_dms.length +
      group_posts.length;

    return NextResponse.json({
      date: now.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      agent: { id: user.id, name: profile?.full_name ?? "Agent" },
      sections: { replies, followups, texts, emails, facebook_dms, group_posts },
      totals: {
        total_tasks: totalTasks,
        sent_today: sentToday,
        deals_today: dealsToday,
        revenue_today_cents: revenueToday,
      },
    });
  } catch (err) {
    console.error("[todays-tasks] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
