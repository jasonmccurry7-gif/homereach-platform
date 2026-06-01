import type { User } from "@supabase/supabase-js";
import type { createServiceClient } from "@/lib/supabase/service";
import {
  hasBusinessMemoryPersistence,
  isBusinessMemoryEnabled,
  isBusinessMemoryInsightsEnabled,
  isBusinessMemorySearchEnabled,
  isMemoryHealthScoreEnabled,
} from "./config";

type ServiceClient = ReturnType<typeof createServiceClient>;
type Db = ReturnType<typeof createServiceClient> & {
  from(table: string): any;
};

type JsonRecord = Record<string, unknown>;

type SourceContext = {
  leads: any[];
  campaigns: any[];
  locations: any[];
  reports: any[];
  assets: any[];
  aiRecommendations: any[];
  aiActions: any[];
  savings: any[];
  suppliers: any[];
  operationalAlerts: any[];
  businessContexts: any[];
};

type ProfileInput = {
  clientId: string | null;
  clientEmail: string | null;
  businessName: string;
  industry: string | null;
  website: string | null;
  markets: string[];
  goals: string[];
  campaignTypes: string[];
  offers: string[];
  budgets: JsonRecord;
};

export type BusinessMemoryProfileRow = {
  id: string;
  client_id: string | null;
  client_email: string | null;
  business_name: string;
  industry: string | null;
  services: string[] | null;
  website: string | null;
  markets_served: string[] | null;
  primary_goals: string[] | null;
  preferred_campaign_types: string[] | null;
  preferred_offers: string[] | null;
  preferred_budgets: JsonRecord | null;
  primary_cities: string[] | null;
  primary_zip_codes: string[] | null;
  primary_counties: string[] | null;
  metadata: JsonRecord | null;
  updated_at: string;
};

export type BusinessMemoryScoreRow = {
  id: string;
  profile_id: string;
  memory_completeness_score: number;
  business_profile_score: number;
  campaign_history_score: number;
  opportunity_history_score: number;
  geography_data_score: number;
  supplier_data_score: number;
  reputation_data_score: number;
  recommendation_data_score: number;
  missing_areas: string[] | null;
  recommended_data_to_collect: string[] | null;
  calculated_at: string;
};

export type BusinessMemoryInsightRow = {
  id: string;
  profile_id: string;
  insight_type: string;
  title: string;
  value_text: string | null;
  value_cents: number;
  confidence_score: number;
  supporting_data: JsonRecord | null;
  recommended_action: string | null;
  generated_at: string;
};

export type BusinessMemoryTimelineRow = {
  id: string;
  profile_id: string;
  event_type: string;
  title: string;
  description: string | null;
  event_date: string;
  related_table: string | null;
  related_id: string | null;
  impact_cents: number;
  status: string | null;
};

export type BusinessMemoryProfileData = {
  enabled: boolean;
  safeMode: boolean;
  message?: string;
  profile: BusinessMemoryProfileRow | null;
  score: BusinessMemoryScoreRow | null;
  geographies: any[];
  campaigns: any[];
  campaignResults: any[];
  opportunities: any[];
  offers: any[];
  suppliers: any[];
  savings: any[];
  reputation: any[];
  growth: any[];
  aiCoo: any[];
  timeline: BusinessMemoryTimelineRow[];
  insights: BusinessMemoryInsightRow[];
};

export type BusinessMemoryAdminData = {
  enabled: boolean;
  safeMode: boolean;
  message?: string;
  profiles: BusinessMemoryProfileRow[];
  scoresByProfile: Record<string, BusinessMemoryScoreRow>;
  metrics: {
    profiles: number;
    averageScore: number;
    timelineEvents: number;
    insights: number;
    campaignsRemembered: number;
    opportunitiesRemembered: number;
    savingsRemembered: number;
  };
};

export type BusinessMemorySignals = {
  profileId: string;
  completenessScore: number;
  acceptedTypes: string[];
  rejectedTypes: string[];
  dismissedTypes: string[];
  completedTypes: string[];
  bestGeographies: string[];
  preferredCampaignTypes: string[];
  preferredOffers: string[];
};

export type RecommendationSeedLike = {
  opportunityType: string;
  confidenceScore: number;
  urgencyScore: number;
  valueScore: number;
  recommendedAction: string;
  metadata?: JsonRecord;
};

function asDb(supabase: ServiceClient): Db {
  return supabase as Db;
}

function normalizeEmail(email: string | null | undefined) {
  return String(email ?? "").trim().toLowerCase();
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function numberValue(value: unknown, fallback = 0) {
  const numeric = typeof value === "string" ? Number(value) : value;
  return typeof numeric === "number" && Number.isFinite(numeric) ? numeric : fallback;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function asArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => normalizeText(item)).filter(Boolean);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function uniqueArray(values: unknown[]) {
  return Array.from(
    new Set(values.flatMap((value) => asArray(value)).map((value) => value.trim()).filter(Boolean)),
  );
}

function firstNonEmpty(...values: Array<unknown>) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function clientKey(input: { clientId?: string | null; clientEmail?: string | null; businessName?: string | null }) {
  return input.clientId || normalizeEmail(input.clientEmail) || normalizeText(input.businessName).toLowerCase() || "unknown";
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
    if (/does not exist|schema cache|relation|multiple rows|no rows/i.test(message)) return null;
    throw new Error(message);
  }
  return data ?? null;
}

function isMissingBusinessMemorySchema(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /business_memory_|schema cache|does not exist|relation/i.test(message);
}

async function findByLookup(db: Db, table: string, lookup: Record<string, unknown>) {
  let query = db.from(table).select("*").limit(1);
  for (const [key, value] of Object.entries(lookup)) {
    query = value === null ? query.is(key, null) : query.eq(key, value);
  }
  const rows = await safeRows(`${table} lookup`, query);
  return rows[0] ?? null;
}

async function upsertByLookup(db: Db, table: string, lookup: Record<string, unknown>, payload: JsonRecord) {
  const now = new Date().toISOString();
  const existing = await findByLookup(db, table, lookup);
  if (existing?.id) {
    const { data, error } = await db.from(table).update({ ...payload, updated_at: now }).eq("id", existing.id).select("*").single();
    if (error) throw new Error(`${table} update failed: ${error.message}`);
    return data;
  }

  const { data, error } = await db.from(table).insert({ ...payload, ...lookup }).select("*").single();
  if (error) throw new Error(`${table} insert failed: ${error.message}`);
  return data;
}

async function upsertBySource(
  db: Db,
  table: string,
  profileId: string,
  sourceTable: string,
  sourceId: string,
  payload: JsonRecord,
) {
  return upsertByLookup(
    db,
    table,
    { profile_id: profileId, source_table: sourceTable, source_id: sourceId },
    { profile_id: profileId, ...payload },
  );
}

async function upsertTimeline(
  db: Db,
  profileId: string,
  eventType: string,
  relatedTable: string,
  relatedId: string,
  payload: JsonRecord,
) {
  return upsertByLookup(
    db,
    "business_memory_timeline",
    { profile_id: profileId, event_type: eventType, related_table: relatedTable, related_id: relatedId },
    { profile_id: profileId, event_type: eventType, related_table: relatedTable, related_id: relatedId, ...payload },
  );
}

