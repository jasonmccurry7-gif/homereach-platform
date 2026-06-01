import { createServiceClient } from "@/lib/supabase/service";
import type {
  AgentDryRunChecklistItem,
  AgentExecutionAuditLog,
  AgentExecutionReadinessData,
  AgentExecutionStatus,
  AgentExecutionTask,
  AgentPermissionScope,
  BrowserSessionRegistryItem,
  BrowserSessionStatus,
} from "./types";

type GenericRow = Record<string, unknown>;

const MIGRATION_HINT =
  "Apply supabase/migrations/20260531170000_agent_execution_readiness.sql to persist Agent Execution Readiness queues, browser session registry, and audit logs.";

export const PERMISSION_SCOPES: AgentPermissionScope[] = [
  "read_only",
  "draft_only",
  "prepare_only",
  "send_after_approval",
  "purchase_after_approval",
  "submit_after_approval",
];

export const SENSITIVE_GUARDRAILS = [
  "Sending emails",
  "Sending SMS",
  "Posting publicly",
  "Placing orders",
  "Spending money",
  "Submitting SAM.gov bids",
  "Signing contracts",
  "Changing account settings",
  "Deleting records",
  "Exporting sensitive data",
];

export const SECURITY_RULES = [
  "Do not store passwords, API keys, MFA secrets, browser cookies, or session tokens in HomeReach.",
  "Default every execution task to read_only unless an admin explicitly approves a narrower workflow scope.",
  "Browser sessions are assumed to live outside the app in a dedicated Windows user and dedicated Chrome profile.",
  "This layer prepares tasks, approvals, screenshots, logs, and dry-run checklists only. It does not directly control the computer.",
  "Personal accounts must not be automated. Use dedicated business sessions only.",
];

const SEED_REGISTRY: BrowserSessionRegistryItem[] = [
  seedRegistry("HomeReach Admin", "https://www.home-reach.com/admin", "Review internal queues and prepare approval-gated actions."),
  seedRegistry("Gmail", "https://mail.google.com/", "Read approved business mailbox context and prepare draft-only replies."),
  seedRegistry("Facebook", "https://www.facebook.com/", "Review business page context and prepare draft-only DMs or posts."),
  seedRegistry("Stripe", "https://dashboard.stripe.com/", "Read payment status and prepare reconciliation notes."),
  seedRegistry("Twilio", "https://console.twilio.com/", "Read SMS status and prepare A2P/compliance notes."),
  seedRegistry("Mailgun", "https://app.mailgun.com/", "Read deliverability events and prepare bounce/reputation notes."),
  seedRegistry("GitHub", "https://github.com/", "Read issues, PRs, CI status, and prepare change notes."),
  seedRegistry("Vercel", "https://vercel.com/", "Read deployment status, logs, and prepare rollback checklists."),
  seedRegistry("Supabase", "https://supabase.com/dashboard", "Read project state and prepare migration review notes."),
  seedRegistry("GoDaddy", "https://www.godaddy.com/", "Read domain/DNS settings and prepare change checklists."),
  seedRegistry("SAM.gov", "https://sam.gov/", "Read public opportunities and prepare bid/no-bid checklists."),
  seedRegistry("supplier websites", null, "Read approved supplier pages and prepare price comparison notes."),
];

