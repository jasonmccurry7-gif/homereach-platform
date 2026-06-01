import "server-only";

import crypto from "crypto";
import { createServiceClient } from "@/lib/supabase/service";

export type OutreachChannel = "email" | "sms" | "facebook_dm" | "manual";
export type ReputationRiskLevel = "low" | "medium" | "high" | "critical";
export type ReputationDecision =
  | "allow"
  | "delay"
  | "rewrite_required"
  | "approval_required"
  | "pause"
  | "block";

export type RevenueBusinessLine =
  | "targeted_mailing"
  | "inventory_procurement"
  | "political"
  | "unknown";

type DbClient = ReturnType<typeof createServiceClient>;

type SystemControls = {
  all_paused?: boolean | null;
  sms_paused?: boolean | null;
  email_paused?: boolean | null;
  facebook_paused?: boolean | null;
  manual_approval_mode?: boolean | null;
  outreach_test_mode?: boolean | null;
  sms_prospecting_live_enabled?: boolean | null;
  deliverability_auto_pause_enabled?: boolean | null;
  domain_reputation_paused?: boolean | null;
  max_domain_daily_email_cap?: number | null;
  max_sender_risk_score?: number | null;
  sms_marketing_requires_consent?: boolean | null;
  email_domain_authentication_verified?: boolean | null;
  postmark_sender_signatures_verified?: boolean | null;
  twilio_a2p_approved?: boolean | null;
  daily_email_cap_per_sender?: number | null;
  daily_sms_cap?: number | null;
  outreach_weekly_ramp_max_percent?: number | null;
};

export type ReputationInput = {
  supabase?: DbClient;
  senderEmail?: string | null;
  senderName?: string | null;
  channel: OutreachChannel;
  recipient?: string | null;
  businessLine?: RevenueBusinessLine;
  sourceSystem?: string | null;
  sourceId?: string | null;
  subject?: string | null;
  body: string;
  templateKey?: string | null;
  humanApproved?: boolean;
  autonomous?: boolean;
  recipientSource?:
    | "opted_in"
    | "form_request"
    | "existing_relationship"
    | "public_campaign_contact"
    | "public_business_contact"
    | "purchased_list"
    | "unknown";
  smsConsent?: boolean | null;
  smsPurpose?: "transactional" | "marketing" | "conversation" | "requested_follow_up";
  deliverabilityStatus?: "clear" | "review" | "blocked" | string | null;
  deliverabilityFlags?: string[] | null;
  metadata?: Record<string, unknown>;
};

export type ReputationResult = {
  enabled: boolean;
  allowed: boolean;
  score: number;
  level: ReputationRiskLevel;
  decision: ReputationDecision;
  recommendedAction: string;
  safeDailyLimit: number;
  blockers: string[];
  warnings: string[];
  factors: Record<string, unknown>;
  messageHash: string;
  subjectHash: string | null;
  templateHash: string | null;
};

type SenderHealth = {
  sendsToday: number;
  sends7d: number;
  replies7d: number;
  bounces30d: number;
  complaints30d: number;
  unsubscribes30d: number;
  failures30d: number;
  replyRate7d: number;
  bounceRate30d: number;
  complaintRate30d: number;
  unsubscribeRate30d: number;
  failureRate30d: number;
};

type SenderSummary = {
  senderEmail: string;
  senderName: string;
  emailSendsToday: number;
  smsSendsToday: number;
  emailSends7d: number;
  smsSends7d: number;
  replies7d: number;
  bounces30d: number;
  complaints30d: number;
  unsubscribes30d: number;
  failures30d: number;
  riskScore: number;
  level: ReputationRiskLevel;
  status: "healthy" | "watch" | "needs_review" | "paused" | "blocked";
  safeEmailLimit: number;
  safeSmsLimit: number;
  recommendation: string;
};

