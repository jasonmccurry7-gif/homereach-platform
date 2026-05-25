import { NextResponse } from "next/server";
import { requireCron } from "@/lib/auth/api-guards";
import { createServiceClient } from "@/lib/supabase/service";
import { getPublicAppBaseUrl } from "@/lib/runtime/app-url";

export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/facebook/followup
// Cron: 3x daily — checks for stalled conversations and sends follow-ups
// Follow-up 1: 24 hours after last message with no reply
// Follow-up 2: 48 hours after follow-up 1 with no reply
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_ACCESS_TOKEN = () => process.env.FACEBOOK_PAGE_ACCESS_TOKEN ?? "";
const FB_API = "https://graph.facebook.com/v19.0";

async function fbSend(psid: string, text: string): Promise<void> {
  const token = PAGE_ACCESS_TOKEN();
  if (!token) return;
  await fetch(`${FB_API}/me/messages?access_token=${token}`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({
      recipient: { id: psid },
      message:   { text },
      messaging_type: "MESSAGE_TAG",
      tag: "ACCOUNT_UPDATE",
    }),
  }).catch(err => console.error("[FB followup] send error:", err));
}

export async function POST(req: Request) {
  const guard = requireCron(req);
  if (!guard.ok) return guard.response;

  const db  = createServiceClient();
  const now = new Date();
  const startUrl = `${getPublicAppBaseUrl()}/get-started`;
  const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const h48 = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();

  const summary = { followup1_sent: 0, followup2_sent: 0, errors: 0 };

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
      ? `Hey ${name}! 👋 Just checking in — that ${cat} spot in ${loc} is still available but filling up fast. Ready to lock it in? ${startUrl}`
      : `Hey ${name}! Wanted to follow up — are you still interested in reaching homeowners in ${loc}? We have exclusive spots available for ${cat} businesses. Takes 3 minutes to get started: ${startUrl}`;

    await fbSend(lead.fb_psid, msg);
    await Promise.resolve(db.from("facebook_leads").update({
      follow_up_1_sent_at: now.toISOString(),
      messages_sent:       (lead.messages_sent ?? 0) + 1,
    }).eq("id", lead.id)).catch(() => {});

    await Promise.resolve(db.from("facebook_messages").insert({
      lead_id:   lead.id,
      direction: "outbound",
      message:   msg,
      agent:     "closer",
    })).catch(() => {});

    summary.followup1_sent++;
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

    const msg = `Hey ${name}, last message from me — I know you're busy.\n\n` +
      `We have ONE exclusive spot open for your business type in ${loc}. Once it's claimed, it's gone.\n\n` +
      `If you're ever ready: ${startUrl} 🏠\n\nWishing you continued success!`;

    await fbSend(lead.fb_psid, msg);
    await Promise.resolve(db.from("facebook_leads").update({
      follow_up_2_sent_at: now.toISOString(),
      lead_status:         "dead", // final follow-up sent
      messages_sent:       (lead.messages_sent ?? 0) + 1,
    }).eq("id", lead.id)).catch(() => {});

    await Promise.resolve(db.from("facebook_messages").insert({
      lead_id:   lead.id,
      direction: "outbound",
      message:   msg,
      agent:     "closer",
    })).catch(() => {});

    summary.followup2_sent++;
  }

  return NextResponse.json({ ok: true, summary });
}
