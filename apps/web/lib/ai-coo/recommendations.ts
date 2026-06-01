import type { User } from "@supabase/supabase-js";
import {
  applyBusinessMemoryToRecommendationSeeds,
  loadBusinessMemorySignals,
} from "@/lib/business-memory/memory";
import { ensureAdTechForAll, ensureAdTechForClient } from "@/lib/ad-tech/engine";
import { ensureCostControlForAll, ensureCostControlForClient } from "@/lib/cost-control/engine";
import { ensureGrowthIntelligenceForAll, ensureGrowthIntelligenceForClient } from "@/lib/growth-intelligence/engine";
import { ensureReputationForAll, ensureReputationForClient } from "@/lib/reputation/engine";
import type { createServiceClient } from "@/lib/supabase/service";
import { formatUsdCents, isAiCooEnabled, isAiCooRecommendationsEnabled, isAiCooScoresEnabled } from "./config";

type ServiceClient = ReturnType<typeof createServiceClient>;
type Db = ReturnType<typeof createServiceClient> & {
  from(table: string): any;
};

export type AiCooCategory =
  | "revenue"
  | "cost_savings"
  | "reputation"
  | "growth"
  | "risk"
  | "renewal"
  | "upsell";

export type AiCooStatus =
  | "new"
  | "reviewed"
  | "approved"
  | "in_progress"
  | "completed"
  | "dismissed"
  | "expired";

