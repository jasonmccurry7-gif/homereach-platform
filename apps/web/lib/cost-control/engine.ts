import type { User } from "@supabase/supabase-js";
import type { createServiceClient } from "@/lib/supabase/service";
import {
  hasCostControlPersistence,
  isCostControlEnabled,
  isCostControlReportingEnabled,
  isCostControlScoreEnabled,
  isSavingsTrackerEnabled,
  isSupplierDirectoryEnabled,
} from "./config";

type ServiceClient = ReturnType<typeof createServiceClient>;
type Db = ReturnType<typeof createServiceClient> & {
  from(table: string): any;
};

type JsonRecord = Record<string, unknown>;

export type CostControlOpportunityRow = {
  id: string;
  client_id: string | null;
  client_email: string | null;
  business_memory_profile_id: string | null;
  supplier_id: string | null;
  category_id: string | null;
  opportunity_type: string;
  title: string;
  category: string;
  estimated_savings_cents: number;
  estimated_monthly_savings_cents: number;
  estimated_annual_savings_cents: number;
  actual_savings_cents: number;
  reason: string;
  recommended_action: string;
  confidence_score: number;
  priority_score: number;
  status: CostControlStatus;
  owner: string | null;
  next_action: string | null;
  notes: string | null;
  review_due_at: string | null;
  metadata: JsonRecord | null;
  created_at: string;
  updated_at: string;
};

export type SupplierDirectoryRow = {
  id: string;
  client_id: string | null;
  client_email: string | null;
  business_memory_profile_id: string | null;
  supplier_name: string;
  category: string | null;
  spend_category: string | null;
  status: string;
  notes: string | null;
  pricing_notes: string | null;
  review_date: string | null;
  savings_found_cents: number;
  savings_accepted_cents: number;
  savings_rejected_cents: number;
  metadata: JsonRecord | null;
  updated_at: string;
};

export type CostControlScoreRow = {
  id: string;
  client_id: string | null;
  client_email: string | null;
  score: number;
  color: "green" | "yellow" | "red";
  categories_monitored_score: number;
  opportunities_reviewed_score: number;
  opportunities_implemented_score: number;
  supplier_reviews_score: number;
  data_completeness_score: number;
  current_status: string;
  recommended_action: string;
  next_opportunity_id: string | null;
  calculated_at: string;
};

export type CostControlDraftRow = {
  id: string;
  opportunity_id: string;
  draft_type: string;
  label: string;
  content: string;
  approval_status: string;
  copy_count: number;
};

export type CostControlReportRow = {
  id: string;
  reporting_period_start: string;
  reporting_period_end: string;
  estimated_savings_cents: number;
  actual_savings_cents: number;
  top_categories: JsonRecord[] | null;
  top_opportunities: JsonRecord[] | null;
  implemented_opportunities: JsonRecord[] | null;
  rejected_opportunities: JsonRecord[] | null;
  recommendations: string | null;
};

export type CostControlCenterData = {
  enabled: boolean;
  safeMode: boolean;
  message?: string;
  opportunities: CostControlOpportunityRow[];
  suppliers: SupplierDirectoryRow[];
  draftsByOpportunity: Record<string, CostControlDraftRow[]>;
  score: CostControlScoreRow | null;
  report: CostControlReportRow | null;
  metrics: CostControlMetrics;
};

export type CostControlAdminData = CostControlCenterData & {
  reviews: any[];
  savings: any[];
};

export type CostControlMetrics = {
  potentialSavingsCents: number;
  acceptedSavingsCents: number;
  estimatedAnnualSavingsCents: number;
  openOpportunities: number;
  supplierCategoriesTracked: number;
  pendingReviews: number;
  implementedOpportunities: number;
  rejectedOpportunities: number;
};

type ClientIdentity = {
  clientId: string | null;
  clientEmail: string | null;
  businessMemoryProfileId: string | null;
  businessName: string | null;
};

type CostControlStatus =
  | "new_opportunity"
  | "under_review"
  | "pending_decision"
  | "approved"
  | "implemented"
  | "rejected"
  | "completed"
  | "dismissed";

const STANDARD_CATEGORIES = [
  "Ingredients",
  "Printing",
  "Marketing",
  "Office Supplies",
  "Equipment",
  "Fuel",
  "Fleet",
  "Utilities",
  "Software",
  "Labor Services",
  "Other",
];

const OPEN_STATUSES = new Set(["new_opportunity", "under_review", "pending_decision", "approved"]);
const TABLES_WITHOUT_UPDATED_AT = new Set(["business_memory_timeline", "cost_control_drafts"]);

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
  return Array.from(new Set(values.flatMap(asArray).filter(Boolean)));
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

