// ─────────────────────────────────────────────────────────────────────────────
// HomeReach Outreach Service
//
// SMS   → Twilio
// Email → Mailgun (HTTP API)
//
// Provider-specific logic is isolated here.
// ─────────────────────────────────────────────────────────────────────────────

import twilio from "twilio";
import type { OutreachChannel } from "@homereach/types";
import { sendEmailViaPostmark, getActiveEmailProvider } from "./postmark";

// ─── Clients ─────────────────────────────────────────────────────────────────

function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    throw new Error("TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required");
  }
  return twilio(accountSid, authToken);
}

function getMailgunConfig() {
  const apiKey = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;
  if (!apiKey || !domain) {
    throw new Error(
      "MAILGUN_API_KEY and MAILGUN_DOMAIN are required for sending email."
    );
  }
  return { apiKey, domain };
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SmsSendOptions {
  to: string;   // E.164 format: +1XXXXXXXXXX
  body: string;
}

export interface EmailSendOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export interface OutreachSendResult {
  success: boolean;
  externalId?: string;
  error?: string;
}

// ─── SMS ─────────────────────────────────────────────────────────────────────

export async function sendSms(
  options: SmsSendOptions
): Promise<OutreachSendResult> {
  try {
    const client     = getTwilioClient();
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
      to:   options.to,
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

// ─── Email Router (Mailgun default, Postmark when EMAIL_PROVIDER=postmark) ──
//
// Routes outbound email based on the EMAIL_PROVIDER env var:
//   • "mailgun" (default) → sendEmailViaMailgun() below
//   • "postmark"          → sendEmailViaPostmark() in ./postmark.ts
//
// To swap providers in production, set EMAIL_PROVIDER=postmark in Vercel env
// vars + ensure POSTMARK_API_TOKEN + POSTMARK_FROM_EMAIL are also set.
// No code change required to flip back — just unset the env var.

export async function sendEmail(
  options: EmailSendOptions
): Promise<OutreachSendResult> {
  const provider = getActiveEmailProvider();
  if (provider === "postmark") {
    const r = await sendEmailViaPostmark(options);
    return {
      success:    r.success,
      externalId: r.externalId,
      error:      r.error ? `[postmark] ${r.error}` : undefined,
    };
  }
  return sendEmailViaMailgun(options);
}

// ─── Email via Mailgun ────────────────────────────────────────────────────────

async function sendEmailViaMailgun(
  options: EmailSendOptions
): Promise<OutreachSendResult> {
  try {
    const { apiKey, domain } = getMailgunConfig();

    const fromEmail = process.env.MAILGUN_FROM_EMAIL ?? `no-reply@${domain}`;
    const fromName  = process.env.MAILGUN_FROM_NAME  ?? "HomeReach";
    const from      = `${fromName} <${fromEmail}>`;

    const body = new URLSearchParams();
    body.set("from",    from);
    body.set("to",      options.to);
    body.set("subject", options.subject);
    body.set("html",    options.html);
    if (options.text)    body.set("text",     options.text);
    if (options.replyTo) body.set("h:Reply-To", options.replyTo);

    const response = await fetch(
      `https://api.mailgun.net/v3/${domain}/messages`,
      {
        method:  "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      }
    );

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Mailgun error ${response.status}: ${detail}`);
    }

    const data = await response.json() as { id?: string; message?: string };
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

export async function isOptedOut(
  db: import("@homereach/db").typeof_db,
  contactId: string
): Promise<boolean> {
  const { outreachContacts } = await import("@homereach/db");
  const { eq }               = await import("drizzle-orm");

  const [contact] = await db
    .select({ optedOut: outreachContacts.optedOut })
    .from(outreachContacts)
    .where(eq(outreachContacts.id, contactId))
    .limit(1);

  return contact?.optedOut ?? true; // default to true (safe) if not found
}