const SEED_TASKS: AgentExecutionTask[] = [
  {
    id: "seed-agent-execution-001",
    taskId: "AER-SEED-001",
    miniAppId: "political-plan",
    sourceAgent: "Political Campaign Agent",
    taskType: "dry_run_browser_review",
    targetSystem: "HomeReach Admin",
    targetUrl: "/admin/political",
    permissionScope: "read_only",
    status: "dry_run_ready",
    humanApprovalRequired: true,
    approvedBy: null,
    approvedAt: null,
    executionStartedAt: null,
    executionCompletedAt: null,
    screenshotBeforeUrl: null,
    screenshotAfterUrl: null,
    executionLog: [
      {
        at: new Date().toISOString(),
        actor: "System",
        event: "seed_created",
        note: "Fallback dry-run example. Apply migration before using as live queue.",
      },
    ],
    failureReason: null,
    retryAllowed: false,
    manualTakeoverRequired: false,
    dryRunEnabled: true,
    dryRunChecklist: buildDryRunChecklist("HomeReach Admin", "read_only"),
    sensitiveActionFlags: ["political_review"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export async function loadAgentExecutionReadiness(): Promise<AgentExecutionReadinessData> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return fallbackData([
      "Supabase URL or service role key is unavailable.",
      "Agent Execution Readiness is showing seed data only.",
    ]);
  }

  const db = createServiceClient();
  const [tasksResult, registryResult, auditResult] = await Promise.all([
    safeList(db, "agent_execution_queue", "updated_at"),
    safeList(db, "agent_browser_session_registry", "system_name", true),
    safeList(db, "agent_execution_audit_log", "created_at"),
  ]);

  const errors = [tasksResult, registryResult, auditResult]
    .flatMap((result) => (result.error ? [result.error.message] : []))
    .filter(Boolean);

  if (errors.length > 0) {
    return fallbackData(errors);
  }

  const tasks = (tasksResult.data ?? []).map(mapTask);
  const registry = (registryResult.data ?? []).map(mapRegistry);
  const auditLogs = (auditResult.data ?? []).map(mapAuditLog);

  return {
    schemaReady: true,
    migrationHint: null,
    warnings: [],
    summary: buildSummary(tasks, registry),
    tasks,
    registry,
    auditLogs,
    permissionScopes: PERMISSION_SCOPES,
    sensitiveGuardrails: SENSITIVE_GUARDRAILS,
    securityRules: SECURITY_RULES,
  };
}

export function buildDryRunChecklist(
  targetSystem: string,
  permissionScope: AgentPermissionScope,
): AgentDryRunChecklistItem[] {
  const sensitive = isSensitiveScope(permissionScope);
  return [
    {
      label: "Confirm approved mini app origin",
      status: "pending",
      detail: "Task must originate from a named mini app with a human-visible purpose and target system.",
    },
    {
      label: "Confirm browser session boundary",
      status: "pending",
      detail: `${targetSystem} must be accessed only through the dedicated HomeReach Windows user and Chrome profile.`,
    },
    {
      label: "Capture before screenshot placeholder",
      status: "pending",
      detail: "Record screenshot_before_url before any future browser agent attempts work.",
    },
    {
      label: "Run in dry-run mode",
      status: "ready",
      detail: "Simulate clicks, fields, and expected page states without sending, submitting, buying, posting, deleting, exporting, or changing settings.",
    },
    {
      label: "Sensitive action approval",
      status: sensitive ? "blocked" : "ready",
      detail: sensitive
        ? "This scope can affect outbound, spend, submission, or account state. It must be approved again before execution."
        : "Read/draft/prepare-only scope. No external mutation is allowed.",
    },
    {
      label: "Capture after screenshot placeholder",
      status: "pending",
      detail: "Record screenshot_after_url and execution_log after any future permissioned run.",
    },
  ];
}

export function isSensitiveScope(scope: AgentPermissionScope) {
  return scope === "send_after_approval" || scope === "purchase_after_approval" || scope === "submit_after_approval";
}

function fallbackData(warnings: string[]): AgentExecutionReadinessData {
  return {
    schemaReady: false,
    migrationHint: MIGRATION_HINT,
    warnings,
    summary: buildSummary(SEED_TASKS, SEED_REGISTRY),
    tasks: SEED_TASKS,
    registry: SEED_REGISTRY,
    auditLogs: [],
    permissionScopes: PERMISSION_SCOPES,
    sensitiveGuardrails: SENSITIVE_GUARDRAILS,
    securityRules: SECURITY_RULES,
  };
}

async function safeList(
  db: ReturnType<typeof createServiceClient>,
  table: string,
  orderColumn: string,
  ascending = false,
): Promise<{ data: GenericRow[] | null; error: { message: string } | null }> {
  const { data, error } = await db.from(table).select("*").order(orderColumn, { ascending }).limit(250);
  return {
    data: (data ?? null) as GenericRow[] | null,
    error: error ? { message: error.message } : null,
  };
}

function buildSummary(
  tasks: AgentExecutionTask[],
  registry: BrowserSessionRegistryItem[],
) {
  return {
    pendingApprovals: tasks.filter((task) => task.status === "pending_approval").length,
    approvedTasks: tasks.filter((task) => task.status === "approved").length,
    runningTasks: tasks.filter((task) => task.status === "running").length,
    failedTasks: tasks.filter((task) => task.status === "failed").length,
    completedTasks: tasks.filter((task) => task.status === "completed" || task.status === "executed_manually").length,
    manualTakeoverNeeded: tasks.filter((task) => task.manualTakeoverRequired || task.status === "manual_takeover_required" || task.status === "manual_takeover_needed").length,
    sensitiveActionQueue: tasks.filter((task) => isSensitiveScope(task.permissionScope) || task.sensitiveActionFlags.length > 0).length,
    dryRunReady: tasks.filter((task) => task.dryRunEnabled && (task.status === "dry_run_ready" || task.status === "approved")).length,
    registeredSystems: registry.length,
  };
}

function mapTask(row: GenericRow): AgentExecutionTask {
  return {
    id: String(row.id),
    taskId: String(row.task_id ?? ""),
    miniAppId: String(row.mini_app_id ?? ""),
    sourceAgent: String(row.source_agent ?? ""),
    taskType: String(row.task_type ?? ""),
    targetSystem: String(row.target_system ?? ""),
    targetUrl: nullableString(row.target_url),
    permissionScope: asPermissionScope(row.permission_scope),
    status: asExecutionStatus(row.status),
    humanApprovalRequired: Boolean(row.human_approval_required ?? true),
    approvedBy: nullableString(row.approved_by),
    approvedAt: nullableString(row.approved_at),
    executionStartedAt: nullableString(row.execution_started_at),
    executionCompletedAt: nullableString(row.execution_completed_at),
    screenshotBeforeUrl: nullableString(row.screenshot_before_url),
    screenshotAfterUrl: nullableString(row.screenshot_after_url),
    executionLog: asExecutionLog(row.execution_log),
    failureReason: nullableString(row.failure_reason),
    retryAllowed: Boolean(row.retry_allowed ?? false),
    manualTakeoverRequired: Boolean(row.manual_takeover_required ?? false),
    dryRunEnabled: Boolean(row.dry_run_enabled ?? true),
    dryRunChecklist: asDryRunChecklist(row.dry_run_checklist),
    sensitiveActionFlags: asStringArray(row.sensitive_action_flags),
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? row.created_at ?? new Date().toISOString()),
  };
}

