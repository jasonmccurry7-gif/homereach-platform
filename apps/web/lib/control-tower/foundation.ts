import "server-only";

import type { ApprovalLedgerStatus } from "@/lib/approvals/ledger-status";
import type { ApprovalSpineSummary } from "@/lib/approvals/types";
import { loadApprovalSpine } from "@/lib/approvals/spine";
import { createServiceClient } from "@/lib/supabase/service";
import { getEmailInfrastructureAudit } from "@/lib/email-infrastructure/verification";
import type { EmailInfrastructureAudit } from "@/lib/email-infrastructure/verification";

type GenericRow = Record<string, unknown>;
type QueryError = { message?: string; code?: string };

export type FoundationStatus = "online" | "watch" | "critical" | "idle";
export type FoundationSeverity = "info" | "low" | "medium" | "high" | "critical";

export type FoundationMetric = {
  label: string;
  value: string;
  detail: string;
  status: FoundationStatus;
  href?: string;
};

export type FoundationHealthItem = {
  name: string;
  status: FoundationStatus;
  detail: string;
  action: string;
  href?: string;
};

export type FoundationRisk = {
  area: string;
  severity: FoundationSeverity;
  finding: string;
  remediation: string;
  implemented?: string;
};

export type FoundationChecklistItem = {
  title: string;
  status: FoundationStatus;
  detail: string;
};

export type FoundationControlSnapshot = {
  allPaused: boolean;
  emailPaused: boolean;
  smsPaused: boolean;
  facebookPaused: boolean;
  testMode: boolean;
  manualApprovalMode: boolean;
  smsLive: boolean;
  dailyEmailCapPerSender: number;
  automationBatchLimit: number;
  timezone: string;
};

export type FoundationBrief = {
  generatedAt: string;
  title: string;
  summary: string;
  metrics: string[];
  risks: string[];
  priorities: string[];
};

export type FoundationFlag = {
  key: string;
  label: string;
  module: string;
  status: string;
  enabled: boolean;
  killSwitch: boolean;
  requiresApproval: boolean;
  safetyLevel: string;
  backingControl: string | null;
};

export type FoundationAuditEvent = {
  id: string;
  occurredAt: string;
  module: string;
  actionType: string;
  resultStatus: string;
  severity: string;
  message: string;
};

export type FoundationControlTowerData = {
  generatedAt: string;
  communicationAudit: EmailInfrastructureAudit;
  controls: FoundationControlSnapshot;
  systemHealth: FoundationHealthItem[];
  businessHealth: FoundationMetric[];
  agentHealth: FoundationMetric[];
  communicationHealth: FoundationMetric[];
  approvalQueue: FoundationMetric[];
  approvalSpineSummary: ApprovalSpineSummary;
  approvalLedgerStatus: ApprovalLedgerStatus;
  featureFlags: FoundationFlag[];
  auditEvents: FoundationAuditEvent[];
  securityFindings: FoundationRisk[];
  communicationFindings: FoundationRisk[];
  architectureAudit: FoundationChecklistItem[];
  preservedSystems: string[];
  newSystemsAdded: string[];
  databaseUpdates: string[];
  adminWorkflowsAdded: string[];
  aiApprovalStructure: string[];
  loggingStructure: string[];
  scalingBlockers: FoundationRisk[];
  nextImplementationOrder: string[];
  testingChecklist: string[];
  rollbackStrategy: string[];
  dailyBrief: FoundationBrief;
  sourceErrors: Record<string, string | undefined>;
};

async function queryMaybe<T>(
  label: string,
  run: () => PromiseLike<{ data: T | null; error: QueryError | null }>,
): Promise<{ data: T | null; error?: string }> {
  try {
    const result = await run();
    if (result.error) return { data: null, error: `${label}: ${result.error.message ?? result.error.code ?? "unknown error"}` };
    return { data: result.data };
  } catch (err) {
    return { data: null, error: `${label}: ${err instanceof Error ? err.message : "unknown error"}` };
  }
}

async function countMaybe(
  label: string,
  run: () => PromiseLike<{ count: number | null; error: QueryError | null }>,
): Promise<{ value: number; error?: string }> {
  try {
    const result = await run();
    if (result.error) return { value: 0, error: `${label}: ${result.error.message ?? result.error.code ?? "unknown error"}` };
    return { value: result.count ?? 0 };
  } catch (err) {
    return { value: 0, error: `${label}: ${err instanceof Error ? err.message : "unknown error"}` };
  }
}

function rows<T extends GenericRow>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function lower(value: unknown): string {
  return typeof value === "string" ? value.toLowerCase() : "";
}

function bool(value: unknown): boolean {
  return Boolean(value);
}