export type DeliverabilityCommandCenterSnapshot = {
  generatedAt: string;
  controls: SystemControls | null;
  overall: {
    score: number;
    status: "healthy" | "watch" | "needs_review" | "paused" | "blocked";
    recommendation: string;
  };
  domainHealth: {
    emailAuthVerified: boolean;
    postmarkSignaturesVerified: boolean;
    domainPaused: boolean;
    status: "healthy" | "watch" | "needs_review" | "paused" | "blocked";
    issues: string[];
  };
  smsHealth: {
    twilioA2pApproved: boolean;
    prospectingEnabled: boolean;
    smsPaused: boolean;
    status: "healthy" | "watch" | "needs_review" | "paused" | "blocked";
    issues: string[];
  };
  totals: {
    sendsToday: number;
    sends7d: number;
    replies7d: number;
    bounces30d: number;
    complaints30d: number;
    unsubscribes30d: number;
    optOuts30d: number;
    blockedRiskEvents7d: number;
  };
  senders: SenderSummary[];
  recentRiskEvents: Array<Record<string, unknown>>;
  suppressions: Array<Record<string, unknown>>;
  scalingRecommendations: Array<Record<string, unknown>>;
};

const LOW = 34;
const MEDIUM = 59;
const HIGH = 79;

function envBool(name: string, fallback = false): boolean {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function toIso(value: Date): string {
  return value.toISOString();
}

function normalizeEmail(value: string | null | undefined): string | null {
  const email = value?.trim().toLowerCase() ?? "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function normalizePhone(value: string | null | undefined): string | null {
  const phone = value?.trim() ?? "";
  if (!phone) return null;
  const digits = phone.replace(/[^\d+]/g, "");
  return digits || null;
}

function normalizeRecipient(channel: OutreachChannel, value: string | null | undefined): string | null {
  if (channel === "email") return normalizeEmail(value);
  if (channel === "sms") return normalizePhone(value);
  return value?.trim() || null;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function percentage(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Number((numerator / denominator).toFixed(4));
}

function isUuid(value: string | null | undefined): value is string {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}

export function hashText(value: string | null | undefined): string | null {
  const text = value?.trim();
  if (!text) return null;
  return crypto.createHash("sha256").update(text).digest("hex");
}

export function riskLevelFromScore(score: number): ReputationRiskLevel {
  if (score <= LOW) return "low";
  if (score <= MEDIUM) return "medium";
  if (score <= HIGH) return "high";
  return "critical";
}

function decisionForScore(input: {
  score: number;
  channel: OutreachChannel;
  humanApproved: boolean;
  autonomous: boolean;
  blockers: string[];
  warnings: string[];
}): ReputationDecision {
  const level = riskLevelFromScore(input.score);
  if (input.blockers.length > 0 || level === "critical") return "block";
  if (level === "high") return input.autonomous ? "block" : "pause";
  if (level === "medium") {
    if (input.humanApproved && !input.autonomous) return "allow";
    if (input.warnings.some((warning) => /copy|template|personalization|claim/i.test(warning))) {
      return "rewrite_required";
    }
    return "approval_required";
  }
  return "allow";
}

function safeNumber(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function senderDefaultSafeLimit(channel: OutreachChannel, controls: SystemControls | null): number {
  if (channel === "sms") return Math.max(1, safeNumber(controls?.daily_sms_cap, 5));
  if (channel === "email") return Math.max(1, safeNumber(controls?.daily_email_cap_per_sender, 5));
  return 5;
}

async function loadControls(db: DbClient): Promise<SystemControls | null> {
  try {
    const { data } = await db.from("system_controls").select("*").eq("id", 1).maybeSingle();
    return (data as SystemControls | null) ?? null;
  } catch {
    return null;
  }
}

async function isSuppressed(input: {
  db: DbClient;
  channel: OutreachChannel;
  recipient: string | null;
}): Promise<{ suppressed: boolean; reason?: string | null }> {
  if (!input.recipient) return { suppressed: false };

  const channels = [input.channel, "all"];
  try {
    if (input.channel === "email") {
      const { data } = await input.db
        .from("outreach_suppression_list")
        .select("reason")
        .eq("active", true)
        .in("channel", channels)
        .ilike("contact_email", input.recipient)
        .limit(1)
        .maybeSingle();
      return { suppressed: Boolean(data), reason: data?.reason ?? null };
    }

    if (input.channel === "sms") {
      const { data } = await input.db
        .from("outreach_suppression_list")
        .select("reason")
        .eq("active", true)
        .in("channel", channels)
        .eq("contact_phone", input.recipient)
        .limit(1)
        .maybeSingle();
      return { suppressed: Boolean(data), reason: data?.reason ?? null };
    }
  } catch {
    return { suppressed: false };
  }

  return { suppressed: false };
}

async function countFrom(
  db: DbClient,
  table: string,
  build: (query: any) => PromiseLike<{ count: number | null }>,
): Promise<number> {
  try {
    const query = db.from(table).select("id", { count: "exact", head: true });
    const result = await build(query);
    return result.count ?? 0;
  } catch {
    return 0;
  }
}

async function loadSenderHealth(input: {
  db: DbClient;
  senderEmail: string | null;
  channel: OutreachChannel;
}): Promise<SenderHealth> {
  const now = new Date();
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const normalizedSender = normalizeEmail(input.senderEmail);
  const senderFilter = normalizedSender ?? "";
  const channel = input.channel;

  const sendsToday = normalizedSender
    ? await countFrom(input.db, "revenue_message_events", (query) =>
        query
          .eq("direction", "outbound")
          .eq("channel", channel)
          .ilike("normalized_from", senderFilter)
          .gte("created_at", toIso(startToday)))
    : 0;

  const sends7d = normalizedSender
    ? await countFrom(input.db, "revenue_message_events", (query) =>
        query
          .eq("direction", "outbound")
          .eq("channel", channel)
          .ilike("normalized_from", senderFilter)
          .gte("created_at", toIso(since7d)))
    : 0;

  const replies7d = normalizedSender
    ? await countFrom(input.db, "revenue_message_events", (query) =>
        query
          .eq("direction", "inbound")
          .eq("channel", channel)
          .ilike("normalized_to", senderFilter)
          .gte("created_at", toIso(since7d)))
    : 0;

  const bounces30d = normalizedSender
    ? await countFrom(input.db, "email_events", (query) =>
        query
          .ilike("recipient", "%")
          .or("event_type.ilike.%bounce%,event_type.ilike.%bounced%")
          .gte("created_at", toIso(since30d)))
    : 0;

  const complaints30d = await countFrom(input.db, "email_events", (query) =>
    query
      .or("event_type.ilike.%complaint%,event_type.ilike.%spam%")
      .gte("created_at", toIso(since30d)));

  const unsubscribes30d = await countFrom(input.db, "email_events", (query) =>
    query
      .or("event_type.ilike.%unsubscribe%,event_type.ilike.%suppression%")
      .gte("created_at", toIso(since30d)));

  const failures30d = channel === "sms"
    ? await countFrom(input.db, "twilio_message_status", (query) =>
        query
          .or("message_status.eq.failed,message_status.eq.undelivered,error_code.not.is.null")
          .gte("created_at", toIso(since30d)))
    : await countFrom(input.db, "revenue_message_events", (query) =>
        query
          .eq("direction", "outbound")
          .eq("channel", channel)
          .eq("processing_status", "failed")
          .gte("created_at", toIso(since30d)));

  return {
    sendsToday,
    sends7d,
    replies7d,
    bounces30d,
    complaints30d,
    unsubscribes30d,
    failures30d,
    replyRate7d: percentage(replies7d, sends7d),
    bounceRate30d: percentage(bounces30d, Math.max(sends7d, 1)),
    complaintRate30d: percentage(complaints30d, Math.max(sends7d, 1)),
    unsubscribeRate30d: percentage(unsubscribes30d, Math.max(sends7d, 1)),
    failureRate30d: percentage(failures30d, Math.max(sends7d, 1)),
  };
}

function messagePersonalizationScore(input: ReputationInput): number {
  const combined = `${input.subject ?? ""}\n${input.body}`.toLowerCase();
  let score = 0;
  if (/\b[a-z]+@[a-z0-9.-]+\.[a-z]{2,}\b/i.test(combined)) score += 1;
  if (/\b(candidate|campaign|business|vendor|supplier|county|city|district|office|restaurant|contractor|roof|procurement)\b/i.test(combined)) score += 1;
  if (input.businessLine && input.businessLine !== "unknown") score += 1;
  if (input.recipientSource && input.recipientSource !== "unknown") score += 1;
  if (/\{\{.*?\}\}/.test(combined)) score -= 2;
  return Math.max(0, score);
}

function providerReadiness(input: {
  controls: SystemControls | null;
  channel: OutreachChannel;
}): { scoreAdd: number; blockers: string[]; warnings: string[]; factors: Record<string, unknown> } {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const factors: Record<string, unknown> = {};
  const controls = input.controls;
  const emailDomainVerified =
    Boolean(controls?.email_domain_authentication_verified) ||
    envBool("EMAIL_DOMAIN_AUTHENTICATION_VERIFIED", false);
  const postmarkVerified =
    Boolean(controls?.postmark_sender_signatures_verified) ||
    envBool("POSTMARK_SENDER_SIGNATURES_VERIFIED", false);
  const twilioApproved =
    Boolean(controls?.twilio_a2p_approved) ||
    envBool("TWILIO_A2P_APPROVED", false);

  factors.email_domain_authentication_verified = emailDomainVerified;
  factors.postmark_sender_signatures_verified = postmarkVerified;
  factors.twilio_a2p_approved = twilioApproved;

  let scoreAdd = 0;
  if (input.channel === "email") {
    if (controls?.domain_reputation_paused) {
      blockers.push("domain_reputation_paused");
      scoreAdd += 60;
    }
    if (!emailDomainVerified) {
      warnings.push("SPF/DKIM/DMARC are not marked verified for production scaling.");
      scoreAdd += 18;
    }
    if (!postmarkVerified) {
      warnings.push("Postmark sender signatures/domain sender are not marked verified.");
      scoreAdd += 16;
    }
  }

  if (input.channel === "sms") {
    if (!twilioApproved) {
      warnings.push("Twilio A2P/10DLC is not marked approved.");
      scoreAdd += 22;
    }
    if (!controls?.sms_prospecting_live_enabled) {
      warnings.push("Prospecting SMS live sending is disabled.");
      scoreAdd += 12;
    }
  }

  return { scoreAdd, blockers, warnings, factors };
}

export async function evaluateOutboundReputation(input: ReputationInput): Promise<ReputationResult> {
  const enabled = envBool("OUTREACH_REPUTATION_CONTROL_ENABLED", true);
  const db = input.supabase ?? createServiceClient();
  const controls = await loadControls(db);
  const recipient = normalizeRecipient(input.channel, input.recipient);
  const senderEmail = normalizeEmail(input.senderEmail);
  const messageHash = hashText(input.body) ?? "";
  const subjectHash = hashText(input.subject);
  const templateHash = hashText(input.templateKey);
  const blockers: string[] = [];
  const warnings: string[] = [];
  const factors: Record<string, unknown> = {
    channel: input.channel,
    business_line: input.businessLine ?? "unknown",
    recipient_source: input.recipientSource ?? "unknown",
    human_approved: Boolean(input.humanApproved),
    autonomous: Boolean(input.autonomous),
  };

  let score = 0;

  if (controls?.all_paused) {
    blockers.push("global_outbound_pause");
    score += 100;
  }
  if (input.channel === "email" && controls?.email_paused) {
    blockers.push("email_channel_paused");
    score += 90;
  }
  if (input.channel === "sms" && controls?.sms_paused) {
    blockers.push("sms_channel_paused");
    score += 90;
  }
  if (input.channel === "facebook_dm" && controls?.facebook_paused) {
    blockers.push("facebook_channel_paused");
    score += 90;
  }

  if (!senderEmail && input.channel === "email") {
    blockers.push("missing_sender_email");
    score += 45;
  }
  if (!recipient) {
    blockers.push("missing_or_invalid_recipient");
    score += 55;
  }

  const suppression = await isSuppressed({ db, channel: input.channel, recipient });
  if (suppression.suppressed) {
    blockers.push(`suppressed_recipient:${suppression.reason ?? "suppressed"}`);
    score += 75;
  }

  if (input.deliverabilityStatus === "blocked") {
    blockers.push("copy_deliverability_blocked");
    score += 50;
  }
  if (input.deliverabilityStatus === "review") {
    warnings.push("Copy deliverability review requested.");
    score += 12;
  }
  if (input.deliverabilityFlags?.length) {
    factors.deliverability_flags = input.deliverabilityFlags;
    score += Math.min(24, input.deliverabilityFlags.length * 8);
  }

  const readiness = providerReadiness({ controls, channel: input.channel });
  score += readiness.scoreAdd;
  blockers.push(...readiness.blockers);
  warnings.push(...readiness.warnings);
  Object.assign(factors, readiness.factors);

  if (input.channel === "sms") {
    const requiresConsent = controls?.sms_marketing_requires_consent ?? true;
    const purpose = input.smsPurpose ?? "marketing";
    factors.sms_purpose = purpose;
    factors.sms_consent = Boolean(input.smsConsent);
    if (requiresConsent && purpose === "marketing" && !input.smsConsent) {
      blockers.push("sms_marketing_consent_missing");
      score += 80;
    } else if (requiresConsent && !input.smsConsent && purpose !== "conversation") {
      warnings.push("SMS consent evidence was not attached to this send.");
      score += 20;
    }
  }

  if (input.businessLine === "political") {
    score += 12;
    if (!input.humanApproved) {
      warnings.push("Political outreach must stay human-approved.");
      score += 20;
    }
  }
  if (input.recipientSource === "purchased_list") {
    blockers.push("purchased_list_source_not_allowed");
    score += 75;
  }
  if ((input.recipientSource ?? "unknown") === "unknown") {
    warnings.push("Recipient source is unknown.");
    score += 8;
  }
  if (input.autonomous) {
    score += 15;
    if (!input.humanApproved) score += 12;
  }
  if (input.humanApproved && !input.autonomous) {
    score -= 10;
  }

  const personalizationScore = messagePersonalizationScore(input);
  factors.personalization_score = personalizationScore;
  if (personalizationScore <= 1) {
    warnings.push("Message needs more specific personalization before scaling.");
    score += 12;
  }
  if ((input.body.match(/https?:\/\//g) ?? []).length > 2) {
    warnings.push("Message includes more than two links.");
    score += 8;
  }
  if (/\bguarantee(d)?\b|\bfree money\b|\bact now\b|\bno risk\b/i.test(input.body)) {
    warnings.push("Message contains high-risk sales language.");
    score += 12;
  }

  const health = await loadSenderHealth({ db, senderEmail, channel: input.channel });
  const defaultSafeLimit = senderDefaultSafeLimit(input.channel, controls);
  let safeDailyLimit = defaultSafeLimit;
  if (input.channel === "email") {
    const domainCap = Math.max(1, safeNumber(controls?.max_domain_daily_email_cap, safeNumber(process.env.OUTREACH_DAILY_DOMAIN_EMAIL_CAP, 60)));
    safeDailyLimit = Math.min(defaultSafeLimit, domainCap);
  }
  if (health.sends7d < 10) safeDailyLimit = Math.min(safeDailyLimit, 5);
  if (health.bounceRate30d > 0.02) {
    warnings.push("Bounce rate is above 2%; hold or reduce volume.");
    score += 18;
    safeDailyLimit = Math.min(safeDailyLimit, 3);
  }
  if (health.bounceRate30d > 0.05) {
    blockers.push("bounce_rate_above_5_percent");
    score += 40;
    safeDailyLimit = 0;
  }
  if (health.complaintRate30d > 0.001) {
    blockers.push("complaint_rate_above_safe_threshold");
    score += 35;
    safeDailyLimit = 0;
  }
  if (health.unsubscribeRate30d > 0.02) {
    warnings.push("Unsubscribe/suppression rate is elevated.");
    score += 14;
  }
  if (health.failureRate30d > 0.05) {
    warnings.push("Provider failure rate is elevated.");
    score += 16;
  }
  if (health.sendsToday >= safeDailyLimit && safeDailyLimit > 0) {
    blockers.push("safe_daily_limit_reached");
    score += 35;
  }

  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const exactHashCount = messageHash
    ? await countFrom(db, "outreach_reputation_events", (query) =>
        query.eq("message_hash", messageHash).gte("created_at", since7d))
    : 0;
  const recipientHashCount = messageHash && recipient
    ? await countFrom(db, "outreach_reputation_events", (query) =>
        query
          .eq("message_hash", messageHash)
          .eq("recipient", recipient)
          .gte("created_at", since7d))
    : 0;
  factors.exact_template_reuse_7d = exactHashCount;
  factors.same_recipient_duplicate_7d = recipientHashCount;
  if (recipientHashCount > 0) {
    blockers.push("duplicate_message_to_recipient");
    score += 55;
  } else if (exactHashCount >= 3) {
    warnings.push("Repeated message pattern detected; rewrite before scaling.");
    score += 18;
  }

  factors.sender_health = health;
  factors.safe_daily_limit = safeDailyLimit;
  factors.controls = {
    auto_pause_enabled: controls?.deliverability_auto_pause_enabled ?? true,
    max_sender_risk_score: controls?.max_sender_risk_score ?? 69,
    weekly_ramp_max_percent: controls?.outreach_weekly_ramp_max_percent ?? 25,
  };

  const scoreLimit = safeNumber(controls?.max_sender_risk_score, 69);
  const finalScore = clampScore(score);
  const level = riskLevelFromScore(finalScore);
  let decision = decisionForScore({
    score: finalScore,
    channel: input.channel,
    humanApproved: Boolean(input.humanApproved),
    autonomous: Boolean(input.autonomous),
    blockers,
    warnings,
  });
  if (finalScore > scoreLimit && decision === "allow") decision = "approval_required";

  const blockHighRisk = envBool("OUTREACH_REPUTATION_BLOCK_HIGH_RISK", true);
  const allowed =
    enabled &&
    blockers.length === 0 &&
    (decision === "allow" || (decision === "approval_required" && Boolean(input.humanApproved) && !input.autonomous)) &&
    !(blockHighRisk && (level === "high" || level === "critical"));

  const recommendedAction = blockers.length
    ? `Blocked: ${blockers[0]}.`
    : decision === "allow"
      ? "Allow send; continue monitoring replies, bounces, opt-outs, and provider warnings."
      : decision === "rewrite_required"
        ? "Rewrite for uniqueness, personalization, and claim safety before approval."
        : decision === "approval_required"
          ? "Route to human approval before sending."
          : decision === "delay"
            ? "Delay send until volume window and sender health improve."
            : "Pause affected sender/channel and review health signals.";

  return {
    enabled,
    allowed: !enabled ? true : allowed,
    score: finalScore,
    level,
    decision,
    recommendedAction,
    safeDailyLimit,
    blockers,
    warnings,
    factors,
    messageHash,
    subjectHash,
    templateHash,
  };
}

export async function logReputationDecision(
  db: DbClient,
  input: ReputationInput,
  result: ReputationResult,
): Promise<void> {
  try {
    await db.from("outreach_reputation_events").insert({
      sender_email: normalizeEmail(input.senderEmail),
      sender_name: input.senderName ?? null,
      channel: input.channel,
      recipient: normalizeRecipient(input.channel, input.recipient),
      business_line: input.businessLine ?? "unknown",
      source_system: input.sourceSystem ?? null,
      source_id: isUuid(input.sourceId) ? input.sourceId : null,
      template_key: input.templateKey ?? null,
      template_hash: result.templateHash,
      message_hash: result.messageHash,
      subject_hash: result.subjectHash,
      risk_score: result.score,
      risk_level: result.level,
      recommended_action: result.recommendedAction,
      decision: result.decision,
      human_approved: Boolean(input.humanApproved),
      autonomous: Boolean(input.autonomous),
      factors: {
        ...result.factors,
        blockers: result.blockers,
        warnings: result.warnings,
      },
      metadata: input.metadata ?? {},
    });
  } catch (err) {
    console.warn("[reputation-control] decision log skipped:", err instanceof Error ? err.message : String(err));
  }
}

async function safeRows<T = Record<string, unknown>>(
  query: PromiseLike<{ data: T[] | null; error?: { message?: string } | null }>,
): Promise<T[]> {
  try {
    const { data } = await query;
    return data ?? [];
  } catch {
    return [];
  }
}

async function safeSingle<T = Record<string, unknown>>(
  query: PromiseLike<{ data: T | null; error?: { message?: string } | null }>,
): Promise<T | null> {
  try {
    const { data } = await query;
    return data ?? null;
  } catch {
    return null;
  }
}

function statusFromScore(score: number): SenderSummary["status"] {
  const level = riskLevelFromScore(score);
  if (level === "critical") return "blocked";
  if (level === "high") return "paused";
  if (level === "medium") return "needs_review";
  if (score > 20) return "watch";
  return "healthy";
}

function recommendationFromSummary(summary: Pick<SenderSummary, "riskScore" | "status" | "safeEmailLimit">): string {
  if (summary.status === "blocked" || summary.status === "paused") return "Pause outbound and review suppressions/provider events.";
  if (summary.status === "needs_review") return "Hold volume and require manual approval until health improves.";
  if (summary.status === "watch") return "Keep current volume; do not ramp until reply and bounce signals stay stable.";
  return `Safe to continue conservative sends up to ${summary.safeEmailLimit}/day if engagement remains healthy.`;
}

export async function buildDeliverabilityCommandCenterSnapshot(): Promise<DeliverabilityCommandCenterSnapshot> {
  const db = createServiceClient();
  const controls = await loadControls(db);
  const now = new Date();
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const identities = await safeRows<{
    from_email: string | null;
    from_name: string | null;
    email_daily_limit: number | null;
    sms_daily_limit: number | null;
    is_active: boolean | null;
  }>(
    db
      .from("agent_identities")
      .select("from_email,from_name,email_daily_limit,sms_daily_limit,is_active")
      .eq("is_active", true)
      .order("from_email", { ascending: true })
  );

  const recentRiskEvents = await safeRows(
    db
      .from("outreach_reputation_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50)
  );

  const suppressions = await safeRows(
    db
      .from("outreach_suppression_list")
      .select("*")
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(20)
  );

  const scalingRecommendations = await safeRows(
    db
      .from("outreach_scaling_recommendations")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20)
  );

  const sendsToday = await countFrom(db, "revenue_message_events", (query) =>
    query.eq("direction", "outbound").gte("created_at", toIso(startToday)));
  const sends7d = await countFrom(db, "revenue_message_events", (query) =>
    query.eq("direction", "outbound").gte("created_at", since7d));
  const replies7d = await countFrom(db, "revenue_message_events", (query) =>
    query.eq("direction", "inbound").gte("created_at", since7d));
  const bounces30d = await countFrom(db, "email_events", (query) =>
    query.or("event_type.ilike.%bounce%,event_type.ilike.%bounced%").gte("created_at", since30d));
  const complaints30d = await countFrom(db, "email_events", (query) =>
    query.or("event_type.ilike.%complaint%,event_type.ilike.%spam%").gte("created_at", since30d));
  const unsubscribes30d = await countFrom(db, "email_events", (query) =>
    query.or("event_type.ilike.%unsubscribe%,event_type.ilike.%suppression%").gte("created_at", since30d));
  const optOuts30d = await countFrom(db, "revenue_consent_events", (query) =>
    query.or("event_type.ilike.%opt_out%,consent_status.eq.opted_out").gte("created_at", since30d));
  const blockedRiskEvents7d = await countFrom(db, "outreach_reputation_events", (query) =>
    query.in("decision", ["block", "pause"]).gte("created_at", since7d));

  const senders: SenderSummary[] = [];
  for (const identity of identities) {
    const email = normalizeEmail(identity.from_email);
    if (!email) continue;
    const emailHealth = await loadSenderHealth({ db, senderEmail: email, channel: "email" });
    const smsHealth = await loadSenderHealth({ db, senderEmail: email, channel: "sms" });
    const providerPenalty =
      (controls?.email_domain_authentication_verified || envBool("EMAIL_DOMAIN_AUTHENTICATION_VERIFIED", false) ? 0 : 18) +
      (controls?.postmark_sender_signatures_verified || envBool("POSTMARK_SENDER_SIGNATURES_VERIFIED", false) ? 0 : 16);
    const riskScore = clampScore(
      providerPenalty +
      emailHealth.bounceRate30d * 1000 +
      emailHealth.complaintRate30d * 3000 +
      emailHealth.unsubscribeRate30d * 600 +
      emailHealth.failureRate30d * 600,
    );
    const status = statusFromScore(riskScore);
    const safeEmailLimit = Math.min(
      safeNumber(identity.email_daily_limit, safeNumber(controls?.daily_email_cap_per_sender, 5)),
      safeNumber(controls?.max_domain_daily_email_cap, safeNumber(process.env.OUTREACH_DAILY_DOMAIN_EMAIL_CAP, 60)),
    );
    const safeSmsLimit = Math.min(
      safeNumber(identity.sms_daily_limit, safeNumber(controls?.daily_sms_cap, 5)),
      controls?.twilio_a2p_approved || envBool("TWILIO_A2P_APPROVED", false) ? safeNumber(identity.sms_daily_limit, 5) : 0,
    );

    const summary: SenderSummary = {
      senderEmail: email,
      senderName: identity.from_name ?? email,
      emailSendsToday: emailHealth.sendsToday,
      smsSendsToday: smsHealth.sendsToday,
      emailSends7d: emailHealth.sends7d,
      smsSends7d: smsHealth.sends7d,
      replies7d: emailHealth.replies7d + smsHealth.replies7d,
      bounces30d: emailHealth.bounces30d,
      complaints30d: emailHealth.complaints30d,
      unsubscribes30d: emailHealth.unsubscribes30d,
      failures30d: emailHealth.failures30d + smsHealth.failures30d,
      riskScore,
      level: riskLevelFromScore(riskScore),
      status,
      safeEmailLimit,
      safeSmsLimit,
      recommendation: "Review sender health.",
    };
    summary.recommendation = recommendationFromSummary(summary);
    senders.push(summary);
  }

  const emailAuthVerified =
    Boolean(controls?.email_domain_authentication_verified) ||
    envBool("EMAIL_DOMAIN_AUTHENTICATION_VERIFIED", false);
  const postmarkSignaturesVerified =
    Boolean(controls?.postmark_sender_signatures_verified) ||
    envBool("POSTMARK_SENDER_SIGNATURES_VERIFIED", false);
  const twilioA2pApproved =
    Boolean(controls?.twilio_a2p_approved) ||
    envBool("TWILIO_A2P_APPROVED", false);

  const domainIssues = [
    !emailAuthVerified ? "SPF/DKIM/DMARC not marked verified." : null,
    !postmarkSignaturesVerified ? "Postmark sender signatures not marked verified." : null,
    controls?.domain_reputation_paused ? "Domain reputation pause is enabled." : null,
    controls?.email_paused ? "Email channel pause is enabled." : null,
  ].filter(Boolean) as string[];

  const smsIssues = [
    !twilioA2pApproved ? "Twilio A2P/10DLC not marked approved." : null,
    !controls?.sms_prospecting_live_enabled ? "Prospecting SMS live send is disabled." : null,
    controls?.sms_paused ? "SMS channel pause is enabled." : null,
  ].filter(Boolean) as string[];

  const worstSenderScore = Math.max(0, ...senders.map((sender) => sender.riskScore));
  const overallScore = clampScore(
    worstSenderScore +
    domainIssues.length * 12 +
    smsIssues.length * 10 +
    blockedRiskEvents7d * 4 +
    (controls?.all_paused ? 45 : 0),
  );
  const overallStatus = controls?.all_paused
    ? "paused"
    : statusFromScore(overallScore);

  return {
    generatedAt: now.toISOString(),
    controls,
    overall: {
      score: overallScore,
      status: overallStatus,
      recommendation:
        overallStatus === "healthy"
          ? "Conservative sending can continue with human approval and active monitoring."
          : "Resolve verification gaps, high-risk events, or pauses before increasing volume.",
    },
    domainHealth: {
      emailAuthVerified,
      postmarkSignaturesVerified,
      domainPaused: Boolean(controls?.domain_reputation_paused),
      status: controls?.domain_reputation_paused || controls?.email_paused
        ? "paused"
        : domainIssues.length ? "needs_review" : "healthy",
      issues: domainIssues,
    },
    smsHealth: {
      twilioA2pApproved,
      prospectingEnabled: Boolean(controls?.sms_prospecting_live_enabled),
      smsPaused: Boolean(controls?.sms_paused),
      status: controls?.sms_paused
        ? "paused"
        : smsIssues.length ? "needs_review" : "healthy",
      issues: smsIssues,
    },
    totals: {
      sendsToday,
      sends7d,
      replies7d,
      bounces30d,
      complaints30d,
      unsubscribes30d,
      optOuts30d,
      blockedRiskEvents7d,
    },
    senders,
    recentRiskEvents,
    suppressions,
    scalingRecommendations,
  };
}
