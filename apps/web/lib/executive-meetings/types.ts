export const EXECUTIVE_DOMAINS = [
  "HomeReach",
  "Supplyfy",
  "Political Mail",
  "Websites",
  "SAM.gov",
  "Outreach",
  "Finance",
  "Operations",
] as const;

export type ExecutiveDomain = (typeof EXECUTIVE_DOMAINS)[number];
export type ExecutiveMeetingType = "morning" | "afternoon" | "strategic" | "emergency";
export type ExecutiveBoardroomMode =
  | "morning_standup"
  | "afternoon_review"
  | "strategic_planning"
  | "emergency_operations";
export type ExecutiveMeetingStatus = "draft" | "ready" | "archived" | "failed";
export type ExecutivePermissionLevel =
  | "analysis_only"
  | "recommend_only"
  | "draft_only"
  | "approval_required"
  | "admin_review_required";
export type ExecutiveRiskLevel = "low" | "medium" | "high" | "critical";
export type ExecutiveApprovalStatus = "pending" | "approved" | "rejected" | "edited" | "archived";
export type ExecutiveCommitmentStatus = "planned" | "completed" | "missed" | "deferred" | "blocked";
export type ExecutiveAdapterStatus = "online" | "missing" | "warning" | "empty";

export type ExecutiveVoiceProfile = {
  id: string;
  profileKey: string;
  providerKey: string;
  displayName: string;
  voiceLabel: string;
  speakingStyle: string;
  ttsSettingsJson: Record<string, unknown>;
  liveModeSettingsJson: Record<string, unknown>;
  enabled: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ExecutiveAgent = {
  id: string;
  agentKey: string;
  name: string;
  role: string;
  mission: string;
  dailyResponsibilities: string[];
  kpiOwnership: string[];
  morningReportFormat: Record<string, unknown>;
  afternoonReportFormat: Record<string, unknown>;
  permissionsLevel: ExecutivePermissionLevel;
  assignedDomains: string[];
  enabled: boolean;
  voiceProfileId: string | null;
  systemPrompt: string;
  displayOrder: number;
  metadataJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

export type ExecutiveMeetingSettings = {
  id: string;
  settingsKey: string;
  timezone: string;
  morningTime: string;
  afternoonTime: string;
  autoGenerateEnabled: boolean;
  notificationBadgeEnabled: boolean;
  emailSummaryEnabled: boolean;
  smsSummaryEnabled: boolean;
  voiceModeEnabled: boolean;
  defaultDomains: string[];
  providerPlanJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type ExecutiveMeeting = {
  id: string;
  meetingDate: string;
  meetingType: ExecutiveMeetingType;
  status: ExecutiveMeetingStatus;
  title: string;
  idempotencyKey: string | null;
  timezone: string;
  generatedAt: string;
  generatedBy: string | null;
  generatedByType: "human" | "cron" | "system";
  ceoSummary: string;
  decisionsNeededJson: ExecutiveDecision[];
  blockersJson: ExecutiveBlocker[];
  revenueImpactJson: ExecutiveRevenueImpact;
  tomorrowPrioritiesJson: ExecutivePriority[];
  sourceSnapshotJson: Record<string, unknown>;
  voiceReadyJson: Record<string, unknown>;
  aiWorkforceTaskId: string | null;
  aiOutputId: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  recordingUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ExecutiveMeetingReport = {
  id: string;
  meetingId: string;
  reportType: string;
  title: string;
  summary: string;
  decisionsNeededJson: ExecutiveDecision[];
  blockersJson: ExecutiveBlocker[];
  revenueImpactJson: ExecutiveRevenueImpact;
  tomorrowPrioritiesJson: ExecutivePriority[];
  reportMarkdown: string;
  sourceSnapshotJson: Record<string, unknown>;
  createdAt: string;
};

export type ExecutiveAgentReport = {
  id: string;
  meetingId: string;
  agentId: string | null;
  agentKey: string;
  agentName: string;
  role: string;
  reportType: ExecutiveMeetingType;
  summary: string;
  plannedWorkJson: ExecutiveWorkItem[];
  completedWorkJson: ExecutiveWorkItem[];
  prioritiesJson: ExecutivePriority[];
  risksJson: ExecutiveRisk[];
  blockersJson: ExecutiveBlocker[];
  decisionsNeededJson: ExecutiveDecision[];
  revenueImpactJson: ExecutiveRevenueImpact;
  kpiSnapshotJson: ExecutiveKpiSnapshot[];
  dataSourcesJson: ExecutiveDataSourceNote[];
  confidenceScore: number;
  approvalRequired: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ExecutiveAgentCommitment = {
  id: string;
  agentId: string | null;
  meetingId: string | null;
  commitmentDate: string;
  commitmentText: string;
  domain: string;
  status: ExecutiveCommitmentStatus;
  evidenceJson: Record<string, unknown>;
  revenueImpact: number;
  riskLevel: ExecutiveRiskLevel;
  followUpDate: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ExecutiveAgentKpi = {
  id: string;
  agentId: string | null;
  kpiDate: string;
  kpiKey: string;
  kpiLabel: string;
  valueNumeric: number | null;
  valueText: string | null;
  trend: "up" | "down" | "flat" | "unknown";
  source: string;
  metadataJson: Record<string, unknown>;
  createdAt: string;
};

export type ExecutiveActionApproval = {
  id: string;
  meetingId: string | null;
  agentId: string | null;
  pendingAction: string;
  businessReason: string;
  riskLevel: ExecutiveRiskLevel;
  approvalStatus: ExecutiveApprovalStatus;
  editedAction: string | null;
  decisionReason: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  auditPayloadJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type ExecutiveMeetingParticipantType =
  | "ai_executive"
  | "human_admin"
  | "facilitator"
  | "observer"
  | "external_future";

export type ExecutiveMeetingParticipant = {
  id: string;
  meetingId: string;
  participantType: ExecutiveMeetingParticipantType;
  agentId: string | null;
  participantKey: string;
  displayName: string;
  title: string;
  roleInMeeting: "voting_member" | "facilitator" | "silent_note_taker" | "guest";
  seatIndex: number;
  attendanceStatus: "invited" | "joined" | "speaking" | "listening" | "left" | "blocked";
  voiceProfileKey: string | null;
  currentAssignment: string;
  performanceJson: Record<string, unknown>;
  joinedAt: string | null;
  leftAt: string | null;
  createdAt: string;
};

export type ExecutiveMeetingTranscriptEntry = {
  id: string;
  meetingId: string;
  participantId: string | null;
  speakerKey: string;
  speakerName: string;
  speakerTitle: string;
  speakerType: "ai_executive" | "human_admin" | "facilitator" | "observer" | "system";
  sequence: number;
  startedAt: string;
  endedAt: string | null;
  statement: string;
  statementType: "opening" | "agent_report" | "user" | "decision" | "action_item" | "risk" | "commitment" | "summary" | "closing" | "system";
  source: "generated_report" | "live_voice" | "manual" | "system";
  metadataJson: Record<string, unknown>;
  createdAt: string;
};

export type ExecutiveMeetingOutcome = {
  id: string;
  meetingId: string;
  outcomeType: "executive_summary" | "action_item" | "decision" | "risk" | "commitment" | "scorecard_update" | "opportunity";
  ownerAgentId: string | null;
  ownerKey: string | null;
  ownerName: string | null;
  title: string;
  detail: string;
  priority: "low" | "normal" | "high" | "urgent";
  dueAt: string | null;
  status: "open" | "in_progress" | "needs_approval" | "completed" | "blocked" | "archived";
  sourceTranscriptEntryId: string | null;
  metadataJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type ExecutiveWorkItem = {
  title: string;
  detail: string;
  domain?: string;
  owner?: string;
  expectedOutcome?: string;
  status?: string;
};

export type ExecutivePriority = {
  title: string;
  detail: string;
  domain?: string;
  priority?: "low" | "normal" | "high" | "urgent";
};

export type ExecutiveRisk = {
  title: string;
  detail: string;
  severity: ExecutiveRiskLevel;
  owner?: string;
};

export type ExecutiveBlocker = {
  title: string;
  detail: string;
  agentKey?: string;
  severity: ExecutiveRiskLevel;
  needsHuman?: boolean;
};

export type ExecutiveDecision = {
  title: string;
  detail: string;
  agentKey?: string;
  riskLevel: ExecutiveRiskLevel;
  businessReason: string;
  approvalRequired: boolean;
};

export type ExecutiveRevenueImpact = {
  estimatedRevenue: number;
  estimatedSavings: number;
  estimatedCostAvoided: number;
  detail: string;
};

export type ExecutiveKpiSnapshot = {
  key: string;
  label: string;
  value: string | number;
  trend: "up" | "down" | "flat" | "unknown";
};

export type ExecutiveDataSourceNote = {
  key: string;
  label: string;
  status: ExecutiveAdapterStatus;
  value: number;
  detail: string;
  href?: string;
};

export type ExecutiveDataAdapterSnapshot = ExecutiveDataSourceNote & {
  table: string;
  warning: string | null;
};

export type ExecutiveSourceSnapshot = {
  generatedAt: string;
  timezone: string;
  adapters: ExecutiveDataAdapterSnapshot[];
  totals: {
    leadsToday: number;
    followUpsDue: number;
    outreachApprovals: number;
    revenueMessages24h: number;
    pendingMiniAppApprovals: number;
    manualTakeovers: number;
    openAiTasks: number;
    aiActivity24h: number;
    ordersPaid: number;
    websiteProjects: number;
    activeCampaigns: number;
    failedOrRiskEvents: number;
    estimatedRevenueAwaitingApproval: number;
    estimatedSavingsAwaitingApproval: number;
  };
  warnings: string[];
};

export type ExecutiveChatSummary = {
  enabledAgents: number;
  disabledAgents: number;
  latestMorningAt: string | null;
  latestAfternoonAt: string | null;
  pendingApprovals: number;
  decisionsNeeded: number;
  blockers: number;
  missedCommitments: number;
  completedCommitments: number;
  estimatedRevenue: number;
  estimatedSavings: number;
  adaptersOnline: number;
  sourceWarnings: number;
};

export type ExecutiveChatData = {
  schemaReady: boolean;
  migrationHint: string | null;
  warnings: string[];
  generatedAt: string;
  settings: ExecutiveMeetingSettings;
  agents: ExecutiveAgent[];
  voiceProfiles: ExecutiveVoiceProfile[];
  meetings: ExecutiveMeeting[];
  meetingReports: ExecutiveMeetingReport[];
  agentReports: ExecutiveAgentReport[];
  commitments: ExecutiveAgentCommitment[];
  kpis: ExecutiveAgentKpi[];
  approvals: ExecutiveActionApproval[];
  participants: ExecutiveMeetingParticipant[];
  transcriptEntries: ExecutiveMeetingTranscriptEntry[];
  outcomes: ExecutiveMeetingOutcome[];
  latestMorning: ExecutiveMeeting | null;
  latestAfternoon: ExecutiveMeeting | null;
  selectedMeeting: ExecutiveMeeting | null;
  sourceSnapshot: ExecutiveSourceSnapshot;
  summary: ExecutiveChatSummary;
};

export type ExecutiveActionResult = {
  ok: boolean;
  id?: string | null;
  meetingId?: string | null;
  reused?: boolean;
  error?: string | null;
  status?: number;
};
