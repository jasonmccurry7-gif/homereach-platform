import { NextResponse } from "next/server";
import { syncFacebookMessageLedger } from "@/lib/approvals/facebook-ledger";
import { createServiceClient } from "@/lib/supabase/service";
import { assertSocialPublishAllowed, SocialPublishBlockedError } from "@/lib/social-content/publish-guard";
import {
  getFacebookVerifyToken,
  verifyFacebookSignature,
} from "@/lib/security/facebook-webhook";

export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// Facebook Webhook — HomeReach Closing Engine
//
// Routes:
//   GET  /api/facebook/webhook  → Webhook verification (Meta setup)
//   POST /api/facebook/webhook  → Incoming messages, comments, engagement
//
// Flow:
//   Facebook → Webhook → APEX classification → Echo/Prospector/Closer
//   → Facebook Messenger API → CRM update → Revenue
// ─────────────────────────────────────────────────────────────────────────────

// ── Hot lead keywords — trigger Closer immediately ───────────────────────────
const HOT_KEYWORDS = [
  "price", "how much", "cost", "pricing",
  "interested", "tell me more", "want to know",
  "availability", "spots left", "available",
  "sign up", "sign me up", "let's do it",
  "how do i", "where do i", "lock in", "reserve",
  "ready", "yes", "yeah", "sure",
];

// ── Qualifying keywords → move to Prospector ────────────────────────────────
const WARM_KEYWORDS = [
  "business", "restaurant", "plumber", "hvac", "roofing", "landscaping",
  "cleaning", "contractor", "service", "shop", "company",
  "advertising", "marketing", "customers", "clients", "reach",
  "homeowners", "neighborhood", "local",
];

// ── City detection ────────────────────────────────────────────────────────────
const OHIO_CITIES = [
  "wooster", "medina", "massillon", "cuyahoga falls", "canton",
  "akron", "brunswick", "barberton", "wadsworth", "stow", "kent",
];

// ── Facebook Graph API helpers ───────────────────────────────────────────────
const PAGE_ACCESS_TOKEN = () => process.env.FACEBOOK_PAGE_ACCESS_TOKEN ?? "";
const FB_API = "https://graph.facebook.com/v19.0";

function envFlag(key: string, defaultValue = false): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function facebookAutoReplyEnabled(): boolean {
  return envFlag("FACEBOOK_AUTO_REPLY_ENABLED", false) && envFlag("FACEBOOK_AUTO_REPLY_HUMAN_APPROVED", false);
}

function facebookCommentAutoReplyEnabled(): boolean {
  return envFlag("FACEBOOK_COMMENT_AUTO_REPLY_ENABLED", false) && envFlag("FACEBOOK_COMMENT_AUTO_REPLY_HUMAN_APPROVED", false);
}

function facebookCommentAutoDmEnabled(): boolean {
  return envFlag("FACEBOOK_COMMENT_AUTO_DM_ENABLED", false) && envFlag("FACEBOOK_COMMENT_AUTO_DM_HUMAN_APPROVED", false);
}

async function facebookOutboundControlsAllow(
  db: ReturnType<typeof createServiceClient>,
): Promise<boolean> {
  try {
    const { data } = await db
      .from("system_controls")
      .select("all_paused, facebook_paused, manual_approval_mode, outreach_test_mode")
      .eq("id", 1)
      .maybeSingle();

    if (
      data?.all_paused ||
      data?.facebook_paused ||
      data?.manual_approval_mode ||
      data?.outreach_test_mode
    ) {
      return false;
    }
  } catch {
    return false;
  }
  return true;
}

async function facebookAutoReplyAllowed(db: ReturnType<typeof createServiceClient>): Promise<boolean> {
  return facebookAutoReplyEnabled() && await facebookOutboundControlsAllow(db);
}

async function facebookCommentAutoReplyAllowed(db: ReturnType<typeof createServiceClient>): Promise<boolean> {
  return facebookCommentAutoReplyEnabled() && await facebookOutboundControlsAllow(db);
}