export type AiCooRecommendationRow = {
  id: string;
  client_id: string | null;
  client_email: string | null;
  client_name: string | null;
  business_name: string | null;
  category: AiCooCategory;
  opportunity_type: string;
  title: string;
  estimated_value_cents: number;
  estimated_savings_cents: number;
  estimated_impact_label: string | null;
  why_it_matters: string;
  recommended_action: string;
  priority_score: number;
  value_score: number;
  confidence_score: number;
  urgency_score: number;
  confidence_level: "low" | "medium" | "high";
  risk_level: "low" | "medium" | "high" | "critical" | null;
  status: AiCooStatus;
  related_entity_type: string | null;
  related_entity_id: string | null;
  action_labels: string[] | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type AiCooDraftRow = {
  id: string;
  recommendation_id: string;
  draft_type: string;
  label: string;
  content: string;
  approval_status: string;
  copy_count: number;
};

export type ClientSuccessScoreRow = {
  id: string;
  client_id: string | null;
  client_email: string | null;
  score: number;
  color: "green" | "yellow" | "red";
  campaign_activity_score: number;
  opportunity_acceptance_score: number;
  task_completion_score: number;
  reporting_compliance_score: number;
  recommended_next_action: string;
  components: Record<string, unknown> | null;
  calculated_at: string;
};

export type AiCooCommandCenterData = {
  enabled: boolean;
  safeMode: boolean;
  message?: string;
  recommendations: AiCooRecommendationRow[];
  draftsByRecommendation: Record<string, AiCooDraftRow[]>;
  score: ClientSuccessScoreRow | null;
};

export type AiCooAdminQueueData = {
  enabled: boolean;
  safeMode: boolean;
  message?: string;
  recommendations: AiCooRecommendationRow[];
  draftsByRecommendation: Record<string, AiCooDraftRow[]>;
  metrics: AiCooQueueMetrics;
};

type AiCooQueueMetrics = {
  revenueFound: number;
  revenueApproved: number;
  revenueCompleted: number;
  estimatedRevenueValueCents: number;
  costSavingsFound: number;
  costSavingsApproved: number;
  estimatedSavingsCents: number;
  reputationOpportunities: number;
  growthOpportunities: number;
  dismissedOpportunities: number;
  acceptanceRate: number;
};

type RecommendationSeed = {
  clientId: string | null;
  clientEmail: string | null;
  clientName: string | null;
  businessName: string | null;
  category: AiCooCategory;
  opportunityType: string;
  title: string;
  estimatedValueCents?: number;
  estimatedSavingsCents?: number;
  estimatedImpactLabel?: string;
  whyItMatters: string;
  recommendedAction: string;
  confidenceScore: number;
  urgencyScore: number;
  valueScore: number;
  riskLevel?: "low" | "medium" | "high" | "critical";
  relatedEntityType?: string;
  relatedEntityId?: string;
  actionLabels?: string[];
  metadata?: Record<string, unknown>;
};

type MarketContext = {
  leads: any[];
  campaigns: any[];
  locations: any[];
  tasks: any[];
  assets: any[];
  approvals: any[];
  reports: any[];
  readiness: any[];
  adTechDrafts: any[];
  adTechLaunchPackages: any[];
  adTechApprovals: any[];
  adTechValidations: any[];
  adTechReportingImports: any[];
  adTechAttribution: any[];
  savings: any[];
  costControlOpportunities: any[];
  reputationOpportunities: any[];
  growthIntelligenceOpportunities: any[];
  operationalAlerts: any[];
};

const ACTIVE_STATUSES = new Set(["new", "reviewed", "approved", "in_progress"]);
const CLIENT_FEED_STATUSES = ["new", "reviewed", "approved", "in_progress"];
const TOP_FEED_LIMIT = 10;

function asDb(supabase: ServiceClient): Db {
  return supabase as Db;
}

function normalizeEmail(email: string | null | undefined) {
  return String(email ?? "").trim().toLowerCase();
}

function firstNonEmpty(...values: Array<unknown>) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function numberValue(value: unknown, fallback = 0) {
  const numeric = typeof value === "string" ? Number(value) : value;
  return typeof numeric === "number" && Number.isFinite(numeric) ? numeric : fallback;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function priorityScore(seed: RecommendationSeed) {
  return clampScore(seed.valueScore * 0.4 + seed.urgencyScore * 0.35 + seed.confidenceScore * 0.25);
}

function confidenceLevel(score: number): "low" | "medium" | "high" {
  if (score >= 80) return "high";
  if (score >= 55) return "medium";
  return "low";
}

function dueIn(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function activeActionLabels(category: AiCooCategory) {
  const byCategory: Record<AiCooCategory, string[]> = {
    revenue: ["Launch", "Review", "Create Proposal", "Assign Task", "Dismiss"],
    cost_savings: ["Review Savings", "Assign Task", "Dismiss"],
    reputation: ["Launch Campaign", "Create Draft", "Assign Task", "Dismiss"],
    growth: ["Launch", "Review", "Assign", "Dismiss"],
    risk: ["Fix", "Assign", "Dismiss"],
    renewal: ["Review", "Create Proposal", "Assign Task", "Dismiss"],
    upsell: ["Review", "Create Proposal", "Assign Task", "Dismiss"],
  };
  return byCategory[category];
}

function displayCategory(category: AiCooCategory) {
  const labels: Record<AiCooCategory, string> = {
    revenue: "Revenue",
    cost_savings: "Cost Savings",
    reputation: "Reputation",
    growth: "Growth",
    risk: "Risk",
    renewal: "Renewal",
    upsell: "Upsell",
  };
  return labels[category];
}

function clientKey(input: { clientId?: string | null; clientEmail?: string | null }) {
  return input.clientId || normalizeEmail(input.clientEmail) || "unknown";
}

function relatedKey(seed: RecommendationSeed) {
  return [
    clientKey({ clientId: seed.clientId, clientEmail: seed.clientEmail }),
    seed.category,
    seed.opportunityType,
    seed.relatedEntityType ?? "",
    seed.relatedEntityId ?? "",
  ].join("|");
}

function mergeById(rows: any[]) {
  const map = new Map<string, any>();
  for (const row of rows) {
    if (row?.id) map.set(row.id, row);
  }
  return Array.from(map.values());
}

async function safeRows(label: string, query: PromiseLike<{ data: any[] | null; error: any }>) {
  const { data, error } = await query;
  if (error) {
    const message = `${label}: ${error.message ?? "query failed"}`;
    if (/does not exist|schema cache|relation/i.test(message)) return [];
    throw new Error(message);
  }
  return data ?? [];
}

async function safeSingle(label: string, query: PromiseLike<{ data: any | null; error: any }>) {
  const { data, error } = await query;
  if (error) {
    const message = `${label}: ${error.message ?? "query failed"}`;
    if (/does not exist|schema cache|relation|multiple rows/i.test(message)) return null;
    throw new Error(message);
  }
  return data ?? null;
}

async function loadMarketContext({
  supabase,
  clientId,
  clientEmail,
  adminMode = false,
}: {
  supabase: ServiceClient;
  clientId?: string | null;
  clientEmail?: string | null;
  adminMode?: boolean;
}): Promise<MarketContext> {
  const db = asDb(supabase);
  const normalizedEmail = normalizeEmail(clientEmail);
  const leadQueries: Array<Promise<any[]>> = [];

  if (adminMode) {
    leadQueries.push(
      safeRows(
        "Market Capture leads",
        db.from("market_capture_leads").select("*").order("updated_at", { ascending: false }).limit(300),
      ),
    );
  } else {
    if (clientId) {
      leadQueries.push(
        safeRows(
          "Market Capture leads by client",
          db.from("market_capture_leads").select("*").eq("client_id", clientId).order("updated_at", { ascending: false }).limit(100),
        ),
      );
    }
    if (normalizedEmail) {
      leadQueries.push(
        safeRows(
          "Market Capture leads by email",
          db.from("market_capture_leads").select("*").ilike("email", normalizedEmail).order("updated_at", { ascending: false }).limit(100),
        ),
      );
    }
  }

  const leads = mergeById((await Promise.all(leadQueries)).flat());
  const leadIds = leads.map((lead) => lead.id).filter(Boolean);

  const campaignQueries: Array<Promise<any[]>> = [];
  if (adminMode) {
    campaignQueries.push(
      safeRows(
        "Market Capture campaigns",
        db.from("market_capture_campaigns").select("*").order("updated_at", { ascending: false }).limit(300),
      ),
    );
  } else {
    if (clientId) {
      campaignQueries.push(
        safeRows(
          "Market Capture campaigns by client",
          db.from("market_capture_campaigns").select("*").eq("client_id", clientId).order("updated_at", { ascending: false }).limit(100),
        ),
      );
    }
    if (leadIds.length > 0) {
      campaignQueries.push(
        safeRows(
          "Market Capture campaigns by lead",
          db.from("market_capture_campaigns").select("*").in("market_capture_lead_id", leadIds).order("updated_at", { ascending: false }).limit(100),
        ),
      );
    }
  }

  const campaigns = mergeById((await Promise.all(campaignQueries)).flat());
  const campaignIds = campaigns.map((campaign) => campaign.id).filter(Boolean);
  const allLeadIds = Array.from(new Set([...leadIds, ...campaigns.map((campaign) => campaign.market_capture_lead_id).filter(Boolean)]));

  const [
    locations,
    tasks,
    assets,
    approvals,
    reports,
    readiness,
    adTechDrafts,
    adTechLaunchPackages,
    adTechApprovals,
    adTechValidations,
    adTechReportingImports,
    adTechAttribution,
    savings,
    costControlOpportunities,
    reputationOpportunities,
    growthIntelligenceOpportunities,
    operationalAlerts,
  ] = await Promise.all([
    campaignIds.length
      ? safeRows("Market Capture locations", db.from("market_capture_campaign_locations").select("*").in("campaign_id", campaignIds).limit(500))
      : Promise.resolve([]),
    allLeadIds.length
      ? safeRows("Market Capture tasks", db.from("market_capture_tasks").select("*").in("market_capture_lead_id", allLeadIds).limit(800))
      : Promise.resolve([]),
    allLeadIds.length
      ? safeRows("Market Capture assets", db.from("market_capture_assets").select("*").in("market_capture_lead_id", allLeadIds).limit(500))
      : Promise.resolve([]),
    campaignIds.length
      ? safeRows("Market Capture approvals", db.from("market_capture_approvals").select("*").in("campaign_id", campaignIds).limit(500))
      : Promise.resolve([]),
    campaignIds.length
      ? safeRows("Market Capture reports", db.from("market_capture_reports").select("*").in("campaign_id", campaignIds).order("created_at", { ascending: false }).limit(500))
      : Promise.resolve([]),
    campaignIds.length
      ? safeRows("Market Capture readiness", db.from("market_capture_launch_readiness").select("*").in("campaign_id", campaignIds).limit(500))
      : Promise.resolve([]),
    campaignIds.length
      ? safeRows("Ad-Tech drafts", db.from("campaign_drafts").select("*").in("market_capture_campaign_id", campaignIds).limit(800))
      : Promise.resolve([]),
    campaignIds.length
      ? safeRows("Ad-Tech launch packages", db.from("campaign_launch_packages").select("*").in("market_capture_campaign_id", campaignIds).limit(500))
      : Promise.resolve([]),
    campaignIds.length
      ? safeRows("Ad-Tech approvals", db.from("campaign_approvals").select("*").in("market_capture_campaign_id", campaignIds).limit(500))
      : Promise.resolve([]),
    campaignIds.length
      ? safeRows("Ad-Tech target validation", db.from("campaign_target_validation").select("*").in("market_capture_campaign_id", campaignIds).limit(500))
      : Promise.resolve([]),
    campaignIds.length
      ? safeRows("Ad-Tech reporting imports", db.from("campaign_reporting_imports").select("*").in("market_capture_campaign_id", campaignIds).order("created_at", { ascending: false }).limit(500))
      : Promise.resolve([]),
    campaignIds.length
      ? safeRows("Ad-Tech attribution", db.from("campaign_attribution").select("*").in("market_capture_campaign_id", campaignIds).order("created_at", { ascending: false }).limit(500))
      : Promise.resolve([]),
    clientId || adminMode
      ? safeRows(
          "Operations Copilot savings",
          adminMode
            ? db.from("opcopilot_savings_recommendations").select("*").order("created_at", { ascending: false }).limit(100)
            : db.from("opcopilot_savings_recommendations").select("*").eq("user_id", clientId).order("created_at", { ascending: false }).limit(50),
        )
      : Promise.resolve([]),
    clientId || adminMode
      ? safeRows(
          "Cost Control opportunities",
          adminMode
            ? db.from("cost_control_opportunities").select("*").order("priority_score", { ascending: false }).limit(150)
            : db.from("cost_control_opportunities").select("*").eq("client_id", clientId).order("priority_score", { ascending: false }).limit(80),
        )
      : Promise.resolve([]),
    clientId || adminMode
      ? safeRows(
          "Reputation opportunities",
          adminMode
            ? db.from("reputation_opportunities").select("*").order("priority_score", { ascending: false }).limit(150)
            : db.from("reputation_opportunities").select("*").eq("client_id", clientId).order("priority_score", { ascending: false }).limit(80),
        )
      : Promise.resolve([]),
    clientId || adminMode
      ? safeRows(
          "Growth Intelligence opportunities",
          adminMode
            ? db.from("growth_intelligence_opportunities").select("*").order("priority_score", { ascending: false }).limit(150)
            : db.from("growth_intelligence_opportunities").select("*").eq("client_id", clientId).order("priority_score", { ascending: false }).limit(80),
        )
      : Promise.resolve([]),
    clientId || adminMode
      ? safeRows(
          "Operations Copilot alerts",
          adminMode
            ? db.from("opcopilot_operational_alerts").select("*").order("created_at", { ascending: false }).limit(100)
            : db.from("opcopilot_operational_alerts").select("*").eq("user_id", clientId).order("created_at", { ascending: false }).limit(50),
        )
      : Promise.resolve([]),
  ]);

  return {
    leads,
    campaigns,
    locations,
    tasks,
    assets,
    approvals,
    reports,
    readiness,
    adTechDrafts,
    adTechLaunchPackages,
    adTechApprovals,
    adTechValidations,
    adTechReportingImports,
    adTechAttribution,
    savings,
    costControlOpportunities,
    reputationOpportunities,
    growthIntelligenceOpportunities,
    operationalAlerts,
  };
}

function leadById(context: MarketContext) {
  return new Map(context.leads.map((lead) => [lead.id, lead]));
}

function rowsBy<T extends Record<string, any>>(rows: T[], key: string) {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const value = row[key];
    if (!value) continue;
    const bucket = map.get(value) ?? [];
    bucket.push(row);
    map.set(value, bucket);
  }
  return map;
}

function seedClientFromLead(lead: any, fallback?: { clientId?: string | null; clientEmail?: string | null }) {
  return {
    clientId: lead?.client_id ?? fallback?.clientId ?? null,
    clientEmail: lead?.email ?? fallback?.clientEmail ?? null,
    clientName: lead?.contact_name ?? null,
    businessName: lead?.business_name ?? null,
  };
}

function seedClientFromCampaign(campaign: any, lead: any) {
  return {
    clientId: campaign?.client_id ?? lead?.client_id ?? null,
    clientEmail: lead?.email ?? null,
    clientName: lead?.contact_name ?? null,
    businessName: lead?.business_name ?? campaign?.campaign_name ?? null,
  };
}

function targetLabel(value: string | null | undefined) {
  const label = String(value ?? "").replace(/_/g, " ").trim();
  return label ? label : "local market";
}

function targetArea(lead: any, campaign: any) {
  return firstNonEmpty(campaign?.target_geography, lead?.target_area, "the target area") ?? "the target area";
}

function monthlyManagementValue(lead: any, campaign: any) {
  return numberValue(campaign?.monthly_management_fee, numberValue(lead?.monthly_management_fee, 49900));
}

function monthlyAdBudget(lead: any, campaign: any) {
  return numberValue(campaign?.monthly_ad_budget, numberValue(lead?.monthly_ad_budget, 0));
}

function campaignIsLive(campaign: any) {
  return ["live", "reporting", "renewal_opportunity"].includes(String(campaign?.campaign_status)) || ["live", "manual_launch_complete"].includes(String(campaign?.launch_status));
}

function paymentIsPaid(lead: any, campaign: any) {
  return String(campaign?.payment_status ?? lead?.payment_status ?? "") === "paid";
}

function buildMarketCaptureSeeds(context: MarketContext, fallback?: { clientId?: string | null; clientEmail?: string | null }) {
  const seeds: RecommendationSeed[] = [];
  const leads = leadById(context);
  const assetsByLead = rowsBy(context.assets, "market_capture_lead_id");
  const tasksByLead = rowsBy(context.tasks, "market_capture_lead_id");
  const approvalsByCampaign = rowsBy(context.approvals, "campaign_id");
  const reportsByCampaign = rowsBy(context.reports, "campaign_id");
  const readinessByCampaign = new Map(context.readiness.map((row) => [row.campaign_id, row]));
  const locationsByCampaign = rowsBy(context.locations, "campaign_id");
  const adTechDraftsByCampaign = rowsBy(context.adTechDrafts, "market_capture_campaign_id");
  const adTechPackagesByCampaign = rowsBy(context.adTechLaunchPackages, "market_capture_campaign_id");
  const adTechApprovalsByCampaign = rowsBy(context.adTechApprovals, "market_capture_campaign_id");
  const adTechValidationsByCampaign = rowsBy(context.adTechValidations, "market_capture_campaign_id");
  const adTechReportsByCampaign = rowsBy(context.adTechReportingImports, "market_capture_campaign_id");
  const adTechAttributionByCampaign = rowsBy(context.adTechAttribution, "market_capture_campaign_id");

  for (const lead of context.leads) {
    const client = seedClientFromLead(lead, fallback);
    const type = String(lead.targeting_type ?? "");
    const objective = targetLabel(lead.targeting_objective);
    const area = targetArea(lead, null);

    if (String(lead.payment_status) !== "paid") {
      seeds.push({
        ...client,
        category: "risk",
        opportunityType: "missing_payment",
        title: "Payment is blocking Market Capture setup",
        estimatedValueCents: monthlyManagementValue(lead, null),
        estimatedImpactLabel: `${formatUsdCents(monthlyManagementValue(lead, null))}/mo management revenue at risk`,
        whyItMatters: "The campaign cannot move cleanly into fulfillment until payment is confirmed, which slows launch and revenue recognition.",
        recommendedAction: "Send a payment follow-up, confirm the management fee, and move the opportunity forward after the subscription is active.",
        confidenceScore: 92,
        urgencyScore: 90,
        valueScore: 75,
        riskLevel: "high",
        relatedEntityType: "market_capture_lead",
        relatedEntityId: lead.id,
        metadata: { source: "market_capture_leads", paymentStatus: lead.payment_status },
      });
    }

    if (type.includes("jobsite_halo")) {
      seeds.push({
        ...client,
        category: "revenue",
        opportunityType: "jobsite_halo_campaign",
        title: "Turn this jobsite into a neighborhood revenue opportunity",
        estimatedValueCents: Math.max(monthlyManagementValue(lead, null), monthlyAdBudget(lead, null) * 2),
        estimatedImpactLabel: "Estimated local visibility opportunity",
        whyItMatters: `The request already points to a jobsite halo around ${area}. That is a focused way to stay visible near homeowners who saw the work happen.`,
        recommendedAction: "Review the target area, confirm the offer, and prepare the launch plan for approval.",
        confidenceScore: 78,
        urgencyScore: 68,
        valueScore: 72,
        relatedEntityType: "market_capture_lead",
        relatedEntityId: lead.id,
        metadata: { objective, targetingType: type, targetArea: area },
      });
    }

    if (type.includes("competitor_area")) {
      seeds.push({
        ...client,
        category: "growth",
        opportunityType: "competitor_area_campaign",
        title: "Competitor-area visibility plan is ready for review",
        estimatedValueCents: Math.max(monthlyManagementValue(lead, null), monthlyAdBudget(lead, null)),
        estimatedImpactLabel: "Market capture opportunity",
        whyItMatters: "The client asked to show up around competitor areas. This can create repeated visibility without using prohibited or individual-level targeting.",
        recommendedAction: "Confirm allowed geography, keep the messaging neutral, and build the approval-ready campaign plan.",
        confidenceScore: 72,
        urgencyScore: 60,
        valueScore: 67,
        relatedEntityType: "market_capture_lead",
        relatedEntityId: lead.id,
        metadata: { targetingType: type, targetArea: area },
      });
    }

    if (type.includes("political_geography")) {
      seeds.push({
        ...client,
        category: "growth",
        opportunityType: "political_campaign_expansion",
        title: "Political geography awareness campaign needs neutral planning",
        estimatedValueCents: Math.max(monthlyManagementValue(lead, null), monthlyAdBudget(lead, null)),
        estimatedImpactLabel: "Campaign awareness opportunity",
        whyItMatters: "The request can be handled with geography-based awareness planning, but it must avoid ideology prediction, voter scoring, or sensitive individual targeting.",
        recommendedAction: "Review district, county, city, ZIP, or campaign-provided geography and prepare a compliant awareness plan.",
        confidenceScore: 70,
        urgencyScore: 62,
        valueScore: 64,
        relatedEntityType: "market_capture_lead",
        relatedEntityId: lead.id,
        metadata: { compliance: "geography_based_only", targetingType: type },
      });
    }
  }

  for (const campaign of context.campaigns) {
    const lead = leads.get(campaign.market_capture_lead_id);
    const client = seedClientFromCampaign(campaign, lead);
    const campaignId = campaign.id;
    const readiness = readinessByCampaign.get(campaignId);
    const score = numberValue(readiness?.readiness_score, 0);
    const area = targetArea(lead, campaign);
    const assets = assetsByLead.get(campaign.market_capture_lead_id) ?? [];
    const approvals = approvalsByCampaign.get(campaignId) ?? [];
    const reports = reportsByCampaign.get(campaignId) ?? [];
    const adTechDrafts = adTechDraftsByCampaign.get(campaignId) ?? [];
    const adTechPackages = adTechPackagesByCampaign.get(campaignId) ?? [];
    const adTechApprovals = adTechApprovalsByCampaign.get(campaignId) ?? [];
    const adTechValidations = adTechValidationsByCampaign.get(campaignId) ?? [];
    const adTechReports = adTechReportsByCampaign.get(campaignId) ?? [];
    const adTechAttribution = adTechAttributionByCampaign.get(campaignId) ?? [];
    const locations = locationsByCampaign.get(campaignId) ?? [];
    const tasks = tasksByLead.get(campaign.market_capture_lead_id) ?? [];
    const openTasks = tasks.filter((task) => !["completed", "cancelled"].includes(String(task.status)));

    if (!paymentIsPaid(lead, campaign)) {
      seeds.push({
        ...client,
        category: "risk",
        opportunityType: "missing_payment",
        title: "Payment is still blocking fulfillment",
        estimatedValueCents: monthlyManagementValue(lead, campaign),
        estimatedImpactLabel: `${formatUsdCents(monthlyManagementValue(lead, campaign))}/mo management revenue at risk`,
        whyItMatters: "Fulfillment activity should not outrun payment confirmation. This is the next blocker to remove.",
        recommendedAction: "Confirm the management subscription or assign a payment follow-up before launch work continues.",
        confidenceScore: 94,
        urgencyScore: 92,
        valueScore: 78,
        riskLevel: "high",
        relatedEntityType: "market_capture_campaign",
        relatedEntityId: campaignId,
        metadata: { paymentStatus: campaign.payment_status },
      });
    }

    if (assets.length === 0 || ["missing", "rejected"].includes(String(campaign.creative_status))) {
      seeds.push({
        ...client,
        category: "risk",
        opportunityType: "missing_assets",
        title: "Creative assets are slowing launch readiness",
        estimatedValueCents: monthlyManagementValue(lead, campaign),
        estimatedImpactLabel: "Launch readiness blocker",
        whyItMatters: "The campaign cannot look professional or move toward approval without logo, images, offer, and creative review.",
        recommendedAction: "Request missing logo/photos/offer details and assign asset review.",
        confidenceScore: 90,
        urgencyScore: 78,
        valueScore: 58,
        riskLevel: "medium",
        relatedEntityType: "market_capture_campaign",
        relatedEntityId: campaignId,
        metadata: { creativeStatus: campaign.creative_status, assetCount: assets.length },
      });
    }

    if (["awaiting_approval", "needs_revision", "rejected"].includes(String(campaign.approval_status))) {
      seeds.push({
        ...client,
        category: "risk",
        opportunityType: "approval_delay",
        title: "Client approval is the next launch blocker",
        estimatedValueCents: monthlyManagementValue(lead, campaign),
        estimatedImpactLabel: "Approval delay risk",
        whyItMatters: "A campaign that is waiting on review can stall even when the plan is otherwise ready.",
        recommendedAction: "Send the approval reminder, capture change requests, and mark the next review owner.",
        confidenceScore: 86,
        urgencyScore: 75,
        valueScore: 55,
        riskLevel: String(campaign.approval_status) === "rejected" ? "high" : "medium",
        relatedEntityType: "market_capture_campaign",
        relatedEntityId: campaignId,
        metadata: { approvalStatus: campaign.approval_status, approvalCount: approvals.length },
      });
    }

    if (score >= 85 && !campaignIsLive(campaign)) {
      seeds.push({
        ...client,
        category: "revenue",
        opportunityType: "campaign_launch_readiness",
        title: "Market Capture campaign is close to launch-ready",
        estimatedValueCents: Math.max(monthlyManagementValue(lead, campaign), monthlyAdBudget(lead, campaign)),
        estimatedImpactLabel: `${score}% launch readiness`,
        whyItMatters: "Most blockers are cleared. Finishing the remaining items helps convert the sale into active market presence.",
        recommendedAction: "Review missing readiness items, confirm approval, and prepare the manual launch workflow.",
        confidenceScore: 88,
        urgencyScore: 76,
        valueScore: 72,
        relatedEntityType: "market_capture_campaign",
        relatedEntityId: campaignId,
        metadata: { readinessScore: score, missingItems: readiness?.missing_items ?? [] },
      });
    }

    const topLaunchPackage = adTechPackages
      .slice()
      .sort((a, b) => numberValue(b.readiness_score) - numberValue(a.readiness_score))[0];
    const launchPackageScore = numberValue(topLaunchPackage?.readiness_score, 0);
    const blockedTargetCount = adTechValidations.filter((row) => ["warning", "invalid"].includes(String(row.status))).length;
    const pendingAdTechApprovals = adTechApprovals.filter((row) => ["awaiting_approval", "needs_revision"].includes(String(row.status))).length;

    if (topLaunchPackage && launchPackageScore >= 80 && !campaignIsLive(campaign)) {
      seeds.push({
        ...client,
        category: "revenue",
        opportunityType: "launch_package_ready_for_approval",
        title: "Campaign launch package is ready for human review",
        estimatedValueCents: Math.max(monthlyManagementValue(lead, campaign), monthlyAdBudget(lead, campaign)),
        estimatedImpactLabel: `${launchPackageScore}% launch readiness`,
        whyItMatters: "The draft plan, targeting checks, creative notes, and tracking package are assembled. Human approval is the next step before any manual platform launch.",
        recommendedAction: "Review the launch package, resolve missing items, and mark it ready only after payment, target area, creative, and budget are approved.",
        confidenceScore: 86,
        urgencyScore: 78,
        valueScore: 74,
        relatedEntityType: "campaign_launch_package",
        relatedEntityId: topLaunchPackage.id,
        metadata: {
          source: "ad_tech_integration_layer",
          readinessScore: launchPackageScore,
          pendingAdTechApprovals,
          draftCount: adTechDrafts.length,
          noAutoLaunch: true,
        },
      });
    }

    if (blockedTargetCount > 0) {
      seeds.push({
        ...client,
        category: "risk",
        opportunityType: "target_area_validation_warning",
        title: "Target area needs validation before launch",
        estimatedValueCents: monthlyManagementValue(lead, campaign),
        estimatedImpactLabel: `${blockedTargetCount} target check${blockedTargetCount === 1 ? "" : "s"} need review`,
        whyItMatters: "Invalid or unclear geography can waste launch prep and create client confusion. Clean targeting protects the campaign plan before money is spent.",
        recommendedAction: "Review the address, ZIP, radius, and duplicate warnings in the launch package before approving the campaign.",
        confidenceScore: 88,
        urgencyScore: 82,
        valueScore: 62,
        riskLevel: "high",
        relatedEntityType: "market_capture_campaign",
        relatedEntityId: campaignId,
        metadata: {
          source: "campaign_target_validation",
          blockedTargetCount,
          validationStatuses: adTechValidations.map((row) => row.status),
        },
      });
    }

    const latestImport = adTechReports[0];
    if (latestImport) {
      const importedClicks = numberValue(latestImport.clicks);
      const importedLeads = numberValue(latestImport.leads);
      const importedSpend = numberValue(latestImport.spend);
      if (importedClicks >= 25 && importedLeads === 0) {
        seeds.push({
          ...client,
          category: "growth",
          opportunityType: "campaign_reporting_optimization",
          title: "Campaign traffic needs a clearer next step",
          estimatedValueCents: monthlyManagementValue(lead, campaign),
          estimatedImpactLabel: `${importedClicks.toLocaleString()} clicks, no leads recorded`,
          whyItMatters: "Imported reporting shows interest, but no lead result is recorded. The next improvement should focus on the offer, landing page, or follow-up path.",
          recommendedAction: "Review the latest metrics, inspect the landing page and tracking link, and prepare one plain-language optimization recommendation for approval.",
          confidenceScore: 74,
          urgencyScore: 68,
          valueScore: 64,
          relatedEntityType: "campaign_reporting_import",
          relatedEntityId: latestImport.id,
          metadata: {
            source: "campaign_reporting_imports",
            importedClicks,
            importedLeads,
            importedSpend,
            attributionCount: adTechAttribution.length,
            attributionIsNotCertain: true,
          },
        });
      }
    } else if (campaignIsLive(campaign)) {
      seeds.push({
        ...client,
        category: "risk",
        opportunityType: "reporting_import_needed",
        title: "Campaign performance needs reporting data",
        estimatedValueCents: monthlyManagementValue(lead, campaign),
        estimatedImpactLabel: "Reporting gap",
        whyItMatters: "The campaign is marked live, but the Ad-Tech reporting layer has no imported or manually entered metrics yet. That makes renewal and optimization harder.",
        recommendedAction: "Enter the latest manual metrics or attach a future platform import before preparing the client summary.",
        confidenceScore: 80,
        urgencyScore: 70,
        valueScore: 58,
        riskLevel: "medium",
        relatedEntityType: "market_capture_campaign",
        relatedEntityId: campaignId,
        metadata: { source: "campaign_reporting_imports", reportingImportCount: 0 },
      });
    }

    if (campaignIsLive(campaign) && String(campaign.direct_mail_status) === "not_requested") {
      seeds.push({
        ...client,
        category: "upsell",
        opportunityType: "direct_mail_expansion",
        title: "Pair digital visibility with postcards in the same area",
        estimatedValueCents: 150000,
        estimatedImpactLabel: "Direct mail add-on opportunity",
        whyItMatters: `The campaign is already focused on ${area}. Matching postcards can create repeated exposure in the same neighborhoods without changing the core campaign.`,
        recommendedAction: "Create a simple direct mail add-on proposal for the same target area.",
        confidenceScore: 76,
        urgencyScore: 55,
        valueScore: 70,
        relatedEntityType: "market_capture_campaign",
        relatedEntityId: campaignId,
        metadata: { directMailStatus: campaign.direct_mail_status, targetArea: area },
      });
    }

    const reputationEngineHasReview = context.reputationOpportunities.some(
      (row) =>
        row.source_table === "market_capture_campaigns" &&
        row.source_id === campaignId &&
        row.opportunity_group === "review",
    );

    if (campaignIsLive(campaign) && !reputationEngineHasReview) {
      seeds.push({
        ...client,
        category: "reputation",
        opportunityType: "review_request_opportunity",
        title: "Ask recent customers for reviews while visibility is active",
        estimatedImpactLabel: "Trust and close-rate lift",
        whyItMatters: "Local visibility works better when homeowners see proof that the business is trusted and active.",
        recommendedAction: "Create a review request draft and send only after the client approves the message and recipient list.",
        confidenceScore: 70,
        urgencyScore: 50,
        valueScore: 52,
        relatedEntityType: "market_capture_campaign",
        relatedEntityId: campaignId,
        metadata: { status: campaign.campaign_status },
      });
    }

    if (campaignIsLive(campaign) && locations.length <= 1) {
      seeds.push({
        ...client,
        category: "growth",
        opportunityType: "additional_geography_opportunity",
        title: "Add one adjacent neighborhood to expand reach",
        estimatedValueCents: Math.max(monthlyManagementValue(lead, campaign), Math.round(monthlyAdBudget(lead, campaign) * 1.5)),
        estimatedImpactLabel: "Expansion opportunity",
        whyItMatters: "The current campaign has a focused geography. A nearby market can be proposed after reviewing performance and budget.",
        recommendedAction: "Review campaign results, choose one adjacent service area, and create an expansion proposal.",
        confidenceScore: 66,
        urgencyScore: 45,
        valueScore: 62,
        relatedEntityType: "market_capture_campaign",
        relatedEntityId: campaignId,
        metadata: { locationCount: locations.length, targetArea: area },
      });
    }

    if (campaignIsLive(campaign) && (reports.length === 0 || String(campaign.reporting_status) === "due")) {
      seeds.push({
        ...client,
        category: "risk",
        opportunityType: "reporting_overdue",
        title: "Reporting needs attention before trust erodes",
        estimatedValueCents: monthlyManagementValue(lead, campaign),
        estimatedImpactLabel: "Retention risk",
        whyItMatters: "Clients need to understand what happened, why it matters, and what should happen next. Missing reports can create renewal risk.",
        recommendedAction: "Enter available metrics, add plain-language notes, and send the monthly summary for approval.",
        confidenceScore: 84,
        urgencyScore: 72,
        valueScore: 60,
        riskLevel: "medium",
        relatedEntityType: "market_capture_campaign",
        relatedEntityId: campaignId,
        metadata: { reportCount: reports.length, reportingStatus: campaign.reporting_status },
      });
    }

    if (["reporting", "renewal_opportunity"].includes(String(campaign.campaign_status)) || (campaignIsLive(campaign) && openTasks.length <= 2)) {
      seeds.push({
        ...client,
        category: "renewal",
        opportunityType: "renewal_opportunity",
        title: "Renewal conversation is ready",
        estimatedValueCents: monthlyManagementValue(lead, campaign),
        estimatedImpactLabel: `${formatUsdCents(monthlyManagementValue(lead, campaign))}/mo recurring revenue`,
        whyItMatters: "The campaign has enough activity to discuss next steps, report value clearly, and protect the recurring management relationship.",
        recommendedAction: "Prepare a renewal note with results, open items, and one recommended improvement.",
        confidenceScore: 72,
        urgencyScore: 58,
        valueScore: 68,
        relatedEntityType: "market_capture_campaign",
        relatedEntityId: campaignId,
        metadata: { campaignStatus: campaign.campaign_status, openTasks: openTasks.length },
      });
    }
  }

  return seeds;
}

function buildCostSavingsSeeds(context: MarketContext, fallback?: { clientId?: string | null; clientEmail?: string | null }) {
  const seeds: RecommendationSeed[] = [];
  const costControlSources = new Set(
    context.costControlOpportunities
      .map((row) => `${row.source_table ?? ""}|${row.source_id ?? ""}`)
      .filter((value) => value !== "|"),
  );

  for (const row of context.costControlOpportunities) {
    const savings = numberValue(row.estimated_annual_savings_cents, numberValue(row.estimated_savings_cents, 0));
    seeds.push({
      clientId: row.client_id ?? fallback?.clientId ?? null,
      clientEmail: row.client_email ?? fallback?.clientEmail ?? null,
      clientName: null,
      businessName: null,
      category: "cost_savings",
      opportunityType: row.opportunity_type ?? "cost_control_opportunity",
      title: row.title ?? "Cost savings opportunity needs review",
      estimatedSavingsCents: savings,
      estimatedImpactLabel: savings > 0 ? `${formatUsdCents(savings)} estimated annual savings` : "Savings review needed",
      whyItMatters: row.reason ?? "A supplier, category, or recurring expense may deserve review before more margin leaks.",
      recommendedAction: row.recommended_action ?? "Review the savings basis and approve any action before vendor or spend changes.",
      confidenceScore: numberValue(row.confidence_score, 64),
      urgencyScore: ["new_opportunity", "under_review", "pending_decision"].includes(String(row.status)) ? 70 : 48,
      valueScore: savings >= 240000 ? 84 : savings >= 60000 ? 70 : savings > 0 ? 55 : 40,
      relatedEntityType: "cost_control_opportunity",
      relatedEntityId: row.id,
      metadata: {
        status: row.status,
        category: row.category,
        approvalRequired: true,
        noSpendCommitment: true,
        source: "cost_control_engine",
      },
    });
  }

  for (const row of context.savings) {
    if (costControlSources.has(`opcopilot_savings_recommendations|${row.id}`)) continue;
    const savings = numberValue(row.projected_monthly_savings_cents, numberValue(row.estimated_impact_cents, 0));
    const rowClientId = row.user_id ?? fallback?.clientId ?? null;
    seeds.push({
      clientId: rowClientId,
      clientEmail: fallback?.clientEmail ?? null,
      clientName: null,
      businessName: null,
      category: "cost_savings",
      opportunityType: "supplier_savings",
      title: row.title ?? "Supplier savings opportunity needs review",
      estimatedSavingsCents: savings,
      estimatedImpactLabel: savings > 0 ? `${formatUsdCents(savings)}/mo estimated savings` : "Savings review needed",
      whyItMatters: row.summary ?? "Supplier pricing, delivery, or repeat purchase patterns may be creating avoidable operating cost.",
      recommendedAction: "Review the savings basis, confirm assumptions, and ask for human approval before any vendor or spend action.",
      confidenceScore: row.confidence === "high" ? 82 : row.confidence === "low" ? 48 : 66,
      urgencyScore: savings >= 20000 ? 78 : 52,
      valueScore: savings >= 20000 ? 80 : savings > 0 ? 58 : 45,
      relatedEntityType: "opcopilot_savings_recommendation",
      relatedEntityId: row.id,
      metadata: {
        status: row.status,
        difficulty: row.difficulty,
        approvalRequired: true,
        noSpendCommitment: true,
      },
    });
  }

  for (const row of context.operationalAlerts) {
    if (costControlSources.has(`opcopilot_operational_alerts|${row.id}`)) continue;
    const impact = numberValue(row.estimated_impact_cents, 0);
    seeds.push({
      clientId: row.user_id ?? fallback?.clientId ?? null,
      clientEmail: fallback?.clientEmail ?? null,
      clientName: null,
      businessName: null,
      category: "risk",
      opportunityType: "operational_cost_risk",
      title: row.title ?? "Operational cost risk needs review",
      estimatedSavingsCents: impact,
      estimatedImpactLabel: impact > 0 ? `${formatUsdCents(impact)} estimated impact` : "Operational risk",
      whyItMatters: row.detail ?? "A purchasing, delivery, invoice, or vendor issue may be affecting margin or execution.",
      recommendedAction: row.recommended_action ?? "Review the alert and assign a human owner before any spend action.",
      confidenceScore: 68,
      urgencyScore: row.severity === "high" ? 84 : row.severity === "low" ? 45 : 62,
      valueScore: impact > 0 ? 64 : 45,
      riskLevel: row.severity === "high" ? "high" : row.severity === "low" ? "low" : "medium",
      relatedEntityType: "opcopilot_operational_alert",
      relatedEntityId: row.id,
      metadata: { alertType: row.alert_type, status: row.status, noSpendCommitment: true },
    });
  }

  return seeds;
}

function buildReputationSeeds(context: MarketContext, fallback?: { clientId?: string | null; clientEmail?: string | null }) {
  const seeds: RecommendationSeed[] = [];

  for (const row of context.reputationOpportunities) {
    const value = numberValue(row.potential_value_cents, 0);
    seeds.push({
      clientId: row.client_id ?? fallback?.clientId ?? null,
      clientEmail: row.client_email ?? fallback?.clientEmail ?? null,
      clientName: null,
      businessName: null,
      category: "reputation",
      opportunityType: row.opportunity_type ?? "reputation_opportunity",
      title: row.title ?? "Reputation opportunity needs review",
      estimatedValueCents: value,
      estimatedImpactLabel: row.estimated_impact_label ?? (value > 0 ? `${formatUsdCents(value)} potential relationship value` : "Trust opportunity"),
      whyItMatters: row.reason ?? "A review, referral, testimonial, or customer follow-up action can strengthen local trust.",
      recommendedAction: row.recommended_action ?? "Review the opportunity and approve any customer-facing outreach before it is sent.",
      confidenceScore: numberValue(row.confidence_score, 66),
      urgencyScore: ["new_opportunity", "under_review", "assigned", "approved"].includes(String(row.status)) ? 68 : 46,
      valueScore: value >= 100000 ? 72 : value > 0 ? 58 : 50,
      relatedEntityType: "reputation_opportunity",
      relatedEntityId: row.id,
      metadata: {
        status: row.status,
        opportunityGroup: row.opportunity_group,
        approvalRequired: true,
        noOutboundWithoutApproval: true,
        noReviewGating: true,
        source: "reputation_engine",
      },
    });
  }

  return seeds;
}

function buildGrowthIntelligenceSeeds(context: MarketContext, fallback?: { clientId?: string | null; clientEmail?: string | null }) {
  const seeds: RecommendationSeed[] = [];

  for (const row of context.growthIntelligenceOpportunities) {
    const value = numberValue(row.estimated_revenue_potential_cents, 0);
    const businessName = typeof row.metadata?.businessName === "string" ? row.metadata.businessName : null;
    seeds.push({
      clientId: row.client_id ?? fallback?.clientId ?? null,
      clientEmail: row.client_email ?? fallback?.clientEmail ?? null,
      clientName: null,
      businessName,
      category: "growth",
      opportunityType: row.opportunity_type ?? "growth_intelligence_opportunity",
      title: row.title ?? "Growth opportunity needs review",
      estimatedValueCents: value,
      estimatedImpactLabel: value > 0 ? `${formatUsdCents(value)} estimated growth potential` : row.category ?? "Growth opportunity",
      whyItMatters: row.why_it_matters ?? "Growth Intelligence found a geography, timing, campaign, or local-market opportunity worth reviewing.",
      recommendedAction: row.recommended_action ?? "Review the opportunity, confirm fit, and create a proposal or campaign task only after approval.",
      confidenceScore: numberValue(row.confidence_score, 64),
      urgencyScore: ["new_opportunity", "needs_review", "recommended_to_client", "client_approved"].includes(String(row.status)) ? 70 : 48,
      valueScore: value >= 250000 ? 82 : value >= 100000 ? 70 : value > 0 ? 55 : 45,
      relatedEntityType: "growth_intelligence_opportunity",
      relatedEntityId: row.id,
      actionLabels: ["Launch", "Review", "Create Campaign", "Create Proposal", "Assign Task", "Dismiss"],
      metadata: {
        status: row.status,
        category: row.category,
        growthScore: row.growth_score,
        priorityLabel: row.priority_label,
        recommendedCampaignType: row.recommended_campaign_type,
        approvalRequired: true,
        noAutonomousOutreach: true,
        noPaidLaunch: true,
        source: "growth_intelligence_engine",
      },
    });
  }

  return seeds;
}

function buildSeeds(context: MarketContext, fallback?: { clientId?: string | null; clientEmail?: string | null }) {
  const seeds = [
    ...buildMarketCaptureSeeds(context, fallback),
    ...buildCostSavingsSeeds(context, fallback),
    ...buildReputationSeeds(context, fallback),
    ...buildGrowthIntelligenceSeeds(context, fallback),
  ];
  const deduped = new Map<string, RecommendationSeed>();
  for (const seed of seeds) {
    if (!seed.clientId && !seed.clientEmail) continue;
    const key = relatedKey(seed);
    const previous = deduped.get(key);
    if (!previous || priorityScore(seed) > priorityScore(previous)) deduped.set(key, seed);
  }
  return Array.from(deduped.values()).sort((a, b) => priorityScore(b) - priorityScore(a));
}

function draftRowsForSeed(seed: RecommendationSeed, recommendationId: string) {
  const business = seed.businessName ?? "your business";
  const contact = seed.clientName ?? "there";
  const impact = seed.estimatedSavingsCents
    ? `${formatUsdCents(seed.estimatedSavingsCents)} in possible savings`
    : seed.estimatedValueCents
      ? `${formatUsdCents(seed.estimatedValueCents)} in estimated opportunity`
      : seed.estimatedImpactLabel ?? "a useful opportunity";
  const category = displayCategory(seed.category).toLowerCase();
  const complianceLine =
    seed.category === "cost_savings"
      ? "No vendor, order, or spend decision should happen until you approve it."
      : "This is not a guarantee of results; it is a recommended next action for review.";

  const email = `Subject: ${seed.title}\n\nHi ${contact},\n\nHomeReach found a ${category} item for ${business}: ${seed.title}.\n\nWhy it matters: ${seed.whyItMatters}\n\nRecommended next step: ${seed.recommendedAction}\n\nEstimated impact: ${impact}.\n\n${complianceLine}\n\nBest,\nHomeReach`;
  const sms = `Hi ${contact}, HomeReach found a ${category} opportunity for ${business}: ${seed.title}. Recommended next step: ${seed.recommendedAction} Reply STOP to opt out.`;
  const dm = `Quick HomeReach update: ${seed.title}. ${seed.whyItMatters} Next step: ${seed.recommendedAction}`;
  const proposal = `${business} has a ${category} opportunity: ${seed.title}. HomeReach recommends ${seed.recommendedAction.toLowerCase()} because ${seed.whyItMatters.toLowerCase()} Estimated impact: ${impact}. ${complianceLine}`;
  const followUp = `Hi ${contact}, I wanted to close the loop on "${seed.title}." The next useful action is: ${seed.recommendedAction}`;
  const renewal = `Renewal angle: keep the next month focused on "${seed.title}" and document the result before expanding budget or scope.`;
  const upsell = `Upsell angle: if the client approves, package "${seed.title}" as a simple next-step proposal with clear scope, no guaranteed outcomes, and no autonomous launch.`;

  return [
    ["email", "Email Draft", email],
    ["sms", "SMS Draft", sms],
    ["dm", "DM Draft", dm],
    ["proposal_intro", "Proposal Intro", proposal],
    ["client_follow_up", "Client Follow-Up", followUp],
    ["renewal_message", "Renewal Message", renewal],
    ["upsell_message", "Upsell Message", upsell],
  ].map(([draftType, label, content]) => ({
    recommendation_id: recommendationId,
    client_id: seed.clientId,
    client_email: seed.clientEmail,
    draft_type: draftType,
    label,
    content,
    approval_status: "draft",
    created_by: "ai_coo_draft_generator",
  }));
}

async function ensureDrafts(db: Db, seed: RecommendationSeed, recommendationId: string) {
  const existing = await safeRows(
    "AI COO drafts",
    db.from("ai_coo_drafts").select("id,draft_type").eq("recommendation_id", recommendationId).limit(20),
  );
  const existingTypes = new Set(existing.map((draft) => draft.draft_type));
  const rows = draftRowsForSeed(seed, recommendationId).filter((draft) => !existingTypes.has(draft.draft_type));
  if (rows.length === 0) return;
  const { error } = await db.from("ai_coo_drafts").insert(rows);
  if (error) throw new Error(`AI COO draft creation failed: ${error.message}`);
}

async function persistSeed(db: Db, seed: RecommendationSeed) {
  const score = priorityScore(seed);
  const activeStatuses = Array.from(ACTIVE_STATUSES);
  let query = db
    .from("ai_coo_recommendations")
    .select("*")
    .eq("category", seed.category)
    .eq("opportunity_type", seed.opportunityType)
    .in("status", activeStatuses)
    .limit(1);

  if (seed.clientId) query = query.eq("client_id", seed.clientId);
  else query = query.ilike("client_email", normalizeEmail(seed.clientEmail));
  if (seed.relatedEntityType) query = query.eq("related_entity_type", seed.relatedEntityType);
  else query = query.is("related_entity_type", null);
  if (seed.relatedEntityId) query = query.eq("related_entity_id", seed.relatedEntityId);
  else query = query.is("related_entity_id", null);

  const existing = await safeSingle("AI COO recommendation lookup", query.maybeSingle());
  const payload = {
    client_id: seed.clientId,
    client_email: seed.clientEmail ? normalizeEmail(seed.clientEmail) : null,
    client_name: seed.clientName,
    business_name: seed.businessName,
    category: seed.category,
    opportunity_type: seed.opportunityType,
    title: seed.title,
    estimated_value_cents: seed.estimatedValueCents ?? 0,
    estimated_savings_cents: seed.estimatedSavingsCents ?? 0,
    estimated_impact_label: seed.estimatedImpactLabel ?? null,
    why_it_matters: seed.whyItMatters,
    recommended_action: seed.recommendedAction,
    priority_score: score,
    value_score: clampScore(seed.valueScore),
    confidence_score: clampScore(seed.confidenceScore),
    urgency_score: clampScore(seed.urgencyScore),
    confidence_level: confidenceLevel(seed.confidenceScore),
    risk_level: seed.riskLevel ?? null,
    related_entity_type: seed.relatedEntityType ?? null,
    related_entity_id: seed.relatedEntityId ?? null,
    owner: "ai_coo",
    action_labels: seed.actionLabels ?? activeActionLabels(seed.category),
    metadata: {
      ...(seed.metadata ?? {}),
      phase: "2_ai_coo_mvp",
      noAutonomousAction: true,
      approvalRequiredBeforeExecution: true,
    },
    due_at: score >= 80 ? dueIn(1) : score >= 65 ? dueIn(3) : dueIn(7),
    updated_at: new Date().toISOString(),
  };

  if (existing?.id) {
    const { data, error } = await db
      .from("ai_coo_recommendations")
      .update(payload)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw new Error(`AI COO recommendation update failed: ${error.message}`);
    await ensureDrafts(db, seed, existing.id);
    return data as AiCooRecommendationRow;
  }

  const { data, error } = await db
    .from("ai_coo_recommendations")
    .insert({
      ...payload,
      status: "new",
      created_by: "ai_coo_recommendation_engine",
    })
    .select("*")
    .single();

  if (error) throw new Error(`AI COO recommendation creation failed: ${error.message}`);

  await db.from("recommendation_history").insert({
    recommendation_id: data.id,
    from_status: null,
    to_status: "new",
    action: "created",
    actor_label: "AI COO",
    note: "Recommendation generated from existing HomeReach records.",
    metadata: { category: seed.category, opportunityType: seed.opportunityType },
  });
  await ensureDrafts(db, seed, data.id);
  return data as AiCooRecommendationRow;
}

function scoreColor(score: number): "green" | "yellow" | "red" {
  if (score >= 76) return "green";
  if (score >= 50) return "yellow";
  return "red";
}

function calculateClientScore(context: MarketContext, recommendations: RecommendationSeed[]) {
  const activeCampaigns = context.campaigns.filter((campaign) => !["closed"].includes(String(campaign.campaign_status)));
  const campaignActivityScore = activeCampaigns.length > 0 ? 75 : context.leads.length > 0 ? 45 : 25;
  const approvedSeeds = recommendations.filter((seed) => ["revenue", "growth", "renewal", "upsell"].includes(seed.category)).length;
  const riskSeeds = recommendations.filter((seed) => seed.category === "risk").length;
  const opportunityAcceptanceScore = approvedSeeds > 0 ? Math.max(45, 80 - riskSeeds * 8) : 35;
  const tasks = context.tasks;
  const completedTasks = tasks.filter((task) => String(task.status) === "completed").length;
  const taskCompletionScore = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : activeCampaigns.length > 0 ? 45 : 30;
  const reportsDue = context.campaigns.filter((campaign) => String(campaign.reporting_status) === "due").length;
  const reportsAvailable = context.reports.length + context.adTechReportingImports.length;
  const reportingComplianceScore = reportsDue > 0 ? 35 : reportsAvailable > 0 ? 80 : activeCampaigns.length > 0 ? 55 : 40;
  const score = clampScore(
    campaignActivityScore * 0.3 +
      opportunityAcceptanceScore * 0.25 +
      taskCompletionScore * 0.25 +
      reportingComplianceScore * 0.2,
  );
  const top = recommendations[0];

  return {
    score,
    color: scoreColor(score),
    campaignActivityScore: clampScore(campaignActivityScore),
    opportunityAcceptanceScore: clampScore(opportunityAcceptanceScore),
    taskCompletionScore: clampScore(taskCompletionScore),
    reportingComplianceScore: clampScore(reportingComplianceScore),
    recommendedNextAction: top?.recommendedAction ?? "Review today's top recommendation",
    components: {
      activeCampaigns: activeCampaigns.length,
      risksFound: riskSeeds,
      recommendationCount: recommendations.length,
      tasksTotal: tasks.length,
      tasksCompleted: completedTasks,
      reportsDue,
      adTechReportingImports: context.adTechReportingImports.length,
    },
  };
}

async function persistClientScore(
  db: Db,
  input: {
    clientId: string | null;
    clientEmail: string | null;
    score: ReturnType<typeof calculateClientScore>;
  },
) {
  if (!isAiCooScoresEnabled()) return null;
  const normalizedEmail = normalizeEmail(input.clientEmail);
  const lookup = input.clientId
    ? db.from("client_success_scores").select("id").eq("client_id", input.clientId).maybeSingle()
    : db.from("client_success_scores").select("id").ilike("client_email", normalizedEmail).maybeSingle();
  const existing = await safeSingle("Client success score lookup", lookup);
  const now = new Date().toISOString();
  const payload = {
    client_id: input.clientId,
    client_email: normalizedEmail || null,
    score: input.score.score,
    color: input.score.color,
    campaign_activity_score: input.score.campaignActivityScore,
    opportunity_acceptance_score: input.score.opportunityAcceptanceScore,
    task_completion_score: input.score.taskCompletionScore,
    reporting_compliance_score: input.score.reportingComplianceScore,
    recommended_next_action: input.score.recommendedNextAction,
    components: input.score.components,
    calculated_at: now,
    updated_at: now,
  };

  if (existing?.id) {
    const { data, error } = await db.from("client_success_scores").update(payload).eq("id", existing.id).select("*").single();
    if (error) throw new Error(`Client success score update failed: ${error.message}`);
    return data as ClientSuccessScoreRow;
  }

  const { data, error } = await db.from("client_success_scores").insert(payload).select("*").single();
  if (error) throw new Error(`Client success score creation failed: ${error.message}`);
  return data as ClientSuccessScoreRow;
}

export async function ensureAiCooRecommendationsForClient({
  supabase,
  clientId,
  clientEmail,
}: {
  supabase: ServiceClient;
  clientId?: string | null;
  clientEmail?: string | null;
}) {
  if (!isAiCooEnabled() || !isAiCooRecommendationsEnabled()) {
    return { createdOrUpdated: 0, score: null };
  }

  const db = asDb(supabase);
  await ensureCostControlForClient({ supabase, clientId, clientEmail });
  await ensureReputationForClient({ supabase, clientId, clientEmail });
  await ensureGrowthIntelligenceForClient({ supabase, clientId, clientEmail });
  await ensureAdTechForClient({ supabase, clientId, clientEmail });
  const context = await loadMarketContext({ supabase, clientId, clientEmail });
  const rawSeeds = buildSeeds(context, { clientId: clientId ?? null, clientEmail: clientEmail ?? null });
  const memorySignals = await loadBusinessMemorySignals({ supabase, clientId, clientEmail });
  const seeds = applyBusinessMemoryToRecommendationSeeds(rawSeeds, memorySignals);
  const persisted: AiCooRecommendationRow[] = [];
  for (const seed of seeds.slice(0, 25)) {
    persisted.push(await persistSeed(db, seed));
  }
  const score = await persistClientScore(db, {
    clientId: clientId ?? null,
    clientEmail: clientEmail ?? null,
    score: calculateClientScore(context, seeds),
  });
  return { createdOrUpdated: persisted.length, score };
}

export async function ensureAiCooRecommendationsForAll({
  supabase,
  limit = 150,
}: {
  supabase: ServiceClient;
  limit?: number;
}) {
  if (!isAiCooEnabled() || !isAiCooRecommendationsEnabled()) {
    return { createdOrUpdated: 0 };
  }

  const db = asDb(supabase);
  await ensureCostControlForAll({ supabase, limit });
  await ensureReputationForAll({ supabase, limit });
  await ensureGrowthIntelligenceForAll({ supabase, limit });
  await ensureAdTechForAll({ supabase, limit });
  const context = await loadMarketContext({ supabase, adminMode: true });
  const rawSeeds = buildSeeds(context).slice(0, limit);
  const memorySignalsByClient = new Map<string, Awaited<ReturnType<typeof loadBusinessMemorySignals>>>();
  const seeds: RecommendationSeed[] = [];
  for (const seed of rawSeeds) {
    const key = clientKey({ clientId: seed.clientId, clientEmail: seed.clientEmail });
    if (!memorySignalsByClient.has(key)) {
      memorySignalsByClient.set(
        key,
        await loadBusinessMemorySignals({ supabase, clientId: seed.clientId, clientEmail: seed.clientEmail }),
      );
    }
    const memoryApplied = applyBusinessMemoryToRecommendationSeeds([seed], memorySignalsByClient.get(key) ?? null)[0];
    if (memoryApplied) seeds.push(memoryApplied);
  }
  let count = 0;
  for (const seed of seeds) {
    await persistSeed(db, seed);
    count += 1;
  }

  const grouped = new Map<string, RecommendationSeed[]>();
  for (const seed of seeds) {
    const key = clientKey({ clientId: seed.clientId, clientEmail: seed.clientEmail });
    grouped.set(key, [...(grouped.get(key) ?? []), seed]);
  }
  for (const [key, clientSeeds] of grouped) {
    const seed = clientSeeds[0];
    const clientContext = {
      ...context,
      leads: context.leads.filter((lead) => clientKey({ clientId: lead.client_id, clientEmail: lead.email }) === key),
      campaigns: context.campaigns.filter((campaign) => clientKey({ clientId: campaign.client_id, clientEmail: null }) === key),
    };
    await persistClientScore(db, {
      clientId: seed?.clientId ?? null,
      clientEmail: seed?.clientEmail ?? null,
      score: calculateClientScore(clientContext, clientSeeds),
    });
  }

  return { createdOrUpdated: count };
}

async function fetchDraftsForRecommendations(db: Db, ids: string[]) {
  if (ids.length === 0) return {};
  const drafts = (await safeRows(
    "AI COO drafts",
    db.from("ai_coo_drafts").select("*").in("recommendation_id", ids).order("created_at", { ascending: true }).limit(500),
  )) as AiCooDraftRow[];
  return drafts.reduce<Record<string, AiCooDraftRow[]>>((acc, draft) => {
    acc[draft.recommendation_id] = [...(acc[draft.recommendation_id] ?? []), draft];
    return acc;
  }, {});
}

export async function loadClientAiCooCommandCenter({
  supabase,
  user,
  autoGenerate = true,
}: {
  supabase: ServiceClient;
  user: Pick<User, "id"> & { email?: string | null };
  autoGenerate?: boolean;
}): Promise<AiCooCommandCenterData> {
  if (!isAiCooEnabled()) {
    return { enabled: false, safeMode: false, recommendations: [], draftsByRecommendation: {}, score: null };
  }

  try {
    const db = asDb(supabase);
    if (autoGenerate) {
      await ensureAiCooRecommendationsForClient({ supabase, clientId: user.id, clientEmail: user.email });
    }

    const rowsByClient = await safeRows(
      "AI COO client recommendations",
      db
        .from("ai_coo_recommendations")
        .select("*")
        .eq("client_id", user.id)
        .in("status", CLIENT_FEED_STATUSES)
        .order("priority_score", { ascending: false })
        .limit(TOP_FEED_LIMIT),
    );
    const rowsByEmail = user.email
      ? await safeRows(
          "AI COO client recommendations by email",
          db
            .from("ai_coo_recommendations")
            .select("*")
            .ilike("client_email", normalizeEmail(user.email))
            .in("status", CLIENT_FEED_STATUSES)
            .order("priority_score", { ascending: false })
            .limit(TOP_FEED_LIMIT),
        )
      : [];
    const recommendations = mergeById([...rowsByClient, ...rowsByEmail])
      .sort((a, b) => numberValue(b.priority_score) - numberValue(a.priority_score))
      .slice(0, TOP_FEED_LIMIT) as AiCooRecommendationRow[];
    const draftsByRecommendation = await fetchDraftsForRecommendations(db, recommendations.map((row) => row.id));
    const score = (await safeSingle(
      "Client success score",
      db.from("client_success_scores").select("*").eq("client_id", user.id).maybeSingle(),
    )) as ClientSuccessScoreRow | null;

    return { enabled: true, safeMode: false, recommendations, draftsByRecommendation, score };
  } catch (error) {
    return {
      enabled: true,
      safeMode: true,
      recommendations: [],
      draftsByRecommendation: {},
      score: null,
      message: error instanceof Error ? error.message : "AI COO recommendations are in safe mode.",
    };
  }
}

export async function loadAdminAiCooQueue({
  supabase,
}: {
  supabase: ServiceClient;
}): Promise<AiCooAdminQueueData> {
  if (!isAiCooEnabled()) {
    return { enabled: false, safeMode: false, recommendations: [], draftsByRecommendation: {}, metrics: emptyMetrics() };
  }

  try {
    const db = asDb(supabase);
    const recommendations = (await safeRows(
      "AI COO admin queue",
      db.from("ai_coo_recommendations").select("*").order("priority_score", { ascending: false }).order("created_at", { ascending: false }).limit(250),
    )) as AiCooRecommendationRow[];
    const draftsByRecommendation = await fetchDraftsForRecommendations(db, recommendations.map((row) => row.id));
    return {
      enabled: true,
      safeMode: false,
      recommendations,
      draftsByRecommendation,
      metrics: calculateQueueMetrics(recommendations),
    };
  } catch (error) {
    return {
      enabled: true,
      safeMode: true,
      recommendations: [],
      draftsByRecommendation: {},
      metrics: emptyMetrics(),
      message: error instanceof Error ? error.message : "AI COO queue is in safe mode.",
    };
  }
}

function emptyMetrics(): AiCooQueueMetrics {
  return {
    revenueFound: 0,
    revenueApproved: 0,
    revenueCompleted: 0,
    estimatedRevenueValueCents: 0,
    costSavingsFound: 0,
    costSavingsApproved: 0,
    estimatedSavingsCents: 0,
    reputationOpportunities: 0,
    growthOpportunities: 0,
    dismissedOpportunities: 0,
    acceptanceRate: 0,
  };
}

function calculateQueueMetrics(rows: AiCooRecommendationRow[]): AiCooQueueMetrics {
  const revenue = rows.filter((row) => row.category === "revenue");
  const costSavings = rows.filter((row) => row.category === "cost_savings");
  const approved = rows.filter((row) => ["approved", "in_progress", "completed"].includes(row.status)).length;
  const actionable = rows.filter((row) => row.status !== "dismissed" && row.status !== "expired").length;

  return {
    revenueFound: revenue.length,
    revenueApproved: revenue.filter((row) => ["approved", "in_progress"].includes(row.status)).length,
    revenueCompleted: revenue.filter((row) => row.status === "completed").length,
    estimatedRevenueValueCents: revenue.reduce((sum, row) => sum + numberValue(row.estimated_value_cents), 0),
    costSavingsFound: costSavings.length,
    costSavingsApproved: costSavings.filter((row) => ["approved", "in_progress"].includes(row.status)).length,
    estimatedSavingsCents: costSavings.reduce((sum, row) => sum + numberValue(row.estimated_savings_cents), 0),
    reputationOpportunities: rows.filter((row) => row.category === "reputation").length,
    growthOpportunities: rows.filter((row) => row.category === "growth").length,
    dismissedOpportunities: rows.filter((row) => row.status === "dismissed").length,
    acceptanceRate: actionable > 0 ? Math.round((approved / actionable) * 100) : 0,
  };
}

export async function recordAiCooAction({
  supabase,
  recommendationId,
  actionType,
  actorUserId,
  actorRole,
  label,
  notes,
  draftId,
}: {
  supabase: ServiceClient;
  recommendationId: string;
  actionType: string;
  actorUserId?: string | null;
  actorRole?: string | null;
  label?: string | null;
  notes?: string | null;
  draftId?: string | null;
}) {
  const db = asDb(supabase);
  const recommendation = await safeSingle(
    "AI COO recommendation",
    db.from("ai_coo_recommendations").select("*").eq("id", recommendationId).single(),
  );
  if (!recommendation) throw new Error("AI COO recommendation not found.");

  const fromStatus = recommendation.status as AiCooStatus;
  const toStatus = nextStatusForAction(actionType, fromStatus);
  const actionStatus = actionStatusForAction(actionType);
  const now = new Date().toISOString();
  let draftCopyCount: number | null = null;

  if (draftId) {
    const draft = await safeSingle(
      "AI COO draft",
      db.from("ai_coo_drafts").select("id,recommendation_id,copy_count").eq("id", draftId).single(),
    );
    if (!draft || draft.recommendation_id !== recommendationId) {
      throw new Error("AI COO draft does not belong to this recommendation.");
    }
    draftCopyCount = numberValue(draft.copy_count, 0);
  }

  const { error: actionError } = await db.from("ai_coo_actions").insert({
    recommendation_id: recommendationId,
    action_type: actionType,
    label: label ?? actionLabel(actionType),
    actor_user_id: actorUserId ?? null,
    actor_role: actorRole ?? null,
    status: actionStatus,
    approval_required: true,
    no_autonomous_action: true,
    notes: notes ?? null,
    metadata: {
      draftId: draftId ?? null,
      noAutonomousAction: true,
      approvalRequiredBeforeExecution: true,
    },
  });
  if (actionError) throw new Error(`AI COO action failed: ${actionError.message}`);

  if (draftId && actionType.startsWith("copy_")) {
    await db
      .from("ai_coo_drafts")
      .update({
        copy_count: (draftCopyCount ?? 0) + 1,
        last_copied_at: now,
      })
      .eq("id", draftId);
  }

  if (toStatus !== fromStatus) {
    const update: Record<string, unknown> = {
      status: toStatus,
      updated_at: now,
    };
    if (toStatus === "completed") update.completed_at = now;
    if (toStatus === "dismissed") update.dismissal_reason = notes ?? "Dismissed from AI COO";
    const { error: updateError } = await db.from("ai_coo_recommendations").update(update).eq("id", recommendationId);
    if (updateError) throw new Error(`AI COO status update failed: ${updateError.message}`);
  }

  await db.from("recommendation_history").insert({
    recommendation_id: recommendationId,
    from_status: fromStatus,
    to_status: toStatus,
    action: actionType,
    actor_user_id: actorUserId ?? null,
    actor_label: actorRole ?? "user",
    note: notes ?? label ?? actionLabel(actionType),
    metadata: { draftId: draftId ?? null, actionStatus },
  });

  return { status: toStatus, actionStatus };
}

function actionLabel(actionType: string) {
  return actionType.replace(/_/g, " ");
}

function actionStatusForAction(actionType: string) {
  if (actionType === "dismiss") return "dismissed";
  if (actionType === "complete") return "completed";
  if (actionType.startsWith("copy_")) return "recorded";
  return "requires_approval";
}

function nextStatusForAction(actionType: string, currentStatus: AiCooStatus): AiCooStatus {
  if (actionType === "review") return "reviewed";
  if (actionType === "approve") return "approved";
  if (actionType === "dismiss") return "dismissed";
  if (actionType === "complete") return "completed";
  if (actionType.startsWith("copy_")) return currentStatus;
  if (["launch", "launch_campaign", "create_campaign", "create_proposal", "assign", "assign_task", "fix", "review_savings", "create_draft"].includes(actionType)) {
    return currentStatus === "new" ? "reviewed" : "in_progress";
  }
  return currentStatus;
}