async function upsertInsight(db: Db, profileId: string, insightType: string, payload: JsonRecord) {
  return upsertByLookup(
    db,
    "business_memory_insights",
    { profile_id: profileId, insight_type: insightType },
    { profile_id: profileId, insight_type: insightType, ...payload, status: "active", generated_at: new Date().toISOString() },
  );
}

function profileInputFromLead(lead: any) {
  return {
    clientId: lead.client_id ?? null,
    clientEmail: lead.email ?? null,
    businessName: firstNonEmpty(lead.business_name, lead.email, "HomeReach Client") ?? "HomeReach Client",
    industry: firstNonEmpty(lead.industry),
    website: firstNonEmpty(lead.website),
    markets: uniqueArray([lead.target_area]),
    goals: uniqueArray([lead.targeting_objective]),
    campaignTypes: uniqueArray([lead.targeting_type, lead.postcard_addon ? "digital_plus_direct_mail" : null]),
    offers: uniqueArray([lead.campaign_offer]),
    budgets: {
      monthlyAdBudget: numberValue(lead.monthly_ad_budget),
      monthlyManagementFee: numberValue(lead.monthly_management_fee, 49900),
    },
  };
}

function profileInputFromCampaign(campaign: any, lead?: any) {
  const fromLead = lead ? profileInputFromLead(lead) : null;
  return {
    clientId: campaign.client_id ?? fromLead?.clientId ?? null,
    clientEmail: fromLead?.clientEmail ?? null,
    businessName: firstNonEmpty(fromLead?.businessName, campaign.campaign_name, campaign.client_email, "HomeReach Client") ?? "HomeReach Client",
    industry: fromLead?.industry ?? null,
    website: fromLead?.website ?? null,
    markets: uniqueArray([fromLead?.markets, campaign.target_geography]),
    goals: uniqueArray([fromLead?.goals]),
    campaignTypes: uniqueArray([fromLead?.campaignTypes, "market_capture"]),
    offers: uniqueArray([fromLead?.offers]),
    budgets: {
      monthlyAdBudget: numberValue(campaign.monthly_ad_budget, numberValue(lead?.monthly_ad_budget)),
      monthlyManagementFee: numberValue(campaign.monthly_management_fee, numberValue(lead?.monthly_management_fee, 49900)),
    },
  };
}

function profileInputFromAiCoo(row: any) {
  return {
    clientId: row.client_id ?? null,
    clientEmail: row.client_email ?? null,
    businessName: firstNonEmpty(row.business_name, row.client_email, "HomeReach Client") ?? "HomeReach Client",
    industry: null,
    website: null,
    markets: [],
    goals: uniqueArray([row.category]),
    campaignTypes: uniqueArray([row.opportunity_type]),
    offers: [],
    budgets: {},
  };
}

function profileInputFromOperations(row: any, context?: any) {
  return {
    clientId: row.user_id ?? context?.user_id ?? null,
    clientEmail: null,
    businessName: firstNonEmpty(context?.company_name, row.business_name, "Operations Client") ?? "Operations Client",
    industry: firstNonEmpty(context?.business_type),
    website: null,
    markets: uniqueArray([context?.service_geography]),
    goals: uniqueArray(["cost_savings"]),
    campaignTypes: [],
    offers: [],
    budgets: {},
  };
}

async function ensureProfile(db: Db, input: ProfileInput) {
  const normalizedEmail = normalizeEmail(input.clientEmail);
  const businessName = normalizeText(input.businessName) || "HomeReach Client";
  let query = db.from("business_memory_profiles").select("*").eq("business_name", businessName).limit(1);
  if (input.clientId) query = query.eq("client_id", input.clientId);
  else if (normalizedEmail) query = query.ilike("client_email", normalizedEmail);
  const existing = (await safeRows("Business memory profile lookup", query))[0] ?? null;
  const now = new Date().toISOString();
  const payload = {
    client_id: input.clientId ?? existing?.client_id ?? null,
    client_email: normalizedEmail || existing?.client_email || null,
    business_name: businessName,
    industry: input.industry ?? existing?.industry ?? null,
    website: input.website ?? existing?.website ?? null,
    markets_served: uniqueArray([existing?.markets_served, input.markets]),
    primary_goals: uniqueArray([existing?.primary_goals, input.goals]),
    preferred_campaign_types: uniqueArray([existing?.preferred_campaign_types, input.campaignTypes]),
    preferred_offers: uniqueArray([existing?.preferred_offers, input.offers]),
    preferred_budgets: { ...(existing?.preferred_budgets ?? {}), ...(input.budgets ?? {}) },
    metadata: {
      ...(existing?.metadata ?? {}),
      phase: "3_business_memory_mvp",
      updatedFrom: "business_memory_sync",
    },
    updated_at: now,
  };

  if (existing?.id) {
    const { data, error } = await db.from("business_memory_profiles").update(payload).eq("id", existing.id).select("*").single();
    if (error) throw new Error(`Business memory profile update failed: ${error.message}`);
    return data as BusinessMemoryProfileRow;
  }

  const { data, error } = await db
    .from("business_memory_profiles")
    .insert({
      ...payload,
      source: "business_memory_mvp",
    })
    .select("*")
    .single();
  if (error) throw new Error(`Business memory profile creation failed: ${error.message}`);
  return data as BusinessMemoryProfileRow;
}

function campaignTypeFromLead(lead: any) {
  const type = normalizeText(lead?.targeting_type).replace(/_/g, " ");
  return type || "Market Capture";
}

function geographyTypeFromTarget(type: string | null | undefined) {
  const normalized = normalizeText(type).toLowerCase();
  if (normalized.includes("jobsite")) return "jobsite_area";
  if (normalized.includes("competitor")) return "competitor_area";
  if (normalized.includes("political")) return "political_area";
  if (normalized.includes("service")) return "service_area";
  if (normalized.includes("event")) return "custom_area";
  if (normalized.includes("neighborhood")) return "neighborhood";
  return "target_area";
}

function successRatingFromReport(report: any) {
  return clampScore(
    numberValue(report.leads) * 20 +
      numberValue(report.calls) * 15 +
      numberValue(report.qr_scans) * 8 +
      numberValue(report.clicks) / 15 +
      numberValue(report.impressions) / 1000,
  );
}

