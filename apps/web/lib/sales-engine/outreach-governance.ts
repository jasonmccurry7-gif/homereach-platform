export type GovernedOutreachChannel = "sms" | "email" | "facebook" | "facebook_dm" | "dm" | "call";

export type OutreachApprovalStatus = "needs_review" | "approved" | "blocked" | "not_required";

export type OutreachLeadLike = {
  id?: string | null;
  business_name?: string | null;
  businessName?: string | null;
  contact_name?: string | null;
  contactName?: string | null;
  city?: string | null;
  category?: string | null;
  status?: string | null;
  pipeline_stage?: string | null;
  score?: number | string | null;
  buying_signal?: number | string | null;
  last_contacted_at?: string | null;
  last_reply_at?: string | null;
  next_follow_up_at?: string | null;
  phone?: string | null;
  email?: string | null;
  facebook_url?: string | null;
  sms_opt_out?: boolean | null;
  do_not_contact?: boolean | null;
  is_quarantined?: boolean | null;
  email_status?: string | null;
  total_replies?: number | string | null;
  total_messages_sent?: number | string | null;
};

export type OutreachSourceAttribution = {
  inputs_used: Record<string, unknown>;
  sources_referenced: string[];
  approval_status: OutreachApprovalStatus;
  next_action: string;
  related_entity: {
    type: string;
    id: string | null;
    label: string;
  };
  destination: {
    channel: GovernedOutreachChannel;
    address: string | null;
  };
  human_approval_required: boolean;
};

export type NextBestAction = {
  label: string;
  action: string;
  urgency: "critical" | "high" | "medium" | "low" | "blocked";
  priority_score: number;
  recommended_channel: GovernedOutreachChannel;
  rationale: string;
  safety_flags: string[];
};

export type DeliverabilityAudit = {
  status: "clear" | "review" | "blocked";
  flags: string[];
  notes: string[];
};

export type OutreachThrottleStatus = {
  channel: "sms" | "email" | "facebook";
  cap: number;
  sent_today: number;
  remaining_today: number;
  requested: number;
  allowed_now: number;
  throttled: boolean;
  approval_status: OutreachApprovalStatus;
  reason: string;
};

type ApprovalGateInput = {
  metadata?: unknown;
  channel: GovernedOutreachChannel;
  actionType: string;
  isAuthenticatedHuman?: boolean;
};

type AutomationGateInput = {
  testMode: boolean;
  manualApprovalMode: boolean;
  env?: NodeJS.ProcessEnv;
};

