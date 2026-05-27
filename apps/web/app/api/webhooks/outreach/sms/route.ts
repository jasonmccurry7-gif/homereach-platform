import { db, outreachContacts, outreachReplies, outreachMessages } from "@homereach/db";
import { eq } from "drizzle-orm";
import { createServiceClient } from "@/lib/supabase/service";
import { processInboundRevenueMessage } from "@/lib/revenue-messaging/inbound";
import {
  type InboundSmsBridgeResult,
  shouldRetryUnmatchedInboundSmsReply,
  validateTwilioInboundSignature,
} from "@/lib/outreach/inbound-sms-webhook";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/webhooks/outreach/sms
// Twilio inbound SMS webhook.
// Receives replies from contacts and stores them as outreach_replies.
// Also handles STOP/HELP keywords for compliance.
//
// Twilio sends as application/x-www-form-urlencoded.
// ─────────────────────────────────────────────────────────────────────────────

const OPT_OUT_KEYWORDS = ["STOP", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"];
const OPT_IN_KEYWORDS = ["START", "YES", "UNSTOP"];
const EMPTY_TWIML = new Response("<Response/>", {
  headers: { "Content-Type": "text/xml" },
});

function retryableTwimlResponse() {
  return new Response("<Response/>", {
    status: 503,
    headers: { "Content-Type": "text/xml" },
  });
}

function validateTwilioSignature(req: Request, params: URLSearchParams): boolean {
  return validateTwilioInboundSignature({
    authToken: process.env.TWILIO_AUTH_TOKEN,
    nodeEnv: process.env.NODE_ENV,
    signature: req.headers.get("x-twilio-signature"),
    requestUrl: req.url,
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
    params,
  });
}

export async function POST(req: Request) {
  const rawText = await req.text();
  const formData = new URLSearchParams(rawText);

  if (!validateTwilioSignature(req, formData)) {
    return new Response("Forbidden", { status: 403 });
  }

  const from = formData.get("From");
  const body = formData.get("Body");
  const messageSid = formData.get("MessageSid");

  if (!from || !body) {
    return EMPTY_TWIML;
  }

  const normalizedBody = body.trim().toUpperCase();

  // ── Opt-out handling ───────────────────────────────────────────────────────
  if (OPT_OUT_KEYWORDS.includes(normalizedBody)) {
    const supabase = createServiceClient();
    await db
      .update(outreachContacts)
      .set({ optedOut: true, optedOutAt: new Date() })
      .where(eq(outreachContacts.phone, from));
    await supabase
      .from("sales_leads")
      .update({ sms_opt_out: true })
      .eq("phone", from);

    // Twilio expects empty TwiML response — do not send confirmation (Twilio sends its own)
    return EMPTY_TWIML;
  }

  // ── Opt-in handling ────────────────────────────────────────────────────────
  if (OPT_IN_KEYWORDS.includes(normalizedBody)) {
    const supabase = createServiceClient();
    await db
      .update(outreachContacts)
      .set({ optedOut: false, optedOutAt: null })
      .where(eq(outreachContacts.phone, from));
    await supabase
      .from("sales_leads")
      .update({ sms_opt_out: false })
      .eq("phone", from);

    return EMPTY_TWIML;
  }

  // ── Store reply ────────────────────────────────────────────────────────────
  let revenueBridgeResult: InboundSmsBridgeResult | null = null;
  let revenueBridgeFailed = false;

  try {
    revenueBridgeResult = await processInboundRevenueMessage({
      channel: "sms",
      from,
      to: formData.get("To"),
      body,
      provider: "twilio",
      providerMessageId: messageSid,
      rawPayload: Object.fromEntries(formData.entries()),
    });
  } catch (err) {
    revenueBridgeFailed = true;
    console.error("[sms/webhook] revenue messaging bridge failed:", err);
  }

  // Find contact by phone number
  const [contact] = await db
    .select()
    .from(outreachContacts)
    .where(eq(outreachContacts.phone, from))
    .limit(1);

  if (!contact) {
    if (
      shouldRetryUnmatchedInboundSmsReply({
        bridgeFailed: revenueBridgeFailed,
        bridgeResult: revenueBridgeResult,
      })
    ) {
      return retryableTwimlResponse();
    }

    // Unknown number — log and ignore
    console.log(`[sms/webhook] reply from unknown number: ${from}`);
    return EMPTY_TWIML;
  }

  // Find the most recent outreach message to this contact for correlation
  const [matchedMessage] = messageSid
    ? await db
        .select()
        .from(outreachMessages)
        .where(eq(outreachMessages.externalId, messageSid))
        .limit(1)
    : [undefined];

  await db.insert(outreachReplies).values({
    messageId: matchedMessage?.id ?? null,
    contactId: contact.id,
    businessId: contact.businessId,
    channel: "sms",
    body: body,
    receivedAt: new Date(),
    isRead: false,
  });

  // TwiML empty response — do not auto-reply
  return EMPTY_TWIML;
}
