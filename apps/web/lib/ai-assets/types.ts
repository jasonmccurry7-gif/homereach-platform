export type AiAssetStatus = "active" | "inactive" | "draft" | "archived";
export type AiApprovalStatus =
  | "draft"
  | "needs_review"
  | "approved"
  | "rejected"
  | "revision_needed"
  | "sent"
  | "archived";
export type AiVerificationStatus = "pending" | "verified" | "failed" | "needs_review";

export type AiBusinessContext = {
  id: string;
  title: string;
  category: string;
  companyOverview: string;
  offers: string;
  pricing: string;
  targetCustomers: string;
  brandVoice: string;
  salesPositioning: string;
  complianceRules: string;
  politicalMailRules: string;
  procurementDashboardRules: string;
  sharedPostcardRules: string;
  targetedCampaignRules: string;
  samGovRules: string;
  humanApprovalRequirements: string;
  tags: string[];
  status: AiAssetStatus;
  lastReviewedAt: string | null;
  notes: string | null;
  updatedAt: string;
};

export type AiPromptSop = {
  id: string;
  promptName: string;
  category: string;
  purpose: string;
  requiredInputs: string[];
  promptText: string;
  outputFormat: string;
  approvalRequirement: string;
  tags: string[];
  status: AiAssetStatus;
  relatedWorkflow: string | null;
  relatedOffer: string | null;
  lastReviewedAt: string | null;
  notes: string | null;
  updatedAt: string;
};

export type AiDataSource = {
  id: string;
  title: string;
  category: string;
  description: string;
  content: string;
  tags: string[];
  relatedWorkflow: string | null;
  relatedOffer: string | null;
  qualityRating: number;
  status: AiAssetStatus;
  lastReviewedAt: string | null;
  notes: string | null;
  updatedAt: string;
};

export type AiAgentProfile = {
  id: string;
  agentName: string;
  mission: string;
  allowedActions: string[];
  disallowedActions: string[];
  requiredDataSources: string[];
  requiredPromptSops: string[];
  approvalRules: string;
  complianceRules: string;
  escalationRules: string;
  outputFormat: string;
  toneRules: string;
  successMetrics: string[];
  status: AiAssetStatus;
  lastReviewedAt: string | null;
  notes: string | null;
  updatedAt: string;
};

export type AiPromptChainStep = {
  id: string;
  chainId: string;
  stepOrder: number;
  stepName: string;
  requiredInputs: string[];
  sourceAssets: string[];
  outputSummary: string;
  approvalRequired: boolean;
  runStatus: string;
  notes: string | null;
};

export type AiPromptChain = {
  id: string;
  chainName: string;
  category: string;
  purpose: string;
  requiredInputs: string[];
  sourceAssets: string[];
  approvalPoints: string[];
  runStatus: string;
  status: AiAssetStatus;
  lastReviewedAt: string | null;
  notes: string | null;
  updatedAt: string;
  steps: AiPromptChainStep[];
};

export type AiVerificationCheck = {
  id: string;
  outputId: string | null;
  label: string;
  category: string;
  status: "not_started" | "verified" | "failed" | "needs_review";
  required: boolean;
  completedAt: string | null;
  notes: string | null;
};

export type AiOutput = {
  id: string;
  title: string;
  agentName: string | null;
  workflow: string | null;
  outputType: string;
  content: string;
  dataSources: string[];
  promptSopName: string | null;
  chainName: string | null;
  approvalStatus: AiApprovalStatus;
  verificationStatus: AiVerificationStatus;
  winningOutput: boolean;
  status: AiAssetStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AiOutputReview = {
  id: string;
  outputId: string | null;
  reviewStatus: string;
  reviewNotes: string | null;
  checklist: Record<string, unknown>;
  createdAt: string;
};

export type AiAssetsCommandCenterData = {
  schemaReady: boolean;
  migrationHint: string | null;
  warnings: string[];
  businessContext: AiBusinessContext;
  promptSops: AiPromptSop[];
  dataSources: AiDataSource[];
  agentProfiles: AiAgentProfile[];
  promptChains: AiPromptChain[];
  outputs: AiOutput[];
  verificationChecks: AiVerificationCheck[];
  outputReviews: AiOutputReview[];
  reusedSystems: string[];
  auditFindings: string[];
};