function mapRegistry(row: GenericRow): BrowserSessionRegistryItem {
  return {
    id: String(row.id),
    systemName: String(row.system_name ?? ""),
    loginUrl: nullableString(row.login_url),
    purpose: String(row.purpose ?? ""),
    accountOwner: String(row.account_owner ?? "HomeReach Admin"),
    allowedActions: asStringArray(row.allowed_actions),
    blockedActions: asStringArray(row.blocked_actions),
    requiresMfa: Boolean(row.requires_mfa ?? true),
    notes: nullableString(row.notes),
    preferredBrowserProfile: String(row.preferred_browser_profile ?? "Dedicated HomeReach Chrome profile"),
    activeSessionStatus: asBrowserSessionStatus(row.active_session_status),
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? row.created_at ?? new Date().toISOString()),
  };
}

function mapAuditLog(row: GenericRow): AgentExecutionAuditLog {
  return {
    id: String(row.id),
    executionTaskId: nullableString(row.execution_task_id),
    taskPublicId: nullableString(row.task_public_id),
    miniAppId: nullableString(row.mini_app_id),
    actorUserId: nullableString(row.actor_user_id),
    actorLabel: String(row.actor_label ?? "HomeReach Admin"),
    eventType: String(row.event_type ?? "logged"),
    whatChanged: asRecord(row.what_changed),
    allowedScope: asPermissionScope(row.allowed_scope),
    attemptedAction: nullableString(row.attempted_action),
    result: String(row.result ?? "logged"),
    notes: nullableString(row.notes),
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

function seedRegistry(systemName: string, loginUrl: string | null, purpose: string): BrowserSessionRegistryItem {
  return {
    id: `seed-${systemName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    systemName,
    loginUrl,
    purpose,
    accountOwner: "Jason McCurry",
    allowedActions: ["read approved context", "prepare checklist", "draft only"],
    blockedActions: ["send", "submit", "purchase", "delete", "export sensitive data", "change account settings"],
    requiresMfa: true,
    notes: "Fallback registry row. Persist the migration before using this as the live registry.",
    preferredBrowserProfile: "Dedicated HomeReach Windows user + dedicated Chrome profile",
    activeSessionStatus: "manual_login_required",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function asPermissionScope(value: unknown): AgentPermissionScope {
  const scope = String(value ?? "read_only");
  return PERMISSION_SCOPES.includes(scope as AgentPermissionScope) ? (scope as AgentPermissionScope) : "read_only";
}

function asExecutionStatus(value: unknown): AgentExecutionStatus {
  const status = String(value ?? "pending_approval");
  if (
    status === "approved" ||
    status === "queued" ||
    status === "dry_run_ready" ||
    status === "running" ||
    status === "completed" ||
    status === "failed" ||
    status === "paused" ||
    status === "rejected" ||
    status === "cancelled" ||
    status === "manual_takeover_required" ||
    status === "manual_takeover_needed" ||
    status === "executed_manually"
  ) {
    return status;
  }
  return "pending_approval";
}

function asBrowserSessionStatus(value: unknown): BrowserSessionStatus {
  const status = String(value ?? "not_configured");
  if (
    status === "manual_login_required" ||
    status === "active" ||
    status === "expired" ||
    status === "blocked" ||
    status === "do_not_automate"
  ) {
    return status;
  }
  return "not_configured";
}

function asExecutionLog(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => item !== null && typeof item === "object" && !Array.isArray(item))
    .map((item) => ({
      at: String(item.at ?? new Date().toISOString()),
      actor: String(item.actor ?? "System"),
      event: String(item.event ?? "activity"),
      note: String(item.note ?? ""),
    }));
}

function asDryRunChecklist(value: unknown): AgentDryRunChecklistItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => item !== null && typeof item === "object" && !Array.isArray(item))
    .map((item) => {
      const rawStatus = String(item.status ?? "pending");
      return {
        label: String(item.label ?? "Checklist item"),
        status: rawStatus === "ready" || rawStatus === "blocked" ? rawStatus : "pending",
        detail: String(item.detail ?? ""),
      };
    });
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  if (typeof value === "string") return value.split(",").map((item) => item.trim()).filter(Boolean);
  return [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