async function facebookCommentAutoDmAllowed(db: ReturnType<typeof createServiceClient>): Promise<boolean> {
  return facebookCommentAutoDmEnabled() && await facebookOutboundControlsAllow(db);
}

async function fbSend(psid: string, text: string): Promise<string | null> {
  const token = PAGE_ACCESS_TOKEN();
  if (!token) { console.error("[FB] No page access token"); return null; }

  try {
    const res = await fetch(`${FB_API}/me/messages?access_token=${token}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        recipient:       { id: psid },
        message:         { text },
        messaging_type: "RESPONSE",
      }),
    });
    const data = await res.json() as { message_id?: string; error?: unknown };
    if (!res.ok) { console.error("[FB] Send error:", data.error); return null; }
    return data.message_id ?? null;
  } catch (err) {
    console.error("[FB] Send exception:", err);
    return null;
  }
}

async function fbCommentReply(commentId: string, message: string): Promise<void> {
  const token = PAGE_ACCESS_TOKEN();
  if (!token) return;
  await fetch(`${FB_API}/${commentId}/comments?access_token=${token}`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ message }),
  }).catch(() => {});
}

async function fbGetUserProfile(psid: string): Promise<{ name?: string; profile_pic?: string }> {
  const token = PAGE_ACCESS_TOKEN();
  if (!token) return {};
  try {
    const res = await fetch(`${FB_API}/${psid}?fields=name,profile_pic&access_token=${token}`);
    return await res.json() as { name?: string; profile_pic?: string };
  } catch { return {}; }
}

// ── Webhook verification ──────────────────────────────────────────────────────
export async function GET(req: Request) {
  const url    = new URL(req.url);
  const mode   = url.searchParams.get("hub.mode");
  const token  = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const verifyToken = getFacebookVerifyToken();
  if (!verifyToken) {
    return NextResponse.json(
      { error: "Facebook webhook verify token is not configured" },
      { status: 503 },
    );
  }

  if (mode === "subscribe" && token === verifyToken && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

// ── Main webhook handler ──────────────────────────────────────────────────────
export async function POST(req: Request) {
  const rawBody = await req.text();
  const signatureCheck = verifyFacebookSignature(
    rawBody,
    req.headers.get("x-hub-signature-256"),
  );

  if (!signatureCheck.ok) {
    return NextResponse.json(
      { error: signatureCheck.reason },
      { status: signatureCheck.status },
    );
  }

  try {
    const payload = JSON.parse(rawBody);
    await processWebhookPayload(payload);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  return new NextResponse("EVENT_RECEIVED", { status: 200 });
}

// ─────────────────────────────────────────────────────────────────────────────
// Payload processor
// ─────────────────────────────────────────────────────────────────────────────

async function processWebhookPayload(payload: Record<string, unknown>) {
  const object = payload.object as string;
  if (object !== "page") return;

  const entries = (payload.entry as Record<string, unknown>[]) ?? [];

  for (const entry of entries) {
    // ── Messenger messages ──────────────────────────────────────────────────
    const messaging = (entry.messaging as Record<string, unknown>[]) ?? [];
    for (const event of messaging) {
      if ((event.message as Record<string, unknown>)?.text) {
        await handleMessage(event).catch(err =>
          console.error("[FB] message handler error:", err)
        );
      }
      if (event.read || event.delivery) continue; // skip read receipts
    }

    // ── Page feed (comments) ────────────────────────────────────────────────
    const changes = (entry.changes as Record<string, unknown>[]) ?? [];
    for (const change of changes) {
      if ((change.value as Record<string, unknown>)?.item === "comment") {
        await handleComment(change.value as Record<string, unknown>).catch(err =>
          console.error("[FB] comment handler error:", err)
        );
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Message handler — core closing engine
// ─────────────────────────────────────────────────────────────────────────────

async function handleMessage(event: Record<string, unknown>) {
  const sender  = (event.sender as Record<string, string>)?.id;
  const msgObj  = event.message as Record<string, unknown>;
  const text    = (msgObj?.text as string ?? "").trim();
  if (!sender || !text) return;

  const db      = createServiceClient();
  const lower   = text.toLowerCase();

  // ── 1. Get or create lead record ──────────────────────────────────────────
  let { data: lead } = await db
    .from("facebook_leads")
    .select("*")
    .eq("fb_psid", sender)
    .maybeSingle();

  if (!lead) {
    const profile = await fbGetUserProfile(sender);
    const { data: newLead } = await db
      .from("facebook_leads")
      .insert({
        fb_psid:   sender,
        fb_name:   profile.name ?? null,
        fb_profile_pic: profile.profile_pic ?? null,
        source:    "messenger",
      })
      .select()
      .single();
    lead = newLead;
  }

  if (!lead) return;

  // ── 2. Log inbound message ────────────────────────────────────────────────
  await db.from("facebook_messages").insert({
    lead_id:   lead.id,
    direction: "inbound",
    message:   text,
    agent:     null,
    delivery_status: "received",
    approval_status: "not_required",
    requires_approval: false,
    source: "facebook_webhook",
  });

  await db.from("facebook_leads").update({
    last_message_at:  new Date().toISOString(),
    messages_received: (lead.messages_received ?? 0) + 1,
    updated_at:        new Date().toISOString(),
  }).eq("id", lead.id);

  // ── 3. APEX: classify intent ──────────────────────────────────────────────
  const intentScore = classifyIntent(lower, lead);
  const detectedCity = detectCity(lower);
  const detectedCategory = detectCategory(lower);

  if (/\b(stop|unsubscribe|do not contact|don't contact|leave me alone)\b/i.test(lower)) {
    await db.from("facebook_leads").update({
      lead_status: "dead",
      current_agent: "manual_review",
      conversation_stage: "opt_out",
      updated_at: new Date().toISOString(),
    }).eq("id", lead.id);
    return;
  }

  // Update lead data if new info found
  const updates: Record<string, unknown> = { intent_level: intentScore };
  if (detectedCity    && !lead.city)     updates.city     = detectedCity;
  if (detectedCategory && !lead.category) updates.category = detectedCategory;
  await db.from("facebook_leads").update(updates).eq("id", lead.id);

  // ── 4. Route to correct agent ─────────────────────────────────────────────
  const isHot  = intentScore >= 7 || HOT_KEYWORDS.some(k => lower.includes(k));
  const isWarm = intentScore >= 4 || WARM_KEYWORDS.some(k => lower.includes(k));

  let response: string;
  let agentName: string;
  let newStatus: string = lead.lead_status;
  let newAgent: string  = lead.current_agent;
  let newStage: string  = lead.conversation_stage;

  if (isHot || lead.lead_status === "hot") {
    // ── CLOSER takes over ───────────────────────────────────────────────────
    agentName = "closer";
    newAgent  = "closer";
    newStatus = "hot";
    newStage  = lead.conversation_stage === "initial" ? "pricing" : "closing";
    response  = buildCloserResponse(text, lead, detectedCity, detectedCategory);

  } else if (isWarm || lead.current_agent === "prospector") {
    // ── PROSPECTOR qualifies ────────────────────────────────────────────────
    agentName = "prospector";
    newAgent  = "prospector";
    newStatus = "warm";
    newStage  = "qualifying";
    response  = buildProspectorResponse(text, lead, detectedCity, detectedCategory);

  } else {
    // ── ECHO handles initial engagement ────────────────────────────────────
    agentName = "echo";
    response  = buildEchoResponse(text, lead);
  }

  // ── 5. Send response ──────────────────────────────────────────────────────
  const shouldAutoReply = await facebookAutoReplyAllowed(db);
  const { data: outboundDraft } = await db
    .from("facebook_messages")
    .insert({
      lead_id:   lead.id,
      direction: "outbound",
      message:   response,
      agent:     agentName,
      delivery_status: "draft",
      approval_status: "pending",
      requires_approval: true,
      proposed_action: "reply",
      source: "facebook_webhook",
      metadata: {
        intent_score: intentScore,
        generated_by: agentName,
        automation_mode: shouldAutoReply ? "approval_guard_required" : "draft_for_approval",
      },
    })
    .select("id, lead_id, message, delivery_status, approval_status, source, proposed_action, requires_approval, metadata, created_at, updated_at")
    .single();

  if (outboundDraft?.id) {
    const ledgerResult = await syncFacebookMessageLedger({
      id: String(outboundDraft.id),
      leadId: typeof outboundDraft.lead_id === "string" ? outboundDraft.lead_id : String(lead.id),
      message: String(outboundDraft.message ?? response),
      deliveryStatus: String(outboundDraft.delivery_status ?? "draft"),
      approvalStatus: String(outboundDraft.approval_status ?? "pending"),
      source: typeof outboundDraft.source === "string" ? outboundDraft.source : "facebook_webhook",
      proposedAction: typeof outboundDraft.proposed_action === "string" ? outboundDraft.proposed_action : "reply",
      requiresApproval: Boolean(outboundDraft.requires_approval ?? true),
      metadata: outboundDraft.metadata && typeof outboundDraft.metadata === "object" && !Array.isArray(outboundDraft.metadata)
        ? (outboundDraft.metadata as Record<string, unknown>)
        : {},
      createdAt: typeof outboundDraft.created_at === "string" ? outboundDraft.created_at : null,
      updatedAt: typeof outboundDraft.updated_at === "string" ? outboundDraft.updated_at : null,
    }, {
      actorLabel: "facebook_webhook",
      eventType: "facebook_webhook_draft_created",
    });
    if (!ledgerResult.ok) {
      console.warn("[approval-ledger] facebook webhook draft sync skipped:", ledgerResult.error);
    }
  }

  let sentOk = false;

  // ── 6. Log outbound + update state ───────────────────────────────────────
  if (shouldAutoReply && outboundDraft?.id) {
    try {
      await assertSocialPublishAllowed({
        source: { type: "facebook_message", messageId: outboundDraft.id },
        destination: { provider: "facebook", channel: "facebook_dm" },
        action: "send_external",
        text: response,
      });
      const mid = await fbSend(sender, response);
      sentOk = Boolean(mid);
      const { data: sentDraft } = await db.from("facebook_messages").update({
        mid: mid ?? null,
        delivery_status: sentOk ? "sent" : "failed",
        requires_approval: false,
        actual_sent_at: sentOk ? new Date().toISOString() : null,
        error_detail: sentOk ? null : "Facebook Graph API send returned no message id.",
      }).eq("id", outboundDraft.id)
        .select("id, lead_id, message, delivery_status, approval_status, source, proposed_action, requires_approval, actual_sent_at, mid, error_detail, metadata, created_at, updated_at")
        .single();
      if (sentDraft) {
        const ledgerResult = await syncFacebookMessageLedger({
          id: String(sentDraft.id),
          leadId: typeof sentDraft.lead_id === "string" ? sentDraft.lead_id : String(lead.id),
          message: String(sentDraft.message ?? response),
          deliveryStatus: String(sentDraft.delivery_status ?? (sentOk ? "sent" : "failed")),
          approvalStatus: String(sentDraft.approval_status ?? "pending"),
          source: typeof sentDraft.source === "string" ? sentDraft.source : "facebook_webhook",
          proposedAction: typeof sentDraft.proposed_action === "string" ? sentDraft.proposed_action : "reply",
          requiresApproval: Boolean(sentDraft.requires_approval ?? false),
          sentAt: typeof sentDraft.actual_sent_at === "string" ? sentDraft.actual_sent_at : null,
          errorDetail: typeof sentDraft.error_detail === "string" ? sentDraft.error_detail : null,
          mid: typeof sentDraft.mid === "string" ? sentDraft.mid : mid ?? null,
          metadata: sentDraft.metadata && typeof sentDraft.metadata === "object" && !Array.isArray(sentDraft.metadata)
            ? (sentDraft.metadata as Record<string, unknown>)
            : {},
          createdAt: typeof sentDraft.created_at === "string" ? sentDraft.created_at : null,
          updatedAt: typeof sentDraft.updated_at === "string" ? sentDraft.updated_at : null,
        }, {
          actorLabel: "facebook_webhook",
          eventType: sentOk ? "facebook_webhook_auto_sent" : "facebook_webhook_auto_send_failed",
        });
        if (!ledgerResult.ok) {
          console.warn("[approval-ledger] facebook webhook send sync skipped:", ledgerResult.error);
        }
      }
    } catch (error) {
      const blockedMetadata = {
        intent_score: intentScore,
        generated_by: agentName,
        automation_mode: "draft_for_approval",
        auto_send_blocked: true,
        block_reason: error instanceof SocialPublishBlockedError ? error.message : "Facebook approval guard blocked auto-send.",
      };
      const { data: blockedDraft } = await db.from("facebook_messages").update({
        metadata: blockedMetadata,
      }).eq("id", outboundDraft.id)
        .select("id, lead_id, message, delivery_status, approval_status, source, proposed_action, requires_approval, metadata, created_at, updated_at")
        .single();
      if (blockedDraft) {
        const ledgerResult = await syncFacebookMessageLedger({
          id: String(blockedDraft.id),
          leadId: typeof blockedDraft.lead_id === "string" ? blockedDraft.lead_id : String(lead.id),
          message: String(blockedDraft.message ?? response),
          deliveryStatus: String(blockedDraft.delivery_status ?? "draft"),
          approvalStatus: String(blockedDraft.approval_status ?? "pending"),
          source: typeof blockedDraft.source === "string" ? blockedDraft.source : "facebook_webhook",
          proposedAction: typeof blockedDraft.proposed_action === "string" ? blockedDraft.proposed_action : "reply",
          requiresApproval: Boolean(blockedDraft.requires_approval ?? true),
          metadata: blockedDraft.metadata && typeof blockedDraft.metadata === "object" && !Array.isArray(blockedDraft.metadata)
            ? (blockedDraft.metadata as Record<string, unknown>)
            : blockedMetadata,
          createdAt: typeof blockedDraft.created_at === "string" ? blockedDraft.created_at : null,
          updatedAt: typeof blockedDraft.updated_at === "string" ? blockedDraft.updated_at : null,
        }, {
          actorLabel: "facebook_webhook",
          eventType: "facebook_webhook_auto_send_blocked",
        });
        if (!ledgerResult.ok) {
          console.warn("[approval-ledger] facebook webhook blocked sync skipped:", ledgerResult.error);
        }
      }
    }
  }

  await db.from("facebook_leads").update({
    current_agent:     newAgent,
    lead_status:       newStatus,
    conversation_stage: newStage,
    last_reply_at:     new Date().toISOString(),
    messages_sent:     sentOk ? (lead.messages_sent ?? 0) + 1 : (lead.messages_sent ?? 0),
    updated_at:        new Date().toISOString(),
  }).eq("id", lead.id);

  // ── 7. Upsert to sales_leads for full CRM tracking ───────────────────────
  if (lead.fb_name || detectedCity) {
    const salesLeadPayload = {
      business_name: lead.fb_name ?? `Facebook Lead ${sender.slice(-6)}`,
      city:          detectedCity ?? lead.city ?? "",
      category:      detectedCategory ?? lead.category ?? "",
      status:        newStatus === "hot" ? "interested" : newStatus === "warm" ? "contacted" : "queued",
      source:        "facebook",
    };

    if (lead.sales_lead_id) {
      await db.from("sales_leads").update(salesLeadPayload).eq("id", lead.sales_lead_id);
    } else {
      const { data: salesLeadRows } = await db
        .from("sales_leads")
        .insert({
          ...salesLeadPayload,
          do_not_contact: false,
          sms_opt_out: false,
        })
        .select("id");
      const salesLeadId = salesLeadRows?.[0]?.id;
      if (salesLeadId) {
        await db.from("facebook_leads").update({ sales_lead_id: salesLeadId }).eq("id", lead.id);
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Comment handler → DM conversion
// ─────────────────────────────────────────────────────────────────────────────

async function handleComment(value: Record<string, unknown>) {
  const commentId = value.comment_id as string;
  const senderId  = (value.from as Record<string, string>)?.id;
  const message   = (value.message as string ?? "").trim();
  if (!senderId || !message) return;

  const db = createServiceClient();
  const profile = await fbGetUserProfile(senderId);
  const firstName = profile.name?.split(" ")[0] ?? "there";

  const { data: lead } = await db.from("facebook_leads").upsert({
    fb_psid:         senderId,
    fb_name:         profile.name ?? null,
    source:          "comment",
    comment_post_id: commentId,
    current_agent:   "echo",
    lead_status:     "warm",
  }, { onConflict: "fb_psid" }).select("id").single();

  if (!lead?.id) return;

  if (await facebookCommentAutoReplyAllowed(db)) {
    const { data: commentReplyDraft } = await db.from("facebook_messages").insert({
      lead_id: lead.id,
      direction: "outbound",
      message: "Thanks for engaging. I can send a quick DM with more info about HomeReach after review.",
      agent: "echo",
      delivery_status: "draft",
      approval_status: "pending",
      requires_approval: true,
      proposed_action: "comment_reply",
      source: "facebook_webhook_comment",
      metadata: {
        comment_id: commentId,
        automation_mode: "approval_guard_required",
      },
    }).select("id, lead_id, message, delivery_status, approval_status, source, proposed_action, requires_approval, metadata, created_at, updated_at").single();
    if (commentReplyDraft) {
      const ledgerResult = await syncFacebookMessageLedger({
        id: String(commentReplyDraft.id),
        leadId: typeof commentReplyDraft.lead_id === "string" ? commentReplyDraft.lead_id : String(lead.id),
        message: String(commentReplyDraft.message ?? ""),
        deliveryStatus: String(commentReplyDraft.delivery_status ?? "draft"),
        approvalStatus: String(commentReplyDraft.approval_status ?? "pending"),
        source: typeof commentReplyDraft.source === "string" ? commentReplyDraft.source : "facebook_webhook_comment",
        proposedAction: typeof commentReplyDraft.proposed_action === "string" ? commentReplyDraft.proposed_action : "comment_reply",
        requiresApproval: Boolean(commentReplyDraft.requires_approval ?? true),
        metadata: commentReplyDraft.metadata && typeof commentReplyDraft.metadata === "object" && !Array.isArray(commentReplyDraft.metadata)
          ? (commentReplyDraft.metadata as Record<string, unknown>)
          : {},
        createdAt: typeof commentReplyDraft.created_at === "string" ? commentReplyDraft.created_at : null,
        updatedAt: typeof commentReplyDraft.updated_at === "string" ? commentReplyDraft.updated_at : null,
      }, {
        actorLabel: "facebook_webhook_comment",
        eventType: "facebook_comment_reply_draft_created",
      });
      if (!ledgerResult.ok) {
        console.warn("[approval-ledger] facebook comment reply draft sync skipped:", ledgerResult.error);
      }
    }
  }

  if (await facebookCommentAutoDmAllowed(db)) {
    const { data: commentDmDraft } = await db.from("facebook_messages").insert({
      lead_id: lead.id,
      direction: "outbound",
      message: `Hey ${firstName}, saw your comment and wanted to reach out directly.\n\nI'm with HomeReach. We help local businesses stay visible with nearby homeowners through reviewed postcard campaigns.\n\nAre you currently doing any local advertising?`,
      agent: "echo",
      delivery_status: "draft",
      approval_status: "pending",
      requires_approval: true,
      proposed_action: "dm_from_comment",
      source: "facebook_webhook_comment",
      metadata: {
        comment_id: commentId,
        automation_mode: "approval_guard_required",
      },
    }).select("id, lead_id, message, delivery_status, approval_status, source, proposed_action, requires_approval, metadata, created_at, updated_at").single();
    if (commentDmDraft) {
      const ledgerResult = await syncFacebookMessageLedger({
        id: String(commentDmDraft.id),
        leadId: typeof commentDmDraft.lead_id === "string" ? commentDmDraft.lead_id : String(lead.id),
        message: String(commentDmDraft.message ?? ""),
        deliveryStatus: String(commentDmDraft.delivery_status ?? "draft"),
        approvalStatus: String(commentDmDraft.approval_status ?? "pending"),
        source: typeof commentDmDraft.source === "string" ? commentDmDraft.source : "facebook_webhook_comment",
        proposedAction: typeof commentDmDraft.proposed_action === "string" ? commentDmDraft.proposed_action : "dm_from_comment",
        requiresApproval: Boolean(commentDmDraft.requires_approval ?? true),
        metadata: commentDmDraft.metadata && typeof commentDmDraft.metadata === "object" && !Array.isArray(commentDmDraft.metadata)
          ? (commentDmDraft.metadata as Record<string, unknown>)
          : {},
        createdAt: typeof commentDmDraft.created_at === "string" ? commentDmDraft.created_at : null,
        updatedAt: typeof commentDmDraft.updated_at === "string" ? commentDmDraft.updated_at : null,
      }, {
        actorLabel: "facebook_webhook_comment",
        eventType: "facebook_comment_dm_draft_created",
      });
      if (!ledgerResult.ok) {
        console.warn("[approval-ledger] facebook comment DM draft sync skipped:", ledgerResult.error);
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Intent classification (0-10 scale)
// ─────────────────────────────────────────────────────────────────────────────

function classifyIntent(
  lower: string,
  lead: Record<string, unknown>
): number {
  let score = (lead.intent_level as number) ?? 0;
  if (HOT_KEYWORDS.some(k => lower.includes(k)))  score = Math.max(score, 7);
  if (WARM_KEYWORDS.some(k => lower.includes(k)))  score = Math.max(score, 4);
  if (/yes|yeah|sure|ok|okay|let's/.test(lower))   score = Math.max(score, 8);
  if (/no|not interested|stop|unsubscribe/.test(lower)) score = 0;
  return Math.min(10, score);
}

function detectCity(lower: string): string | null {
  return OHIO_CITIES.find(c => lower.includes(c)) ?? null;
}

function detectCategory(lower: string): string | null {
  const cats: Record<string, string> = {
    "restaurant|food|pizza|diner|cafe": "Restaurant & Food",
    "plumb|pipe":                        "Plumbing",
    "hvac|heat|cool|air condition":      "HVAC",
    "roof":                              "Roofing",
    "landscap|lawn|yard":                "Landscaping",
    "clean|maid|janitor":                "Home Cleaning",
    "electric":                          "Electrical",
    "paint":                             "Painting",
    "pest|exterminat":                   "Pest Control",
    "pressure.?wash|power.?wash":        "Pressure Washing",
    "junk|haul|remov":                   "Junk Removal",
    "tree|trim|stump":                   "Tree Service",
    "garage.?door":                      "Garage Doors",
    "gutter":                            "Gutters",
    "floor":                             "Flooring",
    "window|door install":               "Windows & Doors",
    "remodel|renovati|contactor":        "Home Remodeling",
    "real estate|realtor":               "Real Estate",
    "solar|panel":                       "Solar",
    "insurance":                         "Insurance",
    "concrete|masonry|brick":            "Concrete & Masonry",
  };
  for (const [pattern, category] of Object.entries(cats)) {
    if (new RegExp(pattern).test(lower)) return category;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent response builders
// ─────────────────────────────────────────────────────────────────────────────

function buildEchoResponse(text: string, lead: Record<string, unknown>): string {
  const name   = (lead.fb_name as string)?.split(" ")[0] ?? "there";
  const lower  = text.toLowerCase();

  if (lead.conversation_stage === "initial" || !lead.conversation_stage) {
    return `Hey ${name}, thanks for reaching out to HomeReach.\n\nWe help local businesses stay visible with nearby homeowners through reviewed postcard campaigns and simple follow-up. What type of business do you run?`;
  }

  if (/hello|hi|hey|yo/.test(lower)) {
    return `Hey ${name}! Great to hear from you. What type of business are you in?`;
  }

  return `Thanks ${name}! I'd love to learn more about your business. What service or industry are you in?`;
}

function buildProspectorResponse(
  text:     string,
  lead:     Record<string, unknown>,
  city:     string | null,
  category: string | null
): string {
  const name = (lead.fb_name as string)?.split(" ")[0] ?? "there";

  if (!category && !lead.category) {
    return `Great ${name}! What type of business do you run? (Plumbing, HVAC, Roofing, Cleaning, etc.)`;
  }

  if (!city && !lead.city) {
    const cat = category ?? (lead.category as string);
    return `Got it — ${cat}! And which city or area are you based in? We currently serve several markets in Ohio.`;
  }

  const cat  = category ?? (lead.category as string) ?? "your business";
  const loc  = city ?? (lead.city as string) ?? "your area";
  return `Perfect, ${cat} in ${loc}.\n\nI can send a simple HomeReach overview with coverage, format, and current pricing so you can review whether it fits. Want me to send that?`;
}

function buildCloserResponse(
  text:     string,
  lead:     Record<string, unknown>,
  city:     string | null,
  category: string | null
): string {
  const name = (lead.fb_name as string)?.split(" ")[0] ?? "there";
  const cat  = category ?? (lead.category as string) ?? "your category";
  const loc  = city ?? (lead.city as string) ?? "your area";
  const lower = text.toLowerCase();

  // Objection handling
  if (/too expensive|too much|can't afford|not in budget/.test(lower)) {
    return `${name}, I totally get it. Budget matters.\n\nOur entry package starts at $200/mo, and I can send the exact coverage, format, and pricing details so you can judge whether it fits.\n\nWant me to send the breakdown?`;
  }

  if (/need to think|think about it|not sure|maybe later/.test(lower)) {
    return `${name}, I hear you. It is a real decision, and timing matters.\n\nI can send the details so you have coverage, pricing, and next steps in one place. Want me to send that for review?`;
  }

  if (/already advertis|already have|google|facebook ads/.test(lower)) {
    return `That's great ${name} — sounds like you're already investing in growth! HomeReach is different from digital: we put a physical postcard directly in homeowners' hands. No algorithm, no ad fatigue. Many of our clients run us alongside Google and see it adds a completely different type of customer.\n\nWant to see what the spot in ${loc} looks like?`;
  }

  // Pricing inquiry
  if (/price|how much|cost|pricing/.test(lower)) {
    return `Great question ${name}. Current HomeReach package options start at $200/mo, with front and anchor placements available at higher tiers.\n\nPackages include professional design, print coordination, mailing support, and category review. Want me to send the full breakdown?`;
  }

  // Hot intent
  if (/interested|tell me more|want to know|availability|spots left/.test(lower)) {
    return `${name}, I can send the ${loc} details for ${cat}: package options, coverage, setup, and current pricing.\n\nThe next step is reviewing the details here: home-reach.com/get-started\n\nWant me to help you compare the options?`;
  }

  // Affirmative / ready to close
  if (/yes|yeah|sure|ok|let's|ready|sign|lock in|reserve/.test(lower)) {
    return `Great, ${name}. Here is the next-step link:\nhome-reach.com/get-started\n\nYou can review the package options and business info there. If any question comes up while you are looking, reply here and I will help.`;
  }

  // Default closer response
  return `${name}, based on what you shared, HomeReach may be worth reviewing for ${cat} in ${loc}.\n\nHere is the next-step link: home-reach.com/get-started\n\nWhat would you want clarified before deciding?`;
}
