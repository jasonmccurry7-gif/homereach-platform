export type AgentPermissionScope =
  | "read_only"
  | "draft_only"
  | "prepare_only"
  | "send_after_approval"
  | "purchase_after_approval"
  | "submit_after_approval";

export type AgentExecutionStatus =
  | "pending_approval"
  | "queued"
  | "approved"
  | "dry_run_ready"
  | "running"
  | "completed"
  | "failed"
  | "paused"
  | "rejected"
  | "cancelled"
  | "manual_takeover_required"
  | "manual_takeover_needed"
  | "executed_manually";

export type BrowserSessionStatus =
  | "not_configured"
  | "manual_login_required"
  | "active"
  | "expired"
  | "blocked"
  | "do_not_automate";

export type AgentExecutionTask = {
  id: string;
  taskId: string;
  miniAppId: string;
  sourceAgent: string;
  taskType: string;
  targetSystem: string;
  targetUrl: string | null;
  permissionScope: AgentPermissionScope;
  status: AgentExecutionStatus;
  humanApprovalRequired: boolean;
  approvedBy: string | null;
  approvedAt: string | null;
  executionStartedAt: string | null;
  executionCompletedAt: string | null;
  screenshotBeforeUrl: string | null;
  screenshotAfterUrl: string | null;
  executionLog: AgentExecutionLogEntry[];
  failureReason: string | null;
  retryAllowed: boolean;
  manualTakeoverRequired: boolean;
  dryRunEnabled: boolean;
  dryRunChecklist: AgentDryRunChecklistItem[];
  sensitiveActionFlags: string[];
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentExecutionLogEntry = {
  at: string;
  actor: string;
  event: string;
  note: string;
};

export type AgentDryRunChecklistItem = {
  label: string;
  status: "pending" | "ready" | "blocked";
  detail: string;
};

export type BrowserSessionRegistryItem = {
  id: string;
  systemName: string;
  loginUrl: string | null;
  purpose: string;
  accountOwner: string;
  allowedActions: string[];
  blockedActions: string[];
  requiresMfa: boolean;
  notes: string | null;
  preferredBrowserProfile: string;
  activeSessionStatus: BrowserSessionStatus;
  createdAt: string;
  updatedAt: string;
};

export type AgentExecutionAuditLog = {
  id: string;
  executionTaskId: string | null;
  taskPublicId: string | null;
  miniAppId: string | null;
  actorUserId: string | null;
  actorLabel: string;
  eventType: string;
  whatChanged: Record<string, unknown>;
  allowedScope: AgentPermissionScope;
  attemptedAction: string | null;
  result: string;
  notes: string | null;
  createdAt: string;
};

export type AgentExecutionSummary = {
  pendingApprovals: number;
  approvedTasks: number;
  runningTasks: number;
  failedTasks: number;
  completedTasks: number;
  manualTakeoverNeeded: number;
  sensitiveActionQueue: number;
  dryRunReady: number;
  registeredSystems: number;
};

export type AgentExecutionReadinessData = {
  schemaReady: boolean;
  migrationHint: string | null;
  warnings: string[];
  summary: AgentExecutionSummary;
  tasks: AgentExecutionTask[];
  registry: BrowserSessionRegistryItem[];
  auditLogs: AgentExecutionAuditLog[];
  permissionScopes: AgentPermissionScope[];
  sensitiveGuardrails: string[];
  securityRules: string[];
};
