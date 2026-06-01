import "server-only";

import { resolveCname, resolveTxt } from "node:dns/promises";
import { createServiceClient } from "@/lib/supabase/service";
import {
  getOwnerIdentity,
  getOutreachSafetyConfig,
  sendEmail,
} from "@homereach/services/outreach";

const ownerIdentity = getOwnerIdentity();

export const DEFAULT_VERIFICATION_DESTINATION = ownerIdentity.personalEmail.toLowerCase();

export const HOME_REACH_SENDER_IDENTITIES = [
  { name: "Heather HomeReach", email: "heather@home-reach.com" },
  { name: "Josh HomeReach", email: "josh@home-reach.com" },
  { name: "Chelsi HomeReach", email: "chelsi@home-reach.com" },
  { name: ownerIdentity.name, email: ownerIdentity.domainEmail.toLowerCase() },
] as const;

export type HomeReachSenderEmail = string;

type GenericRow = Record<string, unknown>;
type PostmarkSenderSignatureApiRow = {
  ID?: number;
  EmailAddress?: string;
  Name?: string;
  ReplyToEmailAddress?: string;
  Domain?: string;
  Confirmed?: boolean;
  SPFVerified?: boolean;
  SPFHost?: string;
  SPFTextValue?: string;
  DKIMVerified?: boolean;
  DKIMHost?: string;
  DKIMTextValue?: string;
  DKIMPendingHost?: string;
  DKIMPendingTextValue?: string;
  ReturnPathDomain?: string;
  ReturnPathDomainVerified?: boolean;
  ReturnPathDomainCNAMEValue?: string;
};

const POSTMARK_SPF_INCLUDE = "include:spf.mtasv.net";
const POSTMARK_RETURN_PATH_HOST = "pm-bounces.home-reach.com";
const POSTMARK_RETURN_PATH_TARGET = "pm.mtasv.net";

export type EnvAudit = {
  emailProvider: string;
  postmarkApiTokenConfigured: boolean;
  postmarkAccountTokenConfigured: boolean;
  postmarkFromEmailConfigured: boolean;
  postmarkFromNameConfigured: boolean;
  postmarkMessageStream: string;
  postmarkWebhookEnabled: boolean;
  postmarkWebhookAuthConfigured: boolean;
  defaultFromEmail: string | null;
  defaultReplyToEmail: string | null;
  resendConfigured: boolean;
  mailgunConfigured: boolean;
  twilioConfigured: boolean;
  nodeEnv: string;
};

export type DnsRecordStatus = {
  name: string;
  type: "TXT" | "CNAME";
  status: "present" | "missing" | "error";
  values: string[];
  error?: string;
};

export type DnsAudit = {
  spf: DnsRecordStatus & {
    hasSpf: boolean;
    includesPostmark: boolean;
    includesWorkspaceProvider: boolean;
    recommendedMergedValue: string;
  };
  dmarc: DnsRecordStatus & {
    hasDmarc: boolean;
    policy: string | null;
  };
  returnPath: DnsRecordStatus & {
    pointsToPostmark: boolean;
  };
  returnPathTxt: DnsRecordStatus & {
    conflictsWithCname: boolean;
  };
  dkimCandidates: DnsRecordStatus[];
  dkimLikelyConfigured: boolean;
};

export type PostmarkSenderSignatureAudit = {
  email: string;
  expectedName: string;
  found: boolean;
  confirmed: boolean | null;
  name: string | null;
  replyTo: string | null;
  senderSignatureId: number | null;
  spfVerified: boolean | null;
  spfHost: string | null;
  spfTextValue: string | null;
  dkimVerified: boolean | null;
  dkimHost: string | null;
  dkimPendingHost: string | null;
  returnPathDomain: string | null;
  returnPathDomainVerified: boolean | null;
  returnPathDomainCnameValue: string | null;
  error: string | null;
};

export type PostmarkSenderSignatureSummary = {
  status: "verified" | "partial" | "missing_token" | "error";
  message: string;
  signatures: PostmarkSenderSignatureAudit[];
};

export type SenderIdentityAudit = {
  email: string;
  name: string;
  databaseIdentity: {
    exists: boolean;
    active: boolean;
    fromName: string | null;
    replyTo: string | null;
    emailDailyLimit: number | null;
    smsDailyLimit: number | null;
    rampDay: number | null;
    updatedAt: string | null;
  };
  postmarkSignature: PostmarkSenderSignatureAudit | null;
  senderHealth: GenericRow | null;
  recentEvents: GenericRow[];
  verificationStatus: "ready" | "blocked" | "needs_postmark_confirmation" | "not_configured";
  notes: string[];
};