async function syncLead(db: Db, profile: BusinessMemoryProfileRow, lead: any) {
  const targetArea = firstNonEmpty(lead.target_area);
  if (targetArea) {
    await upsertBySource(db, "business_memory_geographies", profile.id, "market_capture_leads", lead.id, {
      geography_type: geographyTypeFromTarget(lead.targeting_type),
      name: targetArea,
      value: targetArea,
      performance_status: "active",
      performance_score: 45,
      notes: "Captured from Market Capture intake.",
      metadata: { objective: lead.targeting_objective, targetingType: lead.targeting_type },
    });
  }

  await upsertBySource(db, "business_memory_opportunities", profile.id, "market_capture_leads", lead.id, {
    opportunity_type: campaignTypeFromLead(lead).replace(/\s+/g, "_").toLowerCase(),
    opportunity_reason: "Prospect requested Market Capture intake.",
    opportunity_status: lead.status ?? "active",
    accepted: ["qualified", "ready_for_fulfillment", "closed_won"].includes(String(lead.status)),
    rejected: String(lead.status) === "closed_lost",
    dismissed: false,
    completed: String(lead.status) === "closed_won",
    estimated_value_cents: numberValue(lead.monthly_management_fee, 49900),
    actual_value_cents: String(lead.payment_status) === "paid" ? numberValue(lead.monthly_management_fee, 49900) : 0,
    date_created: lead.created_at ?? new Date().toISOString(),
    date_closed: ["closed_won", "closed_lost"].includes(String(lead.status)) ? lead.updated_at : null,
    metadata: { paymentStatus: lead.payment_status, monthlyAdBudget: lead.monthly_ad_budget },
  });

  if (lead.campaign_offer) {
    await upsertBySource(db, "business_memory_offers", profile.id, "market_capture_leads", lead.id, {
      offer_text: lead.campaign_offer,
      offer_type: "campaign_offer",
      campaign_performance: "Waiting for campaign results.",
      performance_status: "active",
      metadata: { targetingType: lead.targeting_type, objective: lead.targeting_objective },
    });
  }

  await upsertTimeline(db, profile.id, "intake", "market_capture_leads", lead.id, {
    title: "Market Capture intake submitted",
    description: `${lead.business_name ?? profile.business_name} requested ${campaignTypeFromLead(lead)} for ${targetArea ?? "a local target area"}.`,
    event_date: lead.created_at ?? new Date().toISOString(),
    impact_cents: numberValue(lead.monthly_management_fee, 49900),
    status: lead.status ?? "active",
    metadata: { paymentStatus: lead.payment_status },
  });
}

async function syncCampaign(db: Db, profile: BusinessMemoryProfileRow, campaign: any, lead: any, assets: any[]) {
  const campaignMemory = await upsertBySource(db, "business_memory_campaigns", profile.id, "market_capture_campaigns", campaign.id, {
    campaign_type: "market_capture",
    campaign_name: campaign.campaign_name ?? `${profile.business_name} Market Capture`,
    launch_date: campaign.launch_date ?? null,
    budget_cents: numberValue(campaign.monthly_ad_budget),
    status: campaign.campaign_status ?? "unknown",
    assets_used: assets.map((asset) => ({
      type: asset.asset_type,
      status: asset.status,
      approvalStatus: asset.approval_status,
    })),
    target_geography: campaign.target_geography ?? lead?.target_area ?? null,
    direct_mail_used: Boolean(campaign.direct_mail_requested || lead?.postcard_addon),
    digital_used: true,
    political_used: String(lead?.targeting_type ?? "").includes("political"),
    performance_notes: campaign.notes ?? campaign.next_best_action ?? null,
    metadata: {
      launchStatus: campaign.launch_status,
      directMailStatus: campaign.direct_mail_status,
      creativeStatus: campaign.creative_status,
      approvalStatus: campaign.approval_status,
    },
  });

  await upsertTimeline(db, profile.id, "campaign", "market_capture_campaigns", campaign.id, {
    title: "Campaign added to Business Memory",
    description: campaign.next_best_action ?? "Campaign fulfillment state saved for future recommendations.",
    event_date: campaign.created_at ?? new Date().toISOString(),
    impact_cents: numberValue(campaign.monthly_management_fee, 49900),
    status: campaign.campaign_status,
    metadata: { launchStatus: campaign.launch_status, reportingStatus: campaign.reporting_status },
  });

  return campaignMemory;
}

async function syncLocation(db: Db, profile: BusinessMemoryProfileRow, location: any, reports: any[]) {
  const reportSignal = reports.reduce((sum, report) => sum + numberValue(report.leads) * 12 + numberValue(report.calls) * 10 + numberValue(report.qr_scans) * 5, 0);
  await upsertBySource(db, "business_memory_geographies", profile.id, "market_capture_campaign_locations", location.id, {
    geography_type: geographyTypeFromTarget(location.location_type),
    name: location.name,
    value: firstNonEmpty(location.address, location.name),
    address: location.address ?? null,
    radius_miles: location.radius_miles ?? null,
    performance_status: reportSignal > 0 ? "best" : "active",
    performance_score: clampScore(45 + reportSignal),
    notes: location.notes ?? "Fulfillment target location remembered.",
    metadata: { status: location.status },
  });
}

async function syncReport(db: Db, profile: BusinessMemoryProfileRow, campaignMemoryId: string, report: any) {
  const clicks = numberValue(report.clicks);
  const leads = numberValue(report.leads);
  await upsertBySource(db, "business_memory_campaign_results", profile.id, "market_capture_reports", report.id, {
    campaign_memory_id: campaignMemoryId,
    reporting_period_start: report.reporting_period_start ?? null,
    reporting_period_end: report.reporting_period_end ?? null,
    impressions: numberValue(report.impressions),
    reach: numberValue(report.reach),
    clicks,
    leads,
    calls: numberValue(report.calls),
    forms: 0,
    qr_scans: numberValue(report.qr_scans),
    spend_cents: numberValue(report.spend),
    cost_per_lead_cents: leads > 0 ? Math.round(numberValue(report.spend) / leads) : 0,
    cost_per_click_cents: clicks > 0 ? Math.round(numberValue(report.spend) / clicks) : 0,
    internal_notes: report.notes ?? null,
    client_feedback: report.recommendations ?? null,
    success_rating: successRatingFromReport(report),
    metadata: { directMailQuantity: report.direct_mail_quantity },
  });

  await upsertTimeline(db, profile.id, "report", "market_capture_reports", report.id, {
    title: "Campaign report saved",
    description: report.recommendations ?? report.notes ?? "Manual reporting metrics saved to Business Memory.",
    event_date: report.reporting_period_end ?? report.created_at ?? new Date().toISOString(),
    impact_cents: 0,
    status: "reported",
    metadata: { impressions: report.impressions, clicks: report.clicks, leads: report.leads, calls: report.calls },
  });
}

async function syncAiRecommendation(db: Db, profile: BusinessMemoryProfileRow, row: any) {
  const status = String(row.status ?? "new");
  const accepted = ["approved", "in_progress", "completed"].includes(status);
  const completed = status === "completed";
  const dismissed = status === "dismissed";
  const estimatedValue = numberValue(row.estimated_value_cents) || numberValue(row.estimated_savings_cents);

  await upsertBySource(db, "business_memory_ai_coo", profile.id, "ai_coo_recommendations", row.id, {
    recommendation_id: row.id,
    recommendation_type: row.opportunity_type,
    category: row.category,
    status,
    accepted,
    rejected: false,
    dismissed,
    completed,
    estimated_value_cents: estimatedValue,
    success_rating: completed ? 85 : accepted ? 65 : dismissed ? 20 : 45,
    reason: row.why_it_matters,
    metadata: {
      priorityScore: row.priority_score,
      confidenceScore: row.confidence_score,
      recommendedAction: row.recommended_action,
    },
  });

  await upsertBySource(db, "business_memory_opportunities", profile.id, "ai_coo_recommendations", row.id, {
    opportunity_type: row.opportunity_type,
    opportunity_reason: row.why_it_matters,
    opportunity_status: status,
    accepted,
    rejected: false,
    dismissed,
    completed,
    estimated_value_cents: numberValue(row.estimated_value_cents),
    actual_value_cents: completed ? numberValue(row.estimated_value_cents) : 0,
    date_created: row.created_at ?? new Date().toISOString(),
    date_closed: completed || dismissed ? row.updated_at : null,
    metadata: { category: row.category, confidenceScore: row.confidence_score },
  });

  await upsertTimeline(db, profile.id, "ai_coo", "ai_coo_recommendations", row.id, {
    title: row.title,
    description: row.recommended_action,
    event_date: row.created_at ?? new Date().toISOString(),
    impact_cents: estimatedValue,
    status,
    metadata: { category: row.category, opportunityType: row.opportunity_type },
  });
}

