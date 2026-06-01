export type GrowthEngineStatus =
  | "connected"
  | "ready"
  | "needs_config"
  | "manual_review"
  | "blocked";

export type GrowthEnginePriority = "high" | "medium" | "low";

export type BuyerIntent = "high" | "medium" | "low";

export type GrowthEngineSection = {
  id: string;
  title: string;
  description: string;
  owner: string;
  status: GrowthEngineStatus;
  connectedSystems: string[];
  primaryAction: {
    label: string;
    href: string;
  };
  secondaryAction?: {
    label: string;
    href: string;
  };
  metrics: string[];
  safeguards: string[];
};

export type GrowthEngineConnection = {
  from: string;
  to: string;
  handoff: string;
  guardrail: string;
};

export type GrowthEngineBlueprint = {
  title: string;
  summary: string;
  principle: string;
  flow: string[];
  connections: GrowthEngineConnection[];
  protectedFlows: string[];
  internalApproval: {
    status: "approved_for_additive_mvp" | "needs_review";
    reason: string;
  };
};

export type RevenuePagePlan = {
  rank: number;
  title: string;
  slug: string;
  pageType: "local" | "service" | "political" | "comparison" | "calculator";
  serviceOffering: string;
  primaryKeyword: string;
  supportingKeywords: string[];
  searchIntent: string;
  buyerIntent: BuyerIntent;
  revenuePotential: GrowthEnginePriority;
  conversionLikelihood: GrowthEnginePriority;
  targetAudience: string;
  contentAngle: string;
  offerAngle: string;
  ctaRecommendation: string;
  expectedRevenueValue: string;
  whyItMatters: string;
  internalLinks: Array<{
    label: string;
    href: string;
  }>;
  socialRepurposing: string[];
  status: "blueprint" | "ready_to_draft" | "needs_source";
};

export type ReviewQueueBlueprintItem = {
  id: string;
  contentType: string;
  title: string;
  channel: string;
  status: "Draft" | "Needs Review" | "Approved" | "Rejected" | "Scheduled";
  createdBy: string;
  targetAudience: string;
  sourceSystem: string;
  nextAction: string;
};

export type IntegrationRequirement = {
  vendor: string;
  purpose: string;
  mode: "prepared" | "needs_api_key" | "needs_vendor_setup";
  envVars: string[];
  workflow: string[];
  sourceUrl: string;
  notes: string;
};

export type AgentDefinition = {
  name: string;
  job: string;
  inputs: string[];
  outputs: string[];
  guardrails: string[];
};

export type CtaAuditItem = {
  location: string;
  label: string;
  expectedBehavior: string;
  currentConnection: string;
  status: "connected" | "needs_manual_qa" | "needs_backend_connection";
  priority: GrowthEnginePriority;
  revenueImpact: GrowthEnginePriority;
};

export type RevenuePathStep = {
  step: string;
  system: string;
  expectedSignal: string;
  guardrail: string;
};
