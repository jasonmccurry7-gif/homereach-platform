import type { AppRole } from "@/lib/auth/api-guards";

import type {
  ExecutionPermissionScope,
  MiniAppEventType,
  MiniAppPriority,
  MiniAppRiskLevel,
  MiniAppStatus,
  MiniAppType,
} from "./rules";

export {
  EXECUTION_PERMISSION_SCOPES,
  MINI_APP_EVENT_TYPES,
  MINI_APP_PRIORITIES,
  MINI_APP_RISK_LEVELS,
  MINI_APP_STATUSES,
  MINI_APP_TYPES,
} from "./rules";
export type {
  ExecutionPermissionScope,
  MiniAppEventType,
  MiniAppPriority,
  MiniAppRiskLevel,
  MiniAppStatus,
  MiniAppType,
} from "./rules";

export type MiniAppAction =
  | "mark_needs_review"
  | "edit_payload"
  | "approve"
  | "reject"
  | "archive"
  | "schedule"
  | "assign"
  | "mark_executed"
  | "mark_failed"
  | "send_to_execution_queue"
  | "manual_takeover_requested";

export type AgentMiniAppPayload = Record<string, unknown>;

export type AgentMiniApp = {
  id: string;
  tenantId: string | null;
  miniAppType: MiniAppType;
  title: string;
  description: string;
  sourceAgent: string;
  relatedModule: string;
  relatedBusinessId: string | null;
  relatedContactId: string | null;
  relatedCampaignId: string | null;
  relatedClientId: string | null;
  status: MiniAppStatus;
  priority: MiniAppPriority;
  confidenceScore: number;
  riskLevel: MiniAppRiskLevel;
  approvalRequired: boolean;
  estimatedRevenue: number;
  estimatedSavings: number;
  estimatedCost: number;
  recommendedAction: string;
  payloadJson: AgentMiniAppPayload;
  editedPayloadJson: AgentMiniAppPayload | null;
  decision: string | null;
  decisionReason: string | null;
  assignedUserId: string | null;
  dueAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

export type AgentMiniAppEvent = {
  id: string;
  miniAppId: string;
  eventType: MiniAppEventType;
  previousStatus: MiniAppStatus | null;
  newStatus: MiniAppStatus | null;
  actorUserId: string | null;
  actorType: "user" | "agent" | "system";
  eventSummary: string;
  eventPayloadJson: Record<string, unknown>;
  createdAt: string;
};

export type AgentMiniAppsSummary = {
  pendingApprovals: number;
  urgentItems: number;
  estimatedRevenueAwaitingApproval: number;
  estimatedSavingsAwaitingApproval: number;
  overdueTasks: number;
  completedToday: number;
  failedTasks: number;
  manualTakeoverNeeded: number;
};

export type AgentMiniAppsData = {
  schemaReady: boolean;
  migrationHint: string | null;
  warnings: string[];
  summary: AgentMiniAppsSummary;
  miniApps: AgentMiniApp[];
  events: AgentMiniAppEvent[];
  userRole: AppRole | null;
  userId: string | null;
};

export type MiniAppActionResult =
  | { ok: true; id?: string; taskId?: string; status?: MiniAppStatus; message?: string }
  | { ok: false; error: string; status?: number };