async function syncSavings(db: Db, profile: BusinessMemoryProfileRow, row: any) {
  const status = String(row.status ?? "pending_approval");
  const accepted = ["approved", "implemented", "completed"].includes(status);
  const rejected = ["rejected", "dismissed"].includes(status);
  await upsertBySource(db, "business_memory_savings", profile.id, "opcopilot_savings_recommendations", row.id, {
    opportunity_name: row.title,
    category: row.category ?? "savings",
    estimated_savings_cents: numberValue(row.projected_annual_savings_cents) || numberValue(row.projected_monthly_savings_cents) * 12,
    actual_savings_cents: accepted ? numberValue(row.projected_annual_savings_cents) : 0,
    accepted,
    rejected,
    recurring_savings: numberValue(row.projected_monthly_savings_cents) > 0,
    one_time_savings: numberValue(row.projected_monthly_savings_cents) === 0,
    status,
    metadata: {
      summary: row.summary,
      confidence: row.confidence,
      approvalRequired: row.approval_required,
      noSpendCommitment: true,
    },
  });

  await upsertTimeline(db, profile.id, "savings", "opcopilot_savings_recommendations", row.id, {
    title: row.title,
    description: row.summary,
    event_date: row.created_at ?? new Date().toISOString(),
    impact_cents: numberValue(row.projected_annual_savings_cents),
    status,
    metadata: { category: row.category, approvalRequired: row.approval_required },
  });
}

async function syncSupplier(db: Db, profile: BusinessMemoryProfileRow, row: any) {
  await upsertBySource(db, "business_memory_suppliers", profile.id, "opcopilot_suppliers", row.id, {
    supplier_name: row.supplier_name,
    category: asArray(row.category_coverage).join(", ") || null,
    supplier_history: [{ active: row.active, reliabilityScore: row.reliability_score, averageLeadTimeDays: row.average_lead_time_days }],
    vendor_notes: `Payment terms: ${row.payment_terms ?? "standard"}. Approval required before vendor changes.`,
    pricing_history: [{ minimumOrderCents: row.minimum_order_cents, deliveryFeeCents: row.delivery_fee_cents }],
    metadata: { noAutonomousVendorChange: true },
  });
}

async function syncOperationalAlert(db: Db, profile: BusinessMemoryProfileRow, row: any) {
  await upsertTimeline(db, profile.id, "risk", "opcopilot_operational_alerts", row.id, {
    title: row.title,
    description: row.recommended_action ?? row.detail,
    event_date: row.created_at ?? new Date().toISOString(),
    impact_cents: numberValue(row.estimated_impact_cents),
    status: row.status,
    metadata: { alertType: row.alert_type, severity: row.severity, noSpendCommitment: true },
  });
}

async function loadSourceContext({
  supabase,
  clientId,
  clientEmail,
  adminMode = false,
  limit = 300,
}: {
  supabase: ServiceClient;
  clientId?: string | null;
  clientEmail?: string | null;
  adminMode?: boolean;
  limit?: number;
}): Promise<SourceContext> {
  const db = asDb(supabase);
  const normalizedEmail = normalizeEmail(clientEmail);
  const leadQueries: Array<Promise<any[]>> = [];
  if (adminMode) {
    leadQueries.push(safeRows("Market Capture leads", db.from("market_capture_leads").select("*").order("updated_at", { ascending: false }).limit(limit)));
  } else {
    if (clientId) leadQueries.push(safeRows("Market Capture leads by client", db.from("market_capture_leads").select("*").eq("client_id", clientId).limit(limit)));
    if (normalizedEmail) leadQueries.push(safeRows("Market Capture leads by email", db.from("market_capture_leads").select("*").ilike("email", normalizedEmail).limit(limit)));
  }
  const leads = mergeById((await Promise.all(leadQueries)).flat());
  const leadIds = leads.map((lead) => lead.id).filter(Boolean);

  const campaignQueries: Array<Promise<any[]>> = [];
  if (adminMode) {
    campaignQueries.push(safeRows("Market Capture campaigns", db.from("market_capture_campaigns").select("*").order("updated_at", { ascending: false }).limit(limit)));
  } else {
    if (clientId) campaignQueries.push(safeRows("Market Capture campaigns by client", db.from("market_capture_campaigns").select("*").eq("client_id", clientId).limit(limit)));
    if (leadIds.length) campaignQueries.push(safeRows("Market Capture campaigns by leads", db.from("market_capture_campaigns").select("*").in("market_capture_lead_id", leadIds).limit(limit)));
  }
  const campaigns = mergeById((await Promise.all(campaignQueries)).flat());
  const campaignIds = campaigns.map((campaign) => campaign.id).filter(Boolean);
  const sourceLeadIds = Array.from(new Set([...leadIds, ...campaigns.map((campaign) => campaign.market_capture_lead_id).filter(Boolean)]));

  const aiQueries: Array<Promise<any[]>> = [];
  if (adminMode) {
    aiQueries.push(safeRows("AI COO recommendations", db.from("ai_coo_recommendations").select("*").order("updated_at", { ascending: false }).limit(limit)));
  } else {
    if (clientId) aiQueries.push(safeRows("AI COO recommendations by client", db.from("ai_coo_recommendations").select("*").eq("client_id", clientId).limit(limit)));
    if (normalizedEmail) aiQueries.push(safeRows("AI COO recommendations by email", db.from("ai_coo_recommendations").select("*").ilike("client_email", normalizedEmail).limit(limit)));
  }
  const aiRecommendations = mergeById((await Promise.all(aiQueries)).flat());
  const aiRecommendationIds = aiRecommendations.map((row) => row.id).filter(Boolean);

  const [
    locations,
    reports,
    assets,
    aiActions,
    savings,
    suppliers,
    operationalAlerts,
    businessContexts,
  ] = await Promise.all([
    campaignIds.length ? safeRows("Market Capture locations", db.from("market_capture_campaign_locations").select("*").in("campaign_id", campaignIds).limit(600)) : Promise.resolve([]),
    campaignIds.length ? safeRows("Market Capture reports", db.from("market_capture_reports").select("*").in("campaign_id", campaignIds).limit(600)) : Promise.resolve([]),
    sourceLeadIds.length ? safeRows("Market Capture assets", db.from("market_capture_assets").select("*").in("market_capture_lead_id", sourceLeadIds).limit(600)) : Promise.resolve([]),
    aiRecommendationIds.length ? safeRows("AI COO actions", db.from("ai_coo_actions").select("*").in("recommendation_id", aiRecommendationIds).limit(600)) : Promise.resolve([]),
    adminMode || clientId
      ? safeRows("Operations savings", adminMode ? db.from("opcopilot_savings_recommendations").select("*").order("created_at", { ascending: false }).limit(limit) : db.from("opcopilot_savings_recommendations").select("*").eq("user_id", clientId).limit(limit))
      : Promise.resolve([]),
    adminMode || clientId
      ? safeRows("Operations suppliers", adminMode ? db.from("opcopilot_suppliers").select("*").order("updated_at", { ascending: false }).limit(limit) : db.from("opcopilot_suppliers").select("*").eq("user_id", clientId).limit(limit))
      : Promise.resolve([]),
    adminMode || clientId
      ? safeRows("Operations alerts", adminMode ? db.from("opcopilot_operational_alerts").select("*").order("created_at", { ascending: false }).limit(limit) : db.from("opcopilot_operational_alerts").select("*").eq("user_id", clientId).limit(limit))
      : Promise.resolve([]),
    adminMode || clientId
      ? safeRows("Operations business contexts", adminMode ? db.from("opcopilot_business_contexts").select("*").order("updated_at", { ascending: false }).limit(limit) : db.from("opcopilot_business_contexts").select("*").eq("user_id", clientId).limit(20))
      : Promise.resolve([]),
  ]);

  return { leads, campaigns, locations, reports, assets, aiRecommendations, aiActions, savings, suppliers, operationalAlerts, businessContexts };
}