function isMissingCostControlSchema(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /cost_control|supplier_directory|supplier_categories|savings_tracker|schema cache|does not exist|relation/i.test(message);
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

async function profileForIdentity(db: Db, identity: Omit<ClientIdentity, "businessMemoryProfileId">) {
  if (identity.clientId) {
    const profile = await safeSingle(
      "Business memory profile by client",
      db.from("business_memory_profiles").select("*").eq("client_id", identity.clientId).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    );
    if (profile?.id) return profile;
  }
  if (identity.clientEmail) {
    const profile = await safeSingle(
      "Business memory profile by email",
      db.from("business_memory_profiles").select("*").ilike("client_email", normalizeEmail(identity.clientEmail)).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    );
    if (profile?.id) return profile;
  }
  return null;
}

async function identityForOperationsUser(db: Db, userId: string | null | undefined, context?: any): Promise<ClientIdentity> {
  const base = {
    clientId: userId ?? null,
    clientEmail: null,
    businessName: firstNonEmpty(context?.company_name, "Operations Client"),
  };
  const profile = await profileForIdentity(db, base);
  return {
    ...base,
    businessMemoryProfileId: profile?.id ?? null,
    businessName: firstNonEmpty(profile?.business_name, base.businessName),
  };
}

function clientLookup(identity: ClientIdentity) {
  return identity.clientId
    ? { client_id: identity.clientId }
    : { client_email: normalizeEmail(identity.clientEmail) };
}

function categoryName(value: unknown) {
  const raw = normalizeText(value).toLowerCase();
  if (!raw) return "Other";
  if (/food|ingredient|produce|meat|dairy|beverage|paper good/.test(raw)) return "Ingredients";
  if (/print|postcard|mailer|mail|paper|signage/.test(raw)) return "Printing";
  if (/ad|marketing|lead|seo|website|campaign/.test(raw)) return "Marketing";
  if (/office|admin|paper|ink|toner/.test(raw)) return "Office Supplies";
  if (/equipment|tool|machine|hardware/.test(raw)) return "Equipment";
  if (/fuel|gas|diesel/.test(raw)) return "Fuel";
  if (/fleet|vehicle|truck|van/.test(raw)) return "Fleet";
  if (/utility|electric|water|gas bill|internet|phone/.test(raw)) return "Utilities";
  if (/software|saas|subscription|app/.test(raw)) return "Software";
  if (/labor|contractor|service|crew/.test(raw)) return "Labor Services";
  return STANDARD_CATEGORIES.find((category) => category.toLowerCase() === raw) ?? "Other";
}

function normalizedCategory(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function opportunityTypeFromSavings(row: any) {
  const haystack = `${row.title ?? ""} ${row.summary ?? ""} ${row.category ?? ""}`.toLowerCase();
  if (/contract|renewal|terms/.test(haystack)) return "contract_review";
  if (/bulk|volume|case|quantity/.test(haystack)) return "bulk_purchase";
  if (/vendor|supplier|compare|comparison|quote/.test(haystack)) return "supplier_comparison";
  if (/alternative|substitute/.test(haystack)) return "alternative_supplier";
  if (/season|holiday|summer|winter/.test(haystack)) return "seasonal_purchasing";
  return "category_review";
}

function opportunityTypeFromAlert(row: any) {
  const haystack = `${row.alert_type ?? ""} ${row.title ?? ""} ${row.detail ?? ""}`.toLowerCase();
  if (/price|increase|drift/.test(haystack)) return "price_increase_alert";
  if (/invoice|recurring|overspend|variance/.test(haystack)) return "recurring_overspend";
  if (/contract|renewal/.test(haystack)) return "contract_review";
  if (/vendor|supplier/.test(haystack)) return "supplier_comparison";
  return "category_review";
}

function statusFromSource(status: unknown): CostControlStatus {
  const value = normalizeText(status).toLowerCase();
  if (["approved", "accepted"].includes(value)) return "approved";
  if (["implemented", "launched"].includes(value)) return "implemented";
  if (["completed", "resolved"].includes(value)) return "completed";
  if (["rejected", "declined"].includes(value)) return "rejected";
  if (["dismissed", "ignored"].includes(value)) return "dismissed";
  if (["pending_approval", "needs_approval", "needs_review"].includes(value)) return "pending_decision";
  if (["in_progress", "reviewing", "under_review"].includes(value)) return "under_review";
  return "new_opportunity";
}

function confidenceScore(value: unknown, fallback = 62) {
  const confidence = normalizeText(value).toLowerCase();
  if (confidence === "high") return 82;
  if (confidence === "low") return 45;
  return fallback;
}

function priorityFor(input: { annualSavingsCents: number; confidenceScore: number; status: CostControlStatus }) {
  const valueScore = input.annualSavingsCents >= 240000 ? 88 : input.annualSavingsCents >= 60000 ? 72 : input.annualSavingsCents > 0 ? 55 : 35;
  const urgency = ["new_opportunity", "under_review", "pending_decision"].includes(input.status) ? 68 : 48;
  return clampScore(valueScore * 0.45 + input.confidenceScore * 0.3 + urgency * 0.25);
}

async function ensureCategory(db: Db, identity: ClientIdentity, name: string, source?: { table: string; id: string }) {
  if (!isSupplierDirectoryEnabled()) return null;
  const normalized = normalizedCategory(name);
  return upsertByLookup(
    db,
    "supplier_categories",
    { ...clientLookup(identity), normalized_name: normalized },
    {
      client_id: identity.clientId,
      client_email: identity.clientEmail ? normalizeEmail(identity.clientEmail) : null,
      business_memory_profile_id: identity.businessMemoryProfileId,
      name,
      normalized_name: normalized,
      custom: !STANDARD_CATEGORIES.includes(name),
      status: "active",
      source_table: source?.table ?? null,
      source_id: source?.id ?? null,
      metadata: { phase: "4_cost_control_engine_mvp" },
    },
  );
}

async function ensureSupplier(
  db: Db,
  identity: ClientIdentity,
  input: {
    supplierName: string;
    category?: string | null;
    status?: string | null;
    notes?: string | null;
    pricingNotes?: string | null;
    sourceTable?: string | null;
    sourceId?: string | null;
    savingsFoundCents?: number;
    savingsAcceptedCents?: number;
    savingsRejectedCents?: number;
    metadata?: JsonRecord;
  },
) {
  if (!isSupplierDirectoryEnabled()) return null;
  const category = categoryName(input.category);
  const categoryRow = await ensureCategory(db, identity, category, input.sourceTable && input.sourceId ? { table: input.sourceTable, id: input.sourceId } : undefined);
  const lookup = input.sourceTable && input.sourceId
    ? { ...clientLookup(identity), source_table: input.sourceTable, source_id: input.sourceId }
    : { ...clientLookup(identity), supplier_name: input.supplierName };

  return upsertByLookup(db, "supplier_directory", lookup, {
    client_id: identity.clientId,
    client_email: identity.clientEmail ? normalizeEmail(identity.clientEmail) : null,
    business_memory_profile_id: identity.businessMemoryProfileId,
    supplier_name: input.supplierName,
    category_id: categoryRow?.id ?? null,
    category,
    spend_category: category,
    status: input.status ?? "active",
    notes: input.notes ?? null,
    pricing_notes: input.pricingNotes ?? null,
    review_date: addDaysIso(14).slice(0, 10),
    savings_found_cents: input.savingsFoundCents ?? 0,
    savings_accepted_cents: input.savingsAcceptedCents ?? 0,
    savings_rejected_cents: input.savingsRejectedCents ?? 0,
    source_table: input.sourceTable ?? null,
    source_id: input.sourceId ?? null,
    metadata: { ...(input.metadata ?? {}), phase: "4_cost_control_engine_mvp" },
  });
}

async function ensureOpportunity(
  db: Db,
  identity: ClientIdentity,
  input: {
    title: string;
    category: string;
    opportunityType: string;
    reason: string;
    recommendedAction: string;
    monthlySavingsCents: number;
    annualSavingsCents: number;
    actualSavingsCents?: number;
    confidence: number;
    status: CostControlStatus;
    supplierId?: string | null;
    categoryId?: string | null;
    sourceTable: string;
    sourceId: string;
    metadata?: JsonRecord;
  },
) {
  const opportunity = await upsertByLookup(
    db,
    "cost_control_opportunities",
    {
      ...clientLookup(identity),
      source_table: input.sourceTable,
      source_id: input.sourceId,
      opportunity_type: input.opportunityType,
    },
    {
      client_id: identity.clientId,
      client_email: identity.clientEmail ? normalizeEmail(identity.clientEmail) : null,
      business_memory_profile_id: identity.businessMemoryProfileId,
      supplier_id: input.supplierId ?? null,
      category_id: input.categoryId ?? null,
      title: input.title,
      category: input.category,
      estimated_savings_cents: input.monthlySavingsCents,
      estimated_monthly_savings_cents: input.monthlySavingsCents,
      estimated_annual_savings_cents: input.annualSavingsCents,
      actual_savings_cents: input.actualSavingsCents ?? 0,
      reason: input.reason,
      recommended_action: input.recommendedAction,
      confidence_score: input.confidence,
      priority_score: priorityFor({ annualSavingsCents: input.annualSavingsCents, confidenceScore: input.confidence, status: input.status }),
      status: input.status,
      owner: "Cost Control",
      next_action: input.recommendedAction,
      review_due_at: OPEN_STATUSES.has(input.status) ? addDaysIso(7) : null,
      metadata: { ...(input.metadata ?? {}), approvalRequired: true, noSpendCommitment: true, phase: "4_cost_control_engine_mvp" },
    },
  );

  await ensureDrafts(db, opportunity as CostControlOpportunityRow);
  if (isSavingsTrackerEnabled()) await ensureSavingsTracker(db, identity, opportunity as CostControlOpportunityRow);
  await syncOpportunityToBusinessMemory(db, identity, opportunity as CostControlOpportunityRow);
  return opportunity as CostControlOpportunityRow;
}

async function ensureSavingsTracker(db: Db, identity: ClientIdentity, opportunity: CostControlOpportunityRow) {
  const status = opportunity.status === "approved"
    ? "approved"
    : opportunity.status === "implemented"
      ? "implemented"
      : opportunity.status === "rejected"
        ? "rejected"
        : opportunity.status === "completed"
          ? "completed"
          : "estimated";

  await upsertByLookup(
    db,
    "savings_tracker",
    {
      ...clientLookup(identity),
      source_table: "cost_control_opportunities",
      source_id: opportunity.id,
    },
    {
      opportunity_id: opportunity.id,
      supplier_id: opportunity.supplier_id,
      client_id: identity.clientId,
      client_email: identity.clientEmail ? normalizeEmail(identity.clientEmail) : null,
      business_memory_profile_id: identity.businessMemoryProfileId,
      estimated_savings_cents: opportunity.estimated_savings_cents,
      actual_savings_cents: opportunity.actual_savings_cents,
      monthly_savings_cents: opportunity.estimated_monthly_savings_cents,
      annual_savings_cents: opportunity.estimated_annual_savings_cents,
      savings_source: "cost_control_engine",
      status,
      notes: opportunity.reason,
      metadata: { opportunityType: opportunity.opportunity_type },
    },
  );
}

function draftsForOpportunity(row: CostControlOpportunityRow) {
  const business = "your business";
  const savings = row.estimated_annual_savings_cents > 0
    ? `$${Math.round(row.estimated_annual_savings_cents / 100).toLocaleString()} in possible annual savings`
    : "a cost-control review";
  const supplierLine = row.metadata?.supplierName ? ` for ${row.metadata.supplierName}` : "";
  const guardrail = "No vendor change, order, payment, or spend commitment should happen without owner approval.";

  return [
    {
      draft_type: "supplier_review_email",
      label: "Supplier Review Email",
      content: `Subject: Quick supplier cost review${supplierLine}\n\nHi there,\n\nHomeReach found a cost-control item for ${business}: ${row.title}.\n\nReason: ${row.reason}\n\nRecommended next step: ${row.recommended_action}\n\nEstimated impact: ${savings}.\n\n${guardrail}\n\nBest,\nHomeReach`,
    },
    {
      draft_type: "price_inquiry_email",
      label: "Price Inquiry Email",
      content: `Subject: Pricing review request\n\nHi,\n\nWe are reviewing recurring costs and would like current pricing, fees, delivery terms, and any volume options for the category tied to ${row.category}.\n\nPlease send the latest pricing details and any practical ways to reduce recurring cost without lowering quality.\n\nThank you.`,
    },
    {
      draft_type: "vendor_comparison_request",
      label: "Vendor Comparison Request",
      content: `Please compare the current supplier cost for ${row.category} against at least one approved alternative. Include unit price, delivery fees, minimums, lead time, reliability notes, and any switching risk. ${guardrail}`,
    },
    {
      draft_type: "savings_proposal",
      label: "Savings Proposal",
      content: `${row.title}\n\nEstimated savings: ${savings}\n\nWhy it matters: ${row.reason}\n\nRecommended action: ${row.recommended_action}\n\nApproval note: ${guardrail}`,
    },
    {
      draft_type: "internal_review_memo",
      label: "Internal Review Memo",
      content: `Cost Control review memo\n\nOpportunity: ${row.title}\nCategory: ${row.category}\nStatus: ${row.status.replaceAll("_", " ")}\nConfidence: ${row.confidence_score}%\nReason: ${row.reason}\nNext action: ${row.recommended_action}\nGuardrail: ${guardrail}`,
    },
    {
      draft_type: "owner_action_summary",
      label: "Owner Action Summary",
      content: `We found a possible savings opportunity: ${row.title}. The practical next step is to ${row.recommended_action.toLowerCase()} Estimated impact: ${savings}. ${guardrail}`,
    },
  ];
}

async function ensureDrafts(db: Db, opportunity: CostControlOpportunityRow) {
  const existing = await safeRows(
    "Cost Control drafts",
    db.from("cost_control_drafts").select("draft_type").eq("opportunity_id", opportunity.id).limit(20),
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
      metadata: { noOutboundWithoutApproval: true },
    }));
  if (rows.length === 0) return;
  const { error } = await db.from("cost_control_drafts").insert(rows);
  if (error) throw new Error(`Cost Control draft creation failed: ${error.message}`);
}

