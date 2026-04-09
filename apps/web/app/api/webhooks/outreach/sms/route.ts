import { NextResponse } from "next/server";
import { db, outreachContacts, outreachReplies, outreachMessages } from "@homereach/db";
import { eq, and } from "drizzle-orm";

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

export async function POST(req: Request) {
  const formData = await req.formData();

  const from = formData.get("From") as string | null;
  const body = formData.get("Body") as string | null;
  const messageSid = formData.get("MessageSid") as string | null;

  if (!from || !body) {
    return new Response("<Response/>", {
      headers: { "Content-Type": "text/xml" },
    });
  }

  const normalizedBody = body.trim().toUpperCase();

  // ── Opt-out handling ───────────────────────────────────────────────────────
  if (OPT_OUT_KEYWORDS.includes(normalizedBody)) {
    await db
      .update(outreachContacts)
      .set({ optedOut: true, optedOutAt: new Date() })
      .where(eq(outreachContacts.phone, from));

    // Twilio expects empty TwiML response — do not send confirmation (Twilio sends its own)
    return new Response("<Response/>", {
      headers: { "Content-Type": "text/xml" },
    });
  }

  // ── Opt-in handling ────────────────────────────────────────────────────────
  if (OPT_IN_KEYWORDS.includes(normalizedBody)) {
    await db
      .update(outreachContacts)
      .set({ optedOut: false, optedOutAt: null })
      .where(eq(outreachContacts.phone, from));

    return new Response("<Response/>", {
      headers: { "Content-Type": "text/xml" },
    });
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
    return new Response("<Response/>", {
      headers: { "Content-Type": "text/xml" },
    });
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
  return new Response("<Response/>", {
    headers: { "Content-Type": "text/xml" },
  });
}
