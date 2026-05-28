export const GROUP_OPPORTUNITY_CATEGORIES = [
  "Supplyfy opportunity",
  "HomeReach postcard opportunity",
  "Sunshine Cupcakes partnership opportunity",
  "Catering / corporate order opportunity",
  "Restaurant dessert partnership opportunity",
  "Realtor gifting opportunity",
  "Political outreach opportunity",
  "General small business advice opportunity",
  "Not relevant",
] as const;

export const GROUP_OBSERVATION_STATUSES = [
  "New",
  "Reviewed",
  "Comment Drafted",
  "DM Drafted",
  "Responded",
  "Follow-Up Due",
  "Converted to Lead",
  "Not Relevant",
  "Archived",
] as const;

export type GroupOpportunityCategory = (typeof GROUP_OPPORTUNITY_CATEGORIES)[number];
export type GroupObservationStatus = (typeof GROUP_OBSERVATION_STATUSES)[number];
export type GroupUrgencyLevel = "low" | "medium" | "high" | "urgent";
export type GroupDraftType = "public_comment" | "private_dm" | "follow_up" | "facebook_post_idea";

export type GroupSource = {
  id: string;
  groupName: string;
  groupUrl: string | null;
  groupType: string;
  accessBasis: string;
  status: string;
  notes: string | null;
  updatedAt: string;
};

export type GroupResponseDraft = {
  id: string;
  observationId: string;
  draftType: GroupDraftType;
  title: string | null;
  content: string;
  tone: string;
  approvalStatus: string;
  copiedAt: string | null;
  createdAt: string;
};

export type GroupObservation = {
  id: string;
  sourceId: string | null;
  groupName: string;
  postAuthorName: string | null;
  businessName: string | null;
  businessType: string | null;
  postUrl: string | null;
  observedAt: string;
  sourceText: string;
  painPointSummary: string;
  urgencyLevel: GroupUrgencyLevel;
  opportunityCategory: GroupOpportunityCategory;
  opportunityScore: number;
  recommendedResponseAngle: string;
  suggestedServiceFit: string;
  followUpSuggestion: string;
  status: GroupObservationStatus;
  notes: string | null;
  copiedPublicCommentAt: string | null;
  copiedDmAt: string | null;
  respondedAt: string | null;
  followUpDueAt: string | null;
  convertedLeadId: string | null;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
  drafts: GroupResponseDraft[];
};

export type GroupIntelligenceSummary = {
  schemaReady: boolean;
  totalObservations: number;
  newPainPoints: number;
  bestOpportunitiesToday: number;
  draftsReadyForReview: number;
  responsesCopied: number;
  followUpsDue: number;
  convertedLeads: number;
  topPainPoints: Array<{ label: string; count: number }>;
  topOpportunities: GroupObservation[];
  suggestedFacebookPosts: string[];
  dailyBrief: string;
  warnings: string[];
};

export type GroupDashboardData = {
  schemaReady: boolean;
  warnings: string[];
  observations: GroupObservation[];
  sources: GroupSource[];
  summary: GroupIntelligenceSummary;
};

export type GroupAnalyzeInput = {
  groupName: string;
  groupUrl?: string | null;
  groupType?: string | null;
  postAuthorName?: string | null;
  businessName?: string | null;
  businessType?: string | null;
  postUrl?: string | null;
  observedAt?: string | null;
  sourceText: string;
  notes?: string | null;
};

export type GroupAnalyzeResult = {
  painPointSummary: string;
  urgencyLevel: GroupUrgencyLevel;
  opportunityCategory: GroupOpportunityCategory;
  opportunityScore: number;
  recommendedResponseAngle: string;
  suggestedServiceFit: string;
  followUpSuggestion: string;
  publicCommentDraft: string;
  privateDmDraft: string;
  followUpDraft: string;
  facebookPostIdeas: string[];
  detectedCity: string | null;
  detectedPainPoints: string[];
  safetyNotes: string[];
};