function mergeById(rows: any[]) {
  const map = new Map<string, any>();
  for (const row of rows) {
    if (row?.id) map.set(row.id, row);
  }
  return Array.from(map.values());
}

function rowsBy<T extends Record<string, any>>(rows: T[], key: string) {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const value = row[key];
    if (!value) continue;
    map.set(value, [...(map.get(value) ?? []), row]);
  }
  return map;
}

async function syncContext(db: Db, context: SourceContext) {
  const touched = new Set<string>();
  const profilesByKey = new Map<string, BusinessMemoryProfileRow>();
  const leadsById = new Map(context.leads.map((lead) => [lead.id, lead]));
  const locationsByCampaign = rowsBy(context.locations, "campaign_id");
  const reportsByCampaign = rowsBy(context.reports, "campaign_id");
  const assetsByLead = rowsBy(context.assets, "market_capture_lead_id");
  const operationsContextByUser = new Map(context.businessContexts.map((row) => [row.user_id, row]));

  async function rememberProfile(input: ProfileInput) {
    const key = clientKey(input);
    const cached = profilesByKey.get(key);
    if (cached) return cached;
    const profile = await ensureProfile(db, input);
    profilesByKey.set(key, profile);
    touched.add(profile.id);
    return profile;
  }

  for (const lead of context.leads) {
    const profile = await rememberProfile(profileInputFromLead(lead));
    await syncLead(db, profile, lead);
  }

  for (const campaign of context.campaigns) {
    const lead = leadsById.get(campaign.market_capture_lead_id);
    const profile = await rememberProfile(profileInputFromCampaign(campaign, lead));
    const assets = assetsByLead.get(campaign.market_capture_lead_id) ?? [];
    const campaignMemory = await syncCampaign(db, profile, campaign, lead, assets);
    const reports = reportsByCampaign.get(campaign.id) ?? [];
    for (const location of locationsByCampaign.get(campaign.id) ?? []) {
      await syncLocation(db, profile, location, reports);
    }
    for (const report of reports) {
      await syncReport(db, profile, campaignMemory.id, report);
    }
  }

  for (const row of context.aiRecommendations) {
    const profile = await rememberProfile(profileInputFromAiCoo(row));
    await syncAiRecommendation(db, profile, row);
  }

  for (const row of context.savings) {
    const profile = await rememberProfile(profileInputFromOperations(row, operationsContextByUser.get(row.user_id)));
    await syncSavings(db, profile, row);
  }

  for (const row of context.suppliers) {
    const profile = await rememberProfile(profileInputFromOperations(row, operationsContextByUser.get(row.user_id)));
    await syncSupplier(db, profile, row);
  }

  for (const row of context.operationalAlerts) {
    const profile = await rememberProfile(profileInputFromOperations(row, operationsContextByUser.get(row.user_id)));
    await syncOperationalAlert(db, profile, row);
  }

  for (const profileId of touched) {
    await generateInsightsAndScore(db, profileId);
  }

  return { profilesTouched: touched.size };
}

async function generateInsightsAndScore(db: Db, profileId: string) {
  const [profile, geographies, campaigns, results, opportunities, offers, suppliers, savings, reputation, aiCoo] = await Promise.all([
    safeSingle("Business memory profile", db.from("business_memory_profiles").select("*").eq("id", profileId).maybeSingle()),
    safeRows("Business memory geographies", db.from("business_memory_geographies").select("*").eq("profile_id", profileId).limit(500)),
    safeRows("Business memory campaigns", db.from("business_memory_campaigns").select("*").eq("profile_id", profileId).limit(500)),
    safeRows("Business memory campaign results", db.from("business_memory_campaign_results").select("*").eq("profile_id", profileId).limit(500)),
    safeRows("Business memory opportunities", db.from("business_memory_opportunities").select("*").eq("profile_id", profileId).limit(500)),
    safeRows("Business memory offers", db.from("business_memory_offers").select("*").eq("profile_id", profileId).limit(500)),
    safeRows("Business memory suppliers", db.from("business_memory_suppliers").select("*").eq("profile_id", profileId).limit(500)),
    safeRows("Business memory savings", db.from("business_memory_savings").select("*").eq("profile_id", profileId).limit(500)),
    safeRows("Business memory reputation", db.from("business_memory_reputation").select("*").eq("profile_id", profileId).limit(200)),
    safeRows("Business memory AI COO", db.from("business_memory_ai_coo").select("*").eq("profile_id", profileId).limit(500)),
  ]);

  if (isBusinessMemoryInsightsEnabled()) {
    await generateInsights(db, profileId, { geographies, campaigns, results, opportunities, offers, savings, aiCoo });
  }

  if (isMemoryHealthScoreEnabled() && profile) {
    await upsertMemoryScore(db, profileId, { profile, geographies, campaigns, opportunities, suppliers, reputation, aiCoo });
  }
}

