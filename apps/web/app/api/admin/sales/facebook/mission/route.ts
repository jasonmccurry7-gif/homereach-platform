import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

// ─────────────────────────────────────────────────────────────────────────────
// GET  /api/admin/sales/facebook/mission?agent_id=xxx
// Returns today's Facebook mission tasks + completion status for a rep.
//
// POST /api/admin/sales/facebook/mission
// Logs a completed Facebook mission task.
// ─────────────────────────────────────────────────────────────────────────────

// ── Daily mission task definitions ────────────────────────────────────────────
const MISSION_TASKS = [
  {
    type: "authority_post",
    label: "Authority Post",
    icon: "📣",
    target: 2,
    why: "Posts with local homeowner/business angles drive visibility and build trust. Aim for 2 per day that invite comments.",
    scripts: [
      "Just spoke with a [CITY] homeowner who had 3 quotes for HVAC — picked the company that showed up first and followed up. If you're in [CATEGORY] and not advertising to homeowners yet, what are you waiting for?\n\nDrop a comment if you want to know how we help local businesses get in front of 2,500+ homeowners in [CITY].",
      "Real talk: homeowners in [CITY] are hiring right now. Most of them pick the first name they recognize.\n\nAre you the name they recognize? Happy to show you what we're doing to help local [CATEGORY] businesses own their neighborhood. 👇",
      "Hot take: the best marketing for a [CITY] [CATEGORY] business isn't Google Ads. It's showing up in the mailbox of every homeowner in your target zip before they even start searching.\n\nWe do that for $0.08 per home. Comment or DM me if you're curious.",
    ],
    fields: ["post_url", "post_copy", "group_or_page"],
    proof_label: "Paste post URL or describe where you posted",
  },
  {
    type: "power_comment",
    label: "Power Comments",
    icon: "💬",
    target: 10,
    why: "Comments on local business / homeowner posts keep you visible. A good comment gets replies — which opens DMs naturally.",
    scripts: [
      "Great point — homeowners in [CITY] are making decisions like this more and more. Happy to share what we've seen work in the area.",
      "This is so true for [CITY]. Local businesses that show up consistently in front of homeowners are the ones winning right now.",
      "Love seeing this conversation — [CITY] homeowners and local businesses are a great match. Are you advertising locally yet?",
      "Spot on. We help [CATEGORY] businesses in [CITY] get in front of 2,500+ homeowner mailboxes for less than the cost of one Google click. DM me if you want to see how.",
      "Solid advice. I'd add that the businesses dominating [CITY] right now are also showing up in physical mailboxes — before people even start searching.",
    ],
    fields: ["comment_url", "thread_context"],
    proof_label: "Paste comment link or describe the post you commented on",
  },
  {
    type: "conversation_builder",
    label: "Active Conversation",
    icon: "🔁",
    target: 5,
    why: "Thread depth matters. A 3-reply thread is worth 10x a single comment. Keep existing conversations warm.",
    scripts: [
      "Following up on our thread — did you get a chance to look at what I shared? Happy to send a quick example of what we do for [CATEGORY] businesses in [CITY].",
      "Still thinking about this one. What does your current lead flow look like? Curious if you're getting quality homeowner inquiries.",
      "Quick question — what's your busiest season in [CITY]? I want to make sure any conversation we have is actually timed right for you.",
    ],
    fields: ["thread_url", "thread_depth", "prospect_type"],
    proof_label: "Paste thread URL and describe what stage the conversation is at",
  },
  {
    type: "dm_conversion",
    label: "DM Conversion",
    icon: "📩",
    target: 5,
    why: "Every active public thread is a DM opportunity. Moving the conversation to DM = moving toward the close.",
    scripts: [
      "Hey [NAME] — loved our conversation on [POST]. Didn't want to clog up the comments. Happy to send you a quick overview of what we do for [CATEGORY] businesses in [CITY]. Cool if I drop it here?",
      "Following up from your post about [TOPIC] — I think there might be a fit for what we do. Mind if I share a quick breakdown?",
      "Hey — saw your comment and wanted to reach out directly. We help [CATEGORY] businesses in [CITY] get exclusive access to 2,500+ homeowner mailboxes. Worth a 2-min look?",
    ],
    fields: ["dm_sent_to", "source_thread", "outcome"],
    proof_label: "Who did you DM? From which thread? What happened?",
  },
  {
    type: "group_contribution",
    label: "Group Post / Share",
    icon: "📢",
    target: 2,
    why: "Local Facebook groups are full of business owners and homeowners. A strategic post (not spammy) creates inbound interest.",
    scripts: [
      "For any [CITY]-area business owners here — we have 1 exclusive advertising spot open for [CATEGORY] businesses. You get your name in front of 2,500+ verified homeowner addresses in [CITY]. DM me if you're interested before it's gone.",
      "Question for local [CITY] business owners: how are you reaching homeowners right now? Curious what's working. (Also happy to share what we're seeing work for home services businesses.)",
      "Sharing this because a few business owners here might find it useful — we just opened up a new advertising route covering [CITY] homeowners. First [CATEGORY] business to sign up locks out competitors. Details in DM.",
    ],
    fields: ["group_name", "post_url", "city"],
    proof_label: "Which group? What was the post about? Any engagement?",
  },
  {
    type: "sales_opportunity_followup",
    label: "Sales Opportunity Follow-Up",
    icon: "🎯",
    target: 0, // dynamic — all warm threads
    why: "Any warm Facebook interaction needs a next step. Push it: continue thread → DM → intake link → call.",
    scripts: [
      "Following up on our Facebook conversation — wanted to check if you'd had a chance to think about the homeowner advertising spot we discussed. The [CITY] slot for [CATEGORY] is still available but goes fast.",
      "Hey [NAME] — just wanted to circle back. We had a great conversation about reaching [CITY] homeowners. If you're ready to take a look at pricing, I can send that over right now.",
      "Quick check-in — any questions I can answer? We can also set up a 10-min call if easier. I want to make sure [BUSINESS] has the first shot at this before the spot goes.",
    ],
    fields: ["lead_name", "next_action", "outcome"],
    proof_label: "Who did you follow up with? What was the outcome or next step?",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// GET — fetch today's mission state
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get("agent_id");

  const supabase = createServiceClient();
  const today = new Date().toISOString().split("T")[0];

  // Load completion records for today — graceful fallback if table doesn't exist
  let completedToday: Record<string, number> = {};
  try {
    const { data } = await supabase
      .from("facebook_activity_logs")
      .select("task_type")
      .eq("agent_id", agentId ?? "")
      .gte("created_at", `${today}T00:00:00.000Z`)
      .lt("created_at",  `${today}T23:59:59.999Z`);

    if (data) {
      for (const row of data) {
        completedToday[row.task_type] = (completedToday[row.task_type] ?? 0) + 1;
      }
    }
  } catch {
    // Table not yet created — return tasks with zero completion
    completedToday = {};
  }

  // Load assigned cities for context
  let assignedCities: string[] = [];
  try {
    const { data: identity } = await supabase
      .from("agent_identities")
      .select("assigned_cities")
      .eq("agent_id", agentId ?? "")
      .maybeSingle();
    assignedCities = identity?.assigned_cities ?? [];
  } catch {}

  // Load today's warm Facebook opportunities (from sales_leads + sales_events)
  let warmOpportunities: Array<{ business_name: string; city: string; category: string; facebook_url: string | null }> = [];
  try {
    const { data: fbLeads } = await supabase
      .from("sales_leads")
      .select("business_name, city, category, facebook_url")
      .not("facebook_url", "is", null)
      .in("status", ["replied", "interested", "contacted"])
      .order("last_reply_at", { ascending: false })
      .limit(10);
    warmOpportunities = fbLeads ?? [];
  } catch {}

  const tasks = MISSION_TASKS.map(task => ({
    ...task,
    completed: completedToday[task.type] ?? 0,
    remaining: Math.max(0, task.target - (completedToday[task.type] ?? 0)),
    done: task.target > 0 && (completedToday[task.type] ?? 0) >= task.target,
    warmOpportunities: task.type === "sales_opportunity_followup" ? warmOpportunities : [],
  }));

  const totalCompleted = Object.values(completedToday).reduce((a, b) => a + b, 0);
  const missionScore = Math.round(
    (tasks.filter(t => t.done || t.type === "sales_opportunity_followup").length / tasks.filter(t => t.type !== "sales_opportunity_followup").length) * 100
  );

  return NextResponse.json({
    date: today,
    agent_id: agentId,
    assigned_cities: assignedCities,
    tasks,
    total_completed_today: totalCompleted,
    mission_score: missionScore,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// POST — log a completed Facebook mission task
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      agent_id, task_type, city, category, proof_text, proof_url,
      script_used, thread_depth, prospect_type, next_action, outcome,
      dm_converted, business_owner_interaction, lead_id,
    } = body;

    if (!agent_id || !task_type) {
      return NextResponse.json({ error: "agent_id and task_type required" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Compute quality score
    let qualityScore = 50; // base
    if (proof_url)                  qualityScore += 10; // has proof
    if (thread_depth && thread_depth >= 2) qualityScore += 15; // deep thread
    if (dm_converted)               qualityScore += 20; // converted to DM
    if (business_owner_interaction) qualityScore += 15; // business owner
    if (next_action)                qualityScore += 5;  // has next step
    qualityScore = Math.min(100, qualityScore);

    // Try to insert — if table doesn't exist yet, log to sales_events as fallback
    let inserted = false;
    try {
      const { error } = await supabase
        .from("facebook_activity_logs")
        .insert({
          agent_id,
          task_type,
          city,
          category,
          proof_text,
          proof_url,
          script_used,
          thread_depth: thread_depth ?? 1,
          prospect_type: prospect_type ?? "unknown",
          next_action,
          outcome,
          dm_converted: dm_converted ?? false,
          business_owner_interaction: business_owner_interaction ?? false,
          lead_id,
          quality_score: qualityScore,
        });
      if (!error) inserted = true;
    } catch {}

    if (!inserted) {
      // Fallback: log to sales_events so activity is not lost
      await supabase.from("sales_events").insert({
        agent_id,
        lead_id: lead_id ?? null,
        action_type: "facebook_sent",
        channel: "facebook",
        city,
        category,
        message: `[FB Mission] ${task_type}: ${proof_text ?? ""}`,
        metadata: { task_type, proof_url, quality_score: qualityScore },
      });
    }

    // Also fire to sales_events for unified tracking
    await supabase.from("sales_events").insert({
      agent_id,
      lead_id: lead_id ?? null,
      action_type: "facebook_sent",
      channel: "facebook",
      city,
      category,
      message: `[FB:${task_type}] ${script_used?.slice(0, 100) ?? proof_text?.slice(0, 100) ?? ""}`,
      metadata: { task_type, quality_score: qualityScore, dm_converted, thread_depth },
    }).then(() => {}).catch(() => {});

    return NextResponse.json({ ok: true, quality_score: qualityScore, inserted });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
