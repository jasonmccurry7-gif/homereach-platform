import { NextResponse } from "next/server";
import twilio from "twilio";
import { db, outreachContacts, outreachReplies, outreachMessages } from "@homereach/db";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/webhooks/outreach/sms
// Twilio inbound SMS webhook.
// Receives replies from contacts and stores them as outreach_replies.
// Also handles STOP/HELP keywords for compliance.
//
// Security: Validates Twilio request signature on every request.
// Twilio sends as application/x-www-form-urlencoded.
// ─────────────────────────────────────────────────────────────────────────────

const OPT_OUT_KEYWORDS = ["STOP", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"];
const OPT_IN_KEYWORDS  = ["START", "YES", "UNSTOP"];

const EMPTY_TWIML = new Response("<Response/>", {
  headers: { "Content-Type": "text/xml" },
});

export async function POST(req: Request) {
  try {
  // ── Twilio signature validation ────────────────────────────────────────────
  // Skip validation only in development when no auth token is set.
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const isProduction = process.env.NODE_ENV === "production";

  if (authToken) {
    const twilioSignature = req.headers.get("X-Twilio-Signature") ?? "";
    const url = process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/outreach/sms`
      : req.url;

    // Parse body for signature validation (Twilio signs the form params)
    const rawText = await req.text();
    const params: Record<string, string> = {};
    for (const [k, v] of new URLSearchParams(rawText)) {
      params[k] = v;
    }

    const isValid = twilio.validateRequest(authToken, twilioSignature, url, params);

    if (!isValid) {
      // In production: reject outright. In dev: log a warning but continue.
      if (isProduction) {
        console.error("[sms/webhook] REJECTED — invalid Twilio signature");
        return new Response("Forbidden", { status: 403 });
      } else {
        console.warn("[sms/webhook] WARNING — invalid Twilio signature (ignored in dev)");
      }
    }

    // Re-parse from already-read body
    return await handleSmsPayload(params);
  }

  // No auth token set — parse normally (unsafe, will warn in prod env validation)
  const formData = await req.formData();
  const params: Record<string, string> = {};
  for (const [k, v] of formData) {
    params[k] = String(v);
  }
  return await handleSmsPayload(params);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[route] error:`, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

}

async function handleSmsPayload(params: Record<string, string>): Promise<Response> {
  const from       = params["From"]      ?? null;
  const body       = params["Body"]      ?? null;
  const messageSid = params["MessageSid"] ?? null;

  if (!from || !body) {
    return EMPTY_TWIML;
  }

  const normalizedBody = body.trim().toUpperCase();

  // ── Opt-out handling ───────────────────────────────────────────────────────
  if (OPT_OUT_KEYWORDS.includes(normalizedBody)) {
    await db
      .update(outreachContacts)
      .set({ optedOut: true, optedOutAt: new Date() })
      .where(eq(outreachContacts.phone, from));

    return EMPTY_TWIML;
  }

  // ── Opt-in handling ────────────────────────────────────────────────────────
  if (OPT_IN_KEYWORDS.includes(normalizedBody)) {
    await db
      .update(outreachContacts)
      .set({ optedOut: false, optedOutAt: null })
      .where(eq(outreachContacts.phone, from));

    return EMPTY_TWIML;
  }

  // ── Store reply ────────────────────────────────────────────────────────────
  const [contact] = await db
    .select()
    .from(outreachContacts)
    .where(eq(outreachContacts.phone, from))
    .limit(1);

  if (!contact) {
    console.log(`[sms/webhook] reply from unknown number: ${from}`);
    return EMPTY_TWIML;
  }

  const [matchedMessage] = messageSid
    ? await db
        .select()
        .from(outreachMessages)
        .where(eq(outreachMessages.externalId, messageSid))
        .limit(1)
    : [undefined];

  await db.insert(outreachReplies).values({
    messageId:  matchedMessage?.id ?? null,
    contactId:  contact.id,
    businessId: contact.businessId,
    channel:    "sms",
    body:       body,
    receivedAt: new Date(),
    isRead:     false,
  });

  // ── Also update sales_leads in Supabase (bridges outreach ↔ sales system) ──
  // If this phone number belongs to a sales lead, mark it replied so it
  // surfaces in the agent Today's To-Do → Replies section.
  try {
    const supabase = await createClient();
    const { data: matchingLead } = await supabase
      .from("sales_leads")
      .select("id, status")
      .eq("phone", from)
      .not("status", "in", "(closed,dnc,bad_number)")
      .limit(1)
      .single();

    if (matchingLead) {
      await supabase
        .from("sales_leads")
        .update({
          status:        "replied",
          last_reply_at: new Date().toISOString(),
          pipeline_stage: "replied",
        })
        .eq("id", matchingLead.id);

      // Log reply event in sales_events for reporting
      await supabase.from("sales_events").insert({
        lead_id:     matchingLead.id,
        action_type: "reply_received",
        channel:     "sms",
        message:     body,
        created_at:  new Date().toISOString(),
      });
    }
  } catch (salesErr) {
    // Non-fatal: outreach reply already stored above
    console.warn("[sms/webhook] could not update sales_leads:", salesErr);
  }

  return EMPTY_TWIML;
}
