import type { GrowthExecutionSnapshot } from "../growth-execution/services";

export type HomeReachOSMode = "command" | "sales";

export type OSStatus = "online" | "watch" | "critical" | "idle";

export interface OSMetric {
  label: string;
  value: string;
  detail: string;
  status: OSStatus;
  trend?: string;
}

export interface OSOpportunity {
  id: string;
  name: string;
  segment: "business" | "political" | "route";
  location: string;
  product: string;
  score: number;
  value: string;
  nextAction: string;
}

export interface OSNextBestAction {
  id: string;
  title: string;
  outcome: string;
  reason: string;
  ifIgnored: string;
  actionLabel: string;
  href: string;
  confidence: number;
  urgency: number;
  impact: string;
  risk: "Low" | "Medium" | "High";
  status: OSStatus;
  category:
    | "revenue"
    | "communications"
    | "political"
    | "procurement"
    | "creative"
    | "operations"
    | "growth"
    | "seo"
    | "reputation"
    | "retention";
}

export interface OSConversation {
  id: string;
  name: string;
  channel: "sms" | "email" | "dm" | "web" | "intake";
  summary: string;
  age: string;
  unread: boolean;
  urgency: number;
  nextAction: string;
}

export interface OSActivity {
  id: string;
  title: string;
  detail: string;
  time: string;
  status: OSStatus;
}

export interface OSAgent {
  name: string;
  status: OSStatus;
  currentTask: string;
  lastAction: string;
  confidence: number;
  queueCount: number;
}

export interface OSCommandCard {
  id: string;
  title: string;
  segment:
    | "revenue"
    | "shared_postcards"
    | "targeted_campaigns"
    | "political"
    | "procurement"
    | "gov_contracts"
    | "creative"
    | "fulfillment"
    | "client_success"
    | "seo"
    | "reputation"
    | "membership"
    | "retention";
  value: string;
  detail: string;
  nextAction: string;
  href: string;
  status: OSStatus;
  priority: number;
}

export interface OSSpecializedAgent {
  name: string;
  domain: string;
  found: string;
  recommends: string;
  draftsCreated: number;
  nextAction: string;
  approvalRequired: boolean;
  revenueImpact: string;
  status: OSStatus;
  href: string;
}

export interface OSExperienceBoundary {
  system: string;
  publicExperience: string;
  adminExperience: string;
  migrationDecision: "keep_public" | "simplify_public" | "admin_only" | "preview_public";
  href: string;
}

export interface OSExecutionLayer {
  name: string;
  purpose: string;
  currentSource: string;
  publicRole: string;
  adminRole: string;
  nextAction: string;
  href: string;
  status: OSStatus;
}

export interface OSProductPanel {
  name: string;
  description: string;
  href: string;
  status: OSStatus;
  metrics: OSMetric[];
  actions: Array<{ label: string; href: string }>;
}

export interface OSMapLayer {
  name: string;
  type: string;
  status: OSStatus;
  count: number;
  detail: string;
}

export interface OSPipelineStage {
  name: string;
  count: number;
  value: string;
  probability: number;
}

export interface OSMonitor {
  name: string;
  status: OSStatus;
  detail: string;
  href: string;
}

export interface OSRoleView {
  role: string;
  href: string;
  focus: string;
  status: OSStatus;
}

export interface OSHealthDimension {
  id: string;
  label: string;
  score: number;
  status: OSStatus;
  detail: string;
  weakSpot: string;
  nextAction: string;
  href: string;
}

export interface OSBusinessHealthScore {
  score: number;
  trend: "improving" | "steady" | "needs_attention";
  summary: string;
  dimensions: OSHealthDimension[];
  weakSpots: string[];
  opportunities: string[];
}

export interface OSMoneyLeak {
  id: string;
  title: string;
  issue: string;
  estimatedImpact: string;
  recommendedAction: string;
  relatedSolution: string;
  actionLabel: string;
  href: string;
  status: OSStatus;
  severity: "Low" | "Medium" | "High";
}

export interface OSDigitalEmployee {
  name: string;
  domain: string;
  promise: string;
  ownerSees: string;
  watches: string[];
  recommends: string;
  nextAction: string;
  href: string;
  status: OSStatus;
  approvalRequired: boolean;
}

export interface OSIndustryPlaybook {
  industry: string;
  systemName: string;
  focus: string;
  campaignStrategy: string;
  targetingStrategy: string;
  seoRecommendation: string;
  procurementRecommendation: string;
  seasonalRecommendation: string;
  retentionMove: string;
  href: string;
  status: OSStatus;
}

export interface OSMembershipPlan {
  name: string;
  cadence: string;
  bestFor: string;
  includes: string[];
  outcome: string;
  priceSignal: string;
  href: string;
  status: OSStatus;
}

export interface OSCommunityLoop {
  title: string;
  detail: string;
  trustSignal: string;
  nextAction: string;
  href: string;
  status: OSStatus;
}

export interface HomeReachOSData {
  generatedAt: string;
  revenue: {
    revenueToday: string;
    mrr: string;
    arr: string;
    pendingInvoices: number;
    pendingProposals: number;
    failedPayments: number;
    stripePipeline: string;
    projectedRevenue: string;
    closeProbability: number;
  };
  leadIntelligence: {
    newLeads: number;
    hotLeads: number;
    staleLeads: number;
    aiRanked: number;
    politicalOpportunities: number;
    businessOpportunities: number;
    routeOpportunities: number;
    opportunities: OSOpportunity[];
  };
  operations: {
    activeCampaigns: number;
    printJobs: number;
    postcardSchedules: number;
    bmeuDrops: number;
    designApprovals: number;
    deliveryWindows: number;
    operationalAlerts: number;
  };
  communications: {
    unreadTexts: number;
    unreadEmails: number;
    unreadDms: number;
    websiteInquiries: number;
    intakeSubmissions: number;
    campaignReplies: number;
    missedFollowUps: number;
    pendingReplies: number;
    conversations: OSConversation[];
  };
  ai: {
    actions: number;
    leadResearchUpdates: number;
    newCandidateFilings: number;
    newBusinessOpportunities: number;
    scoringChanges: number;
    drafts: number;
    automationStatus: OSStatus;
    agents: OSAgent[];
  };
  productOps: OSProductPanel[];
  maps: OSMapLayer[];
  pipeline: OSPipelineStage[];
  performance: {
    textsSent: number;
    emailsSent: number;
    dmsSent: number;
    callsMade: number;
    meetingsBooked: number;
    proposalsSent: number;
    dealsClosed: number;
    revenueByProduct: OSMetric[];
    humanActions: number;
    aiActions: number;
  };
  automation: OSMonitor[];
  notifications: OSActivity[];
  roleViews: OSRoleView[];
  activityFeed: OSActivity[];
  businessHealth: OSBusinessHealthScore;
  moneyLeaks: OSMoneyLeak[];
  digitalEmployees: OSDigitalEmployee[];
  industryPlaybooks: OSIndustryPlaybook[];
  membershipPlans: OSMembershipPlan[];
  communityLoops: OSCommunityLoop[];
  nextBestActions: OSNextBestAction[];
  commandCards: OSCommandCard[];
  specializedAgents: OSSpecializedAgent[];
  experienceBoundaries: OSExperienceBoundary[];
  executionLayers: OSExecutionLayer[];
  growthExecution: GrowthExecutionSnapshot;
  audit: string[];
}
