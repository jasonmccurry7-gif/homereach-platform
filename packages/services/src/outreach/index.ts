// ─────────────────────────────────────────────────────────────────────────────
// HomeReach Outreach Service
//
// SMS   → Twilio
// Email → Mailgun (HTTP API — no extra SDK required)
//
// Provider-specific logic is isolated here.
// ─────────────────────────────────────────────────────────────────────────────

import twilio from "twilio";
import type { OutreachChannel } from "@homereach/types";

// ─── Clients ─────────────────────────────────────────────────────────────────

function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    throw new Error("TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required");
  }
  return twilio(accountSid, authToken);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SmsSendOptions {
  to: string;       // E.164 format: +1XXXXXXXXXX
  body: string;
}

export interface EmailSendOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;    // Plain text fallback
  replyTo?: string;
}

export interface OutreachSendResult {
  success: boolean;
  externalId?: string;  // Twilio SID or Mailgun message ID
  error?: string;
}

// ─── SMS ─────────────────────────────────────────────────────────────────────

export async function sendSms(
  options: SmsSendOptions
): Promise<OutreachSendResult> {
  try {
    const client = getTwilioClient();
    const fromNumber =
      process.env.TWILIO_MESSAGING_SERVICE_SID ??
      process.env.TWILIO_PHONE_NUMBER;

    if (!fromNumber) {
      throw new Error(
        "TWILIO_MESSAGING_SERVICE_SID or TWILIO_PHONE_NUMBER is required"
      );
    }

    const message = await client.messages.create({
      body: options.body,
      to: options.to,
      // Prefer messaging service (supports opt-out auto-handling) over single number
      ...(process.env.TWILIO_MESSAGING_SERVICE_SID
        ? { messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID }
        : { from: process.env.TWILIO_PHONE_NUMBER }),
    });

    return { success: true, externalId: message.sid };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown SMS error";
    console.error("[outreach/sms] send failed:", error);
    return { success: false, error };
  }
}

// ─── Email via Mailgun HTTP API ───────────────────────────────────────────────

export async function sendEmail(
  options: EmailSendOptions
): Promise<OutreachSendResult> {
  try {
    const apiKey = process.env.MAILGUN_API_KEY;
    const domain = process.env.MAILGUN_DOMAIN;
    const from   = process.env.MAILGUN_FROM_EMAIL;

    if (!apiKey || !domain || !from) {
      throw new Error(
        "MAILGUN_API_KEY, MAILGUN_DOMAIN, and MAILGUN_FROM_EMAIL are required"
      );
    }

    const formData = new FormData();
    formData.append("from",    from);
    formData.append("to",      options.to);
    formData.append("subject", options.subject);
    formData.append("html",    options.html);
    if (options.text)    formData.append("text",       options.text);
    if (options.replyTo) formData.append("h:Reply-To", options.replyTo);

    const credentials = Buffer.from(`api:${apiKey}`).toString("base64");
    const res = await fetch(
      `https://api.mailgun.net/v3/${domain}/messages`,
      {
        method:  "POST",
        headers: { Authorization: `Basic ${credentials}` },
        body:    formData,
      }
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Mailgun ${res.status}: ${text}`);
    }

    const data = await res.json() as { id?: string };
    return { success: true, externalId: data.id };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown email error";
    console.error("[outreach/email] send failed:", error);
    return { success: false, error };
  }
}

// ─── Unified Send ─────────────────────────────────────────────────────────────

export async function sendOutreach(
  channel: OutreachChannel,
  options: SmsSendOptions | EmailSendOptions
): Promise<OutreachSendResult> {
  if (channel === "sms") {
    return sendSms(options as SmsSendOptions);
  }
  return sendEmail(options as EmailSendOptions);
}

// ─── Opt-out check ────────────────────────────────────────────────────────────

/**
 * Check if a phone/email is on the opt-out list before sending.
 * This is a lightweight guard — the database is the source of truth.
 * Never send to an opted-out contact.
 */
export async function isOptedOut(
  db: import("@homereach/db").typeof_db,
  contactId: string
): Promise<boolean> {
  const { outreachContacts } = await import("@homereach/db");
  const { eq } = await import("drizzle-orm");

  const [contact] = await db
    .select({ optedOut: outreachContacts.optedOut })
    .from(outreachContacts)
    .where(eq(outreachContacts.id, contactId))
    .limit(1);

  return contact?.optedOut ?? true; // default to true (safe) if not found
}