async function generateInsights(
  db: Db,
  profileId: string,
  data: {
    geographies: any[];
    campaigns: any[];
    results: any[];
    opportunities: any[];
    offers: any[];
    savings: any[];
    aiCoo: any[];
  },
) {
  const geographyCounts = countBy(data.geographies, (row) => row.name);
  const topGeography = topEntry(geographyCounts);
  if (topGeography) {
    await upsertInsight(db, profileId, "most_active_geography", {
      title: "Most active geography",
      value_text: topGeography[0],
      confidence_score: clampScore(55 + topGeography[1] * 10),
      supporting_data: { count: topGeography[1] },
      recommended_action: "Use this area as the first place to review for expansion or repeated exposure.",
    });
  }

  const topResult = data.results.sort((a, b) => numberValue(b.success_rating) - numberValue(a.success_rating))[0];
  if (topResult) {
    const campaign = data.campaigns.find((row) => row.id === topResult.campaign_memory_id);
    await upsertInsight(db, profileId, "most_successful_campaign", {
      title: "Most successful campaign",
      value_text: campaign?.campaign_name ?? "Campaign result",
      confidence_score: numberValue(topResult.success_rating),
      supporting_data: { leads: topResult.leads, calls: topResult.calls, qrScans: topResult.qr_scans },
      recommended_action: "Compare future campaigns against this result before changing offer or geography.",
    });
  }

  const acceptedCounts = countBy(
    data.aiCoo.filter((row) => row.accepted || row.completed),
    (row) => row.recommendation_type,
  );
  const topAccepted = topEntry(acceptedCounts);
  if (topAccepted) {
    await upsertInsight(db, profileId, "most_accepted_recommendation_type", {
      title: "Most accepted recommendation type",
      value_text: topAccepted[0].replace(/_/g, " "),
      confidence_score: clampScore(55 + topAccepted[1] * 10),
      supporting_data: { acceptedCount: topAccepted[1] },
      recommended_action: "Prioritize similar recommendations before introducing unfamiliar asks.",
    });
  }

  const savingsByCategory = sumBy(data.savings, (row) => row.category ?? "savings", (row) => numberValue(row.estimated_savings_cents));
  const topSavings = topEntry(savingsByCategory);
  if (topSavings) {
    await upsertInsight(db, profileId, "highest_savings_category", {
      title: "Highest savings category",
      value_text: topSavings[0],
      value_cents: topSavings[1],
      confidence_score: 70,
      supporting_data: { estimatedSavingsCents: topSavings[1] },
      recommended_action: "Review this category with the owner before recommending vendor or spend changes.",
    });
  }

  const opportunityByType = sumBy(data.opportunities, (row) => row.opportunity_type, (row) => numberValue(row.estimated_value_cents));
  const topOpportunity = topEntry(opportunityByType);
  if (topOpportunity) {
    await upsertInsight(db, profileId, "highest_revenue_opportunity_type", {
      title: "Highest revenue opportunity type",
      value_text: topOpportunity[0].replace(/_/g, " "),
      value_cents: topOpportunity[1],
      confidence_score: 65,
      supporting_data: { estimatedValueCents: topOpportunity[1] },
      recommended_action: "Use this as the first revenue angle when preparing the next proposal.",
    });
  }

  const topOffer = data.offers.find((row) => row.performance_status === "best") ?? data.offers[0];
  if (topOffer) {
    await upsertInsight(db, profileId, "most_successful_offer", {
      title: "Offer to remember",
      value_text: topOffer.offer_text,
      confidence_score: topOffer.performance_status === "best" ? 80 : 45,
      supporting_data: { performanceStatus: topOffer.performance_status },
      recommended_action: "Reuse this offer only when the campaign context still fits.",
    });
  }
}

async function upsertMemoryScore(
  db: Db,
  profileId: string,
  data: {
    profile: any;
    geographies: any[];
    campaigns: any[];
    opportunities: any[];
    suppliers: any[];
    reputation: any[];
    aiCoo: any[];
  },
) {
  const businessProfileScore = clampScore(
    (data.profile.business_name ? 20 : 0) +
      (data.profile.industry ? 15 : 0) +
      (data.profile.website ? 15 : 0) +
      (asArray(data.profile.markets_served).length > 0 ? 20 : 0) +
      (asArray(data.profile.preferred_campaign_types).length > 0 ? 15 : 0) +
      (asArray(data.profile.preferred_offers).length > 0 ? 15 : 0),
  );
  const campaignHistoryScore = clampScore(data.campaigns.length * 25);
  const opportunityHistoryScore = clampScore(data.opportunities.length * 20);
  const geographyDataScore = clampScore(data.geographies.length * 18);
  const supplierDataScore = clampScore(data.suppliers.length * 25);
  const reputationDataScore = clampScore(data.reputation.length * 25);
  const recommendationDataScore = clampScore(data.aiCoo.length * 18);
  const score = clampScore(
    businessProfileScore * 0.2 +
      campaignHistoryScore * 0.18 +
      opportunityHistoryScore * 0.18 +
      geographyDataScore * 0.16 +
      supplierDataScore * 0.1 +
      reputationDataScore * 0.08 +
      recommendationDataScore * 0.1,
  );
  const missingAreas = [
    businessProfileScore < 70 ? "Business profile" : null,
    campaignHistoryScore < 50 ? "Campaign history" : null,
    opportunityHistoryScore < 50 ? "Opportunity history" : null,
    geographyDataScore < 50 ? "Geography data" : null,
    supplierDataScore < 50 ? "Supplier data" : null,
    reputationDataScore < 50 ? "Reputation data" : null,
    recommendationDataScore < 50 ? "AI COO history" : null,
  ].filter(Boolean) as string[];
  const recommendedDataToCollect = missingAreas.map((area) => `Collect more ${area.toLowerCase()} so recommendations become more specific.`);

  await upsertByLookup(
    db,
    "business_memory_scores",
    { profile_id: profileId },
    {
      memory_completeness_score: score,
      business_profile_score: businessProfileScore,
      campaign_history_score: campaignHistoryScore,
      opportunity_history_score: opportunityHistoryScore,
      geography_data_score: geographyDataScore,
      supplier_data_score: supplierDataScore,
      reputation_data_score: reputationDataScore,
      recommendation_data_score: recommendationDataScore,
      missing_areas: missingAreas,
      recommended_data_to_collect: recommendedDataToCollect,
      calculated_at: new Date().toISOString(),
    },
  );
}

function countBy<T>(rows: T[], selector: (row: T) => string | null | undefined) {
  const result = new Map<string, number>();
  for (const row of rows) {
    const key = normalizeText(selector(row));
    if (!key) continue;
    result.set(key, (result.get(key) ?? 0) + 1);
  }
  return result;
}

function sumBy<T>(rows: T[], keySelector: (row: T) => string | null | undefined, valueSelector: (row: T) => number) {
  const result = new Map<string, number>();
  for (const row of rows) {
    const key = normalizeText(keySelector(row));
    if (!key) continue;
    result.set(key, (result.get(key) ?? 0) + valueSelector(row));
  }
  return result;
}

function topEntry(map: Map<string, number>) {
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1])[0] ?? null;
}

export async function ensureBusinessMemoryForClient({
  supabase,
  clientId,
  clientEmail,
}: {
  supabase: ServiceClient;
  clientId?: string | null;
  clientEmail?: string | null;
}) {
  if (!isBusinessMemoryEnabled() || !hasBusinessMemoryPersistence()) return { profilesTouched: 0 };
  try {
    const context = await loadSourceContext({ supabase, clientId, clientEmail });
    return await syncContext(asDb(supabase), context);
  } catch (error) {
    if (isMissingBusinessMemorySchema(error)) return { profilesTouched: 0 };
    throw error;
  }
}

export async function ensureBusinessMemoryForAll({
  supabase,
  limit = 300,
}: {
  supabase: ServiceClient;
  limit?: number;
}) {
  if (!isBusinessMemoryEnabled() || !hasBusinessMemoryPersistence()) return { profilesTouched: 0 };
  try {
    const context = await loadSourceContext({ supabase, adminMode: true, limit });
    return await syncContext(asDb(supabase), context);
  } catch (error) {
    if (isMissingBusinessMemorySchema(error)) return { profilesTouched: 0 };
    throw error;
  }
}

