import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireCron } from "@/lib/auth/api-guards";
import {
  auditDeliverabilityCopy,
  buildOutreachSourceAttribution,
} from "@/lib/sales-engine/outreach-governance";

export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/facebook/followup
// Cron: 3x daily — checks for stalled conversations and sends follow-ups
// Follow-up 1: 24 hours after last message with no reply
// Follow-up 2: 48 hours after follow-up 1 with no reply
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_ACCESS_TOKEN = () => process.env.FACEBOOK_PAGE_ACCESS_TOKEN ?? "";
const FB_API = "https://graph.facebook.com/v19.0";

async function fbSend(psid: string, text: string): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const token = PAGE_ACCESS_TOKEN();
  if (!token) return { ok: false, error: "FACEBOOK_PAGE_ACCESS_TOKEN is not configured." };
  try {
    const res = await fetch(`${FB_API}/me/messages?access_token=${token}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        recipient: { id: psid },
        message:   { text },
        messaging_type: "MESSAGE_TAG",
        tag: "ACCOUNT_UPDATE",
      }),
    });
    const data = await res.json() as { message_id?: string; error?: { message?: string } };
    if (!res.ok) return { ok: false, error: data.error?.message ?? `Facebook API ${res.status}` };
    return { ok: true, messageId: data.message_id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function queueFacebookFollowupDraft({
  db,
  lead,
  message,
  proposedAction,
  metadata,
}: {
  db: ReturnType<typeof createServiceClient>;
  lead: Record<string, unknown>;
  message: string;
  proposedAction: "followup_1" | "followup_2";
  metadata: Record<string, unknown>;
}) {
  const { data: existingDraft } = await db
    .from("facebook_messages")
    .select("id")
    .eq("lead_id", lead.id)
    .eq("source", "facebook_followup_cron")
    .eq("proposed_action", proposedAction)
    .eq("delivery_status", "draft")
    .maybeSingle();

  if (existingDraft?.id) {
    return { queued: false, skipped: true, id: existingDraft.id as string };
  }

  const { data, error } = await db
    .from("facebook_messages")
    .insert({
      lead_id: lead.id,
      direction: "outbound",
      message,
      agent: "closer",
      delivery_status: "draft",
      approval_status: "pending",
      requires_approval: true,
      proposed_action: proposedAction,
      source: "facebook_followup_cron",
      metadata: {
        ...metadata,
        automation_mode: "approval_guard_required",
      },
    })
    .select("id")
    .single();

  if (error) return { queued: false, skipped: false, error: error.message };
  return { queued: true, skipped: false, id: data?.id as string | undefined };
}

export async function POST(req: Request) {
  const guard = requireCron(req);
  if (!guard.ok) return guard.response;

  if (
    process.env.FACEBOOK_FOLLOWUP_AUTO_SEND_ENABLED !== "true" ||
    process.env.FACEBOOK_FOLLOWUP_HUMAN_APPROVED !== "true"
  ) {
    return NextResponse.json({
      ok: true,
      disabled: true,
      reason: "Facebook follow-up auto-send is disabled until both FACEBOOK_FOLLOWUP_AUTO_SEND_ENABLED and FACEBOOK_FOLLOWUP_HUMAN_APPROVED are true.",
      approval_status: "needs_review",
      next_action: "Review Facebook follow-up drafts and send one-to-one only after approval.",
      summary: { followup1_sent: 0, followup2_sent: 0, errors: 0 },
    });
  }

  const db  = createServiceClient();
  const { data: controls } = await db
    .from("system_controls")
    .select("all_paused, facebook_paused, manual_approval_mode, outreach_test_mode")
    .eq("id", 1)
    .maybeSingle();

  if (
    controls?.all_paused ||
    controls?.facebook_paused ||
    controls?.manual_approval_mode ||
    controls?.outreach_test_mode
  ) {
    return NextResponse.json({
      ok: true,
      disabled: true,
      reason: "Facebook follow-up is blocked by HomeReach system controls.",
      approval_status: "needs_review",
      summary: { followup1_sent: 0, followup2_sent: 0, errors: 0 },
    });
  }

  const now = new Date();
  const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const h48 = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();

  const summary = { followup1_sent: 0, followup2_sent: 0, drafts_created: 0, drafts_skipped: 0, errors: 0 };

  // ── Follow-up 1: 24h no response, no follow-up sent yet ──────────────────
  const { data: needsFollowup1 } = await db
    .from("facebook_leads")
    .select("*")
    .lt("last_message_at", h24)
    .is("follow_up_1_sent_at", null)
    .not("lead_status", "in", "(closed,dead)")
    .not("last_message_at", "is", null);

  for (const lead of needsFollowup1 ?? []) {
    const name = (lead.fb_name as string)?.split(" ")[0] ?? "there";
    const cat  = lead.category ?? "your industry";
    const loc  = lead.city ?? "your area";

    const msg = lead.lead_status === "hot"
      ? `Hey ${name}, quick follow-up on the HomeReach ${cat} visibility option in ${loc}. Want me to send the simple coverage and pricing details for review?`
      : `Hey ${name}, wanted to follow up on HomeReach in ${loc}. If local visibility is still useful, I can send a simple overview for ${cat} businesses.`;
    const sourceAttribution = buildOutreachSourceAttribution({
      workflow: "facebook_followup_cron",
      channel: "facebook_dm",
      lead: {
        id: lead.sales_lead_id ?? lead.id,
        business_name: lead.fb_name ?? `Facebook Lead ${lead.fb_psid}`,
        city: loc,
        category: cat,
        status: lead.lead_status,
        last_contacted_at: lead.last_message_at,
      },
      destination: lead.fb_psid,
      templateId: "facebook_followup_1_safe_v2",
      action: "Facebook follow-up candidate",
      nextAction: "Human-approved Facebook DM follow-up.",
      approvalStatus: "approved",
      sources: ["facebook_leads", "facebook_messages", "sales_leads"],
    });
    const deliverability = auditDeliverabilityCopy(msg, "facebook_dm");
    if (deliverability.status === "blocked") {
      summary.errors++;
      continue;
    }

    const queued = await queueFacebookFollowupDraft({
      db,
      lead,
      message: msg,
      proposedAction: "followup_1",
      metadata: { source_attribution: sourceAttribution, deliverability },
    });
    if (queued.error) {
      summary.errors++;
      continue;
    }
    if (queued.skipped) {
      summary.drafts_skipped++;
      continue;
    }
    try {
      await db.from("ai_workforce_activity_logs").insert({
        agent_name: "Outreach Agent",
        event_type: "facebook_followup_draft_created",
        status: "needs_review",
        summary: `Facebook follow-up 1 draft queued for ${sourceAttribution.related_entity.label}.`,
        details: { source_attribution: sourceAttribution, deliverability },
        approval_status: "needs_review",
      });
    } catch (logError) {
      console.warn("[FB followup] activity log skipped:", logError);
    }

    summary.drafts_created++;
  }

  // ── Follow-up 2: 48h after follow-up 1, still no response ────────────────
  const { data: needsFollowup2 } = await db
    .from("facebook_leads")
    .select("*")
    .lt("follow_up_1_sent_at", h48)
    .is("follow_up_2_sent_at", null)
    .not("lead_status", "in", "(closed,dead)")
    .not("follow_up_1_sent_at", "is", null);

  for (const lead of needsFollowup2 ?? []) {
    const name = (lead.fb_name as string)?.split(" ")[0] ?? "there";
    const loc  = lead.city ?? "your area";

    const msg = `Hey ${name}, last note from me for now. If the timing is off, no problem.\n\n` +
      `If a simple HomeReach coverage overview for ${loc} would help later, reply here and I can send it over.\n\n` +
      `Wishing you continued success.`;
    const sourceAttribution = buildOutreachSourceAttribution({
      workflow: "facebook_followup_cron",
      channel: "facebook_dm",
      lead: {
        id: lead.sales_lead_id ?? lead.id,
        business_name: lead.fb_name ?? `Facebook Lead ${lead.fb_psid}`,
        city: loc,
        category: lead.category ?? "your industry",
        status: lead.lead_status,
        last_contacted_at: lead.follow_up_1_sent_at,
      },
      destination: lead.fb_psid,
      templateId: "facebook_followup_2_safe_v2",
      action: "Facebook final follow-up candidate",
      nextAction: "Close the loop unless the lead replies.",
      approvalStatus: "approved",
      sources: ["facebook_leads", "facebook_messages", "sales_leads"],
    });
    const deliverability = auditDeliverabilityCopy(msg, "facebook_dm");
    if (deliverability.status === "blocked") {
      summary.errors++;
      continue;
    }

    const queued = await queueFacebookFollowupDraft({
      db,
      lead,
      message: msg,
      proposedAction: "followup_2",
      metadata: { source_attribution: sourceAttribution, deliverability },
    });
    if (queued.error) {
      summary.errors++;
      continue;
    }
    if (queued.skipped) {
      summary.drafts_skipped++;
      continue;
    }
    try {
      await db.from("ai_workforce_activity_logs").insert({
        agent_name: "Outreach Agent",
        event_type: "facebook_followup_draft_created",
        status: "needs_review",
        summary: `Facebook follow-up 2 draft queued for ${sourceAttribution.related_entity.label}.`,
        details: { source_attribution: sourceAttribution, deliverability },
        approval_status: "needs_review",
      });
    } catch (logError) {
      console.warn("[FB followup] activity log skipped:", logError);
    }

    summary.drafts_created++;
  }

  return NextResponse.json({ ok: true, summary });
}