async function syncOpportunityToBusinessMemory(db: Db, identity: ClientIdentity, opportunity: CostControlOpportunityRow) {
  if (!identity.businessMemoryProfileId) return;
  try {
    const accepted = ["approved", "implemented", "completed"].includes(opportunity.status);
    const rejected = ["rejected", "dismissed"].includes(opportunity.status);
    await upsertByLookup(
      db,
      "business_memory_savings",
      { profile_id: identity.businessMemoryProfileId, source_table: "cost_control_opportunities", source_id: opportunity.id },
      {
        profile_id: identity.businessMemoryProfileId,
        opportunity_name: opportunity.title,
        category: opportunity.category,
        estimated_savings_cents: opportunity.estimated_annual_savings_cents,
        actual_savings_cents: opportunity.actual_savings_cents,
        accepted,
        rejected,
        recurring_savings: true,
        one_time_savings: false,
        status: opportunity.status,
        metadata: { opportunityType: opportunity.opportunity_type, confidenceScore: opportunity.confidence_score },
      },
    );
    await upsertByLookup(
      db,
      "business_memory_opportunities",
      { profile_id: identity.businessMemoryProfileId, source_table: "cost_control_opportunities", source_id: opportunity.id },
      {
        profile_id: identity.businessMemoryProfileId,
        opportunity_type: opportunity.opportunity_type,
        opportunity_reason: opportunity.reason,
        opportunity_status: opportunity.status,
        accepted,
        rejected,
        dismissed: opportunity.status === "dismissed",
        completed: opportunity.status === "completed",
        estimated_value_cents: opportunity.estimated_annual_savings_cents,
        actual_value_cents: opportunity.actual_savings_cents,
        date_created: opportunity.created_at ?? new Date().toISOString(),
        date_closed: ["completed", "rejected", "dismissed"].includes(opportunity.status) ? new Date().toISOString() : null,
        metadata: { source: "cost_control_engine" },
      },
    );
    await upsertByLookup(
      db,
      "business_memory_timeline",
      {
        profile_id: identity.businessMemoryProfileId,
        event_type: "cost_control",
        related_table: "cost_control_opportunities",
        related_id: opportunity.id,
      },
      {
        profile_id: identity.businessMemoryProfileId,
        event_type: "cost_control",
        title: "Cost savings opportunity remembered",
        description: opportunity.reason,
        event_date: opportunity.updated_at ?? new Date().toISOString(),
        impact_cents: opportunity.estimated_annual_savings_cents,
        status: opportunity.status,
        metadata: { opportunityType: opportunity.opportunity_type },
      },
    );
  } catch (error) {
    if (!/business_memory_|schema cache|does not exist|relation/i.test(error instanceof Error ? error.message : String(error))) throw error;
  }
}

