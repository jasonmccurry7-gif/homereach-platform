// ─────────────────────────────────────────────────────────────────────────────
// HomeReach Outreach Service
//
// Abstraction layer over Twilio (SMS) and Resend (email).
// Provider-specific logic is isolated here — swap providers without
// touching any application code.
// ─────────────────────────────────────────────────────────────────────────────

import twilio from "twilio";
import { Resend } from "resend";
import type { OutreachChannel } from "@homereach/types";
import { sendEmailViaPostmark } from "./postmark";
import {
  getDefaultEmailIdentity,
  getDefaultSmsIdentity,
  getOutreachSafetyConfig,
  getRotatingEmailIdentity,
  type OutreachIntent,
} from "./identity";

// ─── Clients ─────────────────────────────────────────────────────────────────

function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    throw new Error("TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required");
  }
  return twilio(accountSid, authToken);
}

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is required");
  return new Resend(apiKey);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SmsSendOptions {
  to: string;       // E.164 format: +1XXXXXXXXXX
  body: string;
  fromNumber?: string;
  messagingServiceSid?: string;
  statusCallbackUrl?: string;
  intent?: OutreachIntent;
  testMode?: boolean;
}

export interface EmailSendOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;    // Plain text fallback
  replyTo?: string;
  fromEmail?: string;
  fromName?: string;
  provider?: "resend" | "mailgun" | "postmark";
  messageStream?: string;
  tags?: string[];
  metadata?: Record<string, string>;
  intent?: OutreachIntent;
  testMode?: boolean;
}

export interface OutreachSendResult {
  success: boolean;
  externalId?: string;  // Twilio SID or Resend message ID
  error?: string;
  provider?: string;
  testMode?: boolean;
}

function inferEmailProvider(): "resend" | "mailgun" | "postmark" {
  const configured = process.env.EMAIL_PROVIDER?.toLowerCase();
  if (configured === "resend" || configured === "mailgun" || configured === "postmark") {
    return configured;
  }
  if (process.env.RESEND_API_KEY) return "resend";
  if (process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN) return "mailgun";
  if (process.env.POSTMARK_API_TOKEN) return "postmark";
  return "resend";
}

async function sendEmailViaMailgun(options: Required<Pick<EmailSendOptions, "to" | "subject" | "html">> & EmailSendOptions): Promise<OutreachSendResult> {
  try {
    const apiKey = process.env.MAILGUN_API_KEY;
    const domain = process.env.MAILGUN_DOMAIN;
    if (!apiKey || !domain) {
      throw new Error("MAILGUN_API_KEY and MAILGUN_DOMAIN are required");
    }

    const identity = options.intent === "prospecting"
      ? getRotatingEmailIdentity(`${options.to}:${new Date().toISOString().slice(0, 10)}`, options)
      : getDefaultEmailIdentity(options);
    const form = new URLSearchParams();
    form.set("from", `${identity.fromName} <${identity.fromEmail}>`);
    form.set("to", options.to);
    form.set("subject", options.subject);
    form.set("html", options.html);
    if (options.text) form.set("text", options.text);
    if (identity.replyTo) form.set("h:Reply-To", identity.replyTo);
    if (options.tags?.[0]) form.set("o:tag", options.tags[0]);
    if (options.metadata) {
      for (const [key, value] of Object.entries(options.metadata)) {
        form.set(`v:${key}`, value);
      }
    }

    const response = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });

    const dataText = await response.text();
    if (!response.ok) {
      throw new Error(`Mailgun ${response.status}: ${dataText}`);
    }
    let externalId: string | undefined;
    try {
      externalId = (JSON.parse(dataText) as { id?: string }).id;
    } catch {
      externalId = undefined;
    }
    return { success: true, externalId, provider: "mailgun" };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown Mailgun error";
    console.error("[outreach/mailgun] send failed:", error);
    return { success: false, error, provider: "mailgun" };
  }
}

// ─── SMS ─────────────────────────────────────────────────────────────────────

export async function sendSms(
  options: SmsSendOptions
): Promise<OutreachSendResult> {
  try {
    const safety = getOutreachSafetyConfig();
    const testMode = options.testMode ?? safety.testMode;
    if (testMode) {
      return { success: true, externalId: `test_sms_${Date.now()}`, provider: "twilio", testMode: true };
    }
    if (options.intent === "prospecting" && safety.manualApprovalMode) {
      return {
        success: false,
        error: "Manual approval mode is enabled for prospecting SMS",
        provider: "twilio",
      };
    }
    if (options.intent === "prospecting" && !safety.smsProspectingLiveEnabled) {
      return {
        success: false,
        error: "Prospecting SMS live sending is disabled until Twilio/A2P approval is confirmed",
        provider: "twilio",
      };
    }

    const client = getTwilioClient();
    const smsIdentity = getDefaultSmsIdentity({
      fromNumber: options.fromNumber,
      messagingServiceSid: options.messagingServiceSid,
    });

    if (!smsIdentity.messagingServiceSid && !smsIdentity.fromNumber) {
      throw new Error(
        "TWILIO_MESSAGING_SERVICE_SID or TWILIO_PHONE_NUMBER is required"
      );
    }

    const message = await client.messages.create({
      body: options.body,
      to: options.to,
      // Prefer messaging service (supports opt-out auto-handling) over single number
      ...(smsIdentity.messagingServiceSid
        ? { messagingServiceSid: smsIdentity.messagingServiceSid }
        : { from: smsIdentity.fromNumber }),
      ...(options.statusCallbackUrl ? { statusCallback: options.statusCallbackUrl } : {}),
    });

    return { success: true, externalId: message.sid, provider: "twilio" };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown SMS error";
    console.error("[outreach/sms] send failed:", error);
    return { success: false, error, provider: "twilio" };
  }
}

// ─── Email ────────────────────────────────────────────────────────────────────

export async function sendEmail(
  options: EmailSendOptions
): Promise<OutreachSendResult> {
  try {
    const safety = getOutreachSafetyConfig();
    const testMode = options.testMode ?? safety.testMode;
    const provider = options.provider ?? inferEmailProvider();
    const identity = options.intent === "prospecting"
      ? getRotatingEmailIdentity(`${options.to}:${new Date().toISOString().slice(0, 10)}`, options)
      : getDefaultEmailIdentity(options);

    if (testMode) {
      return { success: true, externalId: `test_email_${Date.now()}`, provider, testMode: true };
    }

    if (provider === "mailgun") {
      return sendEmailViaMailgun(options as Required<Pick<EmailSendOptions, "to" | "subject" | "html">> & EmailSendOptions);
    }

    if (provider === "postmark") {
      const result = await sendEmailViaPostmark({
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        replyTo: identity.replyTo,
        fromEmail: identity.fromEmail,
        fromName: identity.fromName,
        messageStream: options.messageStream,
        tags: options.tags,
        metadata: options.metadata,
      });
      return { ...result, provider: "postmark" };
    }

    const resend = getResendClient();

    const result = await resend.emails.send({
      from: `${identity.fromName} <${identity.fromEmail}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      ...(options.text ? { text: options.text } : {}),
      ...(identity.replyTo ? { replyTo: identity.replyTo } : {}),
    });

    if (result.error) {
      return { success: false, error: result.error.message, provider: "resend" };
    }

    return { success: true, externalId: result.data?.id, provider: "resend" };
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
  const condition = eq(outreachContacts.id as any, contactId) as any;

  const [contact] = await db
    .select({ optedOut: outreachContacts.optedOut })
    .from(outreachContacts)
    .where(condition)
    .limit(1);

  return contact?.optedOut ?? true; // default to true (safe) if not found
}

export * from "./identity";
