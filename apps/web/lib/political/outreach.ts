// ─────────────────────────────────────────────────────────────────────────────
// HomeReach — Political Action Center: outreach + activity logging
//
// Thin wrappers over @homereach/services/outreach.sendSms / sendEmail that:
//   1. Enforce per-contact + per-candidate compliance flags
//      (do_not_contact / do_not_email / do_not_text).
//   2. Log every interaction to sales_events with political_campaign_id set.
//   3. Never place or track calls server-side. Call logging is manual:
//      the rep dials via tel: link and later records an outcome.
//   4. Facebook DM is external-link-only; we log that the rep opened the
//      Messenger URL + what script they used, but the actual message is
//      sent by the rep manually in Facebook's own UI.
//
// Every write goes through the service-role client so we can insert into
// sales_events + update last_contacted_at on the candidate uniformly from
// both the admin UI and future automation paths.
//
// Compliance (non-negotiable):
//   • No call tracking / no call recording anywhere.
//   • Voter inference is not and will never be a thing here — the
//     sales_events.metadata blob intentionally has a small fixed key set.
//   • Opt-outs are checked BEFORE sending and the send is refused, not
//     filtered afterward. Better to fail loudly than silently suppress.
// ─────────────────────────────────────────────────────────────────────────────

import "server-only";

import { createServiceClient } from "@homereach/services/auth";
import {
  sendSms as providerSendSms,
  sendEmail as providerSendEmail,
  type OutreachSendResult,
} from "@homereach/services/outreach";

// ── Types ────────────────────────────────────────────────────────────────────

export type OutreachChannel = "call" | "sms" | "email" | "facebook_dm";

export interface LoggedOutreachBase {
  campaignId: string;
  candidateId: string;
  contactId?: string | null;
  agentId?: string | null;
  scriptSlug?: string | null;
}

export interface SendSmsInput extends LoggedOutreachBase {
  to: string;          // E.164
  body: string;
}

export interface SendEmailInput extends LoggedOutreachBase {
  to: string;
  subject: string;
  html: string;
  text?: string | undefined;
  replyTo?: string | undefined;
}

export interface LogCallInput extends LoggedOutreachBase {
  toPhone: string;
  outcome: string;     // free text — rep's notes after the call
}

export interface LogFacebookInput extends LoggedOutreachBase {
  messengerUrl: string | null;
  body: string;        // the copy the rep pasted into Messenger
}

export type PoliticalOutreachResult =
  | { ok: true; eventId: string; providerExternalId?: string | null }
  | { ok: false; error: string; code: "opted_out" | "missing_contact" | "provider_failed" | "invalid_input" };

// ── Compliance check ─────────────────────────────────────────────────────────

interface CandidateComplianceRow {
  id: string;
  do_not_contact: boolean;
  do_not_email: boolean;
  do_not_text: boolean;
}

interface ContactComplianceRow {
  id: string;
  campaign_candidate_id: string;
  do_not_contact: boolean;
  do_not_email: boolean;
  do_not_text: boolean;
  email: string | null;
  phone: string | null;
}

async function loadCandidateCompliance(
  admin: ReturnType<typeof createServiceClient>,
  candidateId: string,
): Promise<CandidateComplianceRow | null> {
  const { data, error } = await admin
    .from("campaign_candidates")
    .select("id, do_not_contact, do_not_email, do_not_text")
    .eq("id", candidateId)
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as CandidateComplianceRow;
}

async function loadContactCompliance(
  admin: ReturnType<typeof createServiceClient>,
  contactId: string,
): Promise<ContactComplianceRow | null> {
  const { data, error } = await admin
    .from("political_campaign_contacts")
    .select("id, campaign_candidate_id, do_not_contact, do_not_email, do_not_text, email, phone")
    .eq("id", contactId)
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as ContactComplianceRow;
}

/**
 * Checks whether a given channel is allowed for a candidate + optional contact.
 * Returns { ok: true } when permitted, or { ok: false, reason } otherwise.
 */
