export type GovContractPipelineStatus =
  | "discovered"
  | "new"
  | "saved"
  | "reviewing"
  | "qualifying"
  | "strong_fit"
  | "need_subcontractor"
  | "bid_prep"
  | "waiting_on_documents"
  | "waiting_on_subcontractor_quote"
  | "pricing_review"
  | "compliance_review"
  | "awaiting_approval"
  | "ready_for_approval"
  | "ready_to_submit"
  | "submitted"
  | "under_evaluation"
  | "awarded"
  | "lost"
  | "no_bid"
  | "cancelled"
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
  contractType: string | null;
  responseMethod: string | null;
  incumbentVendor: string | null;
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
  requiredDocuments: string[];
  submissionInstructions: Record<string, unknown>;
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
  expectedProfitCents: number;
  complianceRisks: number;
  cashFlowExposureCents: number;
  activeSubcontractorNeeds: number;
}

export interface GovContractDashboardData {
  summary: GovContractDashboardSummary;
  opportunities: GovContractOpportunity[];
  sync: {
    configured: boolean;
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

export type GovContractBidRecommendation =
  | "Strong Bid"
  | "Good Fit"
  | "Teaming Recommended"
  | "Subcontractor-Led"
  | "Possible Bid"
  | "Subcontractor-Led Bid"
  | "Partner Needed"
  | "High Risk"
  | "No-Bid";

export interface GovContractBidDecision {
  recommendation: GovContractBidRecommendation;
  why: string[];
  risks: string[];
  missingRequirements: string[];
  estimatedEffort: "Low" | "Moderate" | "High" | "Very High";
  recommendedNextStep: string;
  capabilityFit: string;
  eligibilityFit: string;
  financialFit: string;
  operationalFit: string;
  competitionFit: string;
}

export interface GovContractPricingLineItem {
  key: string;
  label: string;
  amountCents: number;
  note: string;
}

export interface GovContractPricingModel {
  directCosts: GovContractPricingLineItem[];
  indirectCosts: GovContractPricingLineItem[];
  riskAdders: GovContractPricingLineItem[];
  targetGrossMargin: number;
  targetNetMargin: number;
  minimumAcceptableMargin: number;
  minimumSafeBidCents: number;
  aggressiveBidCents: number;
  recommendedBidCents: number;
  premiumBidCents: number;
  expectedGrossProfitCents: number;
  expectedNetProfitCents: number;
  riskAdjustedMarginPercent: number;
  underpricingWarning: string;
  lowMarginWarning: string;
  cashFlowWarning: string;
  underbidRiskScore: number;
  cashFlowRiskScore: number;
  priceReasonablenessStatus: "blocked" | "advisory" | "needs_comparison" | "ready_for_human_review";
  priceReasonablenessNotes: string[];
  farPriceReasonablenessChecks: string[];
  bidNoBidRecommendation: GovContractBidRecommendation;
}

export interface GovContractResearchSource {
  label: string;
  type: "sam" | "usaspending" | "entity_search" | "local_search" | "far" | "manual" | "internal";
  url: string | null;
  status: "configured" | "needs_key" | "open_search" | "manual_review" | "verified" | "estimated";
  note: string;
  retrievedAt?: string | null;
  freshnessLabel?: string;
  verifiedData?: boolean;
}

export interface GovContractSubcontractorCandidate {
  name: string;
  workCategory: string;
  geography: string;
  distanceSignal: string;
  sourceLabel: string;
  sourceUrl: string | null;
  verificationStatus: "verified" | "unverified" | "search_required" | "needs_outreach";
  nextAction: string;
  verificationChecklist: string[];
}

export interface GovContractMarketResearchPacket {
  generatedAt: string;
  freshnessLabel: string;
  confidence: "estimated" | "partial" | "verified";
  executiveSummary: string;
  researchStatus: "needs_live_research" | "estimated_planning" | "partially_verified" | "verified";
  sourceLinks: GovContractResearchSource[];
  historicalAwardSummary: string;
  competitiveRangeSummary: string;
  likelyCompetitorSummary: string;
  pricingSignals: string[];
  underbidControls: string[];
  subcontractorCandidates: GovContractSubcontractorCandidate[];
  sourceGaps: string[];
}

export interface GovContractWorkflowItem {
  title: string;
  detail: string;
  status: "complete" | "missing" | "needs_review" | "not_applicable" | "pending" | "ready";
  priority: "low" | "medium" | "high" | "critical";
  owner: string;
  dueAt?: string | null;
}

export interface GovContractComplianceMatrixItem {
  requirement: string;
  sourceReference: string;
  status: "completed" | "missing" | "not_applicable" | "needs_review";
  responseLocation: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  humanReviewRequired: boolean;
}

export interface GovContractSubcontractorNeed {
  workCategory: string;
  requiredCapabilities: string[];
  geography: string;
  insuranceRequired: boolean;
  licenseOrCertificationNeeds: string[];
  timelineRequirements: string;
  pipelineStage: string;
  outreachDraft: string;
  candidateBusinesses?: GovContractSubcontractorCandidate[];
  sourcingLinks?: GovContractResearchSource[];
}

export interface GovContractSubmissionPlan {
  method: string;
  portalOrEmail: string;
  deadline: string | null;
  timezone: string;
  requiredSubjectLine: string;
  attachmentLimits: string;
  checklist: GovContractWorkflowItem[];
  humanApprovalGate: string[];
}

export interface GovContractPostAwardPlan {
  awardStatus: string;
  kickoffChecklist: GovContractWorkflowItem[];
  milestones: GovContractWorkflowItem[];
  invoiceTracker: GovContractWorkflowItem[];
  riskLog: GovContractWorkflowItem[];
  closeoutChecklist: GovContractWorkflowItem[];
}

export interface GovContractAIBidAssistant {
  recommendation: GovContractBidRecommendation;
  reasoning: string[];
  risks: string[];
  missingItems: string[];
  nextAction: string;
  allowedActions: string[];
  blockedActions: string[];
}

export interface GovContractLifecycleItem {
  stage: string;
  status: "complete" | "active" | "next" | "blocked" | "future";
  objective: string;
  nextAction: string;
  risk: "low" | "medium" | "high" | "critical";
}

export interface GovContractAgencyProfile {
  agencyName: string;
  office: string | null;
  spendingTrend: string;
  awardFrequency: string;
  commonNaics: string[];
  incumbentPattern: string;
  smallBusinessTendency: string;
  procurementSpeed: string;
  contractSizeRange: string;
  aiGuidance: string[];
}

export interface GovContractAwardIntel {
  incumbentVendor: string;
  historicalAwardSignal: string;
  realisticCompetitiveRange: string;
  incumbentRisk: "low" | "medium" | "high" | "unknown";
  likelyCompetitorBehavior: string;
  pricingPattern: string;
  intelligenceGaps: string[];
}

export interface GovContractFinancialRiskModel {
  upfrontCashNeedCents: number;
  payrollBurdenCents: number;
  subcontractorFloatCents: number;
  estimatedPaymentGapDays: number;
  burnRateCents: number;
  workingCapitalStressScore: number;
  warnings: string[];
  assumptions: string[];
}

export interface GovContractPastPerformanceMatch {
  projectName: string;
  relevanceScore: number;
  matchingScope: string[];
  gap: string;
  narrativeUse: string;
  humanReviewRequired: boolean;
}

export interface GovContractProposalSection {
  key: string;
  title: string;
  status: "missing" | "draft" | "needs_review" | "approved" | "not_applicable";
  owner: string;
  purpose: string;
  aiDraftInstruction: string;
  humanReviewRequired: boolean;
}

export interface GovContractTeamingPlan {
  primeRecommendation: "Prime Direct" | "Prime With Subcontractor" | "Subcontractor First" | "Teaming Partner Needed" | "No Pursuit";
  rationale: string[];
  requiredPartners: GovContractSubcontractorNeed[];
  agreementWarnings: string[];
}

export interface GovContractRecompeteSignal {
  label: string;
  timing: string;
  prepositioningAction: string;
  risk: "low" | "medium" | "high" | "unknown";
}

export interface GovContractContactPlan {
  contactType: "contracting_officer" | "agency" | "small_business_office" | "prime" | "teaming_partner" | "subcontractor";
  label: string;
  relationshipStage: string;
  nextAction: string;
  approvalRequired: boolean;
}

export interface GovContractOperatingModel {
  lifecycle: GovContractLifecycleItem[];
  agencyProfile: GovContractAgencyProfile;
  awardIntel: GovContractAwardIntel;
  financialRisk: GovContractFinancialRiskModel;
  pastPerformanceMatches: GovContractPastPerformanceMatch[];
  proposalSections: GovContractProposalSection[];
  teamingPlan: GovContractTeamingPlan;
  recompeteSignals: GovContractRecompeteSignal[];
  governmentContacts: GovContractContactPlan[];
}

export interface GovContractBidWorkspace {
  id: string;
  opportunityId: string;
  persisted: boolean;
  bidStage: GovContractPipelineStatus;
  ownerLabel: string;
  submissionReadinessScore: number;
  winProbability: number;
  profitTargetPercent: number;
  approvalStatus: string;
  bidDecision: GovContractBidDecision;
  requirements: GovContractWorkflowItem[];
  documents: GovContractWorkflowItem[];
  pricing: GovContractPricingModel;
  subcontractorNeeds: GovContractSubcontractorNeed[];
  complianceMatrix: GovContractComplianceMatrixItem[];
  submissionPlan: GovContractSubmissionPlan;
  postAwardPlan: GovContractPostAwardPlan;
  operatingModel: GovContractOperatingModel;
  marketResearch: GovContractMarketResearchPacket;
  aiAssistant: GovContractAIBidAssistant;
  exportPackage: {
    packageName: string;
    files: string[];
    fileNamingChecklist: string[];
    notes: string[];
  };
  auditTrail: GovContractWorkflowItem[];
}
