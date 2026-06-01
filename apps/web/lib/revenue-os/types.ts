export const REVENUE_PIPELINE_STAGES = [
  "New Lead",
  "AI Queued",
  "Outreach Scheduled",
  "Email Sent",
  "Awaiting Response",
  "Follow-Up #1",
  "Follow-Up #2",
  "Follow-Up #3",
  "Replied",
  "Interested",
  "Intake Started",
  "Intake Completed",
  "Proposal Sent",
  "Negotiation",
  "Closed Won",
  "Closed Lost",
  "Future Opportunity",
  "Do Not Contact",
] as const;

export type RevenuePipelineStage = (typeof REVENUE_PIPELINE_STAGES)[number];
export type RevenueTone = "good" | "watch" | "danger" | "neutral";

export type RevenueMetric = {
  key: string;
  label: string;
  value: string;
  detail: string;
  tone: RevenueTone;
};

export type RevenueTeamPerformance = {
  senderKey: "jason" | "heather" | "josh" | "chelsi";
  name: string;
  email: string;
  role: string;
  emailsSent: number;
  followUpsSent: number;
  repliesReceived: number;
  positiveReplies: number;
  responseRate: number;
  conversionRate: number;
  nextAction: string;
  tone: RevenueTone;
};

export type RevenuePipelineStageSummary = {
  stage: RevenuePipelineStage;
  count: number;
  estimatedValueCents: number;
  attentionCount: number;
};

export type RevenuePriorityAction = {
  id: string;
  title: string;
  leadName: string;
  organizationName: string;
  businessLine: string;
  stage: RevenuePipelineStage;
  owner: string;
  dueLabel: string;
  score: number;
  channel: string;
  nextAction: string;
  reason: string;
  href: string;
  tone: RevenueTone;
};

export type RevenueTomorrowQueueItem = {
  id: string;
  title: string;
  audience: string;
  owner: string;
  campaignType: string;
  scheduledFor: string;
  angle: string;
  readiness: string;
  href: string;
};

export type RevenueStrategyRecommendation = {
  id: string;
  title: string;
  detail: string;
  recommendation: string;
  impact: string;
  confidence: number;
  tone: RevenueTone;
};

export type RevenueCampaignPerformance = {
  id: string;
  label: string;
  sends: number;
  replies: number;
  positiveReplies: number;
  replyRate: number;
  conversionRate: number;
  bestSubject: string;
  bestCta: string;
  nextAction: string;
  tone: RevenueTone;
};

export type RevenueHealthGuardrail = {
  label: string;
  value: string;
  detail: string;
  tone: RevenueTone;
};

export type DailyRevenueCommandCenterData = {
  generatedAt: string;
  todayMetrics: RevenueMetric[];
  teamPerformance: RevenueTeamPerformance[];
  pipeline: RevenuePipelineStageSummary[];
  priorityActions: RevenuePriorityAction[];
  tomorrowQueue: RevenueTomorrowQueueItem[];
  strategyRecommendations: RevenueStrategyRecommendation[];
  campaignPerformance: RevenueCampaignPerformance[];
  guardrails: RevenueHealthGuardrail[];
  sourceErrors: string[];
};