async function syncSupplierToBusinessMemory(db: Db, supplier: SupplierDirectoryRow) {
  if (!supplier.business_memory_profile_id) return;
  try {
    await upsertByLookup(
      db,
      "business_memory_suppliers",
      { profile_id: supplier.business_memory_profile_id, source_table: "supplier_directory", source_id: supplier.id },
      {
        profile_id: supplier.business_memory_profile_id,
        supplier_name: supplier.supplier_name,
        category: supplier.category,
        vendor_notes: supplier.notes,
        supplier_history: [{ status: supplier.status, updatedAt: supplier.updated_at }],
        pricing_history: supplier.pricing_notes ? [{ note: supplier.pricing_notes, updatedAt: supplier.updated_at }] : [],
        metadata: { source: "cost_control_engine" },
      },
    );
  } catch (error) {
    if (!/business_memory_|schema cache|does not exist|relation/i.test(error instanceof Error ? error.message : String(error))) throw error;
  }
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
  const [businessContexts, suppliers, savings, alerts, memoryProfiles] = await Promise.all([
    adminMode
      ? safeRows("Operations business contexts", db.from("opcopilot_business_contexts").select("*").order("updated_at", { ascending: false }).limit(limit ?? 250))
      : clientId
        ? safeRows("Operations business context", db.from("opcopilot_business_contexts").select("*").eq("user_id", clientId).limit(20))
        : Promise.resolve([]),
    adminMode
      ? safeRows("Operations suppliers", db.from("opcopilot_suppliers").select("*").order("updated_at", { ascending: false }).limit(limit ?? 500))
      : clientId
        ? safeRows("Operations suppliers", db.from("opcopilot_suppliers").select("*").eq("user_id", clientId).order("updated_at", { ascending: false }).limit(250))
        : Promise.resolve([]),
    adminMode
      ? safeRows("Operations savings", db.from("opcopilot_savings_recommendations").select("*").order("updated_at", { ascending: false }).limit(limit ?? 500))
      : clientId
        ? safeRows("Operations savings", db.from("opcopilot_savings_recommendations").select("*").eq("user_id", clientId).order("updated_at", { ascending: false }).limit(250))
        : Promise.resolve([]),
    adminMode
      ? safeRows("Operations alerts", db.from("opcopilot_operational_alerts").select("*").order("updated_at", { ascending: false }).limit(limit ?? 500))
      : clientId
        ? safeRows("Operations alerts", db.from("opcopilot_operational_alerts").select("*").eq("user_id", clientId).order("updated_at", { ascending: false }).limit(250))
        : Promise.resolve([]),
    adminMode
      ? safeRows("Business memory profiles", db.from("business_memory_profiles").select("*").order("updated_at", { ascending: false }).limit(limit ?? 250))
      : clientId
        ? safeRows("Business memory profile", db.from("business_memory_profiles").select("*").eq("client_id", clientId).order("updated_at", { ascending: false }).limit(5))
        : normalizedEmail
          ? safeRows("Business memory profile by email", db.from("business_memory_profiles").select("*").ilike("client_email", normalizedEmail).order("updated_at", { ascending: false }).limit(5))
          : Promise.resolve([]),
  ]);

  const profileIds = memoryProfiles.map((profile) => profile.id).filter(Boolean);
  const [memorySuppliers, memorySavings] = await Promise.all([
    profileIds.length
      ? safeRows("Business memory suppliers", db.from("business_memory_suppliers").select("*").in("profile_id", profileIds).limit(limit ?? 500))
      : Promise.resolve([]),
    profileIds.length
      ? safeRows("Business memory savings", db.from("business_memory_savings").select("*").in("profile_id", profileIds).limit(limit ?? 500))
      : Promise.resolve([]),
  ]);

  return { businessContexts, suppliers, savings, alerts, memoryProfiles, memorySuppliers, memorySavings };
}