export async function loadAdminBusinessMemory({
  supabase,
  search,
}: {
  supabase: ServiceClient;
  search?: string | null;
}): Promise<BusinessMemoryAdminData> {
  if (!isBusinessMemoryEnabled()) return { enabled: false, safeMode: false, profiles: [], scoresByProfile: {}, metrics: emptyAdminMetrics() };
  if (!hasBusinessMemoryPersistence()) {
    return {
      enabled: true,
      safeMode: true,
      profiles: [],
      scoresByProfile: {},
      metrics: emptyAdminMetrics(),
      message: "Business Memory persistence is not configured.",
    };
  }

  try {
    const db = asDb(supabase);
    const term = normalizeText(search);
    let profilesQuery = db.from("business_memory_profiles").select("*").order("updated_at", { ascending: false }).limit(250);
    if (term && isBusinessMemorySearchEnabled()) profilesQuery = profilesQuery.or(`business_name.ilike.%${term}%,client_email.ilike.%${term}%,industry.ilike.%${term}%`);
    const profiles = (await safeRows("Business memory profiles", profilesQuery)) as BusinessMemoryProfileRow[];
    const profileIds = profiles.map((profile) => profile.id);
    const [scores, timeline, insights, campaigns, opportunities, savings] = await Promise.all([
      profileIds.length ? safeRows("Business memory scores", db.from("business_memory_scores").select("*").in("profile_id", profileIds).limit(250)) : Promise.resolve([]),
      profileIds.length ? safeRows("Business memory timeline count", db.from("business_memory_timeline").select("id,profile_id").in("profile_id", profileIds).limit(1000)) : Promise.resolve([]),
      profileIds.length ? safeRows("Business memory insights count", db.from("business_memory_insights").select("id,profile_id").in("profile_id", profileIds).limit(1000)) : Promise.resolve([]),
      profileIds.length ? safeRows("Business memory campaign count", db.from("business_memory_campaigns").select("id,profile_id").in("profile_id", profileIds).limit(1000)) : Promise.resolve([]),
      profileIds.length ? safeRows("Business memory opportunity count", db.from("business_memory_opportunities").select("id,profile_id").in("profile_id", profileIds).limit(1000)) : Promise.resolve([]),
      profileIds.length ? safeRows("Business memory savings count", db.from("business_memory_savings").select("id,profile_id").in("profile_id", profileIds).limit(1000)) : Promise.resolve([]),
    ]);
    const scoresByProfile = Object.fromEntries((scores as BusinessMemoryScoreRow[]).map((score) => [score.profile_id, score]));
    const scoreValues = Object.values(scoresByProfile).map((score) => numberValue(score.memory_completeness_score));
    return {
      enabled: true,
      safeMode: false,
      profiles,
      scoresByProfile,
      metrics: {
        profiles: profiles.length,
        averageScore: scoreValues.length ? Math.round(scoreValues.reduce((sum, score) => sum + score, 0) / scoreValues.length) : 0,
        timelineEvents: timeline.length,
        insights: insights.length,
        campaignsRemembered: campaigns.length,
        opportunitiesRemembered: opportunities.length,
        savingsRemembered: savings.length,
      },
    };
  } catch (error) {
    return {
      enabled: true,
      safeMode: true,
      profiles: [],
      scoresByProfile: {},
      metrics: emptyAdminMetrics(),
      message: error instanceof Error ? error.message : "Business Memory is in safe mode.",
    };
  }
}

function emptyAdminMetrics() {
  return {
    profiles: 0,
    averageScore: 0,
    timelineEvents: 0,
    insights: 0,
    campaignsRemembered: 0,
    opportunitiesRemembered: 0,
    savingsRemembered: 0,
  };
}

export async function loadBusinessMemoryProfile({
  supabase,
  profileId,
  search,
}: {
  supabase: ServiceClient;
  profileId: string;
  search?: string | null;
}): Promise<BusinessMemoryProfileData> {
  if (!isBusinessMemoryEnabled()) return emptyProfileData(false);

  try {
    const db = asDb(supabase);
    const [
      profile,
      score,
      geographies,
      campaigns,
      campaignResults,
      opportunities,
      offers,
      suppliers,
      savings,
      reputation,
      growth,
      aiCoo,
      timeline,
      insights,
    ] = await Promise.all([
      safeSingle("Business memory profile", db.from("business_memory_profiles").select("*").eq("id", profileId).maybeSingle()),
      safeSingle("Business memory score", db.from("business_memory_scores").select("*").eq("profile_id", profileId).maybeSingle()),
      safeRows("Business memory geographies", db.from("business_memory_geographies").select("*").eq("profile_id", profileId).order("updated_at", { ascending: false }).limit(250)),
      safeRows("Business memory campaigns", db.from("business_memory_campaigns").select("*").eq("profile_id", profileId).order("updated_at", { ascending: false }).limit(250)),
      safeRows("Business memory campaign results", db.from("business_memory_campaign_results").select("*").eq("profile_id", profileId).order("reporting_period_end", { ascending: false }).limit(250)),
      safeRows("Business memory opportunities", db.from("business_memory_opportunities").select("*").eq("profile_id", profileId).order("date_created", { ascending: false }).limit(250)),
      safeRows("Business memory offers", db.from("business_memory_offers").select("*").eq("profile_id", profileId).order("updated_at", { ascending: false }).limit(250)),
      safeRows("Business memory suppliers", db.from("business_memory_suppliers").select("*").eq("profile_id", profileId).order("updated_at", { ascending: false }).limit(250)),
      safeRows("Business memory savings", db.from("business_memory_savings").select("*").eq("profile_id", profileId).order("updated_at", { ascending: false }).limit(250)),
      safeRows("Business memory reputation", db.from("business_memory_reputation").select("*").eq("profile_id", profileId).order("updated_at", { ascending: false }).limit(100)),
      safeRows("Business memory growth", db.from("business_memory_growth").select("*").eq("profile_id", profileId).order("updated_at", { ascending: false }).limit(100)),
      safeRows("Business memory AI COO", db.from("business_memory_ai_coo").select("*").eq("profile_id", profileId).order("updated_at", { ascending: false }).limit(250)),
      safeRows("Business memory timeline", db.from("business_memory_timeline").select("*").eq("profile_id", profileId).order("event_date", { ascending: false }).limit(250)),
      safeRows("Business memory insights", db.from("business_memory_insights").select("*").eq("profile_id", profileId).order("confidence_score", { ascending: false }).limit(100)),
    ]);

    const term = normalizeText(search).toLowerCase();
    const shouldFilter = Boolean(term && isBusinessMemorySearchEnabled());
    const filterRows = <T extends JsonRecord>(rows: T[]) =>
      shouldFilter
        ? rows.filter((row) => JSON.stringify(row).toLowerCase().includes(term))
        : rows;

    return {
      enabled: true,
      safeMode: false,
      profile: profile as BusinessMemoryProfileRow | null,
      score: score as BusinessMemoryScoreRow | null,
      geographies: filterRows(geographies),
      campaigns: filterRows(campaigns),
      campaignResults: filterRows(campaignResults),
      opportunities: filterRows(opportunities),
      offers: filterRows(offers),
      suppliers: filterRows(suppliers),
      savings: filterRows(savings),
      reputation: filterRows(reputation),
      growth: filterRows(growth),
      aiCoo: filterRows(aiCoo),
      timeline: filterRows(timeline) as BusinessMemoryTimelineRow[],
      insights: filterRows(insights) as BusinessMemoryInsightRow[],
    };
  } catch (error) {
    return { ...emptyProfileData(true), message: error instanceof Error ? error.message : "Business Memory profile is unavailable." };
  }
}