export async function checkComplianceForSend(params: {
  candidateId: string;
  contactId?: string | null;
  channel: OutreachChannel;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const admin = createServiceClient();
  const cand = await loadCandidateCompliance(admin, params.candidateId);
  if (!cand) return { ok: false, reason: "Candidate not found." };

  if (cand.do_not_contact) return { ok: false, reason: "Candidate marked do_not_contact." };
  if (params.channel === "email" && cand.do_not_email) {
    return { ok: false, reason: "Candidate marked do_not_email." };
  }
  if (params.channel === "sms" && cand.do_not_text) {
    return { ok: false, reason: "Candidate marked do_not_text." };
  }

  if (params.contactId) {
    const contact = await loadContactCompliance(admin, params.contactId);
    if (!contact) return { ok: false, reason: "Contact not found." };
    if (contact.campaign_candidate_id !== params.candidateId) {
      return { ok: false, reason: "Contact does not belong to this candidate." };
    }
    if (contact.do_not_contact) return { ok: false, reason: "Contact marked do_not_contact." };
    if (params.channel === "email" && contact.do_not_email) {
      return { ok: false, reason: "Contact marked do_not_email." };
    }
    if (params.channel === "sms" && contact.do_not_text) {
      return { ok: false, reason: "Contact marked do_not_text." };
    }
  }
  return { ok: true };
}

// ── Activity logging ────────────────────────────────────────────────────────

interface LogEventInput {
  campaignId: string;
  candidateId: string;
  contactId?: string | null;
  agentId?: string | null;
  channel: "call" | "sms" | "email" | "facebook";
  actionType:
    | "message_sent"
    | "email_sent"
    | "text_sent"
    | "facebook_sent";
  message: string;
  outcome?: string | null;
  providerExternalId?: string | null;
  scriptSlug?: string | null;
}

async function logPoliticalActivity(
  admin: ReturnType<typeof createServiceClient>,
  input: LogEventInput,
): Promise<string> {
  const metadata: Record<string, unknown> = {
    candidate_id: input.candidateId,
    channel_detail: input.channel,
  };
  if (input.contactId) metadata["contact_id"] = input.contactId;
  if (input.outcome) metadata["outcome"] = input.outcome;
  if (input.providerExternalId) metadata["provider_external_id"] = input.providerExternalId;
  if (input.scriptSlug) metadata["script_slug"] = input.scriptSlug;

  const { data, error } = await admin
    .from("sales_events")
    .insert({
      action_type:           input.actionType,
      channel:               input.channel,
      message:               input.message,
      political_campaign_id: input.campaignId,
      agent_id:              input.agentId ?? null,
      metadata,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`logPoliticalActivity: ${error?.message ?? "no row returned"}`);
  }
  const row = data as unknown as { id: string };
  return row.id;
}

/** Touch last_contacted_at on the candidate. Best-effort. */
async function touchLastContacted(
  admin: ReturnType<typeof createServiceClient>,
  candidateId: string,
): Promise<void> {
  try {
    await admin
      .from("campaign_candidates")
      .update({ last_contacted_at: new Date().toISOString() })
      .eq("id", candidateId);
  } catch {
    // non-fatal
  }
}

// ── SMS ──────────────────────────────────────────────────────────────────────

export async function sendPoliticalSms(input: SendSmsInput): Promise<PoliticalOutreachResult> {
  if (!input.to || !input.body) {
    return { ok: false, error: "Both 'to' and 'body' are required.", code: "invalid_input" };
  }
  const check = await checkComplianceForSend({
    candidateId: input.candidateId,
    contactId: input.contactId ?? null,
    channel: "sms",
  });
  if (!check.ok) return { ok: false, error: check.reason, code: "opted_out" };

  const send = await providerSendSms({ to: input.to, body: input.body });
  return recordSendResult(input, "sms", "text_sent", input.body, send);
}

// ── Email ────────────────────────────────────────────────────────────────────

export async function sendPoliticalEmail(input: SendEmailInput): Promise<PoliticalOutreachResult> {
  if (!input.to || !input.subject || !input.html) {
    return { ok: false, error: "to, subject, and html are required.", code: "invalid_input" };
  }
  const check = await checkComplianceForSend({
    candidateId: input.candidateId,
    contactId: input.contactId ?? null,
    channel: "email",
  });
  if (!check.ok) return { ok: false, error: check.reason, code: "opted_out" };

  const send = await providerSendEmail({
    to: input.to,
    subject: input.subject,
    html: input.html,
    ...(input.text !== undefined ? { text: input.text } : {}),
    ...(input.replyTo !== undefined ? { replyTo: input.replyTo } : {}),
  });
  // For email the "message" field stores subject + body for timeline
  // readability. Raw HTML stays in the provider; sales_events keeps
  // the plain-text excerpt.
  const excerpt = `${input.subject}\n\n${input.text ?? stripHtml(input.html)}`;
  return recordSendResult(input, "email", "email_sent", excerpt, send);
}

// ── Call (manual, no tracking) ──────────────────────────────────────────────

export async function logPoliticalCall(input: LogCallInput): Promise<PoliticalOutreachResult> {
  if (!input.toPhone || !input.outcome) {
    return { ok: false, error: "Phone number and call outcome are required.", code: "invalid_input" };
  }
  // Compliance check — a rep must not log a call against a do_not_contact.
  const check = await checkComplianceForSend({
    candidateId: input.candidateId,
    contactId: input.contactId ?? null,
    channel: "call",
  });
  if (!check.ok) return { ok: false, error: check.reason, code: "opted_out" };

  const admin = createServiceClient();
  const eventId = await logPoliticalActivity(admin, {
    campaignId: input.campaignId,
    candidateId: input.candidateId,
    contactId: input.contactId ?? null,
    agentId: input.agentId ?? null,
    channel: "call",
    actionType: "message_sent",
    message: `Call to ${input.toPhone} — ${input.outcome}`,
    outcome: input.outcome,
    scriptSlug: input.scriptSlug ?? null,
  });
  await touchLastContacted(admin, input.candidateId);
  return { ok: true, eventId };
}

// ── Facebook DM (external, manual) ──────────────────────────────────────────

export async function logPoliticalFacebook(input: LogFacebookInput): Promise<PoliticalOutreachResult> {
  if (!input.body) {
    return { ok: false, error: "Message body is required.", code: "invalid_input" };
  }
  const check = await checkComplianceForSend({
    candidateId: input.candidateId,
    contactId: input.contactId ?? null,
    channel: "facebook_dm",
  });
  if (!check.ok) return { ok: false, error: check.reason, code: "opted_out" };

  const admin = createServiceClient();
  const eventId = await logPoliticalActivity(admin, {
    campaignId: input.campaignId,
    candidateId: input.candidateId,
    contactId: input.contactId ?? null,
    agentId: input.agentId ?? null,
    channel: "facebook",
    actionType: "facebook_sent",
    message: `Facebook DM${input.messengerUrl ? ` (${input.messengerUrl})` : ""}\n\n${input.body}`,
    scriptSlug: input.scriptSlug ?? null,
  });
  await touchLastContacted(admin, input.candidateId);
  return { ok: true, eventId };
}

// ── Internal: shared success-path logger for sms + email ────────────────────

async function recordSendResult(
  input: LoggedOutreachBase,
  channel: "sms" | "email",
  actionType: "text_sent" | "email_sent",
  messageForTimeline: string,
  send: OutreachSendResult,
): Promise<PoliticalOutreachResult> {
  if (!send.success) {
    return {
      ok: false,
      error: send.error ?? `Provider refused the ${channel} send.`,
      code: "provider_failed",
    };
  }
  const admin = createServiceClient();
  const eventId = await logPoliticalActivity(admin, {
    campaignId: input.campaignId,
    candidateId: input.candidateId,
    contactId: input.contactId ?? null,
    agentId: input.agentId ?? null,
    channel,
    actionType,
    message: messageForTimeline,
    providerExternalId: send.externalId ?? null,
    scriptSlug: input.scriptSlug ?? null,
  });
  await touchLastContacted(admin, input.candidateId);
  return { ok: true, eventId, providerExternalId: send.externalId ?? null };
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();
}