async function syncContext(db: Db, context: Awaited<ReturnType<typeof loadSourceContext>>) {
  const contextsByUser = new Map(context.businessContexts.map((row) => [row.user_id, row]));
  const profilesById = new Map(context.memoryProfiles.map((row) => [row.id, row]));
  let touched = 0;
  const supplierBySource = new Map<string, SupplierDirectoryRow>();

  for (const sourceSupplier of context.suppliers) {
    const identity = await identityForOperationsUser(db, sourceSupplier.user_id, contextsByUser.get(sourceSupplier.user_id));
    const coverage = asArray(sourceSupplier.category_coverage);
    const supplier = await ensureSupplier(db, identity, {
      supplierName: sourceSupplier.supplier_name,
      category: coverage[0] ?? "Other",
      status: sourceSupplier.active ? "active" : "inactive",
      notes: `${sourceSupplier.reliability_score ?? 0}% reliability. Average lead time ${sourceSupplier.average_lead_time_days ?? 0} days.`,
      pricingNotes: sourceSupplier.payment_terms ? `Payment terms: ${sourceSupplier.payment_terms}` : null,
      sourceTable: "opcopilot_suppliers",
      sourceId: sourceSupplier.id,
      metadata: {
        categoryCoverage: coverage,
        minimumOrderCents: sourceSupplier.minimum_order_cents,
        deliveryFeeCents: sourceSupplier.delivery_fee_cents,
      },
    }) as SupplierDirectoryRow | null;
    if (supplier) {
      supplierBySource.set(sourceSupplier.id, supplier);
      await syncSupplierToBusinessMemory(db, supplier);
      touched += 1;
    }
  }

  for (const row of context.savings) {
    const identity = await identityForOperationsUser(db, row.user_id, contextsByUser.get(row.user_id));
    const category = categoryName(row.category);
    const categoryRow = await ensureCategory(db, identity, category, { table: "opcopilot_savings_recommendations", id: row.id });
    const relatedSupplier = row.related_supplier_id ? supplierBySource.get(row.related_supplier_id) : null;
    const monthly = numberValue(row.projected_monthly_savings_cents, 0);
    const annual = numberValue(row.projected_annual_savings_cents, monthly * 12);
    await ensureOpportunity(db, identity, {
      title: firstNonEmpty(row.title, "Supplier savings opportunity needs review") ?? "Supplier savings opportunity needs review",
      category,
      opportunityType: opportunityTypeFromSavings(row),
      reason: firstNonEmpty(row.summary, "Supplier pricing, delivery, or recurring purchase patterns may be creating avoidable operating cost.") ?? "Supplier cost review needed.",
      recommendedAction: "Review the savings basis, confirm assumptions, and approve any vendor or spend action before execution.",
      monthlySavingsCents: monthly,
      annualSavingsCents: annual,
      confidence: confidenceScore(row.confidence, 66),
      status: statusFromSource(row.status),
      supplierId: relatedSupplier?.id ?? null,
      categoryId: categoryRow?.id ?? null,
      sourceTable: "opcopilot_savings_recommendations",
      sourceId: row.id,
      metadata: { supplierName: relatedSupplier?.supplier_name ?? null, difficulty: row.difficulty, operationalImpact: row.operational_impact },
    });
    touched += 1;
  }

  for (const row of context.alerts) {
    const identity = await identityForOperationsUser(db, row.user_id, contextsByUser.get(row.user_id));
    const category = categoryName(row.alert_type);
    const impact = numberValue(row.estimated_impact_cents, 0);
    const categoryRow = await ensureCategory(db, identity, category, { table: "opcopilot_operational_alerts", id: row.id });
    await ensureOpportunity(db, identity, {
      title: firstNonEmpty(row.title, "Cost risk needs review") ?? "Cost risk needs review",
      category,
      opportunityType: opportunityTypeFromAlert(row),
      reason: firstNonEmpty(row.detail, "A purchasing, invoice, delivery, or vendor issue may be affecting margin.") ?? "Cost risk review needed.",
      recommendedAction: firstNonEmpty(row.recommended_action, "Review the issue and assign a human owner before any spend action.") ?? "Review the cost risk.",
      monthlySavingsCents: impact,
      annualSavingsCents: impact * 12,
      confidence: row.severity === "high" ? 74 : row.severity === "low" ? 48 : 62,
      status: statusFromSource(row.status),
      categoryId: categoryRow?.id ?? null,
      sourceTable: "opcopilot_operational_alerts",
      sourceId: row.id,
      metadata: { alertType: row.alert_type, severity: row.severity },
    });
    touched += 1;
  }

  for (const memorySupplier of context.memorySuppliers) {
    const profile = profilesById.get(memorySupplier.profile_id);
    if (!profile) continue;
    const identity: ClientIdentity = {
      clientId: profile.client_id ?? null,
      clientEmail: profile.client_email ?? null,
      businessMemoryProfileId: profile.id,
      businessName: profile.business_name ?? null,
    };
    const supplier = await ensureSupplier(db, identity, {
      supplierName: memorySupplier.supplier_name,
      category: memorySupplier.category,
      status: "active",
      notes: memorySupplier.vendor_notes,
      pricingNotes: Array.isArray(memorySupplier.pricing_history) ? JSON.stringify(memorySupplier.pricing_history.slice(-1)[0] ?? {}) : null,
      sourceTable: "business_memory_suppliers",
      sourceId: memorySupplier.id,
      metadata: { fromBusinessMemory: true },
    }) as SupplierDirectoryRow | null;
    if (supplier) {
      await syncSupplierToBusinessMemory(db, supplier);
      touched += 1;
    }
  }

  for (const memorySaving of context.memorySavings) {
    if (memorySaving.source_table === "cost_control_opportunities") continue;
    const profile = profilesById.get(memorySaving.profile_id);
    if (!profile) continue;
    const identity: ClientIdentity = {
      clientId: profile.client_id ?? null,
      clientEmail: profile.client_email ?? null,
      businessMemoryProfileId: profile.id,
      businessName: profile.business_name ?? null,
    };
    const category = categoryName(memorySaving.category);
    const categoryRow = await ensureCategory(db, identity, category, { table: "business_memory_savings", id: memorySaving.id });
    const annual = numberValue(memorySaving.estimated_savings_cents, 0);
    await ensureOpportunity(db, identity, {
      title: firstNonEmpty(memorySaving.opportunity_name, "Savings opportunity from Business Memory") ?? "Savings opportunity from Business Memory",
      category,
      opportunityType: "category_review",
      reason: "Business Memory contains a savings signal that should be reviewed in the Cost Control Center.",
      recommendedAction: "Review remembered savings context and decide whether to approve, reject, or update actual savings.",
      monthlySavingsCents: Math.round(annual / 12),
      annualSavingsCents: annual,
      actualSavingsCents: numberValue(memorySaving.actual_savings_cents),
      confidence: memorySaving.accepted ? 72 : 58,
      status: statusFromSource(memorySaving.status),
      categoryId: categoryRow?.id ?? null,
      sourceTable: "business_memory_savings",
      sourceId: memorySaving.id,
      metadata: { fromBusinessMemory: true },
    });
    touched += 1;
  }

  await refreshCostControlScoresAndReports(db);
  return { recordsTouched: touched };
}

