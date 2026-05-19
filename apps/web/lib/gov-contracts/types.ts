export type GovContractPipelineStatus =
  | "new"
  | "reviewing"
  | "strong_fit"
  | "need_subcontractor"
  | "bid_prep"
  | "awaiting_approval"
  | "submitted"
  | "awarded"
  | "lost"
  | "no_bid"
  | "archived";

export type GovContractFitStatus = "strong_fit" | "possible_fit" | "weak_fit" | "no_bid";

export type GovContractUrgency = "low" | "medium" | "high" | "critical";

export interface GovContractLocation {
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
  label: string;
}

export interface GovContractAttachment {
  label: string;
  url: string;
  type?: string | null;
}

export interface GovContractScoreBreakdown {
  operationalFit: number;
  subcontractability: number;
  revenuePotential: number;
  deadlineFeasibility: number;
  geographyFeasibility: number;
  complianceComplexity: number;
  pastPerformanceRisk: number;
  strategicValue: number;
}

export interface GovContractOpportunity {
  id: string;
  sourceSystem: "sam.gov" | "sample" | "manual";
  sourceId: string;
  sourceUrl: string | null;
  title: string;
  agency: string;
  department: string | null;
  office: string | null;
  solicitationNumber: string | null;
  noticeType: string;
  baseNoticeType: string | null;
  postedDate: string | null;
  dueDate: string | null;
  questionsDeadline: string | null;
  siteVisitAt: string | null;
  naicsCode: string | null;
  pscCode: string | null;
  setAsideCode: string | null;
  setAsideDescription: string | null;
  estimatedValueCents: number | null;
  awardAmountCents: number | null;
  location: GovContractLocation;
  pipelineStatus: GovContractPipelineStatus;
  fitStatus: GovContractFitStatus;
  fitScore: number;
  riskScore: number;
  urgencyScore: number;
  urgency: GovContractUrgency;
  scoreBreakdown: GovContractScoreBreakdown;
  recommendedNextAction: string;
  scoringReason: string;
  summary: string;
  complianceNotes: string[];
  attachments: GovContractAttachment[];
  amendmentCount: number;
  missingItems: string[];
  lastSyncedAt: string | null;
  isSample: boolean;
}

export interface GovContractDashboardFilters {
  keyword?: string;
  naics?: string;
  psc?: string;
  agency?: string;
  state?: string;
  setAside?: string;
  noticeType?: string;
  status?: GovContractPipelineStatus | "all";
  sort?: "fit" | "due" | "urgency" | "value" | "agency" | "status";
}

export interface GovContractDashboardSummary {
  newOpportunities: number;
  strongFit: number;
  deadlinesThisWeek: number;
  bidsInProgress: number;
  submittedBids: number;
  awardedBids: number;
  estimatedPipelineValueCents: number;
  pendingApprovals: number;
  missingDocuments: number;
  requiredActionsToday: number;
}

export interface GovContractDashboardData {
  summary: GovContractDashboardSummary;
  opportunities: GovContractOpportunity[];
  sync: {
    configured: boolean;
    databaseReady: boolean;
    status: "ready" | "not_configured" | "sample_data" | "error";
    lastRunAt: string | null;
    message: string;
  };
  sourceLabel: "database" | "sample";
}

export interface GovContractAuditEventInput {
  opportunityId?: string | null;
  eventType: string;
  actorId?: string | null;
  summary: string;
  metadata?: Record<string, unknown>;
}
