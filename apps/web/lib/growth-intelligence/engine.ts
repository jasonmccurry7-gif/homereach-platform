import type { User } from "@supabase/supabase-js";
import type { createServiceClient } from "@/lib/supabase/service";
import {
  hasGrowthIntelligencePersistence,
  isAdminIntelligenceEntriesEnabled,
  isGrowthAiDraftsEnabled,
  isGrowthClientMatchingEnabled,
  isGrowthIntelligenceEnabled,
  isGrowthReportingEnabled,
  isGrowthScoringEnabled,
} from "./config";

type ServiceClient = ReturnType<typeof createServiceClient>;
type QueryError = { message?: string } | null;
type RowsResult<T extends JsonRecord = JsonRecord> = { data: T[] | null; error: QueryError };
type RowResult<T extends JsonRecord = JsonRecord> = { data: T | null; error: QueryError };
type TableQuery<T extends JsonRecord = JsonRecord> = PromiseLike<RowsResult<T>> & {
  eq(column: string, value: unknown): TableQuery<T>;
  ilike(column: string, value: string): TableQuery<T>;
  in(column: string, values: unknown[]): TableQuery<T>;
  insert(payload: JsonRecord | JsonRecord[]): TableQuery<T>;
  is(column: string, value: null): TableQuery<T>;
  limit(count: number): TableQuery<T>;
  maybeSingle(): PromiseLike<RowResult<T>>;
  order(column: string, options?: { ascending?: boolean }): TableQuery<T>;
  select(columns?: string): TableQuery<T>;
  single(): PromiseLike<RowResult<T>>;
  update(payload: JsonRecord): TableQuery<T>;
};
type Db = ReturnType<typeof createServiceClient> & {
  from(table: string): TableQuery;
};

type JsonRecord = Record<string, unknown>;
type UnknownRow = JsonRecord & {
  address?: string | null;
  budget_estimate_cents?: unknown;
  business_memory_profile_id?: string | null;
  business_name?: string | null;
  campaign_name?: string | null;
  campaign_status?: string | null;
  category?: string | null;
  city?: string | null;
  client_email?: string | null;
  client_id?: string | null;
  contact_name?: string | null;
  copy_count?: unknown;
  county?: string | null;
  created_at?: string | null;
  direct_mail_requested?: boolean | null;
  direct_mail_status?: string | null;
  district?: string | null;
  election_date?: string | null;
  email?: string | null;
  estimated_annual_savings_cents?: unknown;
  estimated_deal_value_cents?: unknown;
  estimated_savings_cents?: unknown;
  geography_value?: string | null;
  id?: string | null;
  industry?: string | null;
  launch_status?: string | null;
  market_capture_lead_id?: string | null;
  monthly_ad_budget?: unknown;
  monthly_ad_budget_cents?: unknown;
  monthly_management_fee?: unknown;
  name?: string | null;
  office?: string | null;
  postcard_addon?: boolean | null;
  primary_cities?: unknown;
  primary_counties?: unknown;
  primary_zip_codes?: unknown;
  profile_id?: string | null;
  score?: unknown;
  status?: string | null;
  target_address?: unknown;
  target_area?: unknown;
  target_geography?: unknown;
  target_locations?: unknown;
  targeting_type?: string | null;
  updated_at?: string | null;
  value?: string | null;
};

export type GrowthStatus =
  | "new_opportunity"
  | "needs_review"
  | "recommended_to_client"
  | "client_approved"
  | "campaign_created"
  | "in_progress"
  | "completed"
  | "dismissed"
  | "expired";

export type GrowthOpportunityRow = {
  id: string;
  client_id: string | null;
  client_email: string | null;
  business_memory_profile_id: string | null;
  admin_entry_id: string | null;
  opportunity_type: string;
  category: string;
  title: string;
  why_it_matters: string;
  recommended_action: string;
  estimated_revenue_potential_cents: number;
  confidence_score: number;
  priority_score: number;
  growth_score: number;
  source: string;
  source_table: string | null;
  source_id: string | null;
  status: GrowthStatus;
  priority_label: "high" | "medium" | "low";
  client_fit_summary: string | null;
  recommended_campaign_type: string;
  owner: string | null;
  next_action: string | null;
  notes: string | null;
  due_at: string | null;
  reviewed_at: string | null;
  approved_at: string | null;
  campaign_created_at: string | null;
  completed_at: string | null;
  expires_at: string | null;
  metadata: JsonRecord | null;
  created_at: string;
  updated_at: string;
};

export type GrowthAdminEntryRow = {
  id: string;
  name: string;
  entry_type: string;
  location: string | null;
  client_fit: string | null;
  notes: string | null;
  estimated_opportunity_cents: number;
  priority: number;
  status: string;
  industry_fit: string[] | null;
  geography_fit: string[] | null;
  client_fit_tags: string[] | null;
  campaign_type_fit: string[] | null;
  budget_fit: string | null;
  urgency: string;
  created_by: string | null;
  metadata: JsonRecord | null;
  created_at: string;
  updated_at: string;
};

export type GrowthDraftRow = {
  id: string;
  opportunity_id: string;
  draft_type: string;
  label: string;
  content: string;
  approval_status: string;
  copy_count: number;
};

export type GrowthScoreRow = {
  id: string;
  score: number;
  color: "green" | "yellow" | "red";
  revenue_potential_score: number;
  client_fit_score: number;
  timing_score: number;
  geography_fit_score: number;
  prior_acceptance_score: number;
  campaign_readiness_score: number;
  urgency_score: number;
  priority_label: "high" | "medium" | "low";
  current_status: string;
  recommended_action: string;
  top_opportunity_id: string | null;
  calculated_at: string;
};

export type GrowthReportRow = {
  id: string;
  reporting_period_start: string;
  reporting_period_end: string;
  opportunities_found: number;
  opportunities_approved: number;
  opportunities_converted: number;
  estimated_revenue_potential_cents: number;
  actual_campaigns_created: number;
  dismissed_opportunities: number;
  top_categories: JsonRecord[] | null;
  top_clients: JsonRecord[] | null;
  recommended_next_actions: string | null;
};

export type GrowthMetrics = {
  totalOpportunities: number;
  highPriority: number;
  estimatedRevenuePotentialCents: number;
  approved: number;
  dismissed: number;
  convertedToCampaigns: number;
  adminEntries: number;
  clientMatches: number;
  topCategory: string;
};

export type GrowthCenterData = {
  enabled: boolean;
  safeMode: boolean;
  message?: string;
  opportunities: GrowthOpportunityRow[];
  draftsByOpportunity: Record<string, GrowthDraftRow[]>;
  adminEntries: GrowthAdminEntryRow[];
  clientMatches: UnknownRow[];
  actions: UnknownRow[];
  score: GrowthScoreRow | null;
  report: GrowthReportRow | null;
  metrics: GrowthMetrics;
};

type ClientIdentity = {
  clientId: string | null;
  clientEmail: string | null;
  businessMemoryProfileId: string | null;
  businessName: string | null;
  contactName: string | null;
  industry: string | null;
  markets: string[];
  campaignTypes: string[];
  monthlyBudgetCents: number;
  acceptedTypes: string[];
  dismissedTypes: string[];
};

type GrowthSeed = {
  identity: ClientIdentity;
  opportunityType: string;
  category: string;
  title: string;
  whyItMatters: string;
  recommendedAction: string;
  estimatedRevenueCents: number;
  confidence: number;
  revenueScore: number;
  clientFitScore: number;
  timingScore: number;
  geographyFitScore: number;
  priorAcceptanceScore: number;
  campaignReadinessScore: number;
  urgencyScore: number;
  sourceType: string;
  sourceTable: string;
  sourceId: string;
  sourceLabel: string;
  adminEntryId?: string | null;
  recommendedCampaignType: string;
  clientFitSummary?: string | null;
  metadata?: JsonRecord;
};

const OPEN_STATUSES = new Set<GrowthStatus>([
  "new_opportunity",
  "needs_review",
  "recommended_to_client",
  "client_approved",
  "campaign_created",
  "in_progress",
]);