function emptyProfileData(safeMode: boolean): BusinessMemoryProfileData {
  return {
    enabled: isBusinessMemoryEnabled(),
    safeMode,
    profile: null,
    score: null,
    geographies: [],
    campaigns: [],
    campaignResults: [],
    opportunities: [],
    offers: [],
    suppliers: [],
    savings: [],
    reputation: [],
    growth: [],
    aiCoo: [],
    timeline: [],
    insights: [],
  };
}

export async function loadClientBusinessMemory({
  supabase,
  user,
  autoSync = true,
}: {
  supabase: ServiceClient;
  user: Pick<User, "id"> & { email?: string | null };
  autoSync?: boolean;
}) {
  if (!isBusinessMemoryEnabled()) return emptyProfileData(false);
  if (!hasBusinessMemoryPersistence()) return { ...emptyProfileData(true), message: "Business Memory persistence is not configured." };

  const db = asDb(supabase);
  try {
    if (autoSync) await ensureBusinessMemoryForClient({ supabase, clientId: user.id, clientEmail: user.email });
    const byClient = await safeRows("Client memory profile", db.from("business_memory_profiles").select("*").eq("client_id", user.id).order("updated_at", { ascending: false }).limit(1));
    const byEmail = user.email
      ? await safeRows("Client memory profile by email", db.from("business_memory_profiles").select("*").ilike("client_email", normalizeEmail(user.email)).order("updated_at", { ascending: false }).limit(1))
      : [];
    const profile = mergeById([...byClient, ...byEmail])[0] as BusinessMemoryProfileRow | undefined;
    if (!profile) return emptyProfileData(false);
    return loadBusinessMemoryProfile({ supabase, profileId: profile.id });
  } catch (error) {
    return { ...emptyProfileData(true), message: error instanceof Error ? error.message : "Business Memory is in safe mode." };
  }
}

export async function loadBusinessMemorySignals({
  supabase,
  clientId,
  clientEmail,
}: {
  supabase: ServiceClient;
  clientId?: string | null;
  clientEmail?: string | null;
}): Promise<BusinessMemorySignals | null> {
  if (!isBusinessMemoryEnabled() || !hasBusinessMemoryPersistence()) return null;

  const db = asDb(supabase);
  const normalizedEmail = normalizeEmail(clientEmail);
  let profiles: any[] = [];
  if (clientId) profiles = await safeRows("Business memory signal profile", db.from("business_memory_profiles").select("*").eq("client_id", clientId).order("updated_at", { ascending: false }).limit(1));
  if (!profiles.length && normalizedEmail) {
    profiles = await safeRows("Business memory signal profile by email", db.from("business_memory_profiles").select("*").ilike("client_email", normalizedEmail).order("updated_at", { ascending: false }).limit(1));
  }
  const profile = profiles[0];
  if (!profile?.id) return null;

  const [aiCoo, opportunities, geographies, score] = await Promise.all([
    safeRows("Business memory signal AI COO", db.from("business_memory_ai_coo").select("*").eq("profile_id", profile.id).limit(300)),
    safeRows("Business memory signal opportunities", db.from("business_memory_opportunities").select("*").eq("profile_id", profile.id).limit(300)),
    safeRows("Business memory signal geographies", db.from("business_memory_geographies").select("*").eq("profile_id", profile.id).order("performance_score", { ascending: false }).limit(50)),
    safeSingle("Business memory signal score", db.from("business_memory_scores").select("*").eq("profile_id", profile.id).maybeSingle()),
  ]);

  const acceptedTypes = uniqueArray([
    aiCoo.filter((row) => row.accepted || row.completed).map((row) => row.recommendation_type),
    opportunities.filter((row) => row.accepted || row.completed).map((row) => row.opportunity_type),
  ]);
  const rejectedTypes = uniqueArray([
    aiCoo.filter((row) => row.rejected).map((row) => row.recommendation_type),
    opportunities.filter((row) => row.rejected).map((row) => row.opportunity_type),
  ]);
  const dismissedTypes = uniqueArray([
    aiCoo.filter((row) => row.dismissed).map((row) => row.recommendation_type),
    opportunities.filter((row) => row.dismissed).map((row) => row.opportunity_type),
  ]);
  const completedTypes = uniqueArray([
    aiCoo.filter((row) => row.completed).map((row) => row.recommendation_type),
    opportunities.filter((row) => row.completed).map((row) => row.opportunity_type),
  ]);

  return {
    profileId: profile.id,
    completenessScore: numberValue(score?.memory_completeness_score),
    acceptedTypes,
    rejectedTypes,
    dismissedTypes,
    completedTypes,
    bestGeographies: uniqueArray(geographies.filter((row) => ["best", "active"].includes(row.performance_status)).map((row) => row.name)).slice(0, 5),
    preferredCampaignTypes: asArray(profile.preferred_campaign_types),
    preferredOffers: asArray(profile.preferred_offers),
  };
}

export function applyBusinessMemoryToRecommendationSeeds<T extends RecommendationSeedLike>(
  seeds: T[],
  signals: BusinessMemorySignals | null,
) {
  if (!signals) return seeds;
  const accepted = new Set(signals.acceptedTypes);
  const completed = new Set(signals.completedTypes);
  const dismissed = new Set([...signals.dismissedTypes, ...signals.rejectedTypes]);

  return seeds.map((seed) => {
    const memoryNotes: string[] = [];
    let confidence = seed.confidenceScore;
    let urgency = seed.urgencyScore;
    let value = seed.valueScore;
    let recommendedAction = seed.recommendedAction;

    if (accepted.has(seed.opportunityType) || completed.has(seed.opportunityType)) {
      confidence += completed.has(seed.opportunityType) ? 10 : 7;
      value += 5;
      memoryNotes.push("Similar recommendations have been accepted before.");
    }

    if (dismissed.has(seed.opportunityType)) {
      confidence -= 10;
      urgency -= 5;
      recommendedAction = `${recommendedAction} Review prior dismissal history before presenting this again.`;
      memoryNotes.push("This recommendation type was previously dismissed or rejected.");
    }

    if (signals.preferredCampaignTypes.includes(seed.opportunityType)) {
      confidence += 5;
      memoryNotes.push("Matches a remembered campaign preference.");
    }

    return {
      ...seed,
      confidenceScore: clampScore(confidence),
      urgencyScore: clampScore(urgency),
      valueScore: clampScore(value),
      recommendedAction,
      metadata: {
        ...(seed.metadata ?? {}),
        businessMemory: {
          profileId: signals.profileId,
          completenessScore: signals.completenessScore,
          notes: memoryNotes,
          bestGeographies: signals.bestGeographies,
          preferredOffers: signals.preferredOffers.slice(0, 3),
        },
      },
    };
  });
}
