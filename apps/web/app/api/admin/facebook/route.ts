import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { logPlatformAuditEvent } from "@/lib/audit/platform-audit";
import { assertSocialPublishAllowed, SocialPublishBlockedError } from "@/lib/social-content/publish-guard";
import { getOwnerIdentity } from "@homereach/services/outreach";

// ─────────────────────────────────────────────────────────────────────────────
// Facebook Revenue Engine API
//
// GET  /api/admin/facebook?view=execution  → today's execution list
// GET  /api/admin/facebook?view=pipeline   → full pipeline
// POST /api/admin/facebook                 → create opportunity + generate scripts
// PUT  /api/admin/facebook                 → update opportunity (log action)
// ─────────────────────────────────────────────────────────────────────────────

const OHIO_CITIES = [
  "Wooster","Medina","Massillon","Cuyahoga Falls","Canton",
  "Akron","Brunswick","Barberton","Wadsworth","Stow","Kent",
];

const CATEGORY_MAP: Record<string, string> = {
  "plumb|pipe":                       "Plumbing",
  "hvac|heat|cool|air":               "HVAC",
  "roof":                             "Roofing",
  "landscap|lawn|yard|mow":           "Landscaping",
  "clean|maid|janitor|pressure.?wash":"Home Cleaning",
  "electric":                         "Electrical",
  "paint":                            "Painting",
  "pest|exterminat":                  "Pest Control",
  "junk|haul|remov":                  "Junk Removal",
  "tree|trim|stump|arborist":         "Tree Service",
  "garage.?door":                     "Garage Doors",
  "gutter":                           "Gutters",
  "floor":                            "Flooring",
  "window|door install":              "Windows & Doors",
  "remodel|renovati|contractor":      "Home Remodeling",
  "real estate|realtor":              "Real Estate",
  "solar":                            "Solar",
  "insurance":                        "Insurance",
  "concrete|masonry":                 "Concrete & Masonry",
  "restaurant|pizza|diner|food|cafe": "Restaurant & Food",
};

const FB_API = "https://graph.facebook.com/v19.0";

function envPresent(key: string): boolean {
  return Boolean(process.env[key]?.trim());
}