const TABLES_WITHOUT_UPDATED_AT = new Set(["growth_intelligence_actions", "growth_intelligence_drafts"]);

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
  if (typeof value === "string" && value.trim()) {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function uniqueArray(values: unknown[]) {
  return Array.from(new Set(values.flatMap(asArray).map((value) => value.trim()).filter(Boolean)));
}

function firstNonEmpty(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function startOfMonthIso() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

function endOfMonthIso() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
}

function addDaysIso(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function daysSince(value: unknown) {
  const date = new Date(String(value ?? ""));
  if (Number.isNaN(date.getTime())) return 0;
  return Math.floor((Date.now() - date.getTime()) / 86400000);
}

function isMissingGrowthSchema(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /growth_intelligence_|schema cache|does not exist|relation/i.test(message);
}

async function safeRows<T extends JsonRecord = UnknownRow>(label: string, query: PromiseLike<RowsResult<T>>): Promise<T[]> {
  const { data, error } = await query;
  if (error) {
    const message = `${label}: ${error.message ?? "query failed"}`;
    if (/does not exist|schema cache|relation/i.test(message)) return [];
    throw new Error(message);
  }
  return data ?? [];
}

async function safeSingle<T extends JsonRecord = UnknownRow>(label: string, query: PromiseLike<RowResult<T>>): Promise<T | null> {
  const { data, error } = await query;
  if (error) {
    const message = `${label}: ${error.message ?? "query failed"}`;
    if (/does not exist|schema cache|relation|multiple rows|no rows/i.test(message)) return null;
    throw new Error(message);
  }
  return data ?? null;
}

async function findByLookup(db: Db, table: string, lookup: JsonRecord) {
  let query = db.from(table).select("*").limit(1);
  for (const [key, value] of Object.entries(lookup)) {
    query = value === null ? query.is(key, null) : query.eq(key, value);
  }
  const rows = await safeRows(`${table} lookup`, query);
  return rows[0] ?? null;
}

async function upsertByLookup(db: Db, table: string, lookup: JsonRecord, payload: JsonRecord) {
  const now = new Date().toISOString();
  const existing = await findByLookup(db, table, lookup);
  if (existing?.id) {
    const updatePayload = TABLES_WITHOUT_UPDATED_AT.has(table) ? payload : { ...payload, updated_at: now };
    const { data, error } = await db.from(table).update(updatePayload).eq("id", existing.id).select("*").single();
    if (error) throw new Error(`${table} update failed: ${error.message}`);
    return data;
  }

  const { data, error } = await db.from(table).insert({ ...lookup, ...payload }).select("*").single();
  if (error) throw new Error(`${table} insert failed: ${error.message}`);
  return data;
}

function clientLookup(identity: Pick<ClientIdentity, "clientId" | "clientEmail">) {
  return identity.clientId
    ? { client_id: identity.clientId }
    : { client_email: normalizeEmail(identity.clientEmail) };
}

function clientKeyFromRow(row: UnknownRow | null | undefined) {
  return row?.client_id || normalizeEmail(row?.client_email) || row?.business_memory_profile_id || "";
}

function clientKey(identity: Pick<ClientIdentity, "clientId" | "clientEmail" | "businessMemoryProfileId">) {
  return identity.clientId || normalizeEmail(identity.clientEmail) || identity.businessMemoryProfileId || "";
}

function priorityLabel(score: number): "high" | "medium" | "low" {
  if (score >= 76) return "high";
  if (score >= 50) return "medium";
  return "low";
}

function scoreColor(score: number): "green" | "yellow" | "red" {
  if (score >= 76) return "green";
  if (score >= 50) return "yellow";
  return "red";
}

function growthScore(seed: GrowthSeed) {
  return clampScore(
    seed.revenueScore * 0.25 +
      seed.clientFitScore * 0.18 +
      seed.timingScore * 0.15 +
      seed.geographyFitScore * 0.12 +
      seed.priorAcceptanceScore * 0.1 +
      seed.campaignReadinessScore * 0.1 +
      seed.urgencyScore * 0.1,
  );
}

function campaignIsLive(campaign: UnknownRow | null | undefined) {
  return ["live", "reporting", "renewal_opportunity"].includes(String(campaign?.campaign_status)) ||
    ["live", "manual_launch_complete"].includes(String(campaign?.launch_status));
}

function hasDirectMail(campaign: UnknownRow | null | undefined, lead: UnknownRow | null | undefined) {
  return Boolean(campaign?.direct_mail_requested || lead?.postcard_addon) ||
    !["", "not_requested", "none"].includes(String(campaign?.direct_mail_status ?? ""));
}

function hasDigital(campaign: UnknownRow | null | undefined, lead: UnknownRow | null | undefined) {
  const type = String(lead?.targeting_type ?? campaign?.targeting_type ?? "");
  return type.includes("digital") || type.includes("jobsite") || type.includes("competitor") || campaignIsLive(campaign);
}

function targetArea(lead: UnknownRow | null | undefined, campaign: UnknownRow | null | undefined) {
  return firstNonEmpty(campaign?.target_geography, lead?.target_area, lead?.target_address, "the target area") ?? "the target area";
}

function managementValue(lead: UnknownRow | null | undefined, campaign: UnknownRow | null | undefined) {
  return numberValue(campaign?.monthly_management_fee, numberValue(lead?.monthly_management_fee, 49900));
}

function adBudgetValue(lead: UnknownRow | null | undefined, campaign: UnknownRow | null | undefined) {
  return numberValue(campaign?.monthly_ad_budget, numberValue(lead?.monthly_ad_budget, numberValue(lead?.monthly_ad_budget_cents, 0)));
}

function recommendedCampaignTypeForOpportunity(type: string) {
  if (type.includes("political")) return "political_campaign";
  if (type.includes("review")) return "review_campaign";
  if (type.includes("referral")) return "referral_campaign";
  if (type.includes("supplyfy")) return "supplyfy_cross_sell";
  if (type.includes("direct_mail_digital")) return "direct_mail_digital_bundle";
  if (type.includes("direct_mail")) return "direct_mail";
  if (type.includes("digital") || type.includes("competitor") || type.includes("jobsite") || type.includes("neighborhood")) return "market_capture";
  return "general_growth_task";
}

async function loadSourceContext({
  db,
  adminMode = false,
  clientId,
  clientEmail,
  limit,
}: {
  db: Db;
  adminMode?: boolean;
  clientId?: string | null;
  clientEmail?: string | null;
  limit?: number;
}) {
  const normalizedEmail = normalizeEmail(clientEmail);
  const leadQueries: Array<Promise<UnknownRow[]>> = [];
  if (adminMode) {
    leadQueries.push(safeRows("Market Capture leads", db.from("market_capture_leads").select("*").order("updated_at", { ascending: false }).limit(limit ?? 300)));
  } else {
    if (clientId) leadQueries.push(safeRows("Market Capture leads by client", db.from("market_capture_leads").select("*").eq("client_id", clientId).order("updated_at", { ascending: false }).limit(120)));
    if (normalizedEmail) leadQueries.push(safeRows("Market Capture leads by email", db.from("market_capture_leads").select("*").ilike("email", normalizedEmail).order("updated_at", { ascending: false }).limit(120)));
  }

  const leads = mergeById((await Promise.all(leadQueries)).flat());
  const leadIds = leads.map((lead) => lead.id).filter(Boolean);
  const campaignQueries: Array<Promise<UnknownRow[]>> = [];
  if (adminMode) {
    campaignQueries.push(safeRows("Market Capture campaigns", db.from("market_capture_campaigns").select("*").order("updated_at", { ascending: false }).limit(limit ?? 300)));
  } else {
    if (clientId) campaignQueries.push(safeRows("Market Capture campaigns by client", db.from("market_capture_campaigns").select("*").eq("client_id", clientId).order("updated_at", { ascending: false }).limit(120)));
    if (leadIds.length > 0) campaignQueries.push(safeRows("Market Capture campaigns by lead", db.from("market_capture_campaigns").select("*").in("market_capture_lead_id", leadIds).order("updated_at", { ascending: false }).limit(120)));
  }
  const campaigns = mergeById((await Promise.all(campaignQueries)).flat());
  const campaignIds = campaigns.map((campaign) => campaign.id).filter(Boolean);

  const profileQueries: Array<Promise<UnknownRow[]>> = [];
  if (adminMode) {
    profileQueries.push(safeRows("Business memory profiles", db.from("business_memory_profiles").select("*").order("updated_at", { ascending: false }).limit(limit ?? 300)));
  } else {
    if (clientId) profileQueries.push(safeRows("Business memory profiles by client", db.from("business_memory_profiles").select("*").eq("client_id", clientId).order("updated_at", { ascending: false }).limit(20)));
    if (normalizedEmail) profileQueries.push(safeRows("Business memory profiles by email", db.from("business_memory_profiles").select("*").ilike("client_email", normalizedEmail).order("updated_at", { ascending: false }).limit(20)));
  }
  const memoryProfiles = mergeById((await Promise.all(profileQueries)).flat());
  const profileIds = memoryProfiles.map((profile) => profile.id).filter(Boolean);

  const byClientOrEmail = async (table: string, orderColumn = "updated_at", rowLimit = 250) => {
    if (adminMode) return safeRows(table, db.from(table).select("*").order(orderColumn, { ascending: false }).limit(rowLimit));
    const queries: Array<Promise<UnknownRow[]>> = [];
    if (clientId) queries.push(safeRows(`${table} by client`, db.from(table).select("*").eq("client_id", clientId).order(orderColumn, { ascending: false }).limit(rowLimit)));
    if (normalizedEmail) queries.push(safeRows(`${table} by email`, db.from(table).select("*").ilike("client_email", normalizedEmail).order(orderColumn, { ascending: false }).limit(rowLimit)));
    return mergeById((await Promise.all(queries)).flat());
  };

  const [
    locations,
    reports,
    memoryGeographies,
    memoryOpportunities,
    memoryGrowth,
    costOpportunities,
    costScores,
    reputationOpportunities,
    reputationScores,
    adminEntries,
    politicalCampaigns,
  ] = await Promise.all([
    campaignIds.length
      ? safeRows("Market Capture locations", db.from("market_capture_campaign_locations").select("*").in("campaign_id", campaignIds).limit(limit ?? 500))
      : Promise.resolve([]),
    campaignIds.length
      ? safeRows("Market Capture reports", db.from("market_capture_reports").select("*").in("campaign_id", campaignIds).order("updated_at", { ascending: false }).limit(limit ?? 500))
      : Promise.resolve([]),
    profileIds.length
      ? safeRows("Business memory geographies", db.from("business_memory_geographies").select("*").in("profile_id", profileIds).order("updated_at", { ascending: false }).limit(limit ?? 500))
      : Promise.resolve([]),
    profileIds.length
      ? safeRows("Business memory opportunities", db.from("business_memory_opportunities").select("*").in("profile_id", profileIds).order("updated_at", { ascending: false }).limit(limit ?? 500))
      : Promise.resolve([]),
    profileIds.length
      ? safeRows("Business memory growth", db.from("business_memory_growth").select("*").in("profile_id", profileIds).order("updated_at", { ascending: false }).limit(limit ?? 500))
      : Promise.resolve([]),
    byClientOrEmail("cost_control_opportunities", "priority_score", limit ?? 250),
    byClientOrEmail("cost_control_scores", "score", limit ?? 250),
    byClientOrEmail("reputation_opportunities", "priority_score", limit ?? 250),
    byClientOrEmail("reputation_scores", "score", limit ?? 250),
    isAdminIntelligenceEntriesEnabled()
      ? safeRows("Growth intelligence admin entries", db.from("growth_intelligence_admin_entries").select("*").in("status", ["active", "needs_review", "matched"]).order("priority", { ascending: false }).limit(limit ?? 250))
      : Promise.resolve([]),
    process.env.ENABLE_POLITICAL_MODULE === "false"
      ? Promise.resolve([])
      : safeRows("Political campaigns", db.from("political_campaigns").select("*").order("updated_at", { ascending: false }).limit(limit ?? 120)),
  ]);

  return {
    leads,
    campaigns,
    locations,
    reports,
    memoryProfiles,
    memoryGeographies,
    memoryOpportunities,
    memoryGrowth,
    costOpportunities,
    costScores,
    reputationOpportunities,
    reputationScores,
    adminEntries: adminEntries as GrowthAdminEntryRow[],
    politicalCampaigns,
  };
}

function mergeById<T extends UnknownRow>(rows: T[]) {
  const map = new Map<string, T>();
  for (const row of rows) {
    if (row?.id) map.set(row.id, row);
  }
  return Array.from(map.values());
}

function rowsBy<T extends UnknownRow>(rows: T[], key: string) {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const value = normalizeText(row[key]);
    if (!value) continue;
    map.set(value, [...(map.get(value) ?? []), row]);
  }
  return map;
}

function buildClientIdentities(context: Awaited<ReturnType<typeof loadSourceContext>>) {
  const leadsById = new Map(context.leads.map((lead) => [lead.id, lead]));
  const geographiesByProfile = rowsBy(context.memoryGeographies, "profile_id");
  const opportunitiesByProfile = rowsBy(context.memoryOpportunities, "profile_id");
  const identities = new Map<string, ClientIdentity>();

  function merge(identity: Partial<ClientIdentity>) {
    const key = identity.clientId || normalizeEmail(identity.clientEmail) || identity.businessMemoryProfileId;
    if (!key) return null;
    const current = identities.get(key) ?? {
      clientId: identity.clientId ?? null,
      clientEmail: identity.clientEmail ?? null,
      businessMemoryProfileId: identity.businessMemoryProfileId ?? null,
      businessName: identity.businessName ?? null,
      contactName: identity.contactName ?? null,
      industry: identity.industry ?? null,
      markets: [],
      campaignTypes: [],
      monthlyBudgetCents: 0,
      acceptedTypes: [],
      dismissedTypes: [],
    };
    current.clientId = current.clientId ?? identity.clientId ?? null;
    current.clientEmail = current.clientEmail ?? identity.clientEmail ?? null;
    current.businessMemoryProfileId = current.businessMemoryProfileId ?? identity.businessMemoryProfileId ?? null;
    current.businessName = current.businessName ?? identity.businessName ?? null;
    current.contactName = current.contactName ?? identity.contactName ?? null;
    current.industry = current.industry ?? identity.industry ?? null;
    current.markets = uniqueArray([current.markets, identity.markets]);
    current.campaignTypes = uniqueArray([current.campaignTypes, identity.campaignTypes]);
    current.monthlyBudgetCents = Math.max(current.monthlyBudgetCents, numberValue(identity.monthlyBudgetCents));
    current.acceptedTypes = uniqueArray([current.acceptedTypes, identity.acceptedTypes]);
    current.dismissedTypes = uniqueArray([current.dismissedTypes, identity.dismissedTypes]);
    identities.set(key, current);
    return current;
  }

  for (const profile of context.memoryProfiles) {
    const profileId = normalizeText(profile.id);
    const geographyRows = geographiesByProfile.get(profileId) ?? [];
    const remembered = opportunitiesByProfile.get(profileId) ?? [];
    merge({
      clientId: profile.client_id ?? null,
      clientEmail: profile.client_email ?? null,
      businessMemoryProfileId: profileId,
      businessName: profile.business_name ?? null,
      industry: profile.industry ?? null,
      markets: uniqueArray([
        profile.markets_served,
        profile.primary_cities,
        profile.primary_zip_codes,
        profile.primary_counties,
        geographyRows.map((row) => [row.name, row.value, row.address]),
      ]),
      campaignTypes: asArray(profile.preferred_campaign_types),
      acceptedTypes: remembered.filter((row) => row.accepted).map((row) => row.opportunity_type),
      dismissedTypes: remembered.filter((row) => row.dismissed || row.rejected).map((row) => row.opportunity_type),
    });
  }

  for (const lead of context.leads) {
    merge({
      clientId: lead.client_id ?? null,
      clientEmail: lead.email ?? null,
      businessName: lead.business_name ?? null,
      contactName: lead.contact_name ?? null,
      industry: lead.industry ?? null,
      markets: uniqueArray([lead.target_area, lead.target_address, lead.target_locations]),
      campaignTypes: uniqueArray([lead.targeting_type, lead.postcard_addon ? "direct_mail" : null]),
      monthlyBudgetCents: numberValue(lead.monthly_ad_budget_cents, numberValue(lead.monthly_ad_budget)),
    });
  }

  for (const campaign of context.campaigns) {
    const lead = leadsById.get(campaign.market_capture_lead_id) ?? null;
    merge({
      clientId: campaign.client_id ?? lead?.client_id ?? null,
      clientEmail: lead?.email ?? null,
      businessName: lead?.business_name ?? campaign.campaign_name ?? null,
      contactName: lead?.contact_name ?? null,
      industry: lead?.industry ?? null,
      markets: uniqueArray([campaign.target_geography, lead?.target_area]),
      campaignTypes: uniqueArray([lead?.targeting_type, campaign.direct_mail_requested ? "direct_mail" : null, campaignIsLive(campaign) ? "digital" : null]),
      monthlyBudgetCents: Math.max(adBudgetValue(lead, campaign), managementValue(lead, campaign)),
    });
  }

  return Array.from(identities.values()).filter((identity) => identity.clientId || identity.clientEmail);
}

function identityFromRows(rows: Array<UnknownRow | null | undefined>): ClientIdentity | null {
  const row = rows.find(Boolean);
  if (!row) return null;
  return {
    clientId: row.client_id ?? null,
    clientEmail: row.client_email ?? null,
    businessMemoryProfileId: row.business_memory_profile_id ?? row.profile_id ?? null,
    businessName: row.business_name ?? row.campaign_name ?? null,
    contactName: row.contact_name ?? null,
    industry: row.industry ?? null,
    markets: [],
    campaignTypes: [],
    monthlyBudgetCents: 0,
    acceptedTypes: [],
    dismissedTypes: [],
  };
}

function seedKey(seed: GrowthSeed) {
  return [
    clientKey(seed.identity),
    seed.opportunityType,
    seed.sourceTable,
    seed.sourceId,
  ].join("|");
}

function sourceTypeForAdminEntry(entryType: string) {
  if (entryType === "political_race") return "political";
  return "admin_entry";
}

function opportunityTypeForAdminEntry(entryType: string) {
  const map: Record<string, string> = {
    competitor: "competitor_area_opportunity",
    local_event: "event_campaign_opportunity",
    neighborhood: "neighborhood_expansion",
    development: "neighborhood_expansion",
    seasonal_opportunity: "seasonal_campaign_opportunity",
    political_race: "political_geography_opportunity",
    local_business_category: "service_area_expansion",
    storm_weather_note: "seasonal_campaign_opportunity",
    community_opportunity: "event_campaign_opportunity",
    referral_target: "referral_growth_opportunity",
    partnership_target: "new_offer_opportunity",
  };
  return map[entryType] ?? "new_offer_opportunity";
}

function categoryForOpportunity(type: string) {
  if (type.includes("competitor")) return "Competitor Area";
  if (type.includes("political")) return "Political Geography";
  if (type.includes("seasonal")) return "Seasonal";
  if (type.includes("event")) return "Event";
  if (type.includes("direct_mail_digital")) return "Digital + Direct Mail Bundle";
  if (type.includes("direct_mail")) return "Direct Mail";
  if (type.includes("digital")) return "Digital Expansion";
  if (type.includes("referral")) return "Referral Growth";
  if (type.includes("review")) return "Review Growth";
  if (type.includes("supplyfy")) return "Supplyfy Cross-Sell";
  if (type.includes("dormant")) return "Reactivation";
  if (type.includes("jobsite")) return "Jobsite Density";
  if (type.includes("neighborhood")) return "Neighborhood Expansion";
  if (type.includes("service_area")) return "Service Area";
  return "Growth";
}

function buildInternalSeeds(context: Awaited<ReturnType<typeof loadSourceContext>>) {
  const seeds: GrowthSeed[] = [];
  const leadsById = new Map(context.leads.map((lead) => [lead.id, lead]));
  const locationsByCampaign = rowsBy(context.locations, "campaign_id");
  const reportsByCampaign = rowsBy(context.reports, "campaign_id");
  const identityMap = new Map(buildClientIdentities(context).map((identity) => [clientKey(identity), identity]));

  function identityFor(lead: UnknownRow | null | undefined, campaign: UnknownRow | null | undefined): ClientIdentity | null {
    const key = campaign?.client_id || lead?.client_id || normalizeEmail(lead?.email);
    if (!key) return null;
    return identityMap.get(key) ?? identityFromRows([campaign, lead]);
  }

  for (const campaign of context.campaigns) {
    const lead = leadsById.get(campaign.market_capture_lead_id) ?? null;
    const identity = identityFor(lead, campaign);
    if (!identity) continue;
    const campaignId = normalizeText(campaign.id);
    const locations = locationsByCampaign.get(campaignId) ?? [];
    const reports = reportsByCampaign.get(campaignId) ?? [];
    const area = targetArea(lead, campaign);
    const value = Math.max(managementValue(lead, campaign), Math.round(adBudgetValue(lead, campaign) * 1.5), 49900);
    const priorBoost = identity.acceptedTypes.length > 0 ? 72 : 50;

    if ((String(lead?.targeting_type ?? "").includes("jobsite") || locations.length > 0) && locations.length <= 2) {
      seeds.push({
        identity,
        opportunityType: "jobsite_density_opportunity",
        category: "Jobsite Density",
        title: "Turn recent jobsites into a repeatable neighborhood plan",
        whyItMatters: `${identity.businessName ?? "This business"} has jobsite or target-area context around ${area}, but the next neighborhood expansion is not yet structured.`,
        recommendedAction: "Review the jobsite density, choose the next nearby neighborhood, and create a Market Capture proposal.",
        estimatedRevenueCents: value,
        confidence: 72,
        revenueScore: 66,
        clientFitScore: 78,
        timingScore: campaignIsLive(campaign) ? 76 : 55,
        geographyFitScore: locations.length > 0 ? 68 : 52,
        priorAcceptanceScore: priorBoost,
        campaignReadinessScore: campaignIsLive(campaign) ? 72 : 50,
        urgencyScore: 62,
        sourceType: "market_capture",
        sourceTable: "market_capture_campaigns",
        sourceId: campaignId,
        sourceLabel: "Market Capture campaign",
        recommendedCampaignType: "market_capture",
        clientFitSummary: "Jobsite context is already available.",
        metadata: { area, locationCount: locations.length, noExternalScraping: true },
      });
    }

    if (hasDigital(campaign, lead) && !hasDirectMail(campaign, lead)) {
      seeds.push({
        identity,
        opportunityType: "direct_mail_expansion",
        category: "Direct Mail",
        title: "Add postcards to reinforce the same growth area",
        whyItMatters: `Digital visibility is already planned or active around ${area}. A postcard layer can create repeated exposure without changing the core offer.`,
        recommendedAction: "Create a direct mail add-on proposal for the same geography and keep results language advisory.",
        estimatedRevenueCents: Math.max(value, 150000),
        confidence: 76,
        revenueScore: 72,
        clientFitScore: 80,
        timingScore: campaignIsLive(campaign) ? 72 : 58,
        geographyFitScore: 70,
        priorAcceptanceScore: priorBoost,
        campaignReadinessScore: 68,
        urgencyScore: 54,
        sourceType: "direct_mail",
        sourceTable: "market_capture_campaigns",
        sourceId: campaignId,
        sourceLabel: "Digital without direct mail",
        recommendedCampaignType: "direct_mail",
        clientFitSummary: "Digital targeting exists and the direct mail add-on is not active.",
        metadata: { area, directMailStatus: campaign.direct_mail_status },
      });
    }

    if (hasDirectMail(campaign, lead) && !hasDigital(campaign, lead)) {
      seeds.push({
        identity,
        opportunityType: "digital_expansion",
        category: "Digital Expansion",
        title: "Pair direct mail with digital visibility",
        whyItMatters: `Postcards are requested or active around ${area}. Adding digital reminders can keep the business visible between mail touches.`,
        recommendedAction: "Review the same geography and build a Market Capture digital add-on proposal.",
        estimatedRevenueCents: Math.max(value, 49900),
        confidence: 68,
        revenueScore: 60,
        clientFitScore: 74,
        timingScore: 60,
        geographyFitScore: 70,
        priorAcceptanceScore: priorBoost,
        campaignReadinessScore: 58,
        urgencyScore: 50,
        sourceType: "market_capture",
        sourceTable: "market_capture_campaigns",
        sourceId: campaignId,
        sourceLabel: "Direct mail without digital",
        recommendedCampaignType: "market_capture",
        clientFitSummary: "Direct mail context exists and can support a matching digital plan.",
        metadata: { area, directMailStatus: campaign.direct_mail_status },
      });
    }

    if (daysSince(campaign.updated_at ?? campaign.created_at) >= 45 && ["live", "reporting", "closed", "renewal_opportunity"].includes(String(campaign.campaign_status))) {
      seeds.push({
        identity,
        opportunityType: "dormant_geography_reactivation",
        category: "Reactivation",
        title: "Reactivate an older growth area",
        whyItMatters: `${area} has campaign history but no recent follow-up signal. Dormant markets are easier to restart when the prior context is already known.`,
        recommendedAction: "Review the prior campaign notes and create a reactivation task or proposal for this geography.",
        estimatedRevenueCents: value,
        confidence: reports.length > 0 ? 70 : 58,
        revenueScore: 58,
        clientFitScore: 68,
        timingScore: 62,
        geographyFitScore: 74,
        priorAcceptanceScore: priorBoost,
        campaignReadinessScore: 52,
        urgencyScore: 48,
        sourceType: "business_memory",
        sourceTable: "market_capture_campaigns",
        sourceId: campaignId,
        sourceLabel: "Dormant campaign geography",
        recommendedCampaignType: "market_capture",
        clientFitSummary: "The market has prior HomeReach activity and can be reactivated.",
        metadata: { area, daysSinceUpdate: daysSince(campaign.updated_at ?? campaign.created_at), reportCount: reports.length },
      });
    }

    if (campaignIsLive(campaign) && locations.length <= 1) {
      seeds.push({
        identity,
        opportunityType: "neighborhood_expansion",
        category: "Neighborhood Expansion",
        title: "Expand from one area into the next neighborhood",
        whyItMatters: `The current campaign is focused around ${area}. A nearby neighborhood can become the next controlled growth step.`,
        recommendedAction: "Pick one adjacent neighborhood and create a simple expansion proposal.",
        estimatedRevenueCents: Math.max(value, 99900),
        confidence: 66,
        revenueScore: 62,
        clientFitScore: 72,
        timingScore: 58,
        geographyFitScore: 64,
        priorAcceptanceScore: priorBoost,
        campaignReadinessScore: 64,
        urgencyScore: 46,
        sourceType: "market_capture",
        sourceTable: "market_capture_campaigns",
        sourceId: campaignId,
        sourceLabel: "Low saturation campaign",
        recommendedCampaignType: "market_capture",
        clientFitSummary: "The campaign has a focused footprint and room for controlled expansion.",
        metadata: { saturationSignal: "location_count_low", locationCount: locations.length, area },
      });
    }
  }

  for (const lead of context.leads) {
    const identity = identityFor(lead, null);
    if (!identity) continue;
    const type = String(lead.targeting_type ?? "");
    const area = targetArea(lead, null);
    const value = Math.max(numberValue(lead.monthly_ad_budget_cents, numberValue(lead.monthly_ad_budget)), 49900);
    const typedSeeds: Array<[boolean, string, string, string, string]> = [
      [type.includes("competitor_area"), "competitor_area_opportunity", "Competitor Area", "Competitor-area visibility can be reviewed safely at the geography level.", "Confirm allowed geography and create a neutral competitor-area campaign proposal."],
      [type.includes("event_area"), "event_campaign_opportunity", "Event", "Event timing gives the business a focused reason to show up in a local area.", "Review event dates, location, and offer, then build a campaign proposal."],
      [type.includes("political_geography"), "political_geography_opportunity", "Political Geography", "Political geography can create compliant awareness opportunities when kept at district, county, city, ZIP, or campaign-provided audience level.", "Prepare a neutral political awareness plan and avoid ideology prediction or voter scoring."],
      [type.includes("digital_direct_mail"), "direct_mail_digital_bundle", "Digital + Direct Mail Bundle", "The intake already points to a bundled visibility strategy.", "Build a combined digital and direct mail proposal for the same geography."],
      [type.includes("service_area"), "service_area_expansion", "Service Area", "The service area is explicit and can be turned into a clear growth plan.", "Choose the most valuable service area and prepare a campaign recommendation."],
    ];
    for (const [condition, opportunityType, category, why, action] of typedSeeds) {
      if (!condition) continue;
      seeds.push({
        identity,
        opportunityType,
        category,
        title: `${category} opportunity is ready for review`,
        whyItMatters: `${why} Target area: ${area}.`,
        recommendedAction: action,
        estimatedRevenueCents: value,
        confidence: 68,
        revenueScore: 62,
        clientFitScore: 70,
        timingScore: 58,
        geographyFitScore: 64,
        priorAcceptanceScore: identity.acceptedTypes.length > 0 ? 70 : 50,
        campaignReadinessScore: 52,
        urgencyScore: opportunityType.includes("event") || opportunityType.includes("political") ? 68 : 54,
        sourceType: "market_capture",
        sourceTable: "market_capture_leads",
        sourceId: normalizeText(lead.id),
        sourceLabel: "Market Capture intake",
        recommendedCampaignType: recommendedCampaignTypeForOpportunity(opportunityType),
        clientFitSummary: "The intake request already contains the targeting signal.",
        metadata: { area, targetingType: type },
      });
    }
  }

  for (const row of context.costOpportunities) {
    if (!["approved", "implemented", "completed"].includes(String(row.status))) continue;
    const identity = identityMap.get(clientKeyFromRow(row)) ?? identityFromRows([row]);
    if (!identity) continue;
    const savings = numberValue(row.estimated_annual_savings_cents, numberValue(row.estimated_savings_cents, 0));
    seeds.push({
      identity,
      opportunityType: "supplyfy_cross_sell_opportunity",
      category: "Supplyfy Cross-Sell",
      title: "Turn cost savings into a growth budget conversation",
      whyItMatters: "A savings win creates a natural moment to discuss where that margin could fund new customer growth.",
      recommendedAction: "Create an owner-friendly note connecting the approved savings to one clear growth campaign option.",
      estimatedRevenueCents: Math.max(savings, 49900),
      confidence: 64,
      revenueScore: savings > 0 ? 66 : 50,
      clientFitScore: 62,
      timingScore: 60,
      geographyFitScore: 42,
      priorAcceptanceScore: identity.acceptedTypes.length > 0 ? 70 : 48,
      campaignReadinessScore: 50,
      urgencyScore: 45,
      sourceType: "cost_control",
      sourceTable: "cost_control_opportunities",
      sourceId: row.id,
      sourceLabel: "Cost Control opportunity",
      recommendedCampaignType: "supplyfy_cross_sell",
      clientFitSummary: "The client has a savings opportunity that can support a growth conversation.",
      metadata: { savingsCents: savings, costCategory: row.category },
    });
  }

  for (const score of context.reputationScores) {
    const identity = identityMap.get(clientKeyFromRow(score)) ?? identityFromRows([score]);
    if (!identity || numberValue(score.score, 100) >= 55) continue;
    seeds.push({
      identity,
      opportunityType: "review_growth_opportunity",
      category: "Review Growth",
      title: "Trust-building should support the next growth push",
      whyItMatters: "A lower reputation score can make paid visibility less effective because prospects need proof before they act.",
      recommendedAction: "Review the Reputation Center and pair the next campaign proposal with review or testimonial follow-up.",
      estimatedRevenueCents: 49900,
      confidence: 70,
      revenueScore: 48,
      clientFitScore: 72,
      timingScore: 70,
      geographyFitScore: 38,
      priorAcceptanceScore: 50,
      campaignReadinessScore: 48,
      urgencyScore: 72,
      sourceType: "reputation",
      sourceTable: "reputation_scores",
      sourceId: score.id,
      sourceLabel: "Reputation score",
      recommendedCampaignType: "review_campaign",
      clientFitSummary: "The client needs more trust signals before scaling growth.",
      metadata: { reputationScore: score.score },
    });
  }

  return seeds;
}

function textMatchesAny(value: string, candidates: string[]) {
  const lower = value.toLowerCase();
  return candidates.some((candidate) => lower.includes(candidate.toLowerCase()) || candidate.toLowerCase().includes(lower));
}

function adminEntryMatch(entry: GrowthAdminEntryRow, identity: ClientIdentity) {
  const industries = asArray(entry.industry_fit);
  const geographies = asArray(entry.geography_fit);
  const campaignTypes = asArray(entry.campaign_type_fit);
  const industry = normalizeText(identity.industry);
  const markets = identity.markets;
  const campaigns = identity.campaignTypes;
  const entryLocation = normalizeText(entry.location);

  const industryMatch = industries.length === 0 ||
    industries.some((item) => /general local business/i.test(item)) ||
    (industry ? textMatchesAny(industry, industries) : false);
  const geographyMatch = geographies.length === 0 ||
    markets.some((market) => textMatchesAny(market, geographies)) ||
    (entryLocation && markets.some((market) => textMatchesAny(market, [entryLocation])));
  const campaignMatch = campaignTypes.length === 0 || campaigns.some((campaign) => textMatchesAny(campaign, campaignTypes));
  const score = {
    industry: industryMatch ? 80 : 35,
    geography: geographyMatch ? 78 : 40,
    campaign: campaignMatch ? 72 : 42,
    budget: identity.monthlyBudgetCents > 0 ? 68 : 50,
    urgency: entry.urgency === "urgent" ? 92 : entry.urgency === "high" ? 78 : entry.urgency === "low" ? 38 : 58,
  };
  const total = clampScore(score.industry * 0.26 + score.geography * 0.28 + score.campaign * 0.18 + score.budget * 0.12 + score.urgency * 0.16);
  return { matched: total >= 58, total, score, industryMatch, geographyMatch, campaignMatch };
}

function buildAdminEntrySeeds(context: Awaited<ReturnType<typeof loadSourceContext>>) {
  const identities = buildClientIdentities(context);
  const seeds: GrowthSeed[] = [];
  for (const entry of context.adminEntries) {
    const opportunityType = opportunityTypeForAdminEntry(entry.entry_type);
    for (const identity of identities) {
      const match = adminEntryMatch(entry, identity);
      if (!match.matched) continue;
      const category = categoryForOpportunity(opportunityType);
      const location = entry.location ? ` in ${entry.location}` : "";
      seeds.push({
        identity,
        opportunityType,
        category,
        title: `${entry.name} could become a ${category.toLowerCase()} opportunity`,
        whyItMatters: `${entry.notes ?? entry.client_fit ?? "Admin-entered local intelligence matches this client."}${location}.`,
        recommendedAction: "Review the fit, confirm timing and geography, then create a proposal or campaign task only after approval.",
        estimatedRevenueCents: numberValue(entry.estimated_opportunity_cents, 49900),
        confidence: match.total,
        revenueScore: Math.max(45, Math.min(90, Math.round(numberValue(entry.estimated_opportunity_cents, 49900) / 3000))),
        clientFitScore: match.score.industry,
        timingScore: match.score.urgency,
        geographyFitScore: match.score.geography,
        priorAcceptanceScore: identity.acceptedTypes.includes(opportunityType) ? 76 : identity.dismissedTypes.includes(opportunityType) ? 35 : 50,
        campaignReadinessScore: match.score.campaign,
        urgencyScore: match.score.urgency,
        sourceType: sourceTypeForAdminEntry(entry.entry_type),
        sourceTable: "growth_intelligence_admin_entries",
        sourceId: entry.id,
        sourceLabel: "Admin-entered local intelligence",
        adminEntryId: entry.id,
        recommendedCampaignType: recommendedCampaignTypeForOpportunity(opportunityType),
        clientFitSummary: `Industry ${match.industryMatch ? "fits" : "needs review"}; geography ${match.geographyMatch ? "fits" : "needs review"}; campaign type ${match.campaignMatch ? "fits" : "needs review"}.`,
        metadata: {
          adminEntryType: entry.entry_type,
          location: entry.location,
          industryFit: entry.industry_fit,
          geographyFit: entry.geography_fit,
          campaignTypeFit: entry.campaign_type_fit,
          match,
          noExternalScraping: true,
        },
      });
    }
  }
  return seeds;
}

function buildPoliticalSeeds(context: Awaited<ReturnType<typeof loadSourceContext>>) {
  const seeds: GrowthSeed[] = [];
  const identities = buildClientIdentities(context).filter((identity) => /political|campaign|mail/i.test([identity.industry, identity.businessName, identity.campaignTypes.join(" ")].join(" ")));
  if (identities.length === 0) return seeds;
  for (const campaign of context.politicalCampaigns) {
    const area = firstNonEmpty(campaign.county, campaign.city, campaign.geography_value, campaign.district, campaign.office, "the campaign geography") ?? "the campaign geography";
    for (const identity of identities.slice(0, 5)) {
      seeds.push({
        identity,
        opportunityType: "political_geography_opportunity",
        category: "Political Geography",
        title: "Political geography opportunity needs neutral review",
        whyItMatters: `A political campaign record exists for ${area}. This can support geography-level awareness planning without individual ideology prediction or voter scoring.`,
        recommendedAction: "Review district, county, city, ZIP, timing, and campaign-provided goals before creating a political campaign task.",
        estimatedRevenueCents: numberValue(campaign.estimated_deal_value_cents, numberValue(campaign.budget_estimate_cents, 150000)),
        confidence: 58,
        revenueScore: 62,
        clientFitScore: 66,
        timingScore: campaign.election_date ? 76 : 52,
        geographyFitScore: 64,
        priorAcceptanceScore: identity.acceptedTypes.includes("political_geography_opportunity") ? 76 : 50,
        campaignReadinessScore: 46,
        urgencyScore: campaign.election_date ? 78 : 48,
        sourceType: "political",
        sourceTable: "political_campaigns",
        sourceId: campaign.id,
        sourceLabel: "Political campaign record",
        recommendedCampaignType: "political_campaign",
        clientFitSummary: "Political module context is available and must stay geography-based.",
        metadata: { area, compliance: "geography_only_no_ideology_prediction" },
      });
    }
  }
  return seeds;
}

function dedupeSeeds(seeds: GrowthSeed[]) {
  const map = new Map<string, GrowthSeed>();
  for (const seed of seeds) {
    if (!seed.identity.clientId && !seed.identity.clientEmail) continue;
    const key = seedKey(seed);
    const existing = map.get(key);
    if (!existing || growthScore(seed) > growthScore(existing)) map.set(key, seed);
  }
  return Array.from(map.values()).sort((a, b) => growthScore(b) - growthScore(a));
}

async function ensureSource(db: Db, seed: GrowthSeed) {
  await upsertByLookup(
    db,
    "growth_intelligence_sources",
    {
      client_id: seed.identity.clientId,
      client_email: seed.identity.clientId ? null : normalizeEmail(seed.identity.clientEmail),
      source_table: seed.sourceTable,
      source_id: seed.sourceId,
      source_type: seed.sourceType,
    },
    {
      client_id: seed.identity.clientId,
      client_email: seed.identity.clientEmail ? normalizeEmail(seed.identity.clientEmail) : null,
      business_memory_profile_id: seed.identity.businessMemoryProfileId,
      source_type: seed.sourceType,
      source_table: seed.sourceTable,
      source_id: seed.sourceId,
      label: seed.sourceLabel,
      notes: seed.whyItMatters,
      metadata: seed.metadata ?? {},
    },
  );
}

async function ensureOpportunity(db: Db, seed: GrowthSeed) {
  const score = growthScore(seed);
  const now = new Date().toISOString();
  const lookup = {
    client_id: seed.identity.clientId,
    client_email: seed.identity.clientId ? null : normalizeEmail(seed.identity.clientEmail),
    source_table: seed.sourceTable,
    source_id: seed.sourceId,
    opportunity_type: seed.opportunityType,
  };
  const existing = await findByLookup(db, "growth_intelligence_opportunities", lookup);
  const payload = {
    client_id: seed.identity.clientId,
    client_email: seed.identity.clientEmail ? normalizeEmail(seed.identity.clientEmail) : null,
    business_memory_profile_id: seed.identity.businessMemoryProfileId,
    admin_entry_id: seed.adminEntryId ?? null,
    opportunity_type: seed.opportunityType,
    category: seed.category,
    title: seed.title,
    why_it_matters: seed.whyItMatters,
    recommended_action: seed.recommendedAction,
    estimated_revenue_potential_cents: seed.estimatedRevenueCents,
    confidence_score: clampScore(seed.confidence),
    priority_score: score,
    growth_score: score,
    source: seed.sourceType,
    source_table: seed.sourceTable,
    source_id: seed.sourceId,
    priority_label: priorityLabel(score),
    client_fit_summary: seed.clientFitSummary ?? null,
    recommended_campaign_type: seed.recommendedCampaignType,
    owner: score >= 76 ? "jason" : score >= 50 ? "josh" : null,
    next_action: seed.recommendedAction,
    due_at: score >= 76 ? addDaysIso(2) : score >= 50 ? addDaysIso(5) : addDaysIso(10),
    expires_at: addDaysIso(seed.opportunityType.includes("seasonal") || seed.opportunityType.includes("event") ? 45 : 90),
    metadata: {
      ...(seed.metadata ?? {}),
      businessName: seed.identity.businessName,
      industry: seed.identity.industry,
      growthFactors: {
        revenuePotential: seed.revenueScore,
        clientFit: seed.clientFitScore,
        timing: seed.timingScore,
        geographyFit: seed.geographyFitScore,
        priorAcceptance: seed.priorAcceptanceScore,
        campaignReadiness: seed.campaignReadinessScore,
        urgency: seed.urgencyScore,
      },
      approvalRequired: true,
      noAutonomousOutreach: true,
      noExternalScraping: true,
    },
    updated_at: now,
  };

  let row: GrowthOpportunityRow;
  if (existing?.id) {
    const { data, error } = await db
      .from("growth_intelligence_opportunities")
      .update(payload)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw new Error(`Growth opportunity update failed: ${error.message}`);
    row = data as GrowthOpportunityRow;
  } else {
    const { data, error } = await db
      .from("growth_intelligence_opportunities")
      .insert({ ...payload, status: "new_opportunity" })
      .select("*")
      .single();
    if (error) throw new Error(`Growth opportunity creation failed: ${error.message}`);
    row = data as GrowthOpportunityRow;
  }

  await ensureDrafts(db, row);
  await syncOpportunityToBusinessMemory(db, row);
  if (seed.adminEntryId && isGrowthClientMatchingEnabled()) {
    await ensureClientMatch(db, seed, row);
  }
  return row;
}

async function ensureClientMatch(db: Db, seed: GrowthSeed, opportunity: GrowthOpportunityRow) {
  const match = seed.metadata?.match as { score?: JsonRecord } | undefined;
  const factors = match?.score ?? {};
  await upsertByLookup(
    db,
    "growth_intelligence_client_matches",
    {
      admin_entry_id: seed.adminEntryId,
      client_id: seed.identity.clientId,
      client_email: seed.identity.clientId ? null : normalizeEmail(seed.identity.clientEmail),
    },
    {
      admin_entry_id: seed.adminEntryId,
      opportunity_id: opportunity.id,
      client_id: seed.identity.clientId,
      client_email: seed.identity.clientEmail ? normalizeEmail(seed.identity.clientEmail) : null,
      business_memory_profile_id: seed.identity.businessMemoryProfileId,
      match_reason: seed.clientFitSummary ?? "Admin-entered intelligence matches this client.",
      industry_fit_score: numberValue(factors.industry, seed.clientFitScore),
      geography_fit_score: numberValue(factors.geography, seed.geographyFitScore),
      campaign_type_fit_score: numberValue(factors.campaign, seed.campaignReadinessScore),
      budget_fit_score: numberValue(factors.budget, 50),
      urgency_score: seed.urgencyScore,
      status: "matched",
      metadata: { opportunityType: seed.opportunityType, source: "growth_intelligence_engine" },
    },
  );
  await db.from("growth_intelligence_admin_entries").update({ status: "matched", updated_at: new Date().toISOString() }).eq("id", seed.adminEntryId);
}

function draftsForOpportunity(row: GrowthOpportunityRow) {
  const business = String(row.metadata?.businessName ?? "your business");
  const impact = row.estimated_revenue_potential_cents > 0
    ? `$${Math.round(row.estimated_revenue_potential_cents / 100).toLocaleString()} in possible opportunity`
    : "a growth opportunity";
  const guardrail = "This is not a guarantee of results, and no campaign or outreach should launch without approval.";
  const title = row.title;
  const why = row.why_it_matters;
  const action = row.recommended_action;

  return [
    {
      draft_type: "client_growth_email",
      label: "Client Growth Opportunity Email",
      content: `Subject: Growth opportunity found for ${business}\n\nHi there,\n\nHomeReach found a growth opportunity: ${title}.\n\nWhy it matters: ${why}\n\nRecommended next step: ${action}\n\nEstimated potential: ${impact}.\n\n${guardrail}\n\nBest,\nHomeReach`,
    },
    {
      draft_type: "client_growth_sms",
      label: "Client Growth Opportunity SMS",
      content: `HomeReach found a growth opportunity for ${business}: ${title}. Recommended next step: ${action} ${guardrail} Reply STOP to opt out.`,
    },
    {
      draft_type: "client_growth_dm",
      label: "Client Growth Opportunity DM",
      content: `Quick HomeReach update: ${title}. ${why} Next step: ${action}`,
    },
    {
      draft_type: "internal_strategy_note",
      label: "Internal Strategy Note",
      content: `Growth Intelligence note\n\nOpportunity: ${title}\nCategory: ${row.category}\nClient fit: ${row.client_fit_summary ?? "Review needed"}\nScore: ${row.growth_score}\nWhy it matters: ${why}\nRecommended action: ${action}\nGuardrail: ${guardrail}`,
    },
    {
      draft_type: "campaign_proposal_intro",
      label: "Campaign Proposal Intro",
      content: `${business} has a ${row.category.toLowerCase()} opportunity: ${title}. HomeReach recommends ${action.toLowerCase()} because ${why.toLowerCase()} Estimated potential: ${impact}. ${guardrail}`,
    },
    {
      draft_type: "seasonal_campaign_message",
      label: "Seasonal Campaign Message",
      content: `Seasonal angle: ${title}. Use timing, service demand, and local context to make the campaign feel relevant without manufacturing urgency. ${guardrail}`,
    },
    {
      draft_type: "competitor_area_message",
      label: "Competitor Area Message",
      content: `Competitor-area angle: show up around important local markets with neutral visibility language. Avoid claims about stealing customers, spying, or tracking individuals. ${guardrail}`,
    },
    {
      draft_type: "neighborhood_expansion_message",
      label: "Neighborhood Expansion Message",
      content: `Neighborhood expansion angle: ${business} can focus on one next area instead of spreading budget thin. ${action} ${guardrail}`,
    },
    {
      draft_type: "political_opportunity_message",
      label: "Political Opportunity Message",
      content: `Political geography angle: keep the plan geography-based using district, county, city, ZIP, or campaign-provided audience context only. Do not infer ideology or score voters. ${guardrail}`,
    },
  ];
}

async function ensureDrafts(db: Db, opportunity: GrowthOpportunityRow) {
  if (!isGrowthAiDraftsEnabled()) return;
  const existing = await safeRows(
    "Growth Intelligence drafts",
    db.from("growth_intelligence_drafts").select("draft_type").eq("opportunity_id", opportunity.id).limit(20),
  );
  const existingTypes = new Set(existing.map((draft) => draft.draft_type));
  const rows = draftsForOpportunity(opportunity)
    .filter((draft) => !existingTypes.has(draft.draft_type))
    .map((draft) => ({
      opportunity_id: opportunity.id,
      client_id: opportunity.client_id,
      client_email: opportunity.client_email,
      business_memory_profile_id: opportunity.business_memory_profile_id,
      ...draft,
      approval_status: "draft",
      metadata: { noOutboundWithoutApproval: true, noGuarantees: true },
    }));
  if (rows.length === 0) return;
  const { error } = await db.from("growth_intelligence_drafts").insert(rows);
  if (error) throw new Error(`Growth Intelligence draft creation failed: ${error.message}`);
}

async function syncOpportunityToBusinessMemory(db: Db, opportunity: GrowthOpportunityRow) {
  if (!opportunity.business_memory_profile_id) return;
  try {
    const accepted = ["client_approved", "campaign_created", "in_progress", "completed"].includes(opportunity.status);
    const rejected = ["dismissed", "expired"].includes(opportunity.status);
    await upsertByLookup(
      db,
      "business_memory_growth",
      { profile_id: opportunity.business_memory_profile_id, source_table: "growth_intelligence_opportunities", source_id: opportunity.id },
      {
        profile_id: opportunity.business_memory_profile_id,
        growth_type: opportunity.opportunity_type,
        description: opportunity.why_it_matters,
        new_zip_codes: [],
        new_cities: [],
        new_services: [],
        new_campaign_types: [opportunity.recommended_campaign_type],
        new_markets: asArray(opportunity.metadata?.area ?? opportunity.metadata?.location),
        new_political_opportunities: opportunity.opportunity_type.includes("political") ? [opportunity.title] : [],
        new_revenue_streams: [opportunity.category],
        status: opportunity.status,
        metadata: { source: "growth_intelligence_engine", growthScore: opportunity.growth_score },
      },
    );
    await upsertByLookup(
      db,
      "business_memory_opportunities",
      { profile_id: opportunity.business_memory_profile_id, source_table: "growth_intelligence_opportunities", source_id: opportunity.id },
      {
        profile_id: opportunity.business_memory_profile_id,
        opportunity_type: opportunity.opportunity_type,
        opportunity_reason: opportunity.why_it_matters,
        opportunity_status: opportunity.status,
        accepted,
        rejected,
        dismissed: opportunity.status === "dismissed",
        completed: opportunity.status === "completed",
        estimated_value_cents: opportunity.estimated_revenue_potential_cents,
        actual_value_cents: opportunity.status === "campaign_created" || opportunity.status === "completed" ? opportunity.estimated_revenue_potential_cents : 0,
        date_created: opportunity.created_at ?? new Date().toISOString(),
        date_closed: ["completed", "dismissed", "expired"].includes(opportunity.status) ? new Date().toISOString() : null,
        metadata: { source: "growth_intelligence_engine", recommendedCampaignType: opportunity.recommended_campaign_type },
      },
    );
    await upsertByLookup(
      db,
      "business_memory_timeline",
      {
        profile_id: opportunity.business_memory_profile_id,
        event_type: "growth",
        related_table: "growth_intelligence_opportunities",
        related_id: opportunity.id,
      },
      {
        profile_id: opportunity.business_memory_profile_id,
        event_type: "growth",
        title: "Growth opportunity remembered",
        description: opportunity.why_it_matters,
        event_date: opportunity.updated_at ?? new Date().toISOString(),
        impact_cents: opportunity.estimated_revenue_potential_cents,
        status: opportunity.status,
        metadata: { opportunityType: opportunity.opportunity_type, category: opportunity.category },
      },
    );
  } catch (error) {
    if (!/business_memory_|schema cache|does not exist|relation/i.test(error instanceof Error ? error.message : String(error))) throw error;
  }
}

async function syncContext(db: Db, context: Awaited<ReturnType<typeof loadSourceContext>>) {
  const seeds = dedupeSeeds([
    ...buildInternalSeeds(context),
    ...buildAdminEntrySeeds(context),
    ...buildPoliticalSeeds(context),
  ]);
  let touched = 0;
  for (const seed of seeds.slice(0, 300)) {
    await ensureSource(db, seed);
    await ensureOpportunity(db, seed);
    touched += 1;
  }
  await refreshGrowthScoresAndReports(db);
  return { recordsTouched: touched };
}

async function refreshGrowthScoresAndReports(db: Db) {
  const [opportunities, matches] = await Promise.all([
    safeRows("Growth Intelligence opportunities", db.from("growth_intelligence_opportunities").select("*").order("priority_score", { ascending: false }).limit(1000)) as Promise<GrowthOpportunityRow[]>,
    safeRows("Growth Intelligence client matches", db.from("growth_intelligence_client_matches").select("*").limit(1000)),
  ]);

  const clientKeys = new Set([...opportunities.map(clientKeyFromRow)].filter(Boolean));
  for (const key of clientKeys) {
    const clientOpportunities = opportunities.filter((row) => clientKeyFromRow(row) === key);
    const identity = identityFromRows(clientOpportunities);
    if (!identity) continue;
    const clientMatches = matches.filter((row) => clientKeyFromRow(row) === key);
    const topOpportunity = clientOpportunities[0] ?? null;
    if (isGrowthScoringEnabled()) await upsertGrowthScore(db, identity, clientOpportunities, clientMatches, topOpportunity);
    if (isGrowthReportingEnabled()) await upsertGrowthReport(db, identity, clientOpportunities);
  }
}

async function upsertGrowthScore(
  db: Db,
  identity: ClientIdentity,
  opportunities: GrowthOpportunityRow[],
  matches: UnknownRow[],
  topOpportunity: GrowthOpportunityRow | null,
) {
  const open = opportunities.filter((row) => OPEN_STATUSES.has(row.status));
  const approved = opportunities.filter((row) => ["client_approved", "campaign_created", "in_progress", "completed"].includes(row.status)).length;
  const converted = opportunities.filter((row) => ["campaign_created", "completed"].includes(row.status)).length;
  const revenuePotentialScore = clampScore(Math.min(100, opportunities.reduce((sum, row) => sum + numberValue(row.estimated_revenue_potential_cents), 0) / 4000));
  const avg = (selector: (row: GrowthOpportunityRow) => number, fallback = 35) => opportunities.length ? clampScore(opportunities.reduce((sum, row) => sum + selector(row), 0) / opportunities.length) : fallback;
  const factorValue = (row: GrowthOpportunityRow, key: string) => numberValue((row.metadata?.growthFactors as JsonRecord | undefined)?.[key]);
  const clientFitScore = matches.length > 0 ? clampScore(matches.reduce((sum, row) => sum + numberValue(row.industry_fit_score), 0) / matches.length) : avg((row) => factorValue(row, "clientFit"), 45);
  const timingScore = avg((row) => factorValue(row, "timing"), open.length > 0 ? 55 : 35);
  const geographyFitScore = avg((row) => factorValue(row, "geographyFit"), 40);
  const priorAcceptanceScore = opportunities.length > 0 ? clampScore((approved / opportunities.length) * 100) : 35;
  const campaignReadinessScore = opportunities.length > 0 ? clampScore((converted / opportunities.length) * 100 + 20) : 25;
  const urgencyScore = avg((row) => factorValue(row, "urgency"), 40);
  const score = topOpportunity ? topOpportunity.growth_score : clampScore(
    revenuePotentialScore * 0.2 +
      clientFitScore * 0.18 +
      timingScore * 0.16 +
      geographyFitScore * 0.14 +
      priorAcceptanceScore * 0.12 +
      campaignReadinessScore * 0.1 +
      urgencyScore * 0.1,
  );
  await upsertByLookup(db, "growth_intelligence_scores", clientLookup(identity), {
    client_id: identity.clientId,
    client_email: identity.clientEmail ? normalizeEmail(identity.clientEmail) : null,
    business_memory_profile_id: identity.businessMemoryProfileId,
    score,
    color: scoreColor(score),
    revenue_potential_score: revenuePotentialScore,
    client_fit_score: clientFitScore,
    timing_score: timingScore,
    geography_fit_score: geographyFitScore,
    prior_acceptance_score: priorAcceptanceScore,
    campaign_readiness_score: campaignReadinessScore,
    urgency_score: urgencyScore,
    priority_label: priorityLabel(score),
    current_status: score >= 76 ? "high_growth_potential" : score >= 50 ? "growth_opportunities_ready" : "needs_more_context",
    recommended_action: topOpportunity?.recommended_action ?? "Add local intelligence, campaign history, and growth notes so HomeReach can find stronger opportunities.",
    top_opportunity_id: topOpportunity?.id ?? null,
    calculated_at: new Date().toISOString(),
    metadata: { opportunityCount: opportunities.length, openOpportunities: open.length, matches: matches.length },
  });
}

async function upsertGrowthReport(db: Db, identity: ClientIdentity, opportunities: GrowthOpportunityRow[]) {
  const approved = opportunities.filter((row) => ["client_approved", "campaign_created", "in_progress", "completed"].includes(row.status));
  const converted = opportunities.filter((row) => ["campaign_created", "completed"].includes(row.status));
  const dismissed = opportunities.filter((row) => ["dismissed", "expired"].includes(row.status));
  await upsertByLookup(
    db,
    "growth_intelligence_reports",
    {
      ...clientLookup(identity),
      reporting_period_start: startOfMonthIso(),
      reporting_period_end: endOfMonthIso(),
    },
    {
      client_id: identity.clientId,
      client_email: identity.clientEmail ? normalizeEmail(identity.clientEmail) : null,
      business_memory_profile_id: identity.businessMemoryProfileId,
      opportunities_found: opportunities.length,
      opportunities_approved: approved.length,
      opportunities_converted: converted.length,
      estimated_revenue_potential_cents: opportunities.reduce((sum, row) => sum + numberValue(row.estimated_revenue_potential_cents), 0),
      actual_campaigns_created: converted.length,
      dismissed_opportunities: dismissed.length,
      top_categories: topCategoryRows(opportunities),
      top_clients: [],
      recommended_next_actions: opportunities[0]?.recommended_action ?? "Review the highest-fit growth opportunity and decide whether to create a proposal.",
      metadata: { generatedBy: "growth_intelligence_engine" },
    },
  );
}

function topCategoryRows(opportunities: GrowthOpportunityRow[]) {
  const map = new Map<string, { count: number; value: number }>();
  for (const row of opportunities) {
    const current = map.get(row.category) ?? { count: 0, value: 0 };
    map.set(row.category, {
      count: current.count + 1,
      value: current.value + numberValue(row.estimated_revenue_potential_cents),
    });
  }
  return Array.from(map.entries())
    .sort((a, b) => b[1].value - a[1].value)
    .slice(0, 5)
    .map(([category, item]) => ({ category, opportunities: item.count, estimatedRevenuePotentialCents: item.value }));
}

async function loadGrowthData(db: Db, input: { clientId?: string | null; clientEmail?: string | null; adminMode?: boolean }): Promise<GrowthCenterData> {
  const normalizedEmail = normalizeEmail(input.clientEmail);
  const adminMode = Boolean(input.adminMode);
  const byClientOrEmail = async (table: string, orderColumn = "updated_at", limit = 300) => {
    if (adminMode) return safeRows(table, db.from(table).select("*").order(orderColumn, { ascending: false }).limit(limit));
    const queries: Array<Promise<UnknownRow[]>> = [];
    if (input.clientId) queries.push(safeRows(`${table} by client`, db.from(table).select("*").eq("client_id", input.clientId).order(orderColumn, { ascending: false }).limit(limit)));
    if (normalizedEmail) queries.push(safeRows(`${table} by email`, db.from(table).select("*").ilike("client_email", normalizedEmail).order(orderColumn, { ascending: false }).limit(limit)));
    return mergeById((await Promise.all(queries)).flat());
  };

  const [opportunities, adminEntries, matches, actions] = await Promise.all([
    byClientOrEmail("growth_intelligence_opportunities", "priority_score", adminMode ? 300 : 80),
    adminMode
      ? safeRows("Growth Intelligence admin entries", db.from("growth_intelligence_admin_entries").select("*").order("priority", { ascending: false }).limit(250))
      : Promise.resolve([]),
    byClientOrEmail("growth_intelligence_client_matches", "updated_at", adminMode ? 400 : 80),
    adminMode
      ? safeRows("Growth Intelligence actions", db.from("growth_intelligence_actions").select("*").order("created_at", { ascending: false }).limit(300))
      : Promise.resolve([]),
  ]);

  const scoreQuery = adminMode
    ? db.from("growth_intelligence_scores").select("*").order("score", { ascending: false }).limit(1).maybeSingle()
    : input.clientId
      ? db.from("growth_intelligence_scores").select("*").eq("client_id", input.clientId).maybeSingle()
      : db.from("growth_intelligence_scores").select("*").ilike("client_email", normalizedEmail).maybeSingle();
  const reportQuery = adminMode
    ? db.from("growth_intelligence_reports").select("*").order("reporting_period_end", { ascending: false }).limit(1).maybeSingle()
    : input.clientId
      ? db.from("growth_intelligence_reports").select("*").eq("client_id", input.clientId).order("reporting_period_end", { ascending: false }).limit(1).maybeSingle()
      : db.from("growth_intelligence_reports").select("*").ilike("client_email", normalizedEmail).order("reporting_period_end", { ascending: false }).limit(1).maybeSingle();

  const [score, report] = await Promise.all([
    safeSingle("Growth Intelligence score", scoreQuery),
    safeSingle("Growth Intelligence report", reportQuery),
  ]);

  const opportunityIds = opportunities.map((row) => row.id).filter(Boolean);
  const drafts = opportunityIds.length
    ? (await safeRows("Growth Intelligence drafts", db.from("growth_intelligence_drafts").select("*").in("opportunity_id", opportunityIds).order("created_at", { ascending: true }).limit(1000))) as GrowthDraftRow[]
    : [];
  const draftsByOpportunity = drafts.reduce<Record<string, GrowthDraftRow[]>>((acc, draft) => {
    acc[draft.opportunity_id] = [...(acc[draft.opportunity_id] ?? []), draft];
    return acc;
  }, {});

  return {
    enabled: true,
    safeMode: false,
    opportunities: opportunities as GrowthOpportunityRow[],
    draftsByOpportunity,
    adminEntries: adminEntries as GrowthAdminEntryRow[],
    clientMatches: matches,
    actions,
    score: score as GrowthScoreRow | null,
    report: report as GrowthReportRow | null,
    metrics: calculateMetrics(opportunities as GrowthOpportunityRow[], adminEntries as GrowthAdminEntryRow[], matches),
  };
}

function calculateMetrics(opportunities: GrowthOpportunityRow[], adminEntries: GrowthAdminEntryRow[], matches: UnknownRow[]): GrowthMetrics {
  const topCategory = topCategoryRows(opportunities)[0]?.category as string | undefined;
  return {
    totalOpportunities: opportunities.length,
    highPriority: opportunities.filter((row) => row.priority_label === "high").length,
    estimatedRevenuePotentialCents: opportunities.reduce((sum, row) => sum + numberValue(row.estimated_revenue_potential_cents), 0),
    approved: opportunities.filter((row) => ["client_approved", "campaign_created", "in_progress", "completed"].includes(row.status)).length,
    dismissed: opportunities.filter((row) => ["dismissed", "expired"].includes(row.status)).length,
    convertedToCampaigns: opportunities.filter((row) => ["campaign_created", "completed"].includes(row.status)).length,
    adminEntries: adminEntries.length,
    clientMatches: matches.length,
    topCategory: topCategory ?? "Growth",
  };
}

function emptyMetrics(): GrowthMetrics {
  return {
    totalOpportunities: 0,
    highPriority: 0,
    estimatedRevenuePotentialCents: 0,
    approved: 0,
    dismissed: 0,
    convertedToCampaigns: 0,
    adminEntries: 0,
    clientMatches: 0,
    topCategory: "Growth",
  };
}

export async function ensureGrowthIntelligenceForClient({
  supabase,
  clientId,
  clientEmail,
}: {
  supabase: ServiceClient;
  clientId?: string | null;
  clientEmail?: string | null;
}) {
  if (!isGrowthIntelligenceEnabled() || !hasGrowthIntelligencePersistence()) return { recordsTouched: 0 };
  try {
    const db = asDb(supabase);
    const context = await loadSourceContext({ db, clientId, clientEmail });
    return await syncContext(db, context);
  } catch (error) {
    if (isMissingGrowthSchema(error)) return { recordsTouched: 0 };
    throw error;
  }
}

export async function ensureGrowthIntelligenceForAll({
  supabase,
  limit = 300,
}: {
  supabase: ServiceClient;
  limit?: number;
}) {
  if (!isGrowthIntelligenceEnabled() || !hasGrowthIntelligencePersistence()) return { recordsTouched: 0 };
  try {
    const db = asDb(supabase);
    const context = await loadSourceContext({ db, adminMode: true, limit });
    return await syncContext(db, context);
  } catch (error) {
    if (isMissingGrowthSchema(error)) return { recordsTouched: 0 };
    throw error;
  }
}

export async function loadClientGrowthIntelligenceCenter({
  supabase,
  user,
  autoSync = true,
}: {
  supabase: ServiceClient;
  user: Pick<User, "id"> & { email?: string | null };
  autoSync?: boolean;
}): Promise<GrowthCenterData> {
  if (!isGrowthIntelligenceEnabled()) return { enabled: false, safeMode: false, opportunities: [], draftsByOpportunity: {}, adminEntries: [], clientMatches: [], actions: [], score: null, report: null, metrics: emptyMetrics() };
  if (!hasGrowthIntelligencePersistence()) return { enabled: true, safeMode: true, opportunities: [], draftsByOpportunity: {}, adminEntries: [], clientMatches: [], actions: [], score: null, report: null, metrics: emptyMetrics(), message: "Growth Intelligence persistence is not configured." };
  try {
    const db = asDb(supabase);
    if (autoSync) await ensureGrowthIntelligenceForClient({ supabase, clientId: user.id, clientEmail: user.email });
    return loadGrowthData(db, { clientId: user.id, clientEmail: user.email });
  } catch (error) {
    return { enabled: true, safeMode: true, opportunities: [], draftsByOpportunity: {}, adminEntries: [], clientMatches: [], actions: [], score: null, report: null, metrics: emptyMetrics(), message: error instanceof Error ? error.message : "Growth Intelligence Center is in safe mode." };
  }
}

export async function loadAdminGrowthIntelligenceCenter({
  supabase,
  autoSync = true,
}: {
  supabase: ServiceClient;
  autoSync?: boolean;
}): Promise<GrowthCenterData> {
  if (!isGrowthIntelligenceEnabled()) return { enabled: false, safeMode: false, opportunities: [], draftsByOpportunity: {}, adminEntries: [], clientMatches: [], actions: [], score: null, report: null, metrics: emptyMetrics() };
  if (!hasGrowthIntelligencePersistence()) return { enabled: true, safeMode: true, opportunities: [], draftsByOpportunity: {}, adminEntries: [], clientMatches: [], actions: [], score: null, report: null, metrics: emptyMetrics(), message: "Growth Intelligence persistence is not configured." };
  try {
    const db = asDb(supabase);
    if (autoSync) await ensureGrowthIntelligenceForAll({ supabase });
    return loadGrowthData(db, { adminMode: true });
  } catch (error) {
    return { enabled: true, safeMode: true, opportunities: [], draftsByOpportunity: {}, adminEntries: [], clientMatches: [], actions: [], score: null, report: null, metrics: emptyMetrics(), message: error instanceof Error ? error.message : "Growth Intelligence Center is in safe mode." };
  }
}

export async function createAdminIntelligenceEntry({
  supabase,
  actorUserId,
  actorEmail,
  input,
}: {
  supabase: ServiceClient;
  actorUserId?: string | null;
  actorEmail?: string | null;
  input: JsonRecord;
}) {
  if (!isAdminIntelligenceEntriesEnabled()) throw new Error("Admin intelligence entries are disabled.");
  const db = asDb(supabase);
  const payload = {
    name: normalizeText(input.name) || "Untitled local intelligence",
    entry_type: normalizeText(input.entryType) || "community_opportunity",
    location: firstNonEmpty(input.location),
    client_fit: firstNonEmpty(input.clientFit),
    notes: firstNonEmpty(input.notes),
    estimated_opportunity_cents: numberValue(input.estimatedOpportunityCents),
    priority: clampScore(numberValue(input.priority, 50)),
    status: "active",
    industry_fit: uniqueArray([input.industryFit]),
    geography_fit: uniqueArray([input.geographyFit]),
    client_fit_tags: uniqueArray([input.clientFitTags]),
    campaign_type_fit: uniqueArray([input.campaignTypeFit]),
    budget_fit: firstNonEmpty(input.budgetFit),
    urgency: ["low", "medium", "high", "urgent"].includes(String(input.urgency)) ? String(input.urgency) : "medium",
    created_by: actorEmail ?? actorUserId ?? "admin",
    metadata: { actorUserId: actorUserId ?? null, noExternalScraping: true },
  };
  const { data, error } = await db.from("growth_intelligence_admin_entries").insert(payload).select("*").single();
  if (error) throw new Error(`Admin intelligence entry creation failed: ${error.message}`);
  await ensureGrowthIntelligenceForAll({ supabase, limit: 300 });
  return data as GrowthAdminEntryRow;
}

export async function recordGrowthIntelligenceAction({
  supabase,
  opportunityId,
  actionType,
  actorUserId,
  actorRole,
  notes,
  draftId,
}: {
  supabase: ServiceClient;
  opportunityId: string;
  actionType: string;
  actorUserId?: string | null;
  actorRole?: string | null;
  notes?: string | null;
  draftId?: string | null;
}) {
  const db = asDb(supabase);
  const opportunity = (await safeSingle("Growth Intelligence opportunity", db.from("growth_intelligence_opportunities").select("*").eq("id", opportunityId).maybeSingle())) as GrowthOpportunityRow | null;
  if (!opportunity) throw new Error("Growth Intelligence opportunity not found.");
  const nextStatus = nextStatusForAction(actionType, opportunity.status);
  const now = new Date().toISOString();
  const update: JsonRecord = {
    status: nextStatus,
    updated_at: now,
    notes: notes ?? opportunity.notes,
    metadata: {
      ...(opportunity.metadata ?? {}),
      lastAction: actionType,
      lastActorUserId: actorUserId ?? null,
      lastActorRole: actorRole ?? null,
      noAutonomousOutreach: true,
      noCampaignLaunchWithoutApproval: true,
    },
  };
  if (nextStatus === "needs_review") update.reviewed_at = now;
  if (nextStatus === "client_approved") update.approved_at = now;
  if (nextStatus === "campaign_created") update.campaign_created_at = now;
  if (nextStatus === "completed") update.completed_at = now;

  const { data, error } = await db.from("growth_intelligence_opportunities").update(update).eq("id", opportunityId).select("*").single();
  if (error) throw new Error(`Growth Intelligence action failed: ${error.message}`);

  if (draftId && actionType === "copy_draft") {
    const draft = await safeSingle("Growth Intelligence draft", db.from("growth_intelligence_drafts").select("copy_count").eq("id", draftId).maybeSingle());
    await db.from("growth_intelligence_drafts").update({ copy_count: numberValue(draft?.copy_count) + 1, last_copied_at: now }).eq("id", draftId);
  }

  await db.from("growth_intelligence_actions").insert({
    opportunity_id: opportunityId,
    action_type: actionType,
    label: actionLabel(actionType),
    status: "recorded",
    actor_user_id: actorUserId ?? null,
    actor_role: actorRole ?? null,
    target_campaign_type: data.recommended_campaign_type,
    notes,
    metadata: {
      noAutonomousOutreach: true,
      noPaidLaunch: true,
      campaignConversionIsWorkflowOnly: actionType === "create_campaign",
    },
  });

  if (data.admin_entry_id && ["create_campaign", "complete"].includes(actionType)) {
    await db
      .from("growth_intelligence_client_matches")
      .update({ status: "converted", updated_at: now })
      .eq("admin_entry_id", data.admin_entry_id)
      .eq("opportunity_id", data.id);
  }

  await syncOpportunityToBusinessMemory(db, data as GrowthOpportunityRow);
  await refreshGrowthScoresAndReports(db);
  return { status: nextStatus };
}

function nextStatusForAction(actionType: string, current: GrowthStatus): GrowthStatus {
  if (actionType === "review") return "needs_review";
  if (actionType === "launch") return "in_progress";
  if (actionType === "create_campaign") return "campaign_created";
  if (actionType === "create_proposal") return "recommended_to_client";
  if (actionType === "assign_task") return "needs_review";
  if (actionType === "approve") return "client_approved";
  if (actionType === "complete") return "completed";
  if (actionType === "dismiss") return "dismissed";
  return current;
}

function actionLabel(actionType: string) {
  const labels: Record<string, string> = {
    review: "Review",
    launch: "Launch",
    create_campaign: "Create Campaign",
    create_proposal: "Create Proposal",
    assign_task: "Assign Task",
    approve: "Approve",
    complete: "Complete",
    dismiss: "Dismiss",
    copy_draft: "Copy Draft",
  };
  return labels[actionType] ?? actionType.replaceAll("_", " ");
}