async function refreshCostControlScoresAndReports(db: Db) {
  const opportunities = (await safeRows(
    "Cost Control opportunities",
    db.from("cost_control_opportunities").select("*").order("priority_score", { ascending: false }).limit(1000),
  )) as CostControlOpportunityRow[];
  const suppliers = (await safeRows("Cost Control suppliers", db.from("supplier_directory").select("*").limit(1000))) as SupplierDirectoryRow[];
  const categories = await safeRows("Cost Control categories", db.from("supplier_categories").select("*").limit(1000));
  const reviews = await safeRows("Supplier reviews", db.from("supplier_reviews").select("*").limit(1000));

  const clientKeys = new Set([
    ...opportunities.map(clientKeyFromRow),
    ...suppliers.map(clientKeyFromRow),
    ...categories.map(clientKeyFromRow),
  ].filter(Boolean));

  for (const key of clientKeys) {
    const clientOpportunities = opportunities.filter((row) => clientKeyFromRow(row) === key);
    const clientSuppliers = suppliers.filter((row) => clientKeyFromRow(row) === key);
    const clientCategories = categories.filter((row) => clientKeyFromRow(row) === key);
    const clientReviews = reviews.filter((row) => clientKeyFromRow(row) === key);
    const topOpportunity = clientOpportunities[0] ?? null;
    const identity = identityFromRows([...clientOpportunities, ...clientSuppliers, ...clientCategories]);
    if (!identity) continue;
    if (isCostControlScoreEnabled()) await upsertCostControlScore(db, identity, {
      opportunities: clientOpportunities,
      suppliers: clientSuppliers,
      categories: clientCategories,
      reviews: clientReviews,
      topOpportunity,
    });
    if (isCostControlReportingEnabled()) await upsertCostControlReport(db, identity, clientOpportunities);
  }
}

function clientKeyFromRow(row: any) {
  return row?.client_id || normalizeEmail(row?.client_email) || row?.business_memory_profile_id || "";
}

function identityFromRows(rows: any[]): ClientIdentity | null {
  const row = rows.find(Boolean);
  if (!row) return null;
  return {
    clientId: row.client_id ?? null,
    clientEmail: row.client_email ?? null,
    businessMemoryProfileId: row.business_memory_profile_id ?? null,
    businessName: null,
  };
}

async function upsertCostControlScore(
  db: Db,
  identity: ClientIdentity,
  data: {
    opportunities: CostControlOpportunityRow[];
    suppliers: SupplierDirectoryRow[];
    categories: any[];
    reviews: any[];
    topOpportunity: CostControlOpportunityRow | null;
  },
) {
  const reviewed = data.opportunities.filter((row) => !["new_opportunity", "dismissed"].includes(row.status)).length;
  const implemented = data.opportunities.filter((row) => ["implemented", "completed"].includes(row.status)).length;
  const completedReviews = data.reviews.filter((row) => row.status === "completed").length;
  const categoriesScore = clampScore(data.categories.length * 16 + data.suppliers.length * 5);
  const reviewedScore = data.opportunities.length > 0 ? clampScore((reviewed / data.opportunities.length) * 100) : 20;
  const implementedScore = data.opportunities.length > 0 ? clampScore((implemented / data.opportunities.length) * 100) : 10;
  const reviewScore = data.reviews.length > 0 ? clampScore((completedReviews / data.reviews.length) * 100) : data.suppliers.length > 0 ? 45 : 10;
  const completenessScore = clampScore((data.suppliers.length ? 35 : 0) + (data.categories.length ? 25 : 0) + (data.opportunities.length ? 30 : 0) + (data.reviews.length ? 10 : 0));
  const score = clampScore(
    categoriesScore * 0.2 +
      reviewedScore * 0.25 +
      implementedScore * 0.2 +
      reviewScore * 0.15 +
      completenessScore * 0.2,
  );
  const status = score >= 76 ? "healthy" : score >= 50 ? "needs_review" : "needs_data";
  await upsertByLookup(db, "cost_control_scores", clientLookup(identity), {
    client_id: identity.clientId,
    client_email: identity.clientEmail ? normalizeEmail(identity.clientEmail) : null,
    business_memory_profile_id: identity.businessMemoryProfileId,
    score,
    color: score >= 76 ? "green" : score >= 50 ? "yellow" : "red",
    categories_monitored_score: categoriesScore,
    opportunities_reviewed_score: reviewedScore,
    opportunities_implemented_score: implementedScore,
    supplier_reviews_score: reviewScore,
    data_completeness_score: completenessScore,
    current_status: status,
    recommended_action: data.topOpportunity?.recommended_action ?? "Add supplier and savings data so HomeReach can find clearer cost opportunities.",
    next_opportunity_id: data.topOpportunity?.id ?? null,
    calculated_at: new Date().toISOString(),
    metadata: {
      opportunityCount: data.opportunities.length,
      supplierCount: data.suppliers.length,
      categoryCount: data.categories.length,
      reviewCount: data.reviews.length,
    },
  });
}

async function upsertCostControlReport(db: Db, identity: ClientIdentity, opportunities: CostControlOpportunityRow[]) {
  const estimated = opportunities.reduce((sum, row) => sum + numberValue(row.estimated_annual_savings_cents), 0);
  const actual = opportunities.reduce((sum, row) => sum + numberValue(row.actual_savings_cents), 0);
  const topCategories = topCategoryRows(opportunities);
  const topOpportunities = opportunities.slice(0, 5).map((row) => ({
    id: row.id,
    title: row.title,
    status: row.status,
    estimatedAnnualSavingsCents: row.estimated_annual_savings_cents,
  }));
  const implemented = opportunities.filter((row) => ["implemented", "completed"].includes(row.status)).slice(0, 5);
  const rejected = opportunities.filter((row) => ["rejected", "dismissed"].includes(row.status)).slice(0, 5);
  await upsertByLookup(
    db,
    "cost_control_reports",
    {
      ...clientLookup(identity),
      reporting_period_start: startOfMonthIso(),
      reporting_period_end: endOfMonthIso(),
    },
    {
      client_id: identity.clientId,
      client_email: identity.clientEmail ? normalizeEmail(identity.clientEmail) : null,
      business_memory_profile_id: identity.businessMemoryProfileId,
      estimated_savings_cents: estimated,
      actual_savings_cents: actual,
      top_categories: topCategories,
      top_opportunities: topOpportunities,
      implemented_opportunities: implemented.map((row) => ({ id: row.id, title: row.title, actualSavingsCents: row.actual_savings_cents })),
      rejected_opportunities: rejected.map((row) => ({ id: row.id, title: row.title, status: row.status })),
      recommendations: opportunities[0]?.recommended_action ?? "Keep reviewing supplier costs monthly and approve only the items with clear savings basis.",
      metadata: { generatedBy: "cost_control_engine" },
    },
  );
}

