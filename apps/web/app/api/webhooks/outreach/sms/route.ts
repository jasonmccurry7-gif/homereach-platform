import { db, outreachContacts, outreachReplies, outreachMessages } from "@homereach/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { createServiceClient } from "@/lib/supabase/service";

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

function timingSafeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function validateTwilioSignature(req: Request, params: URLSearchParams): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) return process.env.NODE_ENV !== "production";

  const signature = req.headers.get("x-twilio-signature") ?? "";
  if (!signature) return false;

  const url = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/outreach/sms`
    : req.url;

  const signedPayload = Array.from(new Set(params.keys()))
    .sort()
    .reduce((payload, key) => `${payload}${key}${params.get(key) ?? ""}`, url);

  const expected = crypto
    .createHmac("sha1", authToken)
    .update(signedPayload)
    .digest("base64");

  return timingSafeEqual(expected, signature);
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
  // Find contact by phone number
  const [contact] = await db
    .select()
    .from(outreachContacts)
    .where(eq(outreachContacts.phone, from))
    .limit(1);

  if (!contact) {
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