function envEnabled(key: string): boolean {
  const value = process.env[key]?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

async function loadFacebookSetup(db: ReturnType<typeof createServiceClient>, origin: string) {
  const { data: controls } = await db
    .from("system_controls")
    .select("all_paused, facebook_paused, manual_approval_mode, outreach_test_mode")
    .eq("id", 1)
    .maybeSingle();

  const [{ count: leadCount }, { count: pendingDrafts }, { count: pendingAlerts }] = await Promise.all([
    db.from("facebook_leads").select("id", { count: "exact", head: true }),
    db.from("facebook_messages").select("id", { count: "exact", head: true })
      .eq("delivery_status", "draft")
      .eq("approval_status", "pending"),
    db.from("facebook_alert_events").select("id", { count: "exact", head: true })
      .eq("delivery_status", "pending"),
  ]);

  const autoReplyEnabled =
    envEnabled("FACEBOOK_AUTO_REPLY_ENABLED") &&
    envEnabled("FACEBOOK_AUTO_REPLY_HUMAN_APPROVED");
  const commentReplyEnabled =
    envEnabled("FACEBOOK_COMMENT_AUTO_REPLY_ENABLED") &&
    envEnabled("FACEBOOK_COMMENT_AUTO_REPLY_HUMAN_APPROVED");
  const commentDmEnabled =
    envEnabled("FACEBOOK_COMMENT_AUTO_DM_ENABLED") &&
    envEnabled("FACEBOOK_COMMENT_AUTO_DM_HUMAN_APPROVED");
  const followupEnabled =
    envEnabled("FACEBOOK_FOLLOWUP_AUTO_SEND_ENABLED") &&
    envEnabled("FACEBOOK_FOLLOWUP_HUMAN_APPROVED");

  return {
    callback_url: `${origin}/api/facebook/webhook`,
    alert_callback_url: `${origin}/api/webhooks/facebook`,
    recommended_callback_url: `${origin}/api/facebook/webhook`,
    verify_token_configured: envPresent("FACEBOOK_WEBHOOK_VERIFY_TOKEN") || envPresent("FACEBOOK_VERIFY_TOKEN"),
    app_secret_configured: envPresent("FACEBOOK_APP_SECRET"),
    page_access_token_configured: envPresent("FACEBOOK_PAGE_ACCESS_TOKEN"),
    page_id_configured: envPresent("FACEBOOK_PAGE_ID"),
    app_id_configured: envPresent("FACEBOOK_APP_ID"),
    system_controls: {
      all_paused: Boolean(controls?.all_paused),
      facebook_paused: Boolean(controls?.facebook_paused),
      manual_approval_mode: Boolean(controls?.manual_approval_mode),
      outreach_test_mode: Boolean(controls?.outreach_test_mode),
    },
    automation_modes: {
      inbound_capture: true,
      draft_generation: true,
      auto_reply_enabled: autoReplyEnabled,
      comment_reply_enabled: commentReplyEnabled,
      comment_dm_enabled: commentDmEnabled,
      followup_auto_send_enabled: followupEnabled,
    },
    counts: {
      facebook_leads: leadCount ?? 0,
      pending_drafts: pendingDrafts ?? 0,
      pending_alerts: pendingAlerts ?? 0,
    },
    subscriptions_needed: ["messages", "messaging_postbacks", "feed", "mention"],
    permissions_needed: ["pages_messaging", "pages_manage_metadata", "pages_read_engagement"],
    operating_mode: autoReplyEnabled || commentReplyEnabled || commentDmEnabled || followupEnabled
      ? "live_auto_send_enabled"
      : "draft_and_approval",
  };
}

async function loadFacebookInbox(db: ReturnType<typeof createServiceClient>) {
  const { data } = await db
    .from("facebook_leads")
    .select(`
      id, fb_psid, fb_name, fb_profile_pic, sales_lead_id, lead_status, intent_level,
      city, category, business_name, current_agent, conversation_stage,
      last_message_at, last_reply_at, messages_sent, messages_received, source,
      created_at, updated_at,
      facebook_messages (
        id, direction, message, agent, mid, sent_at, delivery_status, approval_status,
        requires_approval, proposed_action, source, actual_sent_at, error_detail, metadata
      )
    `)
    .order("updated_at", { ascending: false })
    .limit(25);

  return data ?? [];
}

async function sendFacebookMessage(psid: string, message: string): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN?.trim();
  if (!token) return { ok: false, error: "FACEBOOK_PAGE_ACCESS_TOKEN is not configured." };

  try {
    const res = await fetch(`${FB_API}/me/messages?access_token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: psid },
        message: { text: message },
        messaging_type: "RESPONSE",
      }),
    });
    const data = await res.json() as { message_id?: string; error?: { message?: string } };
    if (!res.ok) return { ok: false, error: data.error?.message ?? `Facebook API ${res.status}` };
    return { ok: true, messageId: data.message_id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ── Reply templates (rotating, human-sounding) ────────────────────────────────
const REPLY_TEMPLATES = {
  curiosity: [
    "Quick question — are you doing anything consistent to get in front of homeowners in {city}, or mostly posts like this?",
    "Are you running anything ongoing locally, or is this mainly how you find new clients?",
    "Smart jumping in early here. Do you have anything set up to reach homeowners directly in {city}?",
  ],
  compliment: [
    "Great work — that category does really well with direct homeowner exposure. Are you already doing anything like that in {city}?",
    "Solid presence. Are you doing any direct outreach to homeowners in {city} or mostly digital?",
    "Nice — {category} businesses typically kill it with direct mail in this area. Have you tried anything like that?",
  ],
  scarcity: [
    "That category is actually moving fast in {city} right now. Are you locked into anything for homeowner reach?",
    "Spots for {category} in {city} don't stay open long — are you in anything right now for local homeowner exposure?",
    "Only asking because we have one opening left for {category} in {city} — wanted to flag it before it fills.",
  ],
  local: [
    "Homeowners in {city} are really active right now — are you getting in front of them consistently?",
    "That area has strong homeowner density. Are you doing any targeted local advertising?",
    "I work with a few {category} businesses in {city} — the ones doing well are usually running something offline too. Are you?",
  ],
};

function detectCity(text: string): string | null {
  const lower = text.toLowerCase();
  return OHIO_CITIES.find(c => lower.includes(c.toLowerCase())) ?? null;
}

function detectCategory(text: string): string | null {
  const lower = text.toLowerCase();
  for (const [pattern, category] of Object.entries(CATEGORY_MAP)) {
    if (new RegExp(pattern).test(lower)) return category;
  }
  return null;
}

function scorePost(postText: string, category: string | null, city: string | null): {
  urgency: number; conversion: number; lead: number;
} {
  let urgency = 3, conversion = 3;
  const lower = postText.toLowerCase();
  if (/need|urgent|asap|emergency|right away|today/.test(lower)) urgency += 4;
  if (/hiring|looking for|recommend/.test(lower)) urgency += 2;
  if (/licensed|insured|years|established|award/.test(lower)) conversion += 3;
  if (/website|reviews|professional/.test(lower)) conversion += 2;
  if (city) conversion += 1;
  if (category) conversion += 1;
  const PRIORITY_CATS = ["Roofing","HVAC","Plumbing","Landscaping","Home Remodeling"];
  if (category && PRIORITY_CATS.includes(category)) conversion += 2;
  return {
    urgency: Math.min(10, urgency),
    conversion: Math.min(10, conversion),
    lead: Math.min(100, (urgency + conversion) * 5),
  };
}

function generateReply(
  city: string | null,
  category: string | null,
  agentName: string,
  seed: number = 0
): string {
  const cityStr = city ?? "your area";
  const catStr  = category ?? "your industry";

  // Pick template group and rotate
  const groups  = Object.keys(REPLY_TEMPLATES) as Array<keyof typeof REPLY_TEMPLATES>;
  const group   = groups[seed % groups.length] ?? groups[0]!;
  const templates = REPLY_TEMPLATES[group];
  const template  = templates[Math.floor(seed / groups.length) % templates.length] ?? templates[0] ?? "";

  return template
    .replace(/{city}/g, cityStr)
    .replace(/{category}/g, catStr)
    .replace(/{agent}/g, agentName);
}

function generateDmFlow(
  businessName: string,
  city: string | null,
  category: string | null,
  agentName: string,
  agentPhone: string
): { stage1: string; stage2: string; stage3: string; stage4: string; stage5: string } {
  const loc  = city ?? "your area";
  const cat  = category ?? "your industry";

  return {
    stage1: `Hey! Saw your post in the group and had to reach out — we work with ${cat} businesses in ${loc} specifically. Are you doing anything right now to get in front of homeowners consistently, or is it mostly referrals and social?`,

    stage2: `Got it. So the challenge a lot of ${cat} businesses in ${loc} face is consistency — digital is hit or miss and referrals plateau. Quick question: when a homeowner in ${loc} needs ${cat} services, how are they finding you right now?`,

    stage3: `That's actually exactly the gap we fill. HomeReach runs direct-mail postcard campaigns — your ad goes to 2,500+ verified homeowners in ${loc} every single month. No algorithm, no competition. And here's the key: we only allow ONE business per category per mailer. So if you lock in ${cat}, no other ${cat} business can advertise while you're active.`,

    stage4: `Real talk — we have one spot open right now for ${cat} in ${loc}. I don't know how long it'll stay open because we had another business asking about it earlier this week. Spots typically go in 3–5 days once we start outreach. Want me to send you the details on what it costs and what it looks like?`,

    stage5: `Here's how to lock it in — takes 3 minutes: home-reach.com/get-started\n\nPick your spot size (starts at $200/mo), enter your info, and you're in. I can hold your category for 24 hours if you want to look it over first — just let me know.\n\nOr if it's easier, call/text me directly: ${agentPhone} — happy to walk you through it.\n\n— ${agentName}, HomeReach`,
  };
}

// ─── GET ─────────────────────────────────────────────────────────────────────
export async function GET(req: Request) {
  try {
    const sessionClient = await createClient();
    const { data: { user } } = await sessionClient.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db  = createServiceClient();
    const url = new URL(req.url);
    const view = url.searchParams.get("view") ?? "execution";
    const agentId = url.searchParams.get("agent_id") ?? user.id;
    const [setup, inbox] = await Promise.all([
      loadFacebookSetup(db, url.origin),
      loadFacebookInbox(db),
    ]);

    if (view === "execution") {
      // Today's execution: items that need action
      const { data: items } = await db
        .from("fb_opportunities")
        .select("*")
        .eq("assigned_agent_id", agentId)
        .not("pipeline_status", "in", "(closed_won,closed_lost)")
        .order("lead_score", { ascending: false })
        .limit(50);

      // Group by action needed
      const needsComment  = (items ?? []).filter(i => ["replies_generated","post_qualified"].includes(i.pipeline_status));
      const needsDm       = (items ?? []).filter(i => ["engaged","dm_ready"].includes(i.pipeline_status));
      const inConversation = (items ?? []).filter(i => ["dm_sent","replied","qualified"].includes(i.pipeline_status));
      const hotLeads      = (items ?? []).filter(i => i.is_hot_lead);
      const followUps     = (items ?? []).filter(i =>
        i.pipeline_status === "follow_up" ||
        (i.follow_up_due_at && new Date(i.follow_up_due_at) <= new Date())
      );
      const closeReady    = (items ?? []).filter(i => ["offer_presented","close_attempt"].includes(i.pipeline_status));

      return NextResponse.json({
        date: new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }),
        agent_id: agentId,
        setup,
        inbox,
        execution: { needsComment, needsDm, inConversation, hotLeads, followUps, closeReady },
        totals: {
          total_active:    (items ?? []).length,
          needs_comment:   needsComment.length,
          needs_dm:        needsDm.length,
          hot_leads:       hotLeads.length,
          follow_ups_due:  followUps.length,
          close_ready:     closeReady.length,
        },
      });
    }

    // Full pipeline view
    const { data: all } = await db
      .from("fb_opportunities")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    return NextResponse.json({ opportunities: all ?? [], setup, inbox });

  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// ─── POST — Create opportunity + generate scripts ────────────────────────────
export async function POST(req: Request) {
  try {
    const sessionClient = await createClient();
    const { data: { user } } = await sessionClient.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db   = createServiceClient();
    const body = await req.json();

    const {
      post_text, post_url, group_name, post_type,
      commenter_name, business_name, original_comment, profile_link,
      trust_signals = [],
    } = body;

    const sourceText = `${post_text ?? ""} ${original_comment ?? ""} ${business_name ?? ""}`;
    const city     = detectCity(sourceText);
    const category = detectCategory(sourceText);
    const scores   = scorePost(sourceText, category, city);

    // Load agent identity for personalized scripts
    const { data: identity } = await db
      .from("agent_identities")
      .select("from_name, twilio_phone")
      .eq("agent_id", user.id)
      .maybeSingle();
    const { data: profile } = await db
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();

    const owner = getOwnerIdentity();
    const agentName  = identity?.from_name ?? profile?.full_name ?? owner.name;
    const agentPhone = formatPhone(identity?.twilio_phone ?? owner.cellPhone);
    const seed       = Date.now() % 12; // rotation seed

    const reply  = generateReply(city, category, agentName, seed);
    const dmFlow = generateDmFlow(business_name ?? commenter_name ?? "there", city, category, agentName, agentPhone);

    // Check category availability
    let categoryAvailable = true;
    if (city && category) {
      const { count } = await db
        .from("sales_leads")
        .select("id", { count: "exact" })
        .eq("city", city)
        .eq("category", category)
        .eq("status", "closed");
      categoryAvailable = (count ?? 0) < 10;
    }

    const { data: opp, error } = await db
      .from("fb_opportunities")
      .insert({
        post_type:          post_type ?? "business_promo",
        group_name,
        post_url,
        post_text,
        city_detected:      city,
        category_detected:  category,
        urgency_score:      scores.urgency,
        conversion_score:   scores.conversion,
        lead_score:         scores.lead,
        close_probability:  scores.conversion * 10,
        commenter_name,
        business_name,
        profile_link,
        original_comment,
        trust_signals,
        suggested_reply:    reply,
        dm_stage_1:         dmFlow.stage1,
        dm_stage_2:         dmFlow.stage2,
        dm_stage_3:         dmFlow.stage3,
        dm_stage_4:         dmFlow.stage4,
        dm_stage_5:         dmFlow.stage5,
        pipeline_status:    "replies_generated",
        assigned_agent_id:  user.id,
        category_available: categoryAvailable,
        is_hot_lead:        scores.urgency >= 7,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ opportunity: opp });

  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// ─── PUT — Update opportunity (log action, advance stage) ────────────────────
export async function PUT(req: Request) {
  try {
    const sessionClient = await createClient();
    const { data: { user } } = await sessionClient.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db   = createServiceClient();
    const body = await req.json();
    const { id, action, draft_message_id, ...updates } = body;

    if ((action === "approve_draft" || action === "reject_draft") && draft_message_id) {
      const { data: draft, error: draftError } = await db
        .from("facebook_messages")
        .select("id, lead_id, message, delivery_status, approval_status, source, proposed_action, metadata")
        .eq("id", draft_message_id)
        .maybeSingle();

      if (draftError) return NextResponse.json({ error: draftError.message }, { status: 500 });
      if (!draft) return NextResponse.json({ error: "Draft not found." }, { status: 404 });
      if (draft.delivery_status !== "draft") {
        return NextResponse.json({ error: "Only draft Facebook messages can be reviewed." }, { status: 400 });
      }

      const now = new Date().toISOString();
      const existingMetadata =
        draft.metadata && typeof draft.metadata === "object" && !Array.isArray(draft.metadata)
          ? (draft.metadata as Record<string, unknown>)
          : {};

      if (action === "approve_draft") {
        const { data: reviewed, error } = await db
          .from("facebook_messages")
          .update({
            approval_status: "approved",
            requires_approval: false,
            approved_at: now,
            error_detail: null,
            metadata: {
              ...existingMetadata,
              approval: {
                status: "approved",
                reviewed_at: now,
                reviewed_by: user.id,
              },
            },
          })
          .eq("id", draft_message_id)
          .select("id, approval_status, approved_at")
          .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        await logPlatformAuditEvent({
          actorType: "human",
          actorId: user.id,
          module: "facebook",
          actionType: "approve_draft",
          entityType: "facebook_message",
          entityId: draft_message_id,
          sourceTable: "facebook_messages",
          sourceId: draft_message_id,
          channel: "facebook_dm",
          provider: "facebook",
          resultStatus: "success",
          approvalState: "approved",
          severity: "medium",
          message: "Facebook draft approved. External send still requires a separate explicit action.",
          metadata: {
            lead_id: draft.lead_id,
            source: draft.source,
            proposed_action: draft.proposed_action,
          },
        });

        return NextResponse.json({ ok: true, draft: reviewed });
      }

      const reason = typeof updates.reason === "string" && updates.reason.trim()
        ? updates.reason.trim()
        : "Rejected by operator.";
      const { data: reviewed, error } = await db
        .from("facebook_messages")
        .update({
          approval_status: "rejected",
          requires_approval: true,
          approved_at: null,
          error_detail: reason,
          metadata: {
            ...existingMetadata,
            approval: {
              status: "rejected",
              reviewed_at: now,
              reviewed_by: user.id,
              reason,
            },
          },
        })
        .eq("id", draft_message_id)
        .select("id, approval_status, error_detail")
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      await logPlatformAuditEvent({
        actorType: "human",
        actorId: user.id,
        module: "facebook",
        actionType: "reject_draft",
        entityType: "facebook_message",
        entityId: draft_message_id,
        sourceTable: "facebook_messages",
        sourceId: draft_message_id,
        channel: "facebook_dm",
        provider: "facebook",
        resultStatus: "success",
        approvalState: "rejected",
        severity: "medium",
        message: "Facebook draft rejected before external send.",
        metadata: {
          lead_id: draft.lead_id,
          source: draft.source,
          proposed_action: draft.proposed_action,
          reason,
        },
      });

      return NextResponse.json({ ok: true, draft: reviewed });
    }

    if (action === "send_draft" && draft_message_id) {
      const { data: controls } = await db
        .from("system_controls")
        .select("all_paused, facebook_paused, outreach_test_mode")
        .eq("id", 1)
        .maybeSingle();

      if (controls?.all_paused || controls?.facebook_paused || controls?.outreach_test_mode) {
        return NextResponse.json({ error: "Facebook sending is paused by system controls." }, { status: 403 });
      }

      const { data: draft, error: draftError } = await db
        .from("facebook_messages")
        .select("id, lead_id, message, delivery_status, approval_status, approved_at, facebook_leads!inner ( fb_psid, messages_sent )")
        .eq("id", draft_message_id)
        .maybeSingle();

      if (draftError) return NextResponse.json({ error: draftError.message }, { status: 500 });
      if (!draft) return NextResponse.json({ error: "Draft not found." }, { status: 404 });
      if (draft.delivery_status !== "draft") {
        return NextResponse.json({ error: "Only draft Facebook messages can be sent from this action." }, { status: 400 });
      }
      if (draft.approval_status !== "approved" || !draft.approved_at) {
        return NextResponse.json({ error: "Facebook drafts must be approved before sending." }, { status: 403 });
      }

      const lead = draft.facebook_leads as unknown as { fb_psid?: string | null; messages_sent?: number | null };
      if (!lead.fb_psid) return NextResponse.json({ error: "Facebook PSID missing for this lead." }, { status: 400 });

      try {
        await assertSocialPublishAllowed({
          source: { type: "facebook_message", messageId: draft_message_id },
          destination: { provider: "facebook", channel: "facebook_dm" },
          action: "send_external",
          actorId: user.id,
          text: draft.message,
        });
      } catch (error) {
        if (error instanceof SocialPublishBlockedError) {
          return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
        }
        throw error;
      }

      const sentAt = new Date().toISOString();
      const sendResult = await sendFacebookMessage(lead.fb_psid, draft.message);
      if (!sendResult.ok) {
        await db.from("facebook_messages").update({
          delivery_status: "failed",
          sent_by_user_id: user.id,
          error_detail: sendResult.error ?? "Facebook send failed.",
        }).eq("id", draft_message_id);
        await logPlatformAuditEvent({
          actorType: "human",
          actorId: user.id,
          module: "facebook",
          actionType: "send_draft",
          entityType: "facebook_message",
          entityId: draft_message_id,
          sourceTable: "facebook_messages",
          sourceId: draft_message_id,
          channel: "facebook_dm",
          provider: "facebook",
          resultStatus: "failure",
          approvalState: "approved",
          severity: "high",
          message: "Approved Facebook draft failed during external send.",
          errorMessage: sendResult.error ?? "Facebook send failed.",
          metadata: { lead_id: draft.lead_id },
        });
        return NextResponse.json({ error: sendResult.error ?? "Facebook send failed." }, { status: 502 });
      }

      await db.from("facebook_messages").update({
        delivery_status: "sent",
        requires_approval: false,
        sent_by_user_id: user.id,
        actual_sent_at: sentAt,
        sent_at: sentAt,
        mid: sendResult.messageId ?? null,
        error_detail: null,
      }).eq("id", draft_message_id);

      await db.from("facebook_leads").update({
        messages_sent: (lead.messages_sent ?? 0) + 1,
        updated_at: sentAt,
      }).eq("id", draft.lead_id);

      await logPlatformAuditEvent({
        actorType: "human",
        actorId: user.id,
        module: "facebook",
        actionType: "send_draft",
        entityType: "facebook_message",
        entityId: draft_message_id,
        sourceTable: "facebook_messages",
        sourceId: draft_message_id,
        channel: "facebook_dm",
        provider: "facebook",
        resultStatus: "success",
        approvalState: "sent",
        severity: "medium",
        message: "Approved Facebook draft sent through the Graph API.",
        metadata: {
          lead_id: draft.lead_id,
          external_message_id: sendResult.messageId ?? null,
        },
      });

      return NextResponse.json({ ok: true, message_id: sendResult.messageId ?? null });
    }

    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    // Advance pipeline based on action
    const stageMap: Record<string, string> = {
      comment_sent:     "comment_posted",
      reply_received:   "engaged",
      dm_sent:          "dm_sent",
      dm_replied:       "replied",
      qualified:        "qualified",
      offer_sent:       "offer_presented",
      close_attempt:    "close_attempt",
      closed_won:       "closed_won",
      closed_lost:      "closed_lost",
      follow_up:        "follow_up",
    };

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { ...updates, updated_at: now };

    if (action && stageMap[action]) {
      patch.pipeline_status = stageMap[action];
      if (action === "comment_sent")  patch.comment_sent_at = now;
      if (action === "dm_sent")       patch.dm_sent_at = now;
      if (action === "dm_replied")    patch.last_reply_at = now;
      if (action === "closed_won")    patch.closed_at = now;
      // Check for hot lead keywords
      if (updates.message_received) {
        const hot = /price|how much|interested|tell me more|send info|availability|spots/.test(
          (updates.message_received as string).toLowerCase()
        );
        if (hot) { patch.is_hot_lead = true; patch.pipeline_status = "close_attempt"; }
      }
    }

    const { data, error } = await db
      .from("fb_opportunities")
      .update(patch)
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ opportunity: data });

  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(-10);
  return d.length === 10 ? `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}` : raw;
}