function textValue(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function boolValue(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return ["1", "true", "yes", "on", "approved"].includes(value.toLowerCase());
  return false;
}

function numberValue(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function dateAgeHours(value: string | null | undefined, now: Date): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return null;
  return Math.max(0, (now.getTime() - time) / 3_600_000);
}

function metadataObject(metadata: unknown): Record<string, unknown> {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? metadata as Record<string, unknown>
    : {};
}

export function getLeadId(lead: OutreachLeadLike): string | null {
  return textValue(lead.id, "") || null;
}

export function getBusinessName(lead: OutreachLeadLike): string {
  return textValue(lead.business_name, textValue(lead.businessName, "Unknown business"));
}

export function getContactName(lead: OutreachLeadLike): string | null {
  return textValue(lead.contact_name, textValue(lead.contactName, "")) || null;
}

export function firstNameFromLead(lead: OutreachLeadLike): string {
  return getContactName(lead)?.split(/\s+/)[0] || "there";
}

export function normalizeGovernedChannel(channel: string | null | undefined): GovernedOutreachChannel {
  const value = (channel ?? "").toLowerCase();
  if (value === "facebook" || value === "facebook_dm" || value === "dm") return value as GovernedOutreachChannel;
  if (value === "call") return "call";
  if (value === "email") return "email";
  return "sms";
}

export function buildOutreachSourceAttribution(input: {
  workflow: string;
  channel: GovernedOutreachChannel;
  lead: OutreachLeadLike;
  destination?: string | null;
  templateId?: string;
  action?: string;
  approvalStatus?: OutreachApprovalStatus;
  nextAction: string;
  sources?: string[];
  extraInputs?: Record<string, unknown>;
}): OutreachSourceAttribution {
  const leadId = getLeadId(input.lead);
  const businessName = getBusinessName(input.lead);

  return {
    inputs_used: {
      workflow: input.workflow,
      template_id: input.templateId ?? null,
      action: input.action ?? null,
      lead_id: leadId,
      business_name: businessName,
      contact_name: getContactName(input.lead),
      city: input.lead.city ?? null,
      category: input.lead.category ?? null,
      status: input.lead.status ?? null,
      pipeline_stage: input.lead.pipeline_stage ?? null,
      score: input.lead.score ?? null,
      buying_signal: input.lead.buying_signal ?? null,
      last_contacted_at: input.lead.last_contacted_at ?? null,
      last_reply_at: input.lead.last_reply_at ?? null,
      next_follow_up_at: input.lead.next_follow_up_at ?? null,
      ...input.extraInputs,
    },
    sources_referenced: Array.from(new Set([
      "AGENTS.md outreach approval rules",
      "AI Assets business context",
      "sales_leads",
      ...(input.sources ?? []),
    ])),
    approval_status: input.approvalStatus ?? "needs_review",
    next_action: input.nextAction,
    related_entity: {
      type: leadId ? "sales_lead" : "outreach_context",
      id: leadId,
      label: businessName,
    },
    destination: {
      channel: input.channel,
      address: input.destination ?? null,
    },
    human_approval_required: (input.approvalStatus ?? "needs_review") !== "not_required",
  };
}

export function scoreNextBestAction(
  lead: OutreachLeadLike,
  input: { channel?: GovernedOutreachChannel; now?: Date; defaultAction?: string } = {},
): NextBestAction {
  const now = input.now ?? new Date();
  const channel = input.channel ?? (lead.phone ? "sms" : lead.email ? "email" : lead.facebook_url ? "facebook_dm" : "call");
  const safetyFlags: string[] = [];
  const status = textValue(lead.status).toLowerCase();
  const pipeline = textValue(lead.pipeline_stage).toLowerCase();
  const score = numberValue(lead.score);
  const buyingSignal = numberValue(lead.buying_signal);
  const replyAgeHours = dateAgeHours(lead.last_reply_at, now);
  const contactAgeHours = dateAgeHours(lead.last_contacted_at, now);
  const followUpAgeHours = dateAgeHours(lead.next_follow_up_at, now);

  if (lead.do_not_contact) safetyFlags.push("do_not_contact");
  if (lead.is_quarantined) safetyFlags.push("quarantined");
  if (channel === "sms" && lead.sms_opt_out) safetyFlags.push("sms_opt_out");
  if (channel === "email" && ["bounced_permanent", "complained", "unsubscribed"].includes(textValue(lead.email_status).toLowerCase())) {
    safetyFlags.push("email_suppressed");
  }

  if (safetyFlags.length > 0) {
    return {
      label: "Review safety blocker",
      action: "Do not contact until the blocker is resolved.",
      urgency: "blocked",
      priority_score: 0,
      recommended_channel: channel,
      rationale: "The lead has a contact safety flag that prevents outbound use.",
      safety_flags: safetyFlags,
    };
  }

  if ((status === "replied" || pipeline === "replied") && replyAgeHours !== null) {
    const scoreBoost = replyAgeHours <= 2 ? 100 : replyAgeHours <= 24 ? 90 : 78;
    return {
      label: "Reply now",
      action: "Send a human-reviewed reply that answers the latest question and offers one clear next step.",
      urgency: replyAgeHours <= 2 ? "critical" : "high",
      priority_score: Math.min(100, scoreBoost + Math.round(score / 10)),
      recommended_channel: lead.phone ? "sms" : channel,
      rationale: "Inbound replies decay quickly; speed and relevance protect the opportunity.",
      safety_flags: safetyFlags,
    };
  }

  if (status === "payment_sent" || pipeline === "payment_sent") {
    return {
      label: "Confirm payment path",
      action: "Call or send a short approved note asking if anything blocked checkout.",
      urgency: "critical",
      priority_score: 92,
      recommended_channel: lead.phone ? "call" : "email",
      rationale: "Payment-link leads are closest to revenue and need human handling.",
      safety_flags: safetyFlags,
    };
  }

  if (followUpAgeHours !== null && followUpAgeHours >= 0) {
    return {
      label: "Send reviewed follow-up",
      action: "Use a short follow-up that asks whether to send details or close the loop.",
      urgency: followUpAgeHours > 24 ? "high" : "medium",
      priority_score: Math.min(88, 60 + Math.round(score / 3) + Math.round(buyingSignal / 2)),
      recommended_channel: channel,
      rationale: "The lead is due for a follow-up and should get one useful decision point, not pressure.",
      safety_flags: safetyFlags,
    };
  }

  if (contactAgeHours !== null && contactAgeHours >= 72 && status === "contacted") {
    return {
      label: "Recover stalled conversation",
      action: "Send a low-pressure review draft or call if the lead previously engaged.",
      urgency: "medium",
      priority_score: Math.min(80, 48 + Math.round(score / 2)),
      recommended_channel: lead.phone ? "sms" : channel,
      rationale: "The lead has gone quiet long enough to justify a simple recovery touch.",
      safety_flags: safetyFlags,
    };
  }

  return {
    label: input.defaultAction ?? "Prepare first-touch draft",
    action: "Create a deliverability-safe draft and keep it in needs_review until a human approves it.",
    urgency: score >= 70 || buyingSignal >= 70 ? "high" : "medium",
    priority_score: Math.min(78, 35 + Math.round(score / 2) + Math.round(buyingSignal / 3)),
    recommended_channel: channel,
    rationale: "Lead priority is based on CRM score, buying signal, channel availability, and current status.",
    safety_flags: safetyFlags,
  };
}

export function auditDeliverabilityCopy(body: string, channel: GovernedOutreachChannel): DeliverabilityAudit {
  const text = body.trim();
  const lower = text.toLowerCase();
  const flags: string[] = [];
  const notes: string[] = [];

  const riskyClaims = [
    /\bguaranteed?\s+(leads?|calls?|results?|roi|ranking|savings?)\b/i,
    /\bdouble(s|d)?\s+(close|conversion|response|revenue)\b/i,
    /\b#1\b|\bbest in\b|\bhighest ranked\b/i,
    /\bcompliance certified\b|\blegally guaranteed\b/i,
  ];

  if (riskyClaims.some((pattern) => pattern.test(text))) {
    flags.push("unsupported_claim");
    notes.push("Remove unsupported ROI, ranking, savings, legal, or delivery guarantees.");
  }

  if (/\{\{\s*(persona_|communication_persona|sender_)[a-zA-Z0-9_]*\s*\}\}/i.test(text)) {
    flags.push("unrendered_persona_token");
    notes.push("Resolve sender persona, communication policy, and sender variables before outbound use.");
  }

  if (/\b(one|1)\s+(exclusive\s+)?spot\b/i.test(text) || /\bfilling fast\b/i.test(text) || /\bgone\b/i.test(text)) {
    flags.push("scarcity_claim_review");
    notes.push("Scarcity language must be backed by current inventory before outbound use.");
  }

  if (channel === "sms") {
    if (text.length > 480) {
      flags.push("sms_too_long");
      notes.push("Keep prospecting SMS under 480 characters before compliance text.");
    }
    if (!/\bSTOP\b/i.test(text)) {
      notes.push("SMS must include STOP/HELP or receive compliance text before sending.");
    }
  }

  if (channel === "email") {
    if (!/[.!?]\s*$/.test(text)) notes.push("Email body should end cleanly before compliance footer.");
    if ((text.match(/https?:\/\//g) ?? []).length > 2) {
      flags.push("too_many_links");
      notes.push("Limit links to protect deliverability.");
    }
  }

  const blocked = flags.includes("unsupported_claim") || flags.includes("unrendered_persona_token");
  return {
    status: blocked ? "blocked" : flags.length > 0 ? "review" : "clear",
    flags,
    notes,
  };
}

export function buildOutreachThrottleStatus(input: {
  channel: "sms" | "email" | "facebook";
  cap: number;
  sentToday: number;
  requested: number;
}): OutreachThrottleStatus {
  const cap = Math.max(0, Math.floor(input.cap));
  const sentToday = Math.max(0, Math.floor(input.sentToday));
  const requested = Math.max(0, Math.floor(input.requested));
  const remaining = Math.max(0, cap - sentToday);
  const allowedNow = Math.min(remaining, requested);

  return {
    channel: input.channel,
    cap,
    sent_today: sentToday,
    remaining_today: remaining,
    requested,
    allowed_now: allowedNow,
    throttled: allowedNow < requested,
    approval_status: "needs_review",
    reason: allowedNow < requested
      ? "Daily cap limits the number of reviewable outbound actions."
      : "Within daily cap; human approval is still required before outbound use.",
  };
}

export function isAutonomousOutbound(metadata: unknown): boolean {
  const data = metadataObject(metadata);
  return boolValue(data.auto)
    || boolValue(data.automation)
    || boolValue(data.ai_generated)
    || boolValue(data.is_auto_generated)
    || textValue(data.source_system).includes("automation")
    || textValue(data.logged_from).includes("automation");
}

export function hasHumanApproval(metadata: unknown): boolean {
  const data = metadataObject(metadata);
  return boolValue(data.human_approved)
    || textValue(data.approval_status).toLowerCase() === "approved"
    || textValue(data.approvalStatus).toLowerCase() === "approved"
    || Boolean(textValue(data.approved_by))
    || Boolean(textValue(data.human_approved_by));
}

export function evaluateOutboundApprovalGate(input: ApprovalGateInput): {
  allowed: boolean;
  approval_status: OutreachApprovalStatus;
  reason: string;
  autonomous: boolean;
  human_approved: boolean;
} {
  const autonomous = isAutonomousOutbound(input.metadata);
  const humanApproved = hasHumanApproval(input.metadata);

  if (autonomous && !humanApproved) {
    return {
      allowed: false,
      approval_status: "needs_review",
      reason: "Autonomous or AI-generated outbound messages require human approval before sending.",
      autonomous,
      human_approved: false,
    };
  }

  return {
    allowed: true,
    approval_status: humanApproved || input.isAuthenticatedHuman ? "approved" : "needs_review",
    reason: humanApproved
      ? "Human approval metadata present."
      : input.isAuthenticatedHuman
        ? "Authenticated human send action treated as approval for this single message."
        : "No autonomous send detected, but review status should remain visible.",
    autonomous,
    human_approved: humanApproved || Boolean(input.isAuthenticatedHuman),
  };
}

export function evaluateAutomationLiveSendGate(input: AutomationGateInput): {
  allowed: boolean;
  approval_status: OutreachApprovalStatus;
  reason: string;
  required_env: string[];
  test_mode: boolean;
} {
  const env = input.env ?? process.env;
  const liveEnabled = boolValue(env.OUTREACH_AUTOMATION_LIVE_SEND_ENABLED);
  const humanApproved = boolValue(env.OUTREACH_AUTOMATION_HUMAN_APPROVED);
  const requiredEnv = [
    "OUTREACH_AUTOMATION_LIVE_SEND_ENABLED=true",
    "OUTREACH_AUTOMATION_HUMAN_APPROVED=true",
  ];

  if (input.manualApprovalMode) {
    return {
      allowed: false,
      approval_status: "needs_review",
      reason: "Manual approval mode is enabled; due automation must remain draft/review only.",
      required_env: requiredEnv,
      test_mode: input.testMode,
    };
  }

  if (!liveEnabled || !humanApproved) {
    return {
      allowed: false,
      approval_status: "needs_review",
      reason: "Automation live send is disabled until both explicit live-send and human-approved environment gates are true.",
      required_env: requiredEnv,
      test_mode: input.testMode,
    };
  }

  return {
    allowed: true,
    approval_status: "approved",
    reason: "Explicit automation live-send and human-approved gates are enabled.",
    required_env: requiredEnv,
    test_mode: input.testMode,
  };
}

export function buildAiOutputContent(input: {
  channel: GovernedOutreachChannel;
  subject?: string | null;
  body: string;
  shortVersion?: string | null;
  cta: string;
  complianceNotes: string[];
  sourceAttribution: OutreachSourceAttribution;
}): string {
  const lines = [
    `Channel: ${input.channel}`,
    input.subject ? `Subject: ${input.subject}` : null,
    "Draft copy:",
    input.body,
    input.shortVersion ? `Short version: ${input.shortVersion}` : null,
    `CTA: ${input.cta}`,
    `Compliance notes: ${input.complianceNotes.join("; ") || "Human approval required before outbound use."}`,
    `Inputs used: ${JSON.stringify(input.sourceAttribution.inputs_used)}`,
    `Sources referenced: ${input.sourceAttribution.sources_referenced.join(", ")}`,
    `Approval status: ${input.sourceAttribution.approval_status}`,
    `Next action: ${input.sourceAttribution.next_action}`,
    `Related entity: ${input.sourceAttribution.related_entity.type}:${input.sourceAttribution.related_entity.id ?? "none"}`,
    `Destination: ${input.sourceAttribution.destination.channel}:${input.sourceAttribution.destination.address ?? "not set"}`,
  ];

  return lines.filter(Boolean).join("\n");
}