function number(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function hasEnv(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

function statusFromCritical(value: boolean): FoundationStatus {
  return value ? "critical" : "online";
}

function statusFromWarnings(warnings: number, critical: number): FoundationStatus {
  if (critical > 0) return "critical";
  if (warnings > 0) return "watch";
  return "online";
}

function metric(
  label: string,
  value: string,
  detail: string,
  status: FoundationStatus = "online",
  href?: string,
): FoundationMetric {
  return { label, value, detail, status, href };
}

function item(
  name: string,
  status: FoundationStatus,
  detail: string,
  action: string,
  href?: string,
): FoundationHealthItem {
  return { name, status, detail, action, href };
}

function countRowsWhere<T extends GenericRow>(items: T[], predicate: (row: T) => boolean) {
  return items.reduce((total, row) => total + (predicate(row) ? 1 : 0), 0);
}

function sourceErrors(entries: Array<{ key: string; error?: string }>) {
  return entries.reduce<Record<string, string | undefined>>((acc, entry) => {
    if (entry.error) acc[entry.key] = entry.error;
    return acc;
  }, {});
}

function controlValueForFlag(controls: FoundationControlSnapshot, column: unknown): boolean | null {
  switch (String(column ?? "")) {
    case "all_paused":
      return controls.allPaused;
    case "email_paused":
      return controls.emailPaused;
    case "sms_paused":
      return controls.smsPaused;
    case "facebook_paused":
      return controls.facebookPaused;
    case "manual_approval_mode":
      return controls.manualApprovalMode;
    case "sms_prospecting_live_enabled":
      return controls.smsLive;
    default:
      return null;
  }
}

function runtimeFlagStatus(row: GenericRow, controls: FoundationControlSnapshot): Pick<FoundationFlag, "enabled" | "status"> {
  if (row.backing_control_table === "system_controls") {
    const runtimeEnabled = controlValueForFlag(controls, row.backing_control_column);
    if (runtimeEnabled !== null) {
      return {
        enabled: runtimeEnabled,
        status: runtimeEnabled ? "active" : String(row.status ?? "monitor_only"),
      };
    }
  }

  return {
    enabled: bool(row.enabled),
    status: String(row.status ?? "future_ready"),
  };
}

function buildControlSnapshot(row: GenericRow | null | undefined): FoundationControlSnapshot {
  return {
    allPaused: bool(row?.all_paused),
    emailPaused: bool(row?.email_paused),
    smsPaused: bool(row?.sms_paused),
    facebookPaused: bool(row?.facebook_paused),
    testMode: bool(row?.outreach_test_mode),
    manualApprovalMode: bool(row?.manual_approval_mode),
    smsLive: bool(row?.sms_prospecting_live_enabled),
    dailyEmailCapPerSender: number(row?.daily_email_cap_per_sender, 30),
    automationBatchLimit: number(row?.automation_batch_limit, 10),
    timezone: typeof row?.default_time_zone === "string" ? row.default_time_zone : "America/New_York",
  };
}

function buildSystemHealth(input: {
  emailAudit: EmailInfrastructureAudit;
  controls: FoundationControlSnapshot;
  webhookFailures: number;
  automationFailures: number;
  approvalSpineSummary: ApprovalSpineSummary;
  approvalLedgerStatus: ApprovalLedgerStatus;
}): FoundationHealthItem[] {
  const env = input.emailAudit.environment;
  const postmarkCritical =
    !env.postmarkApiTokenConfigured ||
    input.emailAudit.postmarkCredentialProbe.status === "invalid" ||
    input.emailAudit.postmarkCredentialProbe.status === "missing";
  const postmarkWarnings =
    Number(!input.emailAudit.dns.spf.includesPostmark) +
    Number(!input.emailAudit.dns.dkimLikelyConfigured) +
    Number(!input.emailAudit.dns.returnPath.pointsToPostmark) +
    Number(input.emailAudit.postmarkSenderSignatures.status === "partial" || input.emailAudit.postmarkSenderSignatures.status === "error") +
    Number(env.postmarkWebhookEnabled && !env.postmarkWebhookAuthConfigured);

  const twilioConfigured = env.twilioConfigured;
  const stripeReady = hasEnv("STRIPE_SECRET_KEY") && hasEnv("STRIPE_WEBHOOK_SECRET");
  const supabaseReady = hasEnv("NEXT_PUBLIC_SUPABASE_URL") && hasEnv("SUPABASE_SERVICE_ROLE_KEY");
  const vercelReady = hasEnv("VERCEL_URL") || hasEnv("NEXT_PUBLIC_APP_URL") || process.env.NODE_ENV !== "production";

  return [
    item(
      "Postmark",
      statusFromWarnings(postmarkWarnings, postmarkCritical ? 1 : 0),
      postmarkCritical
        ? input.emailAudit.postmarkCredentialProbe.message
        : `${env.emailProvider} runtime, webhook ${env.postmarkWebhookEnabled ? "enabled" : "disabled"}.`,
      "Complete Postmark credential, SPF, DKIM, sender signature, and webhook checks before scaling.",
      "/admin/email-infrastructure",
    ),
    item(
      "Twilio",
      input.controls.smsLive && !twilioConfigured ? "critical" : twilioConfigured ? "watch" : "idle",
      twilioConfigured ? "Twilio environment values exist; A2P/live sending still needs final verification." : "Twilio is pending; SMS remains email-first/future-ready.",
      "Keep sms_prospecting_live_enabled off until A2P, inbound webhook, and status callbacks are verified.",
    ),
    item(
      "Stripe",
      stripeReady ? "online" : "watch",
      stripeReady ? "Secret key and webhook secret are configured in this runtime." : "Stripe env is not fully visible in this runtime.",
      "Preserve existing checkout and webhook flows; do not alter payment mutation paths during hardening.",
    ),
    item(
      "Supabase",
      supabaseReady ? "online" : "critical",
      supabaseReady ? "Server-side Supabase service access is available." : "Supabase URL or service role key is missing.",
      "Keep service-role usage server-only and keep RLS policies enabled on exposed tables.",
    ),
    item(
      "Vercel deployment",
      vercelReady ? "online" : "watch",
      vercelReady ? "Runtime has deployment/app URL context." : "Deployment URL context is not visible locally.",
      "Wire the daily brief route to Vercel Cron after production env is confirmed.",
    ),
    item(
      "Webhook health",
      input.webhookFailures > 0 ? "watch" : "online",
      `${input.webhookFailures} recent failed webhook or provider event record${input.webhookFailures === 1 ? "" : "s"}.`,
      "Review Postmark/Twilio provider event rows and keep webhook auth/signature validation active.",
      "/admin/email-infrastructure",
    ),
    item(
      "Automation health",
      input.controls.allPaused ? "idle" : input.automationFailures > 0 ? "watch" : "online",
      input.controls.allPaused
        ? "Global pause is on."
        : `${input.automationFailures} recent automation failure${input.automationFailures === 1 ? "" : "s"}.`,
      "Keep manual approval and batch limits in place while validating send automation.",
      "/admin/control-center",
    ),
    item(
      "Executive review queue",
      input.approvalSpineSummary.blocked > 0 ? "critical" : input.approvalSpineSummary.total > 0 ? "watch" : "online",
      `${input.approvalSpineSummary.total} review item${input.approvalSpineSummary.total === 1 ? "" : "s"}: ${input.approvalSpineSummary.needsApproval} need approval, ${input.approvalSpineSummary.readyToSend + input.approvalSpineSummary.readyToPublish} ready for release, ${input.approvalSpineSummary.blocked} blocked.`,
      "Use the unified executive review queue to clear blockers and keep cross-system approvals in one place.",
      "/admin/content-review",
    ),
    item(
      "Canonical approval ledger",
      !input.approvalLedgerStatus.available
        ? "watch"
        : input.approvalLedgerStatus.missingRows > 0
          ? "watch"
          : "online",
      !input.approvalLedgerStatus.available
        ? "Ledger migration is not visible in this environment."
        : `${input.approvalLedgerStatus.mirroredRows} mirrored, ${input.approvalLedgerStatus.missingRows} missing from the projected executive queue.`,
      "Keep using the executive review queue for operations, and run the ledger sync after the migration is applied.",
      "/admin/content-review",
    ),
  ];
}

function buildRisks(input: {
  emailAudit: EmailInfrastructureAudit;
  controls: FoundationControlSnapshot;
  webhookRoutesHardened: boolean;
}): FoundationRisk[] {
  const risks: FoundationRisk[] = [];
  const env = input.emailAudit.environment;

  if (env.emailProvider !== "postmark") {
    risks.push({
      area: "Communications",
      severity: "high",
      finding: `Active EMAIL_PROVIDER is ${env.emailProvider}, while Postmark is the intended production sender.`,
      remediation: "Set EMAIL_PROVIDER=postmark and POSTMARK_API_TOKEN in the deployment runtime before live outreach.",
      implemented: "Email Infrastructure panel now blocks/labels verification based on actual runtime provider.",
    });
  }

  if (!env.postmarkApiTokenConfigured) {
    risks.push({
      area: "Communications",
      severity: "critical",
      finding: "POSTMARK_API_TOKEN is not available in this runtime.",
      remediation: "Add the Postmark server token to Vercel/local env, then rerun one-recipient verification sends.",
      implemented: "Verification sends are safe-blocked when the token is missing.",
    });
  }

  if (!input.emailAudit.dns.spf.includesPostmark) {
    risks.push({
      area: "Deliverability",
      severity: "high",
      finding: "SPF does not visibly include Postmark.",
      remediation: "Add the Postmark SPF include required for the verified server/domain before scaling.",
    });
  }

  if (!input.emailAudit.dns.dkimLikelyConfigured) {
    risks.push({
      area: "Deliverability",
      severity: "high",
      finding: "Common Postmark DKIM selectors were not found by DNS lookup.",
      remediation: "Confirm Postmark DKIM records in DNS and in the Postmark console.",
    });
  }

  if (!input.emailAudit.dns.returnPath.pointsToPostmark) {
    risks.push({
      area: "Deliverability",
      severity: "medium",
      finding: "Postmark Return-Path CNAME is missing or not pointed to Postmark.",
      remediation: "Configure the Return-Path CNAME shown in Postmark and remove conflicting TXT records at the same host.",
    });
  }

  if (input.emailAudit.postmarkSenderSignatures.status === "partial" || input.emailAudit.postmarkSenderSignatures.status === "error") {
    risks.push({
      area: "Sender identity",
      severity: "high",
      finding: input.emailAudit.postmarkSenderSignatures.message,
      remediation: "Confirm all four HomeReach sender signatures in Postmark before scaling outbound sends.",
    });
  }

  if (env.postmarkWebhookEnabled && !env.postmarkWebhookAuthConfigured) {
    risks.push({
      area: "Webhook security",
      severity: "high",
      finding: "Postmark webhook is enabled without Basic Auth env values.",
      remediation: "Set POSTMARK_WEBHOOK_USER and POSTMARK_WEBHOOK_PASSWORD before production webhook use.",
    });
  }

  if (!input.controls.manualApprovalMode) {
    risks.push({
      area: "AI approvals",
      severity: "high",
      finding: "Manual approval mode is not enabled in system_controls.",
      remediation: "Turn on manual approval mode before any campaign-scale email, SMS, political, government, or paid-media action.",
    });
  }

  if (input.controls.smsLive && !env.twilioConfigured) {
    risks.push({
      area: "SMS",
      severity: "critical",
      finding: "SMS live sending is enabled while Twilio is not fully configured in this runtime.",
      remediation: "Disable sms_prospecting_live_enabled until Twilio/A2P and callbacks are verified.",
    });
  }

  if (process.env.NODE_ENV === "production" && process.env.ADMIN_DEV_BYPASS === "true") {
    risks.push({
      area: "Route protection",
      severity: "critical",
      finding: "ADMIN_DEV_BYPASS is true in production.",
      remediation: "Set ADMIN_DEV_BYPASS=false and redeploy immediately.",
    });
  }

  risks.push({
    area: "Database hardening",
    severity: "medium",
    finding: "Existing public SECURITY DEFINER functions and conventional views should receive a follow-up search_path/security_invoker review.",
    remediation: "Move privileged functions to a private schema or set explicit search_path; set security_invoker=true for read views where appropriate.",
  });

  if (input.webhookRoutesHardened) {
    risks.push({
      area: "Webhook observability",
      severity: "low",
      finding: "Postmark and Twilio status webhooks previously depended on session clients for append-only logs.",
      remediation: "Keep provider auth/signature validation in front, and use service-role writes only inside webhook handlers.",
      implemented: "This pass switches those webhook logs to server-only service-role writes.",
    });
  }

  return risks;
}

function buildCommunicationFindings(emailAudit: EmailInfrastructureAudit, controls: FoundationControlSnapshot): FoundationRisk[] {
  return [
    {
      area: "Sender identities",
      severity: emailAudit.senderIdentities.every((sender) => sender.databaseIdentity.exists && sender.databaseIdentity.active) ? "low" : "high",
      finding: `${emailAudit.senderIdentities.filter((sender) => sender.databaseIdentity.exists && sender.databaseIdentity.active).length}/${emailAudit.senderIdentities.length} HomeReach sender identities are active in the database.`,
      remediation: "Confirm each identity in Postmark sender signatures before marking production outreach ready.",
    },
    {
      area: "Email-first mode",
      severity: controls.smsLive ? "medium" : "low",
      finding: emailAudit.emailFirstAutomation.status,
      remediation: "Use email-only, low-volume, approval-gated automation until Twilio is fully operational.",
      implemented: "system_controls already holds email/SMS/Facebook pauses, test mode, manual approval, and conservative caps.",
    },
    {
      area: "Suppression monitoring",
      severity: emailAudit.suppression.recentTerminalEvents.length > 0 ? "high" : "low",
      finding: emailAudit.suppression.status,
      remediation: "Review terminal events before retrying any sender or destination.",
    },
    {
      area: "Provider webhooks",
      severity: emailAudit.webhook.enabled && emailAudit.webhook.authConfigured ? "low" : "medium",
      finding: `Postmark webhook route is ${emailAudit.webhook.enabled ? "enabled" : "disabled"} and auth is ${emailAudit.webhook.authConfigured ? "configured" : "not configured"}.`,
      remediation: "Enable and protect webhooks before relying on delivery/open/click/bounce dashboards.",
    },
  ];
}

function buildBrief(input: {
  sent24h: number;
  inbound24h: number;
  pendingApprovals: number;
  unreadThreads: number;
  failedComms: number;
  activeCampaigns: number;
  procurementOps: number;
  politicalOps: number;
  risks: FoundationRisk[];
}): FoundationBrief {
  const criticalRisks = input.risks.filter((risk) => risk.severity === "critical").length;
  const highRisks = input.risks.filter((risk) => risk.severity === "high").length;
  const topRisks = input.risks
    .filter((risk) => risk.severity === "critical" || risk.severity === "high")
    .slice(0, 5)
    .map((risk) => `${risk.area}: ${risk.finding}`);

  const priorities = [
    input.pendingApprovals > 0 ? `Review ${input.pendingApprovals} pending approval item${input.pendingApprovals === 1 ? "" : "s"}.` : "Keep approval queue clear.",
    input.failedComms > 0 ? `Investigate ${input.failedComms} failed or terminal communication event${input.failedComms === 1 ? "" : "s"}.` : "Maintain deliverability monitoring.",
    criticalRisks > 0 || highRisks > 0 ? "Resolve critical/high communication and security blockers before scale." : "Continue low-volume verification and dashboard QA.",
    "Do not enable SMS or high-volume outreach until Twilio, sender health, and approval gates are verified.",
  ];

  return {
    generatedAt: new Date().toISOString(),
    title: "HomeReach Daily Executive Brief",
    summary:
      `${input.sent24h} outbound, ${input.inbound24h} inbound, ${input.pendingApprovals} approvals, ` +
      `${input.unreadThreads} unread threads, ${input.failedComms} failed/terminal comm events, ` +
      `${input.activeCampaigns} active campaign records, ${input.procurementOps} procurement items, ` +
      `${input.politicalOps} political opportunities.`,
    metrics: [
      `Outbound sent in 24h: ${input.sent24h}`,
      `Inbound/replies in 24h: ${input.inbound24h}`,
      `Pending approvals: ${input.pendingApprovals}`,
      `Unread message threads: ${input.unreadThreads}`,
      `Failed communication events: ${input.failedComms}`,
      `Active campaigns: ${input.activeCampaigns}`,
    ],
    risks: topRisks.length ? topRisks : ["No critical/high risk found in the current snapshot."],
    priorities,
  };
}

export function buildDailyBriefMarkdown(data: FoundationControlTowerData): string {
  return [
    `# ${data.dailyBrief.title}`,
    ``,
    `Generated: ${data.dailyBrief.generatedAt}`,
    ``,
    `## Summary`,
    data.dailyBrief.summary,
    ``,
    `## Metrics`,
    ...data.dailyBrief.metrics.map((entry) => `- ${entry}`),
    ``,
    `## Risks`,
    ...data.dailyBrief.risks.map((entry) => `- ${entry}`),
    ``,
    `## Priorities For Tomorrow`,
    ...data.dailyBrief.priorities.map((entry) => `- ${entry}`),
  ].join("\n");
}

export async function loadFoundationControlTower(): Promise<FoundationControlTowerData> {
  const db = createServiceClient();
  const now = new Date();
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    emailAudit,
    approvalSpine,
    controlsResult,
    threadsResult,
    approvalsResult,
    suggestionsResult,
    revenueEventsResult,
    emailEventsResult,
    twilioEventsResult,
    senderHealthResult,
    autoSendResult,
    auditResult,
    flagsResult,
    salesLeadsToday,
    waitlistToday,
    intakeOpen,
    marketingActive,
    targetedActive,
    politicalActive,
    procurementActions,
  ] = await Promise.all([
    getEmailInfrastructureAudit(),
    loadApprovalSpine(),
    queryMaybe<GenericRow>("system_controls", () =>
      db.from("system_controls").select("*").eq("id", 1).maybeSingle(),
    ),
    queryMaybe<GenericRow[]>("revenue_message_threads", () =>
      db
        .from("revenue_message_threads")
        .select("id,business_line,channel,status,unread_count,automation_paused,latest_direction,latest_message_at")
        .order("latest_message_at", { ascending: false, nullsFirst: false })
        .limit(120),
    ),
    queryMaybe<GenericRow[]>("revenue_message_approval_queue", () =>
      db
        .from("revenue_message_approval_queue")
        .select("id,business_line,channel,status,title,created_at,due_at")
        .in("status", ["draft", "needs_review", "approved", "scheduled"])
        .order("created_at", { ascending: false })
        .limit(120),
    ),
    queryMaybe<GenericRow[]>("revenue_ai_suggestions", () =>
      db
        .from("revenue_ai_suggestions")
        .select("id,business_line,status,suggestion_type,confidence,created_at")
        .in("status", ["draft", "needs_review", "approved"])
        .order("created_at", { ascending: false })
        .limit(120),
    ),
    queryMaybe<GenericRow[]>("revenue_message_events", () =>
      db
        .from("revenue_message_events")
        .select("id,business_line,channel,direction,provider,processing_status,event_type,created_at")
        .gte("created_at", since7d)
        .order("created_at", { ascending: false })
        .limit(250),
    ),
    queryMaybe<GenericRow[]>("email_events", () =>
      db
        .from("email_events")
        .select("provider,event_type,message_id,recipient,bounce_type,error_message,received_at")
        .gte("received_at", since7d)
        .order("received_at", { ascending: false })
        .limit(250),
    ),
    queryMaybe<GenericRow[]>("twilio_message_status", () =>
      db
        .from("twilio_message_status")
        .select("message_sid,message_status,error_code,error_message,received_at")
        .gte("received_at", since7d)
        .order("received_at", { ascending: false })
        .limit(250),
    ),
    queryMaybe<GenericRow[]>("v_sender_health", () =>
      db.from("v_sender_health" as never).select("*").limit(100),
    ),
    queryMaybe<GenericRow[]>("auto_send_log", () =>
      db
        .from("auto_send_log")
        .select("id,channel,status,error,sent_at,created_at")
        .gte("created_at", since7d)
        .order("created_at", { ascending: false })
        .limit(250),
    ),
    queryMaybe<GenericRow[]>("platform_audit_events", () =>
      db
        .from("platform_audit_events")
        .select("id,occurred_at,module,action_type,result_status,severity,message")
        .order("occurred_at", { ascending: false })
        .limit(80),
    ),
    queryMaybe<GenericRow[]>("platform_feature_flags", () =>
      db
        .from("platform_feature_flags")
        .select("flag_key,label,module,status,enabled,kill_switch,requires_approval,safety_level,backing_control_table,backing_control_column")
        .order("module", { ascending: true })
        .limit(80),
    ),
    countMaybe("sales_leads_today", () =>
      db.from("sales_leads").select("id", { count: "exact", head: true }).gte("created_at", since24h),
    ),
    countMaybe("waitlist_today", () =>
      db.from("waitlist_entries").select("id", { count: "exact", head: true }).gte("created_at", since24h),
    ),
    countMaybe("intake_open", () =>
      db.from("intake_submissions").select("id", { count: "exact", head: true }).in("status", ["submitted", "new", "open"]),
    ),
    countMaybe("marketing_active", () =>
      db.from("marketing_campaigns").select("id", { count: "exact", head: true }).in("status", ["active", "upcoming"]),
    ),
    countMaybe("targeted_active", () =>
      db.from("targeted_route_campaigns").select("id", { count: "exact", head: true }).in("status", ["paid", "design_queued", "design_in_progress", "design_ready", "approved", "mailed"]),
    ),
    countMaybe("political_active", () =>
      db.from("political_campaigns").select("id", { count: "exact", head: true }).in("pipeline_status", ["prospect", "contacted", "proposal_sent"]),
    ),
    countMaybe("procurement_actions", () =>
      db.from("opcopilot_action_requests").select("id", { count: "exact", head: true }).in("status", ["draft", "pending", "needs_approval"]),
    ),
  ]);

  const controls = buildControlSnapshot(controlsResult.data);
  const approvalSpineSummary = approvalSpine.summary;
  const approvalLedgerStatus = approvalSpine.ledgerStatus;
  const threads = rows(threadsResult.data);
  const approvals = rows(approvalsResult.data);
  const suggestions = rows(suggestionsResult.data);
  const revenueEvents = rows(revenueEventsResult.data);
  const emailEvents = rows(emailEventsResult.data);
  const twilioEvents = rows(twilioEventsResult.data);
  const senderHealth = rows(senderHealthResult.data);
  const autoSendLog = rows(autoSendResult.data);

  const sent24h = countRowsWhere(revenueEvents, (row) =>
    lower(row.direction) === "outbound" && String(row.created_at ?? "") >= since24h,
  );
  const inbound24h = countRowsWhere(revenueEvents, (row) =>
    lower(row.direction) === "inbound" && String(row.created_at ?? "") >= since24h,
  );
  const unreadThreads = threads.reduce((total, row) => total + number(row.unread_count, 0), 0);
  const pendingApprovals = approvalSpineSummary.needsApproval;
  const readyForRelease = approvalSpineSummary.readyToSend + approvalSpineSummary.readyToPublish;
  const politicalHandoffs = countRowsWhere(threads, (row) =>
    lower(row.business_line) === "political" && (bool(row.automation_paused) || number(row.unread_count, 0) > 0),
  );
  const emailTerminalEvents = countRowsWhere(emailEvents, (row) =>
    ["bounce", "spam_complaint", "subscription_change", "unsubscribe"].includes(lower(row.event_type)),
  );
  const twilioFailures = countRowsWhere(twilioEvents, (row) =>
    ["failed", "undelivered"].includes(lower(row.message_status)),
  );
  const automationFailures = countRowsWhere(autoSendLog, (row) => lower(row.status) === "failed");
  const failedComms =
    emailTerminalEvents +
    twilioFailures +
    automationFailures +
    countRowsWhere(revenueEvents, (row) => lower(row.processing_status) === "failed");
  const webhookFailures = emailTerminalEvents + twilioFailures;
  const activeCampaigns = marketingActive.value + targetedActive.value + politicalActive.value;
  const leadQueue = salesLeadsToday.value + waitlistToday.value + intakeOpen.value;

  const securityFindings = buildRisks({
    emailAudit,
    controls,
    webhookRoutesHardened: true,
  });
  const communicationFindings = buildCommunicationFindings(emailAudit, controls);

  const data: FoundationControlTowerData = {
    generatedAt: now.toISOString(),
    communicationAudit: emailAudit,
    controls,
    systemHealth: buildSystemHealth({
      emailAudit,
      controls,
      webhookFailures,
      automationFailures,
      approvalSpineSummary,
      approvalLedgerStatus,
    }),
    businessHealth: [
      metric("Leads and intake", String(leadQueue), `${salesLeadsToday.value} sales leads, ${waitlistToday.value} waitlist, ${intakeOpen.value} open intake.`, leadQueue > 0 ? "watch" : "online", "/admin/crm"),
      metric("Active campaigns", String(activeCampaigns), `${marketingActive.value} shared, ${targetedActive.value} targeted, ${politicalActive.value} political.`, activeCampaigns > 0 ? "online" : "idle", "/admin"),
      metric("Pending approvals", String(pendingApprovals), "Cross-system items that still require human approval before execution.", pendingApprovals > 0 ? "watch" : "online", "/admin/content-review"),
      metric("Unread replies", String(unreadThreads), `${politicalHandoffs} political handoff thread${politicalHandoffs === 1 ? "" : "s"}.`, unreadThreads > 0 ? "watch" : "online", "/admin/inbox"),
      metric("Procurement actions", String(procurementActions.value), "Operations Copilot requests needing review or approval.", procurementActions.value > 0 ? "watch" : "online", "/admin/procurement"),
      metric("Failed communications", String(failedComms), "Email terminal events, Twilio failures, automation failures, and failed message events.", failedComms > 0 ? "critical" : "online", "/admin/email-infrastructure"),
    ],
    agentHealth: [
      metric("Sender identities", String(emailAudit.senderIdentities.length), `${emailAudit.senderIdentities.filter((sender) => sender.databaseIdentity.active).length} active database identities.`, "online", "/admin/email-infrastructure"),
      metric("Healthy senders", String(countRowsWhere(senderHealth, (row) => lower(row.health_status) === "healthy")), "Sender health rows from v_sender_health.", countRowsWhere(senderHealth, (row) => lower(row.health_status) !== "healthy") > 0 ? "watch" : "online", "/admin/email-infrastructure"),
      metric("AI suggestions", String(suggestions.length), "Drafts/recommendations waiting in revenue_message AI suggestions.", suggestions.length > 0 ? "watch" : "online", "/admin/revenue-operations"),
      metric("Manual approvals", controls.manualApprovalMode ? "On" : "Off", "System-wide manual approval gate for outbound automation.", controls.manualApprovalMode ? "online" : "critical", "/admin/control-center"),
    ],
    communicationHealth: [
      metric("Outbound 24h", String(sent24h), "Revenue messaging outbound events in the last 24 hours.", sent24h > 0 ? "online" : "idle", "/admin/revenue-operations"),
      metric("Inbound 24h", String(inbound24h), "Revenue messaging inbound events in the last 24 hours.", inbound24h > 0 ? "watch" : "idle", "/admin/inbox"),
      metric("Email terminal events", String(emailTerminalEvents), "Bounces, complaints, unsubscribes, and suppression-type records in seven days.", emailTerminalEvents > 0 ? "critical" : "online", "/admin/email-infrastructure"),
      metric("Twilio failures", String(twilioFailures), "Failed or undelivered Twilio status events in seven days.", twilioFailures > 0 ? "critical" : controls.smsLive ? "watch" : "idle", "/admin/revenue-operations"),
      metric("Automation failures", String(automationFailures), "auto_send_log failures in seven days.", automationFailures > 0 ? "watch" : "online", "/admin/control-center"),
      metric("Email-first mode", emailAudit.emailFirstAutomation.mode.replace(/_/g, " "), emailAudit.emailFirstAutomation.status, controls.smsLive ? "watch" : "online", "/admin/email-infrastructure"),
    ],
    approvalQueue: [
      metric("Unified review queue", String(approvalSpineSummary.total), "Executive queue spanning revenue, political, procurement, creative, daily content, and Gov Contracts.", approvalSpineSummary.blocked > 0 ? "critical" : approvalSpineSummary.total > 0 ? "watch" : "online", "/admin/content-review"),
      metric("Needs approval", String(approvalSpineSummary.needsApproval), "Items still waiting on human approval before send, publish, submit, or spend-sensitive action.", approvalSpineSummary.needsApproval > 0 ? "watch" : "online", "/admin/content-review"),
      metric("Ready for release", String(readyForRelease), "Approved items ready for manual send or publish steps after owner timing and provider checks.", readyForRelease > 0 ? "watch" : "online", "/admin/content-review"),
    ],
    approvalSpineSummary,
    approvalLedgerStatus,
    featureFlags: rows(flagsResult.data).map((row) => {
      const runtime = runtimeFlagStatus(row, controls);
      return {
        key: String(row.flag_key ?? ""),
        label: String(row.label ?? row.flag_key ?? "Unknown flag"),
        module: String(row.module ?? "unknown"),
        status: runtime.status,
        enabled: runtime.enabled,
        killSwitch: bool(row.kill_switch),
        requiresApproval: bool(row.requires_approval),
        safetyLevel: String(row.safety_level ?? "medium"),
        backingControl: row.backing_control_table && row.backing_control_column
          ? `${row.backing_control_table}.${row.backing_control_column}`
          : null,
      };
    }),
    auditEvents: rows(auditResult.data).map((row) => ({
      id: String(row.id ?? ""),
      occurredAt: String(row.occurred_at ?? ""),
      module: String(row.module ?? "unknown"),
      actionType: String(row.action_type ?? "unknown"),
      resultStatus: String(row.result_status ?? "unknown"),
      severity: String(row.severity ?? "info"),
      message: String(row.message ?? ""),
    })),
    securityFindings,
    communicationFindings,
    architectureAudit: [
      { title: "Public/client complexity preserved but kept out of this pass", status: "online", detail: "No customer-facing rebuild or simplification occurred in this hardening phase." },
      { title: "Control Tower overlays existing admin systems", status: "online", detail: "Existing /admin, /admin/revenue-operations, /admin/inbox, /admin/email-infrastructure, and /admin/control-center remain intact." },
      { title: "Executive review queue is shared across surfaces", status: "online", detail: "Control Tower and /admin/content-review now use the same approval spine instead of separate queue logic." },
      { title: "Canonical messaging layer reused", status: "online", detail: "revenue_message_threads/events/suggestions/approval_queue are the unified communications backbone." },
      { title: "Feature flags are registry-first", status: "watch", detail: "platform_feature_flags records safety intent while system_controls remains authoritative for active send pauses." },
      { title: "Daily brief foundation added", status: "watch", detail: "A cron-safe brief route can generate/upsert daily executive summaries; Vercel Cron wiring remains an integration step." },
    ],
    preservedSystems: [
      "Shared postcard, targeted campaign, political, procurement, Stripe, Supabase auth, CRM, intake, maps, proposals, outreach, and admin pages were not rebuilt.",
      "Existing system_controls remains the authoritative global/channel pause and approval gate.",
      "Existing revenue_message_* tables remain the unified communications, inbox, AI suggestion, and approval foundation.",
      "Existing email_events, twilio_message_status, auto_send_log, sales_events, and political audit tables remain source logs.",
    ],
    newSystemsAdded: [
      "platform_audit_events universal audit surface.",
      "platform_feature_flags safety-control registry mapped to existing controls where appropriate.",
      "platform_daily_briefs executive brief store.",
      "Foundation Control Tower dashboard section inside /admin/control-center.",
      "Admin/cron API route for daily brief generation.",
    ],
    databaseUpdates: [
      "096_foundation_control_tower.sql creates platform_audit_events with RLS and admin/service policies.",
      "096_foundation_control_tower.sql creates platform_feature_flags with RLS and seed safety flags.",
      "096_foundation_control_tower.sql creates platform_daily_briefs with RLS for daily executive summaries.",
    ],
    adminWorkflowsAdded: [
      "Control Tower overview for system, business, agent, and communications health.",
      "Unified risk list with security, deliverability, and scaling blockers.",
      "Feature flag/safety registry readout.",
      "Latest universal audit event viewer.",
      "Daily executive brief preview and generation endpoint.",
    ],
    aiApprovalStructure: [
      "The executive review spine aggregates approval-sensitive work across revenue, political, procurement, creative, daily content, and Gov Contracts.",
      "approval_ledger is now the canonical shared ledger model, but existing domain approval tables still own execution until workflows are migrated.",
      "AI drafts and recommendations still flow through revenue_ai_suggestions and revenue_message_approval_queue.",
      "Manual approval mode in system_controls blocks due automation processing.",
      "Political handoffs remain owner/manual-review first.",
      "High-risk actions stay flagged as paused/future-ready in platform_feature_flags.",
    ],
    loggingStructure: [
      "Provider webhook events continue to land in email_events and twilio_message_status.",
      "Revenue messages continue to land in revenue_message_events.",
      "Send automation continues to land in auto_send_log and sales_events.",
      "Safety/control and verification events now also land in platform_audit_events when migration 096 is applied.",
    ],
    scalingBlockers: securityFindings.filter((risk) => risk.severity === "critical" || risk.severity === "high"),
    nextImplementationOrder: [
      "Apply migration 096 in Supabase.",
      "Set production Postmark runtime values and verify DNS/SPF/DKIM/sender signatures.",
      "Turn on manual approval mode before any campaign-scale outbound.",
      "Keep Twilio live disabled until A2P, inbound, and status callbacks are verified.",
      "Wire /api/admin/control-tower/daily-brief to a 5 PM Vercel Cron after env is stable.",
      "Run a database hardening pass on public SECURITY DEFINER functions and views.",
      "Gradually connect more module actions to platform_audit_events.",
    ],
    testingChecklist: [
      "Open /admin/control-center and verify the Foundation panel renders.",
      "Open /admin/email-infrastructure and rerun audit after Postmark env is set.",
      "POST one safe email verification send from each sender only after Postmark token/DNS are ready.",
      "POST /api/admin/system/pause control changes and confirm platform_audit_events receives entries.",
      "GET/POST /api/admin/control-tower/daily-brief as admin or cron and confirm platform_daily_briefs upserts.",
      "Send no mass outreach until sender health, webhook, and manual approval checks are green.",
    ],
    rollbackStrategy: [
      "Revert code changes to remove the Control Tower panel/routes without touching existing admin modules.",
      "Drop platform_audit_events, platform_feature_flags, and platform_daily_briefs if migration 096 must be rolled back.",
      "Keep system_controls/revenue_message_* untouched; they are existing authoritative systems.",
      "Disable new audit writes by leaving migration 096 unapplied; helper failures are non-blocking.",
    ],
    dailyBrief: buildBrief({
      sent24h,
      inbound24h,
      pendingApprovals,
      unreadThreads,
      failedComms,
      activeCampaigns,
      procurementOps: procurementActions.value,
      politicalOps: politicalActive.value,
      risks: securityFindings,
    }),
    sourceErrors: sourceErrors([
      { key: "system_controls", error: controlsResult.error },
      { key: "revenue_message_threads", error: threadsResult.error },
      { key: "revenue_message_approval_queue", error: approvalsResult.error },
      { key: "revenue_ai_suggestions", error: suggestionsResult.error },
      { key: "revenue_message_events", error: revenueEventsResult.error },
      { key: "email_events", error: emailEventsResult.error },
      { key: "twilio_message_status", error: twilioEventsResult.error },
      { key: "v_sender_health", error: senderHealthResult.error },
      { key: "auto_send_log", error: autoSendResult.error },
      { key: "platform_audit_events", error: auditResult.error },
      { key: "platform_feature_flags", error: flagsResult.error },
      { key: "approval_spine", error: approvalSpine.errors.length ? approvalSpine.errors.join("; ") : undefined },
      { key: "approval_ledger", error: approvalLedgerStatus.error ?? undefined },
      { key: "sales_leads_today", error: salesLeadsToday.error },
      { key: "waitlist_today", error: waitlistToday.error },
      { key: "intake_open", error: intakeOpen.error },
      { key: "marketing_active", error: marketingActive.error },
      { key: "targeted_active", error: targetedActive.error },
      { key: "political_active", error: politicalActive.error },
      { key: "procurement_actions", error: procurementActions.error },
    ]),
  };

  return data;
}

export async function persistDailyExecutiveBrief(input?: {
  actorId?: string | null;
  recipient?: string | null;
}): Promise<{ ok: boolean; id: string | null; error: string | null; data: FoundationControlTowerData }> {
  const data = await loadFoundationControlTower();
  const db = createServiceClient();
  const briefDate = new Date().toISOString().slice(0, 10);
  const { data: row, error } = await db
    .from("platform_daily_briefs")
    .upsert({
      brief_date: briefDate,
      title: data.dailyBrief.title,
      status: "ready",
      generated_at: data.dailyBrief.generatedAt,
      delivery_channel: "admin_dashboard",
      recipient: input?.recipient ?? process.env.ADMIN_NOTIFICATION_EMAIL ?? null,
      summary_markdown: buildDailyBriefMarkdown(data),
      metrics: { items: data.dailyBrief.metrics },
      risks: data.dailyBrief.risks,
      priorities: data.dailyBrief.priorities,
      source_snapshot: {
        generated_at: data.generatedAt,
        controls: data.controls,
        communication_health: data.communicationHealth,
        business_health: data.businessHealth,
      },
      created_by: input?.actorId ?? null,
    }, { onConflict: "brief_date" })
    .select("id")
    .maybeSingle();

  return {
    ok: !error,
    id: typeof row?.id === "string" ? row.id : null,
    error: error?.message ?? null,
    data,
  };
}