export type EmailFirstAutomationMode = {
  mode: "email_first" | "paused" | "mixed_ready";
  status: string;
  outboundEmailAllowed: boolean;
  smsLiveSendingAllowed: boolean;
  manualApprovalMode: boolean;
  dailyEmailCapPerSender: number;
  automationBatchLimit: number;
  controls: GenericRow | null;
  safeguards: string[];
};

export type EmailInfrastructureAudit = {
  generatedAt: string;
  environment: EnvAudit;
  dns: DnsAudit;
  postmarkCredentialProbe: {
    status: "configured" | "missing" | "active" | "invalid" | "unknown";
    httpStatus?: number;
    message: string;
  };
  postmarkSenderSignatures: PostmarkSenderSignatureSummary;
  senderIdentities: SenderIdentityAudit[];
  webhook: {
    route: string;
    enabled: boolean;
    authConfigured: boolean;
    recentEvents: GenericRow[];
    eventCounts: Record<string, number>;
  };
  suppression: {
    destination: string;
    recentTerminalEvents: GenericRow[];
    status: string;
  };
  emailFirstAutomation: EmailFirstAutomationMode;
  sourceErrors: Record<string, string | undefined>;
  blockingIssues: string[];
  recommendations: string[];
};

export type VerificationSendResult = {
  ok: boolean;
  sender: string;
  recipient: string;
  subject: string;
  timestamp: string;
  provider: string;
  messageId: string | null;
  error: string | null;
  logStatus: string;
};

function hasValue(value: string | undefined): boolean {
  return Boolean(value && value.trim().length > 0);
}