function topCategoryRows(opportunities: CostControlOpportunityRow[]) {
  const map = new Map<string, number>();
  for (const row of opportunities) map.set(row.category, (map.get(row.category) ?? 0) + numberValue(row.estimated_annual_savings_cents));
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([category, estimatedAnnualSavingsCents]) => ({ category, estimatedAnnualSavingsCents }));
}

async function loadCostControlData(db: Db, input: { clientId?: string | null; clientEmail?: string | null; adminMode?: boolean }): Promise<CostControlAdminData> {
  const normalizedEmail = normalizeEmail(input.clientEmail);
  const adminMode = Boolean(input.adminMode);
  const opportunityQuery = adminMode
    ? db.from("cost_control_opportunities").select("*").order("priority_score", { ascending: false }).limit(300)
    : input.clientId
      ? db.from("cost_control_opportunities").select("*").eq("client_id", input.clientId).order("priority_score", { ascending: false }).limit(100)
      : db.from("cost_control_opportunities").select("*").ilike("client_email", normalizedEmail).order("priority_score", { ascending: false }).limit(100);
  const supplierQuery = adminMode
    ? db.from("supplier_directory").select("*").order("updated_at", { ascending: false }).limit(300)
    : input.clientId
      ? db.from("supplier_directory").select("*").eq("client_id", input.clientId).order("updated_at", { ascending: false }).limit(100)
      : db.from("supplier_directory").select("*").ilike("client_email", normalizedEmail).order("updated_at", { ascending: false }).limit(100);
  const scoreQuery = adminMode
    ? db.from("cost_control_scores").select("*").order("score", { ascending: true }).limit(1).maybeSingle()
    : input.clientId
      ? db.from("cost_control_scores").select("*").eq("client_id", input.clientId).maybeSingle()
      : db.from("cost_control_scores").select("*").ilike("client_email", normalizedEmail).maybeSingle();
  const reportQuery = adminMode
    ? db.from("cost_control_reports").select("*").order("reporting_period_end", { ascending: false }).limit(1).maybeSingle()
    : input.clientId
      ? db.from("cost_control_reports").select("*").eq("client_id", input.clientId).order("reporting_period_end", { ascending: false }).limit(1).maybeSingle()
      : db.from("cost_control_reports").select("*").ilike("client_email", normalizedEmail).order("reporting_period_end", { ascending: false }).limit(1).maybeSingle();

  const [opportunities, suppliers, score, report] = await Promise.all([
    safeRows("Cost Control opportunities", opportunityQuery),
    safeRows("Supplier directory", supplierQuery),
    safeSingle("Cost Control score", scoreQuery),
    safeSingle("Cost Control report", reportQuery),
  ]);
  const opportunityIds = opportunities.map((row) => row.id).filter(Boolean);
  const supplierIds = suppliers.map((row) => row.id).filter(Boolean);
  const [drafts, reviews, savings] = await Promise.all([
    opportunityIds.length
      ? safeRows("Cost Control drafts", db.from("cost_control_drafts").select("*").in("opportunity_id", opportunityIds).order("created_at", { ascending: true }).limit(1000))
      : Promise.resolve([]),
    adminMode || supplierIds.length
      ? safeRows("Supplier reviews", adminMode ? db.from("supplier_reviews").select("*").order("review_date", { ascending: false }).limit(300) : db.from("supplier_reviews").select("*").in("supplier_id", supplierIds).limit(300))
      : Promise.resolve([]),
    opportunityIds.length
      ? safeRows("Savings tracker", db.from("savings_tracker").select("*").in("opportunity_id", opportunityIds).limit(300))
      : Promise.resolve([]),
  ]);
  const draftsByOpportunity = (drafts as CostControlDraftRow[]).reduce<Record<string, CostControlDraftRow[]>>((acc, draft) => {
    acc[draft.opportunity_id] = [...(acc[draft.opportunity_id] ?? []), draft];
    return acc;
  }, {});
  const metrics = calculateMetrics(opportunities as CostControlOpportunityRow[], suppliers as SupplierDirectoryRow[], reviews);
  return {
    enabled: true,
    safeMode: false,
    opportunities: opportunities as CostControlOpportunityRow[],
    suppliers: suppliers as SupplierDirectoryRow[],
    draftsByOpportunity,
    score: score as CostControlScoreRow | null,
    report: report as CostControlReportRow | null,
    reviews,
    savings,
    metrics,
  };
}

function calculateMetrics(opportunities: CostControlOpportunityRow[], suppliers: SupplierDirectoryRow[], reviews: any[]): CostControlMetrics {
  const open = opportunities.filter((row) => OPEN_STATUSES.has(row.status));
  const accepted = opportunities.filter((row) => ["approved", "implemented", "completed"].includes(row.status));
  return {
    potentialSavingsCents: open.reduce((sum, row) => sum + numberValue(row.estimated_savings_cents), 0),
    acceptedSavingsCents: accepted.reduce((sum, row) => sum + Math.max(numberValue(row.actual_savings_cents), numberValue(row.estimated_savings_cents)), 0),
    estimatedAnnualSavingsCents: open.reduce((sum, row) => sum + numberValue(row.estimated_annual_savings_cents), 0),
    openOpportunities: open.length,
    supplierCategoriesTracked: new Set(suppliers.map((row) => row.category).filter(Boolean)).size,
    pendingReviews: reviews.filter((row) => ["pending", "in_progress"].includes(String(row.status))).length,
    implementedOpportunities: opportunities.filter((row) => ["implemented", "completed"].includes(row.status)).length,
    rejectedOpportunities: opportunities.filter((row) => ["rejected", "dismissed"].includes(row.status)).length,
  };
}

export async function ensureCostControlForClient({
  supabase,
  clientId,
  clientEmail,
}: {
  supabase: ServiceClient;
  clientId?: string | null;
  clientEmail?: string | null;
}) {
  if (!isCostControlEnabled() || !hasCostControlPersistence()) return { recordsTouched: 0 };
  try {
    const db = asDb(supabase);
    const context = await loadSourceContext({ db, clientId, clientEmail });
    return await syncContext(db, context);
  } catch (error) {
    if (isMissingCostControlSchema(error)) return { recordsTouched: 0 };
    throw error;
  }
}

