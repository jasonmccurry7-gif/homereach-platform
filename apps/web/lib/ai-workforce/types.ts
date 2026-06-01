import type {
  AiAgentProfile,
  AiDataSource,
  AiOutput,
  AiPromptChain,
  AiPromptSop,
  AiVerificationCheck,
} from "@/lib/ai-assets/types";

export type WorkforceTaskStatus =
  | "new"
  | "assigned"
  | "in_progress"
  | "blocked"
  | "awaiting_approval"
  | "approved"
  | "rejected"
  | "needs_revision"
  | "completed"
  | "failed";

export type WorkforceTaskPriority = "low" | "medium" | "high" | "critical";

export type WorkforceTask = {
  id: string;
  taskId: string;
  workflowName: string;
  requestor: string;
  assignedAgent: string;
  priority: WorkforceTaskPriority;
  status: WorkforceTaskStatus;
  inputPath: string | null;
  inputData: Record<string, unknown>;
  expectedOutput: string;
  dependencies: string[];
  dueDate: string | null;
  approvalRequired: boolean;
  completionNotes: string | null;
  errorNotes: string | null;
  relatedCampaign: string | null;
  relatedClient: string | null;
  relatedOpportunity: string | null;
  outputId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WorkforceActivityLog = {
  id: string;
  taskId: string | null;
  taskPublicId: string | null;
  agentName: string | null;
  eventType: string;
  status: string;
  summary: string;
  details: Record<string, unknown>;
  approvalStatus: "not_required" | "needs_review" | "approved" | "rejected" | "needs_revision";
  relatedOutputId: string | null;
  createdAt: string;
};

export type LegacyAgentRegistry = {
  id: string;
  name: string;
  role: string | null;
  layer: string | null;
  isActive: boolean;
  description: string | null;
};

export type LegacyAgentRunLog = {
  id: string;
  agentId: string | null;
  agentName: string | null;
  status: string;
  actionsTaken: number;
  messagesSent: number;
  errorMessage: string | null;
  runAt: string;
};

export type LegacyAgentDailyStat = {
  id: string;
  agentId: string;
  actionsCompleted: number;
  messagesSent: number;
  errors: number;
  completionPct: number;
  statDate: string;
};

export type WorkforceSummary = {
  activeAgents: number;
  tasksInProgress: number;
  completedToday: number;
  awaitingApproval: number;
  outreachDraftsReady: number;
  politicalPlansReady: number;
  procurementAnalysesReady: number;
  samReviewsReady: number;
  qaIssues: number;
  revenueOpportunities: number;
  systemHealthAlerts: number;
};

export type AiWorkforceCommandCenterData = {
  schemaReady: boolean;
  migrationHint: string | null;
  warnings: string[];
  auditSummary: string[];
  reusedSystems: string[];
  doNotTouch: string[];
  summary: WorkforceSummary;
  agents: AiAgentProfile[];
  tasks: WorkforceTask[];
  outputs: AiOutput[];
  logs: WorkforceActivityLog[];
  promptChains: AiPromptChain[];
  promptSops: AiPromptSop[];
  dataSources: AiDataSource[];
  verificationChecks: AiVerificationCheck[];
  legacyAgents: LegacyAgentRegistry[];
  legacyStats: LegacyAgentDailyStat[];
  legacyRunLogs: LegacyAgentRunLog[];
};