function boolOrNull(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function buildRecommendedSpfValue(records: string[]): string {
  const existing = records.find((value) => value.toLowerCase().startsWith("v=spf1"));
  if (!existing) {
    return `v=spf1 ${POSTMARK_SPF_INCLUDE} include:_spf-usg2.ppe-hosted.com include:secureserver.net ~all`;
  }
  if (existing.includes(POSTMARK_SPF_INCLUDE)) return existing;
  return existing.replace(/\s(~all|-all|\?all|\+all)$/i, ` ${POSTMARK_SPF_INCLUDE}$1`);
}

function getEnvAudit(): EnvAudit {
  const emailProvider = process.env.EMAIL_PROVIDER?.trim() || (
    process.env.POSTMARK_API_TOKEN
      ? "postmark"
      : process.env.RESEND_API_KEY
      ? "resend"
      : process.env.MAILGUN_API_KEY
      ? "mailgun"
      : "not configured"
  );

  return {
    emailProvider,
    postmarkApiTokenConfigured: hasValue(process.env.POSTMARK_API_TOKEN),
    postmarkAccountTokenConfigured: hasValue(process.env.POSTMARK_ACCOUNT_TOKEN),
    postmarkFromEmailConfigured: hasValue(process.env.POSTMARK_FROM_EMAIL),
    postmarkFromNameConfigured: hasValue(process.env.POSTMARK_FROM_NAME),
    postmarkMessageStream: process.env.POSTMARK_MESSAGE_STREAM || "outbound",
    postmarkWebhookEnabled: process.env.ENABLE_POSTMARK_WEBHOOK === "true",
    postmarkWebhookAuthConfigured: hasValue(process.env.POSTMARK_WEBHOOK_USER) && hasValue(process.env.POSTMARK_WEBHOOK_PASSWORD),
    defaultFromEmail: process.env.DEFAULT_FROM_EMAIL ?? null,
    defaultReplyToEmail: process.env.DEFAULT_REPLY_TO_EMAIL ?? null,
    resendConfigured: hasValue(process.env.RESEND_API_KEY),
    mailgunConfigured: hasValue(process.env.MAILGUN_API_KEY) && hasValue(process.env.MAILGUN_DOMAIN),
    twilioConfigured: hasValue(process.env.TWILIO_ACCOUNT_SID) && (
      hasValue(process.env.TWILIO_MESSAGING_SERVICE_SID) ||
      hasValue(process.env.TWILIO_PHONE_NUMBER)
    ),
    nodeEnv: process.env.NODE_ENV ?? "development",
  };
}

async function lookupTxt(name: string): Promise<DnsRecordStatus> {
  try {
    const records = await resolveTxt(name);
    return {
      name,
      type: "TXT",
      status: records.length ? "present" : "missing",
      values: records.map((record) => record.join("")),
    };
  } catch (err) {
    const code = typeof err === "object" && err && "code" in err ? String((err as { code?: string }).code) : undefined;
    return {
      name,
      type: "TXT",
      status: code === "ENODATA" || code === "ENOTFOUND" ? "missing" : "error",
      values: [],
      error: code ?? (err instanceof Error ? err.message : String(err)),
    };
  }
}

async function lookupCname(name: string): Promise<DnsRecordStatus> {
  try {
    const records = await resolveCname(name);
    return {
      name,
      type: "CNAME",
      status: records.length ? "present" : "missing",
      values: records,
    };
  } catch (err) {
    const code = typeof err === "object" && err && "code" in err ? String((err as { code?: string }).code) : undefined;
    return {
      name,
      type: "CNAME",
      status: code === "ENODATA" || code === "ENOTFOUND" ? "missing" : "error",
      values: [],
      error: code ?? (err instanceof Error ? err.message : String(err)),
    };
  }
}

function extractDmarcPolicy(records: string[]): string | null {
  const record = records.find((value) => value.toLowerCase().startsWith("v=dmarc1"));
  if (!record) return null;
  const policy = record.split(";").map((part) => part.trim()).find((part) => part.toLowerCase().startsWith("p="));
  return policy ? policy.slice(2) : null;
}

export async function auditDnsAuthentication(): Promise<DnsAudit> {
  const [spfBase, dmarcBase, returnPath, returnPathTxt, ...dkimCandidates] = await Promise.all([
    lookupTxt("home-reach.com"),
    lookupTxt("_dmarc.home-reach.com"),
    lookupCname(POSTMARK_RETURN_PATH_HOST),
    lookupTxt(POSTMARK_RETURN_PATH_HOST),
    lookupCname("20230601pm._domainkey.home-reach.com"),
    lookupCname("20161025pm._domainkey.home-reach.com"),
    lookupCname("pm._domainkey.home-reach.com"),
    lookupCname("dkim._domainkey.home-reach.com"),
    lookupCname("postmark._domainkey.home-reach.com"),
    lookupTxt("pm._domainkey.home-reach.com"),
    lookupTxt("dkim._domainkey.home-reach.com"),
    lookupTxt("postmark._domainkey.home-reach.com"),
  ]);

  const spfValues = spfBase.values.filter((value) => value.toLowerCase().startsWith("v=spf1"));
  const dmarcValues = dmarcBase.values.filter((value) => value.toLowerCase().startsWith("v=dmarc1"));

  return {
    spf: {
      ...spfBase,
      hasSpf: spfValues.length > 0,
      includesPostmark: spfValues.some((value) => /spf\.mtasv\.net|postmark|mtasv/i.test(value)),
      includesWorkspaceProvider: spfValues.some((value) => /secureserver|ppe-hosted|protection\.outlook/i.test(value)),
      recommendedMergedValue: buildRecommendedSpfValue(spfBase.values),
    },
    dmarc: {
      ...dmarcBase,
      hasDmarc: dmarcValues.length > 0,
      policy: extractDmarcPolicy(dmarcValues),
    },
    returnPath: {
      ...returnPath,
      pointsToPostmark: returnPath.values.some((value) => value.toLowerCase().includes("mtasv.net")),
    },
    returnPathTxt: {
      ...returnPathTxt,
      conflictsWithCname: returnPathTxt.status === "present",
    },
    dkimCandidates,
    dkimLikelyConfigured: dkimCandidates.some((record) =>
      record.status === "present" &&
      record.values.some((value) => /dkim|mtasv|postmark/i.test(value)),
    ),
  };
}

async function probePostmarkCredential(env: EnvAudit): Promise<EmailInfrastructureAudit["postmarkCredentialProbe"]> {
  if (!env.postmarkApiTokenConfigured) {
    return {
      status: "missing",
      message: "POSTMARK_API_TOKEN is not available in this runtime.",
    };
  }

  try {
    const response = await fetch("https://api.postmarkapp.com/server", {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-Postmark-Server-Token": process.env.POSTMARK_API_TOKEN ?? "",
      },
      cache: "no-store",
    });
    if (response.ok) {
      return {
        status: "active",
        httpStatus: response.status,
        message: "Postmark server token accepted.",
      };
    }
    return {
      status: response.status === 401 ? "invalid" : "unknown",
      httpStatus: response.status,
      message: `Postmark credential probe returned HTTP ${response.status}.`,
    };
  } catch (err) {
    return {
      status: "unknown",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

function buildMissingSignature(email: string, expectedName: string, error: string | null): PostmarkSenderSignatureAudit {
  return {
    email,
    expectedName,
    found: false,
    confirmed: null,
    name: null,
    replyTo: null,
    senderSignatureId: null,
    spfVerified: null,
    spfHost: null,
    spfTextValue: null,
    dkimVerified: null,
    dkimHost: null,
    dkimPendingHost: null,
    returnPathDomain: null,
    returnPathDomainVerified: null,
    returnPathDomainCnameValue: null,
    error,
  };
}

function normalizePostmarkSignature(
  row: PostmarkSenderSignatureApiRow | null | undefined,
  expected: { email: string; name: string },
  error: string | null = null,
): PostmarkSenderSignatureAudit {
  if (!row) return buildMissingSignature(expected.email, expected.name, error);

  return {
    email: expected.email,
    expectedName: expected.name,
    found: true,
    confirmed: boolOrNull(row.Confirmed),
    name: stringOrNull(row.Name),
    replyTo: stringOrNull(row.ReplyToEmailAddress),
    senderSignatureId: numberOrNull(row.ID),
    spfVerified: boolOrNull(row.SPFVerified),
    spfHost: stringOrNull(row.SPFHost),
    spfTextValue: stringOrNull(row.SPFTextValue),
    dkimVerified: boolOrNull(row.DKIMVerified),
    dkimHost: stringOrNull(row.DKIMHost),
    dkimPendingHost: stringOrNull(row.DKIMPendingHost),
    returnPathDomain: stringOrNull(row.ReturnPathDomain),
    returnPathDomainVerified: boolOrNull(row.ReturnPathDomainVerified),
    returnPathDomainCnameValue: stringOrNull(row.ReturnPathDomainCNAMEValue),
    error,
  };
}

async function fetchPostmarkSignatureDetail(id: number): Promise<PostmarkSenderSignatureApiRow | null> {
  const response = await fetch(`https://api.postmarkapp.com/senders/${id}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "X-Postmark-Account-Token": process.env.POSTMARK_ACCOUNT_TOKEN ?? "",
    },
    cache: "no-store",
  });

  if (!response.ok) return null;
  return await response.json() as PostmarkSenderSignatureApiRow;
}

async function auditPostmarkSenderSignatures(env: EnvAudit): Promise<PostmarkSenderSignatureSummary> {
  if (!env.postmarkAccountTokenConfigured) {
    return {
      status: "missing_token",
      message: "POSTMARK_ACCOUNT_TOKEN is not available, so sender signatures must be confirmed in the Postmark console.",
      signatures: HOME_REACH_SENDER_IDENTITIES.map((sender) =>
        buildMissingSignature(sender.email, sender.name, "POSTMARK_ACCOUNT_TOKEN missing"),
      ),
    };
  }

  try {
    const response = await fetch("https://api.postmarkapp.com/senders?count=500&offset=0", {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-Postmark-Account-Token": process.env.POSTMARK_ACCOUNT_TOKEN ?? "",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        status: "error",
        message: `Postmark sender signature API returned HTTP ${response.status}.`,
        signatures: HOME_REACH_SENDER_IDENTITIES.map((sender) =>
          buildMissingSignature(sender.email, sender.name, `Postmark API HTTP ${response.status}`),
        ),
      };
    }

    const payload = await response.json() as { SenderSignatures?: PostmarkSenderSignatureApiRow[] };
    const rows = Array.isArray(payload.SenderSignatures) ? payload.SenderSignatures : [];
    const signatures = await Promise.all(HOME_REACH_SENDER_IDENTITIES.map(async (sender) => {
      const listed = rows.find((row) => lower(row.EmailAddress) === sender.email);
      if (!listed) return buildMissingSignature(sender.email, sender.name, "Sender signature not found in Postmark account.");
      const id = numberOrNull(listed.ID);
      const detail = id ? await fetchPostmarkSignatureDetail(id) : null;
      return normalizePostmarkSignature(detail ?? listed, sender, null);
    }));

    const allConfirmed = signatures.every((signature) => signature.found && signature.confirmed === true);
    return {
      status: allConfirmed ? "verified" : "partial",
      message: allConfirmed
        ? "All required HomeReach sender signatures were found and confirmed by the Postmark Account API."
        : "One or more HomeReach sender signatures are missing or not confirmed in Postmark.",
      signatures,
    };
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : String(err),
      signatures: HOME_REACH_SENDER_IDENTITIES.map((sender) =>
        buildMissingSignature(sender.email, sender.name, err instanceof Error ? err.message : String(err)),
      ),
    };
  }
}

async function safeQuery<T>(
  query: () => PromiseLike<{ data: T | null; error: { message: string } | null }>,
): Promise<{ data: T | null; error?: string }> {
  try {
    const result = await query();
    if (result.error) return { data: null, error: result.error.message };
    return { data: result.data };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : String(err) };
  }
}

function asArray(value: unknown): GenericRow[] {
  return Array.isArray(value) ? value as GenericRow[] : [];
}

function countBy(rows: GenericRow[], key: string): Record<string, number> {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const value = String(row[key] ?? "unknown");
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function lower(value: unknown): string {
  return typeof value === "string" ? value.toLowerCase() : "";
}

function buildAutomationMode(controls: GenericRow | null, env: EnvAudit): EmailFirstAutomationMode {
  const safety = getOutreachSafetyConfig();
  const allPaused = Boolean(controls?.all_paused);
  const emailPaused = Boolean(controls?.email_paused);
  const smsLiveSendingAllowed = Boolean(controls?.sms_prospecting_live_enabled ?? safety.smsProspectingLiveEnabled);
  const manualApprovalMode = Boolean(controls?.manual_approval_mode ?? safety.manualApprovalMode);
  const outboundEmailAllowed = !allPaused && !emailPaused && env.postmarkApiTokenConfigured;
  const dailyEmailCapPerSender = Number(controls?.daily_email_cap_per_sender ?? safety.dailyEmailCapPerSender ?? 30);
  const automationBatchLimit = Number(controls?.automation_batch_limit ?? 10);

  return {
    mode: allPaused || emailPaused ? "paused" : smsLiveSendingAllowed ? "mixed_ready" : "email_first",
    status: allPaused
      ? "All outreach is paused."
      : emailPaused
      ? "Email sending is paused."
      : smsLiveSendingAllowed
      ? "SMS is marked live; verify Twilio/A2P before mixed-channel automation."
      : "Email-first mode is active until Twilio/A2P is confirmed.",
    outboundEmailAllowed,
    smsLiveSendingAllowed,
    manualApprovalMode,
    dailyEmailCapPerSender,
    automationBatchLimit,
    controls,
    safeguards: [
      "SMS prospecting remains blocked unless sms_prospecting_live_enabled is true.",
      "Automation batch limits and per-sender daily email caps remain enforced.",
      "Admin verification sends are one-recipient tests only.",
      manualApprovalMode
        ? "Manual approval mode currently blocks due automation sends."
        : "Manual approval mode is not enabled; keep campaign-scale sends approval-gated operationally before scaling.",
    ],
  };
}

function buildEmailRecommendations(input: {
  env: EnvAudit;
  dns: DnsAudit;
  postmarkSenderSignatures: PostmarkSenderSignatureSummary;
  automationMode: EmailFirstAutomationMode;
}): string[] {
  const recommendations: string[] = [];

  if (input.postmarkSenderSignatures.status === "missing_token") {
    recommendations.push("Add POSTMARK_ACCOUNT_TOKEN to production if you want this dashboard to confirm Postmark sender signatures by API; otherwise confirm heather, josh, chelsi, and jason manually in Postmark Sender Signatures.");
  } else if (input.postmarkSenderSignatures.status !== "verified") {
    recommendations.push("Resolve missing or unconfirmed Postmark sender signatures for heather, josh, chelsi, and jason before scaling beyond verification sends.");
  }

  if (!input.dns.spf.includesPostmark) {
    recommendations.push(`Merge Postmark into the existing root SPF record, not a second SPF record: ${input.dns.spf.recommendedMergedValue}`);
  }

  if (!input.dns.dkimLikelyConfigured) {
    recommendations.push("Add the DKIM host/value shown in the Postmark console for home-reach.com, then refresh this audit until a Postmark DKIM selector is visible.");
  }

  if (!input.dns.returnPath.pointsToPostmark) {
    recommendations.push(`Configure the Postmark Return-Path CNAME for ${POSTMARK_RETURN_PATH_HOST} to the Postmark target shown in the console, commonly ${POSTMARK_RETURN_PATH_TARGET}.`);
  }

  if (input.dns.returnPathTxt.conflictsWithCname) {
    recommendations.push(`${POSTMARK_RETURN_PATH_HOST} currently has TXT records; remove any conflicting TXT records before adding the Postmark Return-Path CNAME.`);
  }

  if (input.automationMode.smsLiveSendingAllowed) {
    recommendations.push("Keep Twilio prospecting disabled until A2P/10DLC approval, inbound webhooks, and status callbacks are verified.");
  }

  if (!input.automationMode.manualApprovalMode) {
    recommendations.push("Turn on manual approval mode before campaign-scale outbound sequences.");
  }

  recommendations.push("Keep verification sends at one recipient per sender and monitor Postmark delivery, open, bounce, and suppression events before any warm-up.");

  return recommendations;
}

export async function getEmailInfrastructureAudit(): Promise<EmailInfrastructureAudit> {
  const env = getEnvAudit();
  const db = createServiceClient();
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const senderEmails = HOME_REACH_SENDER_IDENTITIES.map((sender) => sender.email);

  const [
    dns,
    postmarkCredentialProbe,
    postmarkSenderSignatures,
    identities,
    senderHealth,
    recentEvents,
    controls,
    verificationRows,
  ] = await Promise.all([
    auditDnsAuthentication(),
    probePostmarkCredential(env),
    auditPostmarkSenderSignatures(env),
    safeQuery<GenericRow[]>(() =>
      db
        .from("agent_identities")
        .select("agent_id, from_email, from_name, reply_to_email, is_active, email_daily_limit, sms_daily_limit, email_ramp_day, updated_at")
        .in("from_email", senderEmails),
    ),
    safeQuery<GenericRow[]>(() =>
      db.from("v_sender_health" as never).select("*").limit(100),
    ),
    safeQuery<GenericRow[]>(() =>
      db
        .from("email_events")
        .select("provider,event_type,message_id,recipient,subject,bounce_type,error_code,error_message,tags,raw_payload,received_at")
        .gte("received_at", since)
        .order("received_at", { ascending: false })
        .limit(100),
    ),
    safeQuery<GenericRow>(() =>
      db.from("system_controls").select("*").eq("id", 1).maybeSingle(),
    ),
    safeQuery<GenericRow[]>(() =>
      db
        .from("email_verification_tests")
        .select("*")
        .order("requested_at", { ascending: false })
        .limit(50),
    ),
  ]);

  const identityRows = asArray(identities.data);
  const healthRows = asArray(senderHealth.data);
  const eventRows = asArray(recentEvents.data);
  const verificationHistory = asArray(verificationRows.data);
  const combinedEvents = [
    ...verificationHistory.map((row) => ({
      provider: row.provider,
      event_type: row.status,
      message_id: row.message_id,
      recipient: row.recipient_email,
      subject: row.subject,
      tags: ["home_reach_verification"],
      raw_payload: row.provider_response,
      received_at: row.requested_at,
      sender_email: row.sender_email,
    })),
    ...eventRows,
  ];
  const automationMode = buildAutomationMode(controls.data, env);

  const senderIdentities = HOME_REACH_SENDER_IDENTITIES.map((sender) => {
    const identity = identityRows.find((row) => lower(row.from_email) === sender.email);
    const health = healthRows.find((row) => lower(row.from_email) === sender.email) ?? null;
    const signature = postmarkSenderSignatures.signatures.find((row) => lower(row.email) === sender.email) ?? null;
    const senderRecentEvents = combinedEvents.filter((event) => {
      const rawPayload = event.raw_payload as GenericRow | undefined;
      const metadata = rawPayload?.Metadata as GenericRow | undefined;
      const senderFromRaw = lower(metadata?.sender_email ?? rawPayload?.sender_email ?? event.sender_email);
      return senderFromRaw === sender.email;
    }).slice(0, 8);

    const notes: string[] = [];
    if (!identity) notes.push("No agent_identities row found for this sender.");
    if (identity && identity.is_active === false) notes.push("Database identity is inactive.");
    if (!env.postmarkApiTokenConfigured) notes.push("Postmark token is not available in this runtime.");
    if (env.postmarkApiTokenConfigured && !env.postmarkAccountTokenConfigured) {
      notes.push("Postmark account token is not configured, so sender signature confirmation must be checked in Postmark.");
    }
    if (env.postmarkAccountTokenConfigured && !signature?.found) notes.push("Postmark sender signature was not found by the Account API.");
    if (signature?.found && signature.confirmed === false) notes.push("Postmark sender signature exists but is not confirmed.");
    if (signature?.found && signature.confirmed === true) notes.push("Postmark sender signature confirmed by API.");
    if (signature?.dkimVerified === false) notes.push("Postmark reports DKIM is not verified for this sender/domain.");
    if (!dns.spf.includesPostmark) notes.push("Domain SPF does not visibly include Postmark.");
    if (!dns.dkimLikelyConfigured) notes.push("No common Postmark DKIM selector was found by DNS lookup.");
    if (!dns.returnPath.pointsToPostmark) notes.push("Postmark Return-Path CNAME was not found.");

    return {
      email: sender.email,
      name: sender.name,
      databaseIdentity: {
        exists: Boolean(identity),
        active: Boolean(identity?.is_active),
        fromName: typeof identity?.from_name === "string" ? identity.from_name : null,
        replyTo: typeof identity?.reply_to_email === "string" ? identity.reply_to_email : null,
        emailDailyLimit: typeof identity?.email_daily_limit === "number" ? identity.email_daily_limit : null,
        smsDailyLimit: typeof identity?.sms_daily_limit === "number" ? identity.sms_daily_limit : null,
        rampDay: typeof identity?.email_ramp_day === "number" ? identity.email_ramp_day : null,
        updatedAt: typeof identity?.updated_at === "string" ? identity.updated_at : null,
      },
      postmarkSignature: signature,
      senderHealth: health,
      recentEvents: senderRecentEvents,
      verificationStatus: !identity
        ? "not_configured"
        : identity.is_active === false
        ? "blocked"
        : !env.postmarkApiTokenConfigured ||
          !dns.spf.includesPostmark ||
          !dns.dkimLikelyConfigured ||
          !dns.returnPath.pointsToPostmark ||
          (env.postmarkAccountTokenConfigured && (!signature?.found || signature.confirmed !== true))
        ? "needs_postmark_confirmation"
        : "ready",
      notes,
    } satisfies SenderIdentityAudit;
  });

  const terminalEvents = eventRows.filter((event) =>
    lower(event.recipient) === DEFAULT_VERIFICATION_DESTINATION &&
    ["bounce", "spam_complaint", "subscription_change", "unsubscribe"].includes(lower(event.event_type)),
  );

  const blockingIssues = [
    env.emailProvider !== "postmark" ? `Active runtime EMAIL_PROVIDER is ${env.emailProvider}, not postmark.` : null,
    !env.postmarkApiTokenConfigured ? "POSTMARK_API_TOKEN is missing in this runtime." : null,
    !dns.spf.includesPostmark ? "SPF does not include a visible Postmark sending include." : null,
    !dns.dkimLikelyConfigured ? "Postmark DKIM was not found on common selectors." : null,
    !dns.returnPath.pointsToPostmark ? "Postmark Return-Path CNAME is missing or not pointed to Postmark." : null,
    dns.returnPathTxt.conflictsWithCname ? "Postmark Return-Path host has TXT records that can conflict with the required CNAME." : null,
    env.postmarkAccountTokenConfigured && postmarkSenderSignatures.status !== "verified"
      ? "One or more Postmark sender signatures could not be confirmed by API."
      : null,
    env.postmarkWebhookEnabled && !env.postmarkWebhookAuthConfigured ? "Postmark webhook is enabled but Basic Auth env vars are missing." : null,
  ].filter(Boolean) as string[];

  return {
    generatedAt: new Date().toISOString(),
    environment: env,
    dns,
    postmarkCredentialProbe,
    postmarkSenderSignatures,
    senderIdentities,
    webhook: {
      route: "/api/webhooks/postmark",
      enabled: env.postmarkWebhookEnabled,
      authConfigured: env.postmarkWebhookAuthConfigured,
      recentEvents: eventRows.slice(0, 20),
      eventCounts: countBy(eventRows, "event_type"),
    },
    suppression: {
      destination: DEFAULT_VERIFICATION_DESTINATION,
      recentTerminalEvents: terminalEvents,
      status: terminalEvents.length
        ? "Recent bounce/complaint/unsubscribe events exist for the test destination."
        : "No recent terminal suppression events found in HomeReach email_events for the test destination.",
    },
    emailFirstAutomation: automationMode,
    sourceErrors: {
      agent_identities: identities.error,
      sender_health: senderHealth.error,
      email_events: recentEvents.error,
      system_controls: controls.error,
      email_verification_tests: verificationRows.error,
    },
    blockingIssues,
    recommendations: buildEmailRecommendations({ env, dns, postmarkSenderSignatures, automationMode }),
  };
}

function isKnownSender(email: string): email is HomeReachSenderEmail {
  return HOME_REACH_SENDER_IDENTITIES.some((sender) => sender.email === email.toLowerCase());
}

function buildVerificationBody(sender: { name: string; email: string }, timestamp: string) {
  const text = `Hello Jason,

This is an automated HomeReach outbound verification test confirming successful email delivery for the HomeReach messaging infrastructure.

Sender Identity:
${sender.name} <${sender.email}>

Timestamp:
${timestamp}

If you received this email successfully, outbound delivery is functioning correctly.

- HomeReach System`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 640px; color: #172033; line-height: 1.55;">
      <p>Hello Jason,</p>
      <p>This is an automated HomeReach outbound verification test confirming successful email delivery for the HomeReach messaging infrastructure.</p>
      <p><strong>Sender Identity:</strong><br>${sender.name} &lt;${sender.email}&gt;</p>
      <p><strong>Timestamp:</strong><br>${timestamp}</p>
      <p>If you received this email successfully, outbound delivery is functioning correctly.</p>
      <p>- HomeReach System</p>
    </div>
  `;

  return { html, text };
}

async function insertVerificationLog(input: {
  sender: { name: string; email: string };
  recipient: string;
  subject: string;
  status: "sent" | "failed";
  messageId: string | null;
  providerResponse: GenericRow;
  error: string | null;
  requestedBy?: string | null;
}) {
  const db = createServiceClient();
  const row = {
    provider: "postmark",
    sender_email: input.sender.email,
    sender_name: input.sender.name,
    recipient_email: input.recipient,
    subject: input.subject,
    status: input.status,
    message_id: input.messageId,
    provider_response: input.providerResponse,
    error_message: input.error,
    requested_by: input.requestedBy ?? null,
  };

  const { error } = await db.from("email_verification_tests").insert(row);
  if (!error) return "email_verification_tests";

  const fallback = await db.from("email_events").insert({
    provider: "postmark",
    event_type: input.status === "sent" ? "verification_sent" : "verification_failed",
    message_id: input.messageId,
    recipient: input.recipient,
    subject: input.subject,
    error_message: input.error ?? error.message,
    tags: ["home_reach_verification", "safe_test"],
    raw_payload: {
      ...input.providerResponse,
      sender_email: input.sender.email,
      sender_name: input.sender.name,
      requested_by: input.requestedBy ?? null,
      primary_log_error: error.message,
    },
  });
  return fallback.error ? `log_failed: ${fallback.error.message}` : "email_events_fallback";
}

export async function sendVerificationEmail(input: {
  senderEmail: string;
  recipientEmail?: string;
  requestedBy?: string | null;
}): Promise<VerificationSendResult> {
  const senderEmail = input.senderEmail.trim().toLowerCase();
  if (!isKnownSender(senderEmail)) {
    throw new Error("Unsupported sender identity.");
  }

  const sender = HOME_REACH_SENDER_IDENTITIES.find((item) => item.email === senderEmail)!;
  const recipient = input.recipientEmail?.trim().toLowerCase() || DEFAULT_VERIFICATION_DESTINATION;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    throw new Error("Invalid destination email.");
  }

  const timestamp = new Date().toISOString();
  const subject = `[HomeReach Verification Test] ${sender.name.replace(" HomeReach", "")}`;
  const body = buildVerificationBody(sender, timestamp);

  const result = await sendEmail({
    provider: "postmark",
    to: recipient,
    subject,
    html: body.html,
    text: body.text,
    fromEmail: sender.email,
    fromName: sender.name,
    replyTo: sender.email,
    messageStream: process.env.POSTMARK_MESSAGE_STREAM || "outbound",
    tags: ["home_reach_verification"],
    metadata: {
      verification_type: "outbound_identity",
      sender_email: sender.email,
      sender_name: sender.name,
      destination: recipient,
      timestamp,
    },
    intent: "internal",
    testMode: false,
  });

  const logStatus = await insertVerificationLog({
    sender,
    recipient,
    subject,
    status: result.success ? "sent" : "failed",
    messageId: result.externalId ?? null,
    providerResponse: {
      provider: result.provider ?? "postmark",
      success: result.success,
      external_id: result.externalId ?? null,
      error: result.error ?? null,
      timestamp,
    },
    error: result.error ?? null,
    requestedBy: input.requestedBy,
  });

  return {
    ok: result.success,
    sender: `${sender.name} <${sender.email}>`,
    recipient,
    subject,
    timestamp,
    provider: result.provider ?? "postmark",
    messageId: result.externalId ?? null,
    error: result.error ?? null,
    logStatus,
  };
}