export async function ensureCostControlForAll({
  supabase,
  limit = 300,
}: {
  supabase: ServiceClient;
  limit?: number;
}) {
  if (!isCostControlEnabled() || !hasCostControlPersistence()) return { recordsTouched: 0 };
  try {
    const db = asDb(supabase);
    const context = await loadSourceContext({ db, adminMode: true, limit });
    return await syncContext(db, context);
  } catch (error) {
    if (isMissingCostControlSchema(error)) return { recordsTouched: 0 };
    throw error;
  }
}

export async function loadClientCostControlCenter({
  supabase,
  user,
  autoSync = true,
}: {
  supabase: ServiceClient;
  user: Pick<User, "id"> & { email?: string | null };
  autoSync?: boolean;
}): Promise<CostControlCenterData> {
  if (!isCostControlEnabled()) return { enabled: false, safeMode: false, opportunities: [], suppliers: [], draftsByOpportunity: {}, score: null, report: null, metrics: emptyMetrics() };
  if (!hasCostControlPersistence()) return { enabled: true, safeMode: true, opportunities: [], suppliers: [], draftsByOpportunity: {}, score: null, report: null, metrics: emptyMetrics(), message: "Cost Control persistence is not configured." };
  try {
    const db = asDb(supabase);
    if (autoSync) await ensureCostControlForClient({ supabase, clientId: user.id, clientEmail: user.email });
    return loadCostControlData(db, { clientId: user.id, clientEmail: user.email });
  } catch (error) {
    return { enabled: true, safeMode: true, opportunities: [], suppliers: [], draftsByOpportunity: {}, score: null, report: null, metrics: emptyMetrics(), message: error instanceof Error ? error.message : "Cost Control is in safe mode." };
  }
}

export async function loadAdminCostControlQueue({
  supabase,
  autoSync = true,
}: {
  supabase: ServiceClient;
  autoSync?: boolean;
}): Promise<CostControlAdminData> {
  if (!isCostControlEnabled() || !isSupplierDirectoryEnabled()) return { enabled: false, safeMode: false, opportunities: [], suppliers: [], draftsByOpportunity: {}, score: null, report: null, reviews: [], savings: [], metrics: emptyMetrics() };
  if (!hasCostControlPersistence()) return { enabled: true, safeMode: true, opportunities: [], suppliers: [], draftsByOpportunity: {}, score: null, report: null, reviews: [], savings: [], metrics: emptyMetrics(), message: "Cost Control persistence is not configured." };
  try {
    const db = asDb(supabase);
    if (autoSync) await ensureCostControlForAll({ supabase });
    return loadCostControlData(db, { adminMode: true });
  } catch (error) {
    return { enabled: true, safeMode: true, opportunities: [], suppliers: [], draftsByOpportunity: {}, score: null, report: null, reviews: [], savings: [], metrics: emptyMetrics(), message: error instanceof Error ? error.message : "Cost Control queue is in safe mode." };
  }
}

export async function loadSupplierProfile({
  supabase,
  supplierId,
}: {
  supabase: ServiceClient;
  supplierId: string;
}) {
  const db = asDb(supabase);
  const supplier = (await safeSingle("Supplier profile", db.from("supplier_directory").select("*").eq("id", supplierId).maybeSingle())) as SupplierDirectoryRow | null;
  if (!supplier) return null;
  const [opportunities, reviews, savings] = await Promise.all([
    safeRows("Supplier opportunities", db.from("cost_control_opportunities").select("*").eq("supplier_id", supplierId).order("priority_score", { ascending: false }).limit(100)),
    safeRows("Supplier reviews", db.from("supplier_reviews").select("*").eq("supplier_id", supplierId).order("review_date", { ascending: false }).limit(100)),
    safeRows("Supplier savings", db.from("savings_tracker").select("*").eq("supplier_id", supplierId).order("updated_at", { ascending: false }).limit(100)),
  ]);
  return { supplier, opportunities: opportunities as CostControlOpportunityRow[], reviews, savings };
}

export async function recordCostControlAction({
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
  const opportunity = (await safeSingle("Cost Control opportunity", db.from("cost_control_opportunities").select("*").eq("id", opportunityId).maybeSingle())) as CostControlOpportunityRow | null;
  if (!opportunity) throw new Error("Cost Control opportunity not found.");
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
      noSpendCommitment: true,
    },
  };
  if (nextStatus === "approved") update.approved_at = now;
  if (nextStatus === "implemented") update.implemented_at = now;
  if (nextStatus === "completed") update.completed_at = now;
  const { data, error } = await db.from("cost_control_opportunities").update(update).eq("id", opportunityId).select("*").single();
  if (error) throw new Error(`Cost Control action failed: ${error.message}`);
  if (draftId && actionType === "copy_draft") {
    const draft = await safeSingle("Cost Control draft", db.from("cost_control_drafts").select("copy_count").eq("id", draftId).maybeSingle());
    await db.from("cost_control_drafts").update({ copy_count: numberValue(draft?.copy_count) + 1, last_copied_at: now }).eq("id", draftId);
  }
  const identity: ClientIdentity = {
    clientId: data.client_id,
    clientEmail: data.client_email,
    businessMemoryProfileId: data.business_memory_profile_id,
    businessName: null,
  };
  if (isSavingsTrackerEnabled()) await ensureSavingsTracker(db, identity, data as CostControlOpportunityRow);
  await syncOpportunityToBusinessMemory(db, identity, data as CostControlOpportunityRow);
  await refreshCostControlScoresAndReports(db);
  return { status: nextStatus };
}

function nextStatusForAction(actionType: string, current: CostControlStatus): CostControlStatus {
  if (actionType === "review") return "under_review";
  if (actionType === "assign") return current === "new_opportunity" ? "under_review" : current;
  if (actionType === "approve") return "approved";
  if (actionType === "implement") return "implemented";
  if (actionType === "complete") return "completed";
  if (actionType === "reject") return "rejected";
  if (actionType === "dismiss") return "dismissed";
  return current;
}

function emptyMetrics(): CostControlMetrics {
  return {
    potentialSavingsCents: 0,
    acceptedSavingsCents: 0,
    estimatedAnnualSavingsCents: 0,
    openOpportunities: 0,
    supplierCategoriesTracked: 0,
    pendingReviews: 0,
    implementedOpportunities: 0,
    rejectedOpportunities: 0,
  };
}
