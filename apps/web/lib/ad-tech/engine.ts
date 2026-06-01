import type { User } from "@supabase/supabase-js";
import type { createServiceClient } from "@/lib/supabase/service";
import {
  syncAdTechApprovalLedger,
  syncAdTechLaunchPackageLedger,
} from "@/lib/approvals/ad-tech-ledger";
import {
  adApiLaunchStatus,
  googleAdsCredentials,
  googleMapsCredentials,
  hasAdTechPersistence,
  integrationFeatureFlags,
  isAttributionLayerEnabled,
  isGeocodingEnabled,
  isGoogleDraftsEnabled,
  isIntegrationHealthEnabled,
  isLaunchPackagesEnabled,
  isMetaDraftsEnabled,
  isReportingImportsEnabled,
  isTargetValidationEnabled,
  metaCredentials,
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
type Db = ServiceClient & { from(table: string): TableQuery };
type JsonRecord = Record<string, unknown>;
type UnknownRow = JsonRecord & {
  id?: string | null;
  market_capture_lead_id?: string | null;
  client_id?: string | null;
  client_email?: string | null;
  email?: string | null;
  business_name?: string | null;
  campaign_name?: string | null;
  contact_name?: string | null;
  industry?: string | null;
  targeting_objective?: string | null;
  targeting_type?: string | null;
  target_area?: string | null;
  target_geography?: string | null;
  location_type?: string | null;
  name?: string | null;
  address?: string | null;
  latitude?: unknown;
  longitude?: unknown;
  radius_miles?: unknown;
  monthly_ad_budget?: unknown;
  monthly_management_fee?: unknown;
  payment_status?: string | null;
  creative_status?: string | null;
  approval_status?: string | null;
  launch_status?: string | null;
  tracking_url?: string | null;
  landing_page_url?: string | null;
  direct_mail_requested?: boolean | null;
  status?: string | null;
  item_order?: unknown;
  title?: string | null;
  completed_at?: string | null;
  approval_type?: string | null;
  spend?: unknown;
  clicks?: unknown;
  leads?: unknown;
  calls?: unknown;
  forms?: unknown;
  landing_page_visits?: unknown;
  qr_scans?: unknown;
  created_at?: string | null;
  updated_at?: string | null;
  metadata?: JsonRecord | null;
};

export type CampaignDraftRow = UnknownRow & {
  platform: "meta" | "google" | "manual";
  draft_type: string;
  name: string;
  status: string;
  summary: string | null;
  payload: JsonRecord;
};

export type LaunchPackageRow = UnknownRow & {
  package_name: string;
  package_status: string;
  campaign_summary: string;
  readiness_score: number;
  ready_status: "ready" | "not_ready";
  missing_items: string[];
  recommended_next_action: string | null;
  client_approval_status: string;
  admin_approval_status: string;
};

export type IntegrationHealthRow = UnknownRow & {
  integration_key: string;
  integration_name: string;
  status: string;
  api_key_status: string;
  warnings: string[];
  errors: string[];
  feature_flag_status: JsonRecord;
};

export type AdTechCenterData = {
  enabled: boolean;
  safeMode: boolean;
  message?: string;
  campaigns: UnknownRow[];
  drafts: CampaignDraftRow[];
  launchPackages: LaunchPackageRow[];
  geocodes: UnknownRow[];
  validations: UnknownRow[];
  approvals: UnknownRow[];
  launchHistory: UnknownRow[];
  reportingImports: UnknownRow[];
  attribution: UnknownRow[];
  integrationHealth: IntegrationHealthRow[];
  metrics: {
    draftCount: number;
    approvalsNeeded: number;
    launchReady: number;
    reportingImportsNeeded: number;
    healthWarnings: number;
    averageReadiness: number;
    manualLaunches: number;
  };
};

const LAUNCH_CHECKLIST = [
  "Payment confirmed",
  "Target areas validated",
  "Creative approved",
  "Tracking URL confirmed",
  "Client approvals captured",
  "Admin launch package approved",
  "Manual launch instructions ready",
];

function asDb(supabase: ServiceClient): Db {
  return supabase as Db;
}

function normalizeEmail(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function numberValue(value: unknown, fallback = 0) {
  const number = typeof value === "string" ? Number(value) : value;
  return typeof number === "number" && Number.isFinite(number) ? number : fallback;
}

function isMissingSchema(error: unknown) {
  return /campaign_drafts|campaign_launch_packages|integration_health|schema cache|does not exist|relation/i.test(
    error instanceof Error ? error.message : String(error ?? ""),
  );
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
  const existing = await findByLookup(db, table, lookup);
  const now = new Date().toISOString();
  if (existing?.id) {
    const { data, error } = await db.from(table).update({ ...payload, updated_at: now }).eq("id", existing.id).select("*").single();
    if (error) throw new Error(`${table} update failed: ${error.message}`);
    return data;
  }
  const { data, error } = await db.from(table).insert({ ...lookup, ...payload }).select("*").single();
  if (error) throw new Error(`${table} insert failed: ${error.message}`);
  return data;
}

function campaignClientLookup(campaign: UnknownRow) {
  return campaign.client_id ? { client_id: campaign.client_id } : { client_email: normalizeEmail(campaign.client_email ?? campaign.email) };
}

function campaignName(campaign: UnknownRow) {
  return normalizeText(campaign.campaign_name || campaign.business_name) || "Market Capture Campaign";
}

function campaignObjective(campaign: UnknownRow, lead?: UnknownRow | null) {
  return normalizeText(lead?.targeting_objective || campaign.targeting_objective || "local_visibility") || "local_visibility";
}

function campaignTargetingType(campaign: UnknownRow, lead?: UnknownRow | null) {
  return normalizeText(lead?.targeting_type || campaign.targeting_type || "custom_area") || "custom_area";
}

function campaignArea(campaign: UnknownRow, lead?: UnknownRow | null) {
  return normalizeText(campaign.target_geography || lead?.target_area || "approved target area") || "approved target area";
}

function budgetSummary(campaign: UnknownRow) {
  const adBudget = numberValue(campaign.monthly_ad_budget);
  const managementFee = numberValue(campaign.monthly_management_fee, 49900);
  return {
    clientFundedAdSpendCents: adBudget,
    monthlyManagementFeeCents: managementFee,
    adSpendSeparate: true,
    noAutoCharge: true,
  };
}

function buildDrafts(campaign: UnknownRow, lead?: UnknownRow | null) {
  const name = campaignName(campaign);
  const objective = campaignObjective(campaign, lead);
  const targeting = campaignTargetingType(campaign, lead);
  const area = campaignArea(campaign, lead);
  const budget = budgetSummary(campaign);
  const trackingUrl = campaign.tracking_url || campaign.landing_page_url || null;
  const guardrails = {
    noAutoLaunch: true,
    noAutoSpend: true,
    requiresAdminApproval: true,
    platformApprovalRequired: true,
  };

  const rows: JsonRecord[] = [];
  if (isMetaDraftsEnabled()) {
    rows.push(
      {
        platform: "meta",
        draft_type: "campaign",
        name: `${name} Meta Campaign Draft`,
        objective,
        summary: `Meta campaign draft for ${name}. Prepared only for review; no paid ads are created or published.`,
        payload: { buyingType: "auction", objective, campaignName: name, status: "paused_draft", guardrails },
      },
      {
        platform: "meta",
        draft_type: "ad_set",
        name: `${name} Meta Ad Set Draft`,
        objective,
        summary: `Audience and budget draft around ${area}.`,
        payload: { targetArea: area, targetingType: targeting, budget, optimization: "approval_required", guardrails },
      },
      {
        platform: "meta",
        draft_type: "creative",
        name: `${name} Meta Creative Draft`,
        objective,
        summary: "Creative shell for approved images, copy, and destination URL.",
        payload: { headline: `${name}: visible in your neighborhood`, primaryText: "Draft copy requires human approval.", trackingUrl, guardrails },
      },
      {
        platform: "meta",
        draft_type: "tracking",
        name: `${name} Meta Tracking Draft`,
        objective,
        summary: "Tracking URL and campaign parameters prepared for review.",
        payload: { trackingUrl, utmSource: "meta", utmMedium: "paid_social", attributionCaution: true, guardrails },
      },
    );
  }

  if (isGoogleDraftsEnabled()) {
    rows.push(
      {
        platform: "google",
        draft_type: "campaign",
        name: `${name} Google Campaign Draft`,
        objective,
        summary: `Google campaign draft for ${name}. Uses location/proximity criteria only after approval.`,
        payload: { campaignName: name, objective, status: "paused_draft", guardrails },
      },
      {
        platform: "google",
        draft_type: "location_target",
        name: `${name} Google Location Target Draft`,
        objective,
        summary: `Location target draft for ${area}.`,
        payload: { targetArea: area, targetingType: targeting, usesCampaignCriteria: true, guardrails },
      },
      {
        platform: "google",
        draft_type: "creative",
        name: `${name} Google Creative Draft`,
        objective,
        summary: "Google/display creative shell for approved copy and destination.",
        payload: { headlines: [`${name}`, "Local visibility campaign"], descriptions: ["Draft only. Human approval required."], trackingUrl, guardrails },
      },
      {
        platform: "google",
        draft_type: "budget",
        name: `${name} Google Budget Draft`,
        objective,
        summary: "Budget draft mirrors confirmed client-funded ad spend.",
        payload: { budget, status: "approval_required", guardrails },
      },
    );
  }

  return rows;
}

function normalizeAddress(location: UnknownRow, campaign: UnknownRow, lead?: UnknownRow | null) {
  return normalizeText(location.address || location.name || location.target_geography || campaign.target_geography || lead?.target_area);
}

function zipExists(value: string) {
  return /\b\d{5}(?:-\d{4})?\b/.test(value);
}

function validationForLocation(input: { label: string; address: string; radiusMiles: number; duplicate: boolean; linked: boolean; hasCoordinates: boolean }) {
  const warnings: string[] = [];
  const errors: string[] = [];
  const addressExists = Boolean(input.address);
  const hasZip = zipExists(input.address);
  const geographyValid = input.hasCoordinates || addressExists || hasZip;
  const radiusReasonable = input.radiusMiles <= 50 && input.radiusMiles >= 0;

  if (!addressExists) warnings.push("Address or geography needs manual confirmation.");
  if (!hasZip) warnings.push("ZIP code is not present; validate city, county, district, or neighborhood manually.");
  if (!input.hasCoordinates && !googleMapsCredentials().ready) warnings.push("Google Maps API key missing; coordinates require manual review.");
  if (!radiusReasonable) errors.push("Radius should be between 0 and 50 miles.");
  if (input.duplicate) warnings.push("Duplicate target location detected.");
  if (!input.linked) errors.push("Location is not linked to a campaign.");

  const status = errors.length > 0 ? "invalid" : warnings.length > 0 ? "warning" : "valid";
  return {
    status,
    address_exists: addressExists,
    zip_exists: hasZip,
    geography_valid: geographyValid,
    radius_reasonable: radiusReasonable,
    duplicate_location: input.duplicate,
    linked_to_campaign: input.linked,
    warnings,
    errors,
    recommended_action: errors[0] || warnings[0] || "Target area is ready for launch package review.",
  };
}

function readinessFactors(input: {
  campaign: UnknownRow;
  validations: UnknownRow[];
  approvals: UnknownRow[];
  draftCount: number;
  checklistComplete: boolean;
}) {
  const hasTargetWarnings = input.validations.some((row) => row.status === "warning" || row.status === "invalid");
  const clientApproved = input.approvals.some((row) => row.status === "approved");
  const factors = [
    { key: "payment", ready: input.campaign.payment_status === "paid", missing: "Confirm payment" },
    { key: "target_area", ready: input.validations.length > 0 && !hasTargetWarnings, missing: "Validate target areas" },
    { key: "assets", ready: ["uploaded", "approved"].includes(String(input.campaign.creative_status)), missing: "Collect assets" },
    { key: "creative", ready: input.campaign.creative_status === "approved", missing: "Approve creative" },
    { key: "tracking", ready: Boolean(input.campaign.tracking_url || input.campaign.landing_page_url), missing: "Add tracking or landing page URL" },
    { key: "approvals", ready: clientApproved || input.campaign.approval_status === "approved", missing: "Capture client approval" },
    { key: "launch_package", ready: input.draftCount > 0, missing: "Generate draft package" },
    { key: "checklist", ready: input.checklistComplete, missing: "Complete fulfillment checklist" },
  ];
  const missing = factors.filter((factor) => !factor.ready).map((factor) => factor.missing);
  return {
    factors,
    missing,
    score: Math.round((factors.filter((factor) => factor.ready).length / factors.length) * 100),
  };
}

async function loadContext(db: Db, input: { adminMode?: boolean; clientId?: string | null; clientEmail?: string | null; limit?: number }) {
  const normalizedEmail = normalizeEmail(input.clientEmail);
  const limit = input.limit ?? 250;
  const campaignQueries: Array<Promise<UnknownRow[]>> = [];
  const leadQueries: Array<Promise<UnknownRow[]>> = [];

  if (input.adminMode) {
    campaignQueries.push(safeRows("Market Capture campaigns", db.from("market_capture_campaigns").select("*").order("updated_at", { ascending: false }).limit(limit)));
    leadQueries.push(safeRows("Market Capture leads", db.from("market_capture_leads").select("*").order("updated_at", { ascending: false }).limit(limit)));
  } else {
    if (input.clientId) {
      campaignQueries.push(safeRows("Market Capture campaigns by client", db.from("market_capture_campaigns").select("*").eq("client_id", input.clientId).order("updated_at", { ascending: false }).limit(limit)));
      leadQueries.push(safeRows("Market Capture leads by client", db.from("market_capture_leads").select("*").eq("client_id", input.clientId).order("updated_at", { ascending: false }).limit(limit)));
    }
    if (normalizedEmail) {
      leadQueries.push(safeRows("Market Capture leads by email", db.from("market_capture_leads").select("*").ilike("email", normalizedEmail).order("updated_at", { ascending: false }).limit(limit)));
    }
  }

  const leads = await Promise.all(leadQueries).then((sets) => mergeById(sets.flat()));
  const leadIds = leads.map((row) => normalizeText(row.id)).filter(Boolean);
  if (!input.adminMode && leadIds.length > 0) {
    campaignQueries.push(safeRows("Market Capture campaigns by lead", db.from("market_capture_campaigns").select("*").in("market_capture_lead_id", leadIds).order("updated_at", { ascending: false }).limit(limit)));
  }
  const campaigns = await Promise.all(campaignQueries).then((sets) => mergeById(sets.flat()));
  const campaignIds = campaigns.map((row) => normalizeText(row.id)).filter(Boolean);

  const [locations, checklists, approvals, drafts, packages, geocodes, validations, history, imports, attribution, health] = await Promise.all([
    campaignIds.length ? safeRows("Market Capture locations", db.from("market_capture_campaign_locations").select("*").in("campaign_id", campaignIds).limit(800)) : Promise.resolve([]),
    campaignIds.length ? safeRows("Market Capture checklists", db.from("market_capture_checklists").select("*").in("campaign_id", campaignIds).limit(1000)) : Promise.resolve([]),
    campaignIds.length ? safeRows("Campaign approvals", db.from("campaign_approvals").select("*").in("market_capture_campaign_id", campaignIds).order("updated_at", { ascending: false }).limit(800)) : Promise.resolve([]),
    campaignIds.length ? safeRows("Campaign drafts", db.from("campaign_drafts").select("*").in("market_capture_campaign_id", campaignIds).order("updated_at", { ascending: false }).limit(1200)) : Promise.resolve([]),
    campaignIds.length ? safeRows("Launch packages", db.from("campaign_launch_packages").select("*").in("market_capture_campaign_id", campaignIds).order("updated_at", { ascending: false }).limit(500)) : Promise.resolve([]),
    campaignIds.length ? safeRows("Campaign geocodes", db.from("campaign_geocodes").select("*").in("market_capture_campaign_id", campaignIds).order("updated_at", { ascending: false }).limit(800)) : Promise.resolve([]),
    campaignIds.length ? safeRows("Target validation", db.from("campaign_target_validation").select("*").in("market_capture_campaign_id", campaignIds).order("updated_at", { ascending: false }).limit(800)) : Promise.resolve([]),
    campaignIds.length ? safeRows("Launch history", db.from("campaign_launch_history").select("*").in("market_capture_campaign_id", campaignIds).order("created_at", { ascending: false }).limit(500)) : Promise.resolve([]),
    campaignIds.length ? safeRows("Reporting imports", db.from("campaign_reporting_imports").select("*").in("market_capture_campaign_id", campaignIds).order("updated_at", { ascending: false }).limit(600)) : Promise.resolve([]),
    campaignIds.length ? safeRows("Attribution", db.from("campaign_attribution").select("*").in("market_capture_campaign_id", campaignIds).order("updated_at", { ascending: false }).limit(600)) : Promise.resolve([]),
    input.adminMode && isIntegrationHealthEnabled() ? safeRows("Integration health", db.from("integration_health").select("*").order("updated_at", { ascending: false }).limit(20)) : Promise.resolve([]),
  ]);

  return {
    campaigns,
    leads,
    locations,
    checklists,
    approvals,
    drafts: drafts as CampaignDraftRow[],
    launchPackages: packages as LaunchPackageRow[],
    geocodes,
    validations,
    launchHistory: history,
    reportingImports: imports,
    attribution,
    integrationHealth: health as IntegrationHealthRow[],
  };
}

function mergeById<T extends UnknownRow>(rows: T[]) {
  const map = new Map<string, T>();
  for (const row of rows) {
    const id = normalizeText(row.id);
    if (id) map.set(id, row);
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

async function seedCampaignDrafts(db: Db, campaign: UnknownRow, lead?: UnknownRow | null) {
  const rows = buildDrafts(campaign, lead);
  for (const row of rows) {
    await upsertByLookup(
      db,
      "campaign_drafts",
      {
        market_capture_campaign_id: campaign.id,
        platform: row.platform,
        draft_type: row.draft_type,
      },
      {
        market_capture_campaign_id: campaign.id,
        client_id: campaign.client_id,
        client_email: normalizeEmail(lead?.email || campaign.client_email),
        ...row,
        status: "draft_created",
        metadata: { noPaidLaunch: true, noAutoPublish: true, humanApprovalRequired: true },
      },
    );
  }
  return rows.length;
}

async function seedGeocodesAndValidation(db: Db, campaign: UnknownRow, lead: UnknownRow | null | undefined, locations: UnknownRow[]) {
  if (!isGeocodingEnabled() && !isTargetValidationEnabled()) return 0;
  const locationRows = locations.length > 0
    ? locations
    : [{ id: `synthetic-${campaign.id}`, location_type: "target_geography", name: campaignArea(campaign, lead), address: campaignArea(campaign, lead), radius_miles: campaign.radius_miles }];
  const seen = new Set<string>();
  let touched = 0;
  for (const location of locationRows) {
    const address = normalizeAddress(location, campaign, lead);
    const normalized = address.replace(/\s+/g, " ");
    const radius = numberValue(location.radius_miles, numberValue(campaign.radius_miles, 5));
    const duplicate = seen.has(normalized.toLowerCase());
    seen.add(normalized.toLowerCase());
    const hasCoordinates = Boolean(location.latitude && location.longitude);
    const validation = validationForLocation({
      label: normalizeText(location.name || normalized || "Target area"),
      address: normalized,
      radiusMiles: radius,
      duplicate,
      linked: Boolean(campaign.id),
      hasCoordinates,
    });
    const geocode = await upsertByLookup(
      db,
      "campaign_geocodes",
      {
        market_capture_campaign_id: campaign.id,
        location_id: normalizeText(location.id).startsWith("synthetic-") ? null : normalizeText(location.id),
      },
      {
        market_capture_campaign_id: campaign.id,
        location_id: normalizeText(location.id).startsWith("synthetic-") ? null : normalizeText(location.id),
        client_id: campaign.client_id,
        client_email: normalizeEmail(lead?.email || campaign.client_email),
        location_type: normalizeText(location.location_type || "custom_area"),
        input_address: address,
        normalized_address: normalized,
        latitude: location.latitude ?? null,
        longitude: location.longitude ?? null,
        radius_miles: radius,
        validation_status: validation.status,
        validation_message: validation.recommended_action,
        provider: googleMapsCredentials().ready && hasCoordinates ? "existing_coordinates" : "manual_validation",
        provider_payload: { googleMapsConfigured: googleMapsCredentials().ready, externalGeocodeNotAutoCalled: true },
        metadata: { phase: "7_ad_tech_integration_layer" },
      },
    );
    if (isTargetValidationEnabled()) {
      await upsertByLookup(
        db,
        "campaign_target_validation",
        {
          market_capture_campaign_id: campaign.id,
          geocode_id: geocode?.id ?? null,
        },
        {
          market_capture_campaign_id: campaign.id,
          geocode_id: geocode?.id ?? null,
          client_id: campaign.client_id,
          client_email: normalizeEmail(lead?.email || campaign.client_email),
          target_label: normalizeText(location.name || normalized || "Target area"),
          target_type: normalizeText(location.location_type || "custom_area"),
          ...validation,
          metadata: { radiusMiles: radius, noIndividualTargeting: true },
        },
      );
    }
    touched += 1;
  }
  return touched;
}

async function seedApprovals(db: Db, campaign: UnknownRow, lead?: UnknownRow | null) {
  const approvals = ["campaign", "creative", "geography", "budget", "launch_package", "tracking"];
  for (const approvalType of approvals) {
    const row = await upsertByLookup(
      db,
      "campaign_approvals",
      {
        market_capture_campaign_id: campaign.id,
        approval_type: approvalType,
      },
      {
        market_capture_campaign_id: campaign.id,
        client_id: campaign.client_id,
        client_email: normalizeEmail(lead?.email || campaign.client_email),
        approval_type: approvalType,
        status: approvalType === "launch_package" ? "awaiting_approval" : "awaiting_approval",
        requested_by: "ad_tech_integration_layer",
        notes: `${approvalType.replaceAll("_", " ")} requires explicit human approval before launch.`,
        metadata: { noAutoApproval: true },
      },
    );
    const ledgerResult = await syncAdTechApprovalLedger(
      {
        id: normalizeText(row.id),
        marketCaptureCampaignId: normalizeText(row.market_capture_campaign_id),
        digitalTargetingCampaignId: normalizeText(row.digital_targeting_campaign_id),
        launchPackageId: normalizeText(row.launch_package_id),
        clientId: normalizeText(row.client_id),
        clientEmail: normalizeEmail(row.client_email),
        approvalType: normalizeText(row.approval_type),
        status: normalizeText(row.status || "awaiting_approval"),
        requestedBy: normalizeText(row.requested_by),
        approverUserId: normalizeText(row.approver_user_id),
        approverEmail: normalizeEmail(row.approver_email),
        notes: typeof row.notes === "string" ? row.notes : null,
        revisionNotes: typeof row.revision_notes === "string" ? row.revision_notes : null,
        respondedAt: typeof row.responded_at === "string" ? row.responded_at : null,
        metadata: row.metadata as JsonRecord | null,
        createdAt: typeof row.created_at === "string" ? row.created_at : null,
        updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
      },
      {
        actorLabel: "ad_tech_integration_layer",
        eventType: "ad_tech_campaign_approval_seeded",
      },
    );
    if (!ledgerResult.ok && ledgerResult.error) {
      console.warn("[approval-ledger] ad-tech approval sync skipped:", ledgerResult.error);
    }
  }
  return approvals.length;
}

async function seedLaunchPackage(db: Db, campaign: UnknownRow, lead: UnknownRow | null | undefined, context: Awaited<ReturnType<typeof loadContext>>) {
  if (!isLaunchPackagesEnabled()) return null;
  const campaignId = normalizeText(campaign.id);
  const validations = context.validations.filter((row) => row.market_capture_campaign_id === campaignId);
  const approvals = context.approvals.filter((row) => row.market_capture_campaign_id === campaignId);
  const checklists = context.checklists.filter((row) => row.campaign_id === campaignId || row.market_capture_campaign_id === campaignId);
  const draftCount = context.drafts.filter((row) => row.market_capture_campaign_id === campaignId).length || buildDrafts(campaign, lead).length;
  const checklistComplete = checklists.length > 0 && checklists.every((row) => Boolean(row.completed_at) || row.status === "completed");
  const readiness = readinessFactors({ campaign, validations, approvals, draftCount, checklistComplete });
  const ready = readiness.score === 100;
  const row = await upsertByLookup(
    db,
    "campaign_launch_packages",
    {
      market_capture_campaign_id: campaignId,
    },
    {
      market_capture_campaign_id: campaignId,
      client_id: campaign.client_id,
      client_email: normalizeEmail(lead?.email || campaign.client_email),
      package_name: `${campaignName(campaign)} Launch Package`,
      package_status: ready ? "ready_for_launch" : "needs_review",
      campaign_summary: `${campaignName(campaign)} is prepared for manual launch review around ${campaignArea(campaign, lead)}. No paid campaign is launched by this package.`,
      target_areas: validations.map((row) => ({ label: row.target_label, status: row.status, action: row.recommended_action })),
      budget_summary: budgetSummary(campaign),
      creative_summary: { creativeStatus: campaign.creative_status ?? "missing", approvalRequired: true },
      tracking_urls: [campaign.tracking_url, campaign.landing_page_url].filter(Boolean).map((url) => ({ url })),
      landing_page_url: campaign.landing_page_url ?? null,
      launch_checklist: LAUNCH_CHECKLIST.map((item) => ({ item, complete: !readiness.missing.includes(item) })),
      missing_items: readiness.missing,
      readiness_score: readiness.score,
      ready_status: ready ? "ready" : "not_ready",
      recommended_next_action: readiness.missing[0] ?? "Admin may review and mark ready for manual launch.",
      client_approval_status: approvals.some((row) => row.status === "approved") ? "approved" : "awaiting_approval",
      admin_approval_status: ready ? "needs_review" : "needs_review",
      metadata: {
        readinessFactors: readiness.factors,
        noAutoLaunch: true,
        noAutoSpend: true,
      },
    },
  );
  const ledgerResult = await syncAdTechLaunchPackageLedger(
    {
      id: normalizeText(row.id),
      marketCaptureCampaignId: normalizeText(row.market_capture_campaign_id),
      digitalTargetingCampaignId: normalizeText(row.digital_targeting_campaign_id),
      clientId: normalizeText(row.client_id),
      clientEmail: normalizeEmail(row.client_email),
      packageName: normalizeText(row.package_name),
      packageStatus: normalizeText(row.package_status),
      campaignSummary: normalizeText(row.campaign_summary),
      readinessScore: numberValue(row.readiness_score),
      readyStatus: typeof row.ready_status === "string" ? row.ready_status : null,
      missingItems: Array.isArray(row.missing_items) ? row.missing_items.map(String) : [],
      recommendedNextAction: typeof row.recommended_next_action === "string" ? row.recommended_next_action : null,
      clientApprovalStatus: typeof row.client_approval_status === "string" ? row.client_approval_status : null,
      adminApprovalStatus: typeof row.admin_approval_status === "string" ? row.admin_approval_status : null,
      approvedForLaunchBy: typeof row.approved_for_launch_by === "string" ? row.approved_for_launch_by : null,
      approvedForLaunchAt: typeof row.approved_for_launch_at === "string" ? row.approved_for_launch_at : null,
      metadata: row.metadata as JsonRecord | null,
      createdAt: typeof row.created_at === "string" ? row.created_at : null,
      updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
    },
    {
      actorLabel: "ad_tech_integration_layer",
      eventType: "ad_tech_launch_package_synced",
    },
  );
  if (!ledgerResult.ok && ledgerResult.error) {
    console.warn("[approval-ledger] ad-tech launch package sync skipped:", ledgerResult.error);
  }
  return row;
}

function integrationRows(): JsonRecord[] {
  const meta = metaCredentials();
  const google = googleAdsCredentials();
  const maps = googleMapsCredentials();
  const launch = adApiLaunchStatus();
  const flags = integrationFeatureFlags();
  return [
    {
      integration_key: "meta",
      integration_name: "Meta Campaign Drafts",
      status: !flags.metaDrafts ? "disabled" : meta.ready ? "ready" : "not_configured",
      api_key_status: meta.ready ? "configured" : "missing",
      warnings: meta.ready ? ["API credentials present, but paid launch remains disabled unless explicitly approved."] : ["Missing META_ACCESS_TOKEN or META_MARKETING_API_ACCESS_TOKEN and META_AD_ACCOUNT_ID."],
      errors: [],
      feature_flag_status: flags,
      metadata: { adAccountConfigured: Boolean(meta.adAccountId), noAutoLaunch: true },
    },
    {
      integration_key: "google_ads",
      integration_name: "Google Campaign Drafts",
      status: !flags.googleDrafts ? "disabled" : google.ready ? "ready" : "not_configured",
      api_key_status: google.ready ? "configured" : "missing",
      warnings: google.ready ? ["Campaign criteria/location targeting can be prepared, but not launched automatically."] : ["Missing GOOGLE_ADS_CUSTOMER_ID or GOOGLE_ADS_DEVELOPER_TOKEN."],
      errors: [],
      feature_flag_status: flags,
      metadata: { fullOAuthReady: google.fullOAuthReady, noAutoLaunch: true },
    },
    {
      integration_key: "google_maps",
      integration_name: "Location Intelligence",
      status: !flags.geocoding ? "disabled" : maps.ready ? "ready" : "degraded",
      api_key_status: maps.ready ? "configured" : "missing",
      warnings: maps.ready ? [] : ["GOOGLE_MAPS_API_KEY missing; validation falls back to manual review."],
      errors: [],
      feature_flag_status: flags,
      metadata: { noExternalGeocodingByDefault: true },
    },
    {
      integration_key: "manual_reporting",
      integration_name: "Reporting Import Framework",
      status: flags.reportingImports ? "ready" : "disabled",
      api_key_status: "not_required",
      warnings: ["Manual reporting imports are available. API/CSV imports are future-ready and must not imply certainty."],
      errors: [],
      feature_flag_status: flags,
      metadata: { attributionCaution: true },
    },
    {
      integration_key: "launch_control",
      integration_name: "Launch Approval Control",
      status: launch.manualMode ? "ready" : "degraded",
      api_key_status: launch.enabled ? "api_launch_flag_enabled" : "manual_mode",
      warnings: launch.enabled ? ["ENABLE_AD_API_LAUNCH is enabled; still require explicit admin approval before any paid action."] : ["Manual launch mode is the active safe path."],
      errors: launch.manualMode || launch.enabled ? [] : ["Manual and API launch modes are both disabled."],
      feature_flag_status: flags,
      metadata: { noAutoLaunch: true, noAutoSpend: true },
    },
  ];
}

async function refreshIntegrationHealth(db: Db) {
  if (!isIntegrationHealthEnabled()) return 0;
  let touched = 0;
  for (const row of integrationRows()) {
    await upsertByLookup(db, "integration_health", { integration_key: row.integration_key }, row);
    touched += 1;
  }
  return touched;
}

async function syncContext(db: Db, context: Awaited<ReturnType<typeof loadContext>>) {
  const leadsById = new Map(context.leads.map((row) => [normalizeText(row.id), row]));
  const locationsByCampaign = rowsBy(context.locations, "campaign_id");
  let touched = 0;
  for (const campaign of context.campaigns.slice(0, 250)) {
    const lead = leadsById.get(normalizeText(campaign.market_capture_lead_id));
    touched += await seedCampaignDrafts(db, campaign, lead);
    touched += await seedGeocodesAndValidation(db, campaign, lead, locationsByCampaign.get(normalizeText(campaign.id)) ?? []);
    touched += await seedApprovals(db, campaign, lead);
    await seedLaunchPackage(db, campaign, lead, context);
  }
  touched += await refreshIntegrationHealth(db);
  return { recordsTouched: touched };
}

function emptyData(message?: string): AdTechCenterData {
  return {
    enabled: true,
    safeMode: Boolean(message),
    message,
    campaigns: [],
    drafts: [],
    launchPackages: [],
    geocodes: [],
    validations: [],
    approvals: [],
    launchHistory: [],
    reportingImports: [],
    attribution: [],
    integrationHealth: [],
    metrics: {
      draftCount: 0,
      approvalsNeeded: 0,
      launchReady: 0,
      reportingImportsNeeded: 0,
      healthWarnings: 0,
      averageReadiness: 0,
      manualLaunches: 0,
    },
  };
}

function metrics(data: Omit<AdTechCenterData, "enabled" | "safeMode" | "metrics">) {
  const readiness = data.launchPackages.map((row) => numberValue(row.readiness_score));
  return {
    draftCount: data.drafts.length,
    approvalsNeeded: data.approvals.filter((row) => row.status === "awaiting_approval" || row.status === "needs_changes").length,
    launchReady: data.launchPackages.filter((row) => row.ready_status === "ready" || row.package_status === "ready_for_launch").length,
    reportingImportsNeeded: data.campaigns.filter((campaign) => !data.reportingImports.some((row) => row.market_capture_campaign_id === campaign.id)).length,
    healthWarnings: data.integrationHealth.filter((row) => row.status !== "ready").length,
    averageReadiness: readiness.length ? Math.round(readiness.reduce((sum, value) => sum + value, 0) / readiness.length) : 0,
    manualLaunches: data.launchHistory.filter((row) => row.event_type === "manual_launch_complete").length,
  };
}

async function loadData(db: Db, input: { adminMode?: boolean; clientId?: string | null; clientEmail?: string | null }): Promise<AdTechCenterData> {
  const context = await loadContext(db, input);
  const data = {
    campaigns: context.campaigns,
    drafts: context.drafts,
    launchPackages: context.launchPackages,
    geocodes: context.geocodes,
    validations: context.validations,
    approvals: context.approvals,
    launchHistory: context.launchHistory,
    reportingImports: context.reportingImports,
    attribution: context.attribution,
    integrationHealth: context.integrationHealth,
  };
  return {
    enabled: true,
    safeMode: false,
    ...data,
    metrics: metrics(data),
  };
}

export async function ensureAdTechForAll({ supabase, limit = 250 }: { supabase: ServiceClient; limit?: number }) {
  if (!hasAdTechPersistence()) return { recordsTouched: 0 };
  try {
    const db = asDb(supabase);
    const context = await loadContext(db, { adminMode: true, limit });
    return await syncContext(db, context);
  } catch (error) {
    if (isMissingSchema(error)) return { recordsTouched: 0 };
    throw error;
  }
}

export async function ensureAdTechForClient({
  supabase,
  clientId,
  clientEmail,
}: {
  supabase: ServiceClient;
  clientId?: string | null;
  clientEmail?: string | null;
}) {
  if (!hasAdTechPersistence()) return { recordsTouched: 0 };
  try {
    const db = asDb(supabase);
    const context = await loadContext(db, { clientId, clientEmail });
    return await syncContext(db, context);
  } catch (error) {
    if (isMissingSchema(error)) return { recordsTouched: 0 };
    throw error;
  }
}

export async function loadAdminAdTechCenter({ supabase, autoSync = true }: { supabase: ServiceClient; autoSync?: boolean }): Promise<AdTechCenterData> {
  if (!hasAdTechPersistence()) return emptyData("Ad-Tech persistence is not configured.");
  try {
    const db = asDb(supabase);
    if (autoSync) await ensureAdTechForAll({ supabase });
    return loadData(db, { adminMode: true });
  } catch (error) {
    return emptyData(error instanceof Error ? error.message : "Ad-Tech Integration Layer is in safe mode.");
  }
}

export async function loadClientAdTechCenter({
  supabase,
  user,
  autoSync = true,
}: {
  supabase: ServiceClient;
  user: Pick<User, "id"> & { email?: string | null };
  autoSync?: boolean;
}): Promise<AdTechCenterData> {
  if (!hasAdTechPersistence()) return emptyData("Campaign launch status will appear after persistence is configured.");
  try {
    const db = asDb(supabase);
    if (autoSync) await ensureAdTechForClient({ supabase, clientId: user.id, clientEmail: user.email });
    return loadData(db, { clientId: user.id, clientEmail: user.email });
  } catch (error) {
    return emptyData(error instanceof Error ? error.message : "Campaign launch status is in safe mode.");
  }
}

export async function recordAdTechAction({
  supabase,
  actionType,
  actorEmail,
  actorUserId,
  actorRole,
  launchPackageId,
  approvalId,
  notes,
}: {
  supabase: ServiceClient;
  actionType: string;
  actorEmail?: string | null;
  actorUserId?: string | null;
  actorRole?: string | null;
  launchPackageId?: string | null;
  approvalId?: string | null;
  notes?: string | null;
}) {
  const db = asDb(supabase);
  const now = new Date().toISOString();
  const actorIsPrivileged = actorRole === "admin" || actorRole === "sales_agent";
  const assertActorCanAccess = (row: UnknownRow | null | undefined) => {
    if (actorIsPrivileged) return;
    const actorMatchesClientId = Boolean(actorUserId && row?.client_id === actorUserId);
    const actorMatchesEmail = Boolean(actorEmail && normalizeEmail(row?.client_email) === normalizeEmail(actorEmail));
    if (!actorMatchesClientId && !actorMatchesEmail) {
      throw new Error("Forbidden: campaign approval does not belong to this client.");
    }
  };

  if (approvalId) {
    const approval = await safeSingle<UnknownRow>("Campaign approval", db.from("campaign_approvals").select("*").eq("id", approvalId).maybeSingle());
    if (!approval) throw new Error("Approval not found.");
    assertActorCanAccess(approval);
    const status = actionType === "approve" ? "approved" : actionType === "request_changes" ? "needs_changes" : actionType === "reject" ? "rejected" : "question";
    const updatedApproval = await safeSingle<UnknownRow>(
      "Campaign approval update",
      db
        .from("campaign_approvals")
        .update({ status, approver_user_id: actorUserId ?? null, approver_email: actorEmail ?? null, notes, responded_at: now, updated_at: now })
        .eq("id", approvalId)
        .select("*")
        .maybeSingle(),
    );
    if (updatedApproval) {
      const ledgerResult = await syncAdTechApprovalLedger(
        {
          id: normalizeText(updatedApproval.id),
          marketCaptureCampaignId: normalizeText(updatedApproval.market_capture_campaign_id),
          digitalTargetingCampaignId: normalizeText(updatedApproval.digital_targeting_campaign_id),
          launchPackageId: normalizeText(updatedApproval.launch_package_id),
          clientId: normalizeText(updatedApproval.client_id),
          clientEmail: normalizeEmail(updatedApproval.client_email),
          approvalType: normalizeText(updatedApproval.approval_type),
          status: normalizeText(updatedApproval.status),
          requestedBy: normalizeText(updatedApproval.requested_by),
          approverUserId: normalizeText(updatedApproval.approver_user_id),
          approverEmail:
            typeof updatedApproval.approver_email === "string"
              ? normalizeEmail(updatedApproval.approver_email)
              : actorEmail ?? null,
          notes: typeof updatedApproval.notes === "string" ? updatedApproval.notes : notes,
          revisionNotes: typeof updatedApproval.revision_notes === "string" ? updatedApproval.revision_notes : null,
          respondedAt: typeof updatedApproval.responded_at === "string" ? updatedApproval.responded_at : now,
          metadata: updatedApproval.metadata as JsonRecord | null,
          createdAt: typeof updatedApproval.created_at === "string" ? updatedApproval.created_at : null,
          updatedAt: typeof updatedApproval.updated_at === "string" ? updatedApproval.updated_at : now,
        },
        {
          actorId: actorUserId ?? null,
          actorLabel: actorEmail ?? actorRole ?? "ad_tech_operator",
          eventType: "ad_tech_campaign_approval_updated",
          eventNotes: notes ?? undefined,
        },
      );
      if (!ledgerResult.ok && ledgerResult.error) {
        console.warn("[approval-ledger] ad-tech approval action sync skipped:", ledgerResult.error);
      }
    }
  }
  if (launchPackageId) {
    const launchPackage = await safeSingle<LaunchPackageRow>("Launch package", db.from("campaign_launch_packages").select("*").eq("id", launchPackageId).maybeSingle());
    if (!launchPackage) throw new Error("Launch package not found.");
    assertActorCanAccess(launchPackage);
    if ((actionType === "mark_ready" || actionType === "manual_launch_complete") && !actorIsPrivileged) {
      throw new Error("Admin approval required.");
    }
    if (actionType === "mark_ready") {
      const updatedPackage = await safeSingle<LaunchPackageRow>(
        "Launch package update",
        db
          .from("campaign_launch_packages")
          .update({ package_status: "ready_for_launch", admin_approval_status: "approved", approved_for_launch_by: actorRole ?? "admin", approved_for_launch_at: now, updated_at: now })
          .eq("id", launchPackageId)
          .select("*")
          .maybeSingle(),
      );
      if (updatedPackage) {
        const ledgerResult = await syncAdTechLaunchPackageLedger(
          {
            id: normalizeText(updatedPackage.id),
            marketCaptureCampaignId: normalizeText(updatedPackage.market_capture_campaign_id),
            digitalTargetingCampaignId: normalizeText(updatedPackage.digital_targeting_campaign_id),
            clientId: normalizeText(updatedPackage.client_id),
            clientEmail: normalizeEmail(updatedPackage.client_email),
            packageName: updatedPackage.package_name,
            packageStatus: updatedPackage.package_status,
            campaignSummary: updatedPackage.campaign_summary,
            readinessScore: numberValue(updatedPackage.readiness_score),
            readyStatus: typeof updatedPackage.ready_status === "string" ? updatedPackage.ready_status : null,
            missingItems: Array.isArray(updatedPackage.missing_items) ? updatedPackage.missing_items.map(String) : [],
            recommendedNextAction:
              typeof updatedPackage.recommended_next_action === "string" ? updatedPackage.recommended_next_action : null,
            clientApprovalStatus:
              typeof updatedPackage.client_approval_status === "string" ? updatedPackage.client_approval_status : null,
            adminApprovalStatus:
              typeof updatedPackage.admin_approval_status === "string" ? updatedPackage.admin_approval_status : null,
            approvedForLaunchBy:
              typeof updatedPackage.approved_for_launch_by === "string" ? updatedPackage.approved_for_launch_by : null,
            approvedForLaunchAt:
              typeof updatedPackage.approved_for_launch_at === "string"
                ? updatedPackage.approved_for_launch_at
                : null,
            metadata: updatedPackage.metadata as JsonRecord | null,
            createdAt: typeof updatedPackage.created_at === "string" ? updatedPackage.created_at : null,
            updatedAt: typeof updatedPackage.updated_at === "string" ? updatedPackage.updated_at : now,
          },
          {
            actorId: actorUserId ?? null,
            actorLabel: actorEmail ?? actorRole ?? "ad_tech_operator",
            eventType: "ad_tech_launch_package_ready",
            eventNotes: notes ?? undefined,
          },
        );
        if (!ledgerResult.ok && ledgerResult.error) {
          console.warn("[approval-ledger] ad-tech launch package ready sync skipped:", ledgerResult.error);
        }
      }
    }
    if (actionType === "manual_launch_complete") {
      const updatedPackage = await safeSingle<LaunchPackageRow>(
        "Launch package manual completion",
        db
          .from("campaign_launch_packages")
          .update({ package_status: "launch_completed_manually", updated_at: now })
          .eq("id", launchPackageId)
          .select("*")
          .maybeSingle(),
      );
      if (updatedPackage) {
        const ledgerResult = await syncAdTechLaunchPackageLedger(
          {
            id: normalizeText(updatedPackage.id),
            marketCaptureCampaignId: normalizeText(updatedPackage.market_capture_campaign_id),
            digitalTargetingCampaignId: normalizeText(updatedPackage.digital_targeting_campaign_id),
            clientId: normalizeText(updatedPackage.client_id),
            clientEmail: normalizeEmail(updatedPackage.client_email),
            packageName: updatedPackage.package_name,
            packageStatus: updatedPackage.package_status,
            campaignSummary: updatedPackage.campaign_summary,
            readinessScore: numberValue(updatedPackage.readiness_score),
            readyStatus: typeof updatedPackage.ready_status === "string" ? updatedPackage.ready_status : null,
            missingItems: Array.isArray(updatedPackage.missing_items) ? updatedPackage.missing_items.map(String) : [],
            recommendedNextAction:
              typeof updatedPackage.recommended_next_action === "string" ? updatedPackage.recommended_next_action : null,
            clientApprovalStatus:
              typeof updatedPackage.client_approval_status === "string" ? updatedPackage.client_approval_status : null,
            adminApprovalStatus:
              typeof updatedPackage.admin_approval_status === "string" ? updatedPackage.admin_approval_status : null,
            approvedForLaunchBy:
              typeof updatedPackage.approved_for_launch_by === "string" ? updatedPackage.approved_for_launch_by : null,
            approvedForLaunchAt:
              typeof updatedPackage.approved_for_launch_at === "string"
                ? updatedPackage.approved_for_launch_at
                : null,
            metadata: updatedPackage.metadata as JsonRecord | null,
            createdAt: typeof updatedPackage.created_at === "string" ? updatedPackage.created_at : null,
            updatedAt: typeof updatedPackage.updated_at === "string" ? updatedPackage.updated_at : now,
          },
          {
            actorId: actorUserId ?? null,
            actorLabel: actorEmail ?? actorRole ?? "ad_tech_operator",
            eventType: "ad_tech_launch_completed_manually",
            eventNotes: notes ?? undefined,
          },
        );
        if (!ledgerResult.ok && ledgerResult.error) {
          console.warn("[approval-ledger] ad-tech launch package complete sync skipped:", ledgerResult.error);
        }
      }
      await db.from("campaign_launch_history").insert({
        market_capture_campaign_id: launchPackage.market_capture_campaign_id,
        digital_targeting_campaign_id: launchPackage.digital_targeting_campaign_id,
        launch_package_id: launchPackageId,
        client_id: launchPackage.client_id,
        client_email: launchPackage.client_email,
        event_type: "manual_launch_complete",
        platform: "manual",
        status: "recorded",
        actor_user_id: actorUserId ?? null,
        actor_role: actorRole ?? null,
        summary: notes || "Admin recorded manual launch completion. No paid launch was performed by HomeReach automation.",
        metadata: { noAutoLaunch: true, humanRecorded: true },
      });
    }
  }
  return { ok: true };
}

export async function saveReportingImport({
  supabase,
  input,
  importedBy,
}: {
  supabase: ServiceClient;
  input: JsonRecord;
  importedBy: string;
}) {
  if (!isReportingImportsEnabled()) throw new Error("Reporting imports are disabled.");
  const db = asDb(supabase);
  const campaignId = normalizeText(input.marketCaptureCampaignId);
  if (!campaignId) throw new Error("Campaign is required.");
  const campaign = await safeSingle<UnknownRow>("Market Capture campaign", db.from("market_capture_campaigns").select("*").eq("id", campaignId).maybeSingle());
  if (!campaign) throw new Error("Campaign not found.");
  const clicks = numberValue(input.clicks);
  const spend = numberValue(input.spendCents);
  const leads = numberValue(input.leads);
  const row = await upsertByLookup(
    db,
    "campaign_reporting_imports",
    {
      market_capture_campaign_id: campaignId,
      platform: normalizeText(input.platform || "manual"),
      reporting_period_start: normalizeText(input.reportingPeriodStart) || null,
      reporting_period_end: normalizeText(input.reportingPeriodEnd) || null,
    },
    {
      market_capture_campaign_id: campaignId,
      client_id: campaign.client_id,
      client_email: normalizeEmail(campaign.client_email),
      source: normalizeText(input.source || "manual"),
      platform: normalizeText(input.platform || "manual"),
      reporting_period_start: normalizeText(input.reportingPeriodStart) || null,
      reporting_period_end: normalizeText(input.reportingPeriodEnd) || null,
      impressions: numberValue(input.impressions),
      reach: numberValue(input.reach),
      clicks,
      ctr: numberValue(input.ctr),
      spend,
      leads,
      calls: numberValue(input.calls),
      forms: numberValue(input.forms),
      landing_page_visits: numberValue(input.landingPageVisits),
      qr_scans: numberValue(input.qrScans),
      cost_per_click: clicks > 0 ? Math.round(spend / clicks) : 0,
      cost_per_lead: leads > 0 ? Math.round(spend / leads) : 0,
      campaign_notes: normalizeText(input.notes),
      recommendations: normalizeText(input.recommendations),
      import_status: "manual_entry",
      imported_by: importedBy,
      raw_payload: input,
      metadata: { attributionCaution: true },
    },
  );
  if (isAttributionLayerEnabled()) {
    await db.from("campaign_attribution").insert({
      market_capture_campaign_id: campaignId,
      reporting_import_id: row?.id ?? null,
      client_id: campaign.client_id,
      client_email: normalizeEmail(campaign.client_email),
      source: normalizeText(input.platform || "manual"),
      medium: "manual_reporting",
      landing_page_url: campaign.landing_page_url ?? null,
      conversion_type: leads > 0 ? "lead" : "performance_note",
      conversion_notes: normalizeText(input.notes || "Manual reporting import created."),
      confidence: "observed",
      metadata: { reportingImportId: row?.id ?? null, attributionIsNotCertain: true },
    });
  }
  return row;
}
