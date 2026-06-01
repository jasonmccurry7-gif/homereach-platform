import type { User } from "@supabase/supabase-js";
import type { createServiceClient } from "@/lib/supabase/service";
import {
  hasReputationPersistence,
  isReferralCampaignsEnabled,
  isReputationEngineEnabled,
  isReputationReportingEnabled,
  isReputationScoreEnabled,
  isReviewCampaignsEnabled,
  isTestimonialLibraryEnabled,
} from "./config";

type ServiceClient = ReturnType<typeof createServiceClient>;
type Db = ReturnType<typeof createServiceClient> & {
  from(table: string): any;
};

type JsonRecord = Record<string, unknown>;

export type ReputationStatus =
  | "new_opportunity"
  | "under_review"
  | "assigned"
  | "approved"
  | "launched"
  | "in_progress"
  | "dismissed"
  | "completed"
  | "archived";

export type ReputationOpportunityRow = {
  id: string;
  client_id: string | null;
  client_email: string | null;
  business_memory_profile_id: string | null;
  opportunity_group: "review" | "referral" | "testimonial" | "follow_up";
  opportunity_type: string;
  title: string;
  reason: string;
  recommended_action: string;
  estimated_impact_label: string | null;
  potential_value_cents: number;
  priority_score: number;
  confidence_score: number;
  status: ReputationStatus;
  owner: string | null;
  next_action: string | null;
  notes: string | null;
  due_at: string | null;
  launched_at: string | null;
  completed_at: string | null;
  source_table: string | null;
  source_id: string | null;
  metadata: JsonRecord | null;
  created_at: string;
  updated_at: string;
};

export type ReputationDraftRow = {
  id: string;
  opportunity_id: string;
  draft_type: string;
  label: string;
  content: string;
  approval_status: string;
  copy_count: number;
};

export type TestimonialRow = {
  id: string;
  customer_name: string | null;
  business_name: string | null;
  testimonial_text: string | null;
  campaign_source: string | null;
  status: string;
  approved: boolean;
  updated_at: string;
};

export type ReputationScoreRow = {
  id: string;
  score: number;
  color: "green" | "yellow" | "red";
  review_activity_score: number;
  referral_activity_score: number;
  testimonial_activity_score: number;
  follow_up_activity_score: number;
  campaign_activity_score: number;
  current_status: string;
  recommended_action: string;
  top_opportunity_id: string | null;
  calculated_at: string;
};

export type ReputationReportRow = {
  id: string;
  reporting_period_start: string;
  reporting_period_end: string;
  review_opportunities: number;
  review_requests_sent: number;
  referral_opportunities: number;
  referral_requests_sent: number;
  testimonials_captured: number;
  campaign_activity: JsonRecord | null;
  recommendations: string | null;
};

export type ReputationMetrics = {
  reviewOpportunities: number;
  referralOpportunities: number;
  testimonialsCollected: number;
  reviewRequestsSent: number;
  referralRequestsSent: number;
  reviewCampaignsActive: number;
  referralCampaignsActive: number;
  openOpportunities: number;
  recentWins: number;
  potentialReferralValueCents: number;
};

export type ReputationCenterData = {
  enabled: boolean;
  safeMode: boolean;
  message?: string;
  opportunities: ReputationOpportunityRow[];
  draftsByOpportunity: Record<string, ReputationDraftRow[]>;
  reviewCampaigns: any[];
  referralCampaigns: any[];
  testimonials: TestimonialRow[];
  reviewRequests: any[];
  referralRequests: any[];
  score: ReputationScoreRow | null;
  report: ReputationReportRow | null;
  metrics: ReputationMetrics;
};

type ClientIdentity = {
  clientId: string | null;
  clientEmail: string | null;
  businessMemoryProfileId: string | null;
  businessName: string | null;
  contactName: string | null;
};

const OPEN_STATUSES = new Set<ReputationStatus>(["new_opportunity", "under_review", "assigned", "approved", "launched", "in_progress"]);
const TABLES_WITHOUT_UPDATED_AT = new Set(["business_memory_timeline", "reputation_drafts"]);

function asDb(supabase: ServiceClient): Db {
  return supabase as Db;
}

function normalizeEmail(email: string | null | undefined) {
  return String(email ?? "").trim().toLowerCase();
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function firstNonEmpty(...values: unknown[]) {
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

function isMissingReputationSchema(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /reputation_|review_campaigns|referral_campaigns|testimonial_library|schema cache|does not exist|relation/i.test(message);
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

function clientLookup(identity: ClientIdentity) {
  return identity.clientId
    ? { client_id: identity.clientId }
    : { client_email: normalizeEmail(identity.clientEmail) };
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
    businessName: row.business_name ?? null,
    contactName: row.contact_name ?? null,
  };
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

async function identityFromLeadCampaign(db: Db, lead: any, campaign?: any): Promise<ClientIdentity> {
  const base = {
    clientId: campaign?.client_id ?? lead?.client_id ?? null,
    clientEmail: lead?.email ?? null,
    businessName: firstNonEmpty(lead?.business_name, campaign?.campaign_name),
    contactName: firstNonEmpty(lead?.contact_name),
  };
  const profile = await profileForIdentity(db, base);
  return {
    ...base,
    businessMemoryProfileId: profile?.id ?? null,
    businessName: firstNonEmpty(profile?.business_name, base.businessName),
  };
}

function identityFromProfile(profile: any): ClientIdentity {
  return {
    clientId: profile?.client_id ?? null,
    clientEmail: profile?.client_email ?? null,
    businessMemoryProfileId: profile?.id ?? null,
    businessName: profile?.business_name ?? null,
    contactName: null,
  };
}

function campaignIsLive(campaign: any) {
  return ["live", "reporting", "renewal_opportunity", "closed"].includes(String(campaign?.campaign_status)) ||
    ["live", "manual_launch_complete"].includes(String(campaign?.launch_status));
}

function campaignHasResults(reports: any[]) {
  return reports.some((report) =>
    numberValue(report.leads) > 0 ||
    numberValue(report.calls) > 0 ||
    numberValue(report.qr_scans) > 0 ||
    numberValue(report.landing_page_visits) > 0,
  );
}

function targetArea(lead: any, campaign: any) {
  return firstNonEmpty(campaign?.target_geography, lead?.target_area, "the target area") ?? "the target area";
}

function monthlyManagementValue(lead: any, campaign: any) {
  return numberValue(campaign?.monthly_management_fee, numberValue(lead?.monthly_management_fee, 49900));
}

function opportunityPriority(input: { potentialValueCents: number; confidence: number; urgency: number; status?: ReputationStatus }) {
  const valueScore = input.potentialValueCents >= 100000 ? 76 : input.potentialValueCents > 0 ? 62 : 48;
  const statusLift = input.status && OPEN_STATUSES.has(input.status) ? 8 : 0;
  return clampScore(valueScore * 0.3 + input.confidence * 0.35 + input.urgency * 0.35 + statusLift);
}

async function ensureOpportunity(
  db: Db,
  identity: ClientIdentity,
  input: {
    opportunityGroup: ReputationOpportunityRow["opportunity_group"];
    opportunityType: string;
    title: string;
    reason: string;
    recommendedAction: string;
    estimatedImpactLabel: string;
    potentialValueCents?: number;
    confidence: number;
    urgency: number;
    sourceTable: string;
    sourceId: string;
    metadata?: JsonRecord;
  },
) {
  const status: ReputationStatus = "new_opportunity";
  const opportunity = await upsertByLookup(
    db,
    "reputation_opportunities",
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
      opportunity_group: input.opportunityGroup,
      title: input.title,
      reason: input.reason,
      recommended_action: input.recommendedAction,
      estimated_impact_label: input.estimatedImpactLabel,
      potential_value_cents: input.potentialValueCents ?? 0,
      confidence_score: clampScore(input.confidence),
      priority_score: opportunityPriority({ potentialValueCents: input.potentialValueCents ?? 0, confidence: input.confidence, urgency: input.urgency, status }),
      status,
      owner: "Reputation",
      next_action: input.recommendedAction,
      due_at: addDaysIso(input.urgency >= 75 ? 2 : 7),
      metadata: {
        ...(input.metadata ?? {}),
        phase: "5_reputation_engine_mvp",
        noFakeReviews: true,
        noReviewGating: true,
        noOutboundWithoutApproval: true,
      },
    },
  );

  await ensureDrafts(db, opportunity as ReputationOpportunityRow, identity);
  await ensureCampaignScaffold(db, opportunity as ReputationOpportunityRow);
  await syncOpportunityToBusinessMemory(db, identity, opportunity as ReputationOpportunityRow);
  return opportunity as ReputationOpportunityRow;
}

async function ensureCampaignScaffold(db: Db, opportunity: ReputationOpportunityRow) {
  if (opportunity.opportunity_group === "review" && isReviewCampaignsEnabled()) {
    await upsertByLookup(
      db,
      "review_campaigns",
      { opportunity_id: opportunity.id, campaign_type: reviewCampaignType(opportunity.opportunity_type) },
      {
        client_id: opportunity.client_id,
        client_email: opportunity.client_email,
        business_memory_profile_id: opportunity.business_memory_profile_id,
        campaign_name: opportunity.title,
        status: opportunity.status === "launched" ? "active" : opportunity.status === "completed" ? "completed" : "draft",
        owner: opportunity.owner ?? "Reputation",
        notes: opportunity.reason,
        tracking: { approvalRequired: true, noAutoSend: true },
        draft_summary: opportunity.recommended_action,
        source_table: "reputation_opportunities",
        source_id: opportunity.id,
        metadata: { noReviewGating: true },
      },
    );
  }

  if (opportunity.opportunity_group === "referral" && isReferralCampaignsEnabled()) {
    await upsertByLookup(
      db,
      "referral_campaigns",
      { opportunity_id: opportunity.id, campaign_type: referralCampaignType(opportunity.opportunity_type) },
      {
        client_id: opportunity.client_id,
        client_email: opportunity.client_email,
        business_memory_profile_id: opportunity.business_memory_profile_id,
        campaign_name: opportunity.title,
        status: opportunity.status === "launched" ? "active" : opportunity.status === "completed" ? "completed" : "draft",
        owner: opportunity.owner ?? "Reputation",
        notes: opportunity.reason,
        tracking: { approvalRequired: true, noAutoSend: true },
        draft_summary: opportunity.recommended_action,
        source_table: "reputation_opportunities",
        source_id: opportunity.id,
        metadata: { noOutboundWithoutApproval: true },
      },
    );
  }
}

function reviewCampaignType(opportunityType: string) {
  if (opportunityType === "review_reminder") return "review_reminder";
  if (opportunityType === "review_recovery") return "review_recovery";
  if (opportunityType === "client_appreciation_campaign") return "review_appreciation";
  return "review_request";
}

function referralCampaignType(opportunityType: string) {
  if (opportunityType === "past_customer_reengagement") return "referral_reactivation";
  if (opportunityType === "neighbor_referral_campaign") return "neighbor_referral";
  if (opportunityType === "client_appreciation_campaign") return "referral_appreciation";
  return "referral_request";
}

function draftsForOpportunity(row: ReputationOpportunityRow, identity: ClientIdentity) {
  const business = identity.businessName ?? "your business";
  const contact = identity.contactName ?? "there";
  const guardrail = "Use only after human approval. Do not offer incentives for reviews, do not filter by expected sentiment, and do not invent customer feedback.";
  const reviewLink = "[insert approved review link]";
  const referralLink = "[insert approved referral or contact link]";

  return [
    {
      draft_type: "review_request_email",
      label: "Review Request Email",
      content: `Subject: Quick favor after working with ${business}\n\nHi ${contact},\n\nThank you again for choosing ${business}. If the experience was helpful, would you be willing to leave an honest review here?\n\n${reviewLink}\n\nYour feedback helps local customers know what to expect. There is no pressure, and honest feedback is always welcome.\n\n${guardrail}\n\nBest,\n${business}`,
    },
    {
      draft_type: "review_request_sms",
      label: "Review Request SMS",
      content: `Hi ${contact}, thanks again for choosing ${business}. If you are open to it, an honest review here would help local customers know what to expect: ${reviewLink}. ${guardrail} Reply STOP to opt out.`,
    },
    {
      draft_type: "review_request_dm",
      label: "Review Request DM",
      content: `Quick thank you from ${business}. If the work was helpful, an honest review would help other local customers understand what to expect: ${reviewLink}. ${guardrail}`,
    },
    {
      draft_type: "referral_request_email",
      label: "Referral Request Email",
      content: `Subject: Know someone nearby who may need help?\n\nHi ${contact},\n\nThank you again for trusting ${business}. If a neighbor, friend, or colleague needs similar help, we would be grateful for an introduction.\n\nYou can send them here: ${referralLink}\n\nNo pressure. We just want to make it easy when someone asks who you recommend.\n\n${guardrail}\n\nBest,\n${business}`,
    },
    {
      draft_type: "referral_request_sms",
      label: "Referral Request SMS",
      content: `Hi ${contact}, thank you again for working with ${business}. If someone nearby asks who you recommend, you can send them here: ${referralLink}. ${guardrail} Reply STOP to opt out.`,
    },
    {
      draft_type: "referral_request_dm",
      label: "Referral Request DM",
      content: `Thank you again for trusting ${business}. If someone nearby needs similar help, this link makes it easy to connect them with us: ${referralLink}. ${guardrail}`,
    },
    {
      draft_type: "customer_appreciation",
      label: "Customer Appreciation",
      content: `Hi ${contact}, just a quick note from ${business}: thank you for trusting us. Local businesses grow through trust, repeat customers, and kind introductions. We appreciate the opportunity to help.`,
    },
    {
      draft_type: "testimonial_request",
      label: "Testimonial Request",
      content: `Hi ${contact}, would you be comfortable sharing one or two sentences about your experience with ${business}? We will only use your words publicly after you approve the exact testimonial. ${guardrail}`,
    },
    {
      draft_type: "follow_up_message",
      label: "Follow-Up Message",
      content: `Hi ${contact}, checking in from ${business}. We wanted to make sure everything still looks good and answer any questions after the work. If anything needs attention, please let us know.`,
    },
  ];
}

async function ensureDrafts(db: Db, opportunity: ReputationOpportunityRow, identity: ClientIdentity) {
  const existing = await safeRows(
    "Reputation drafts",
    db.from("reputation_drafts").select("draft_type").eq("opportunity_id", opportunity.id).limit(20),
  );
  const existingTypes = new Set(existing.map((draft) => draft.draft_type));
  const rows = draftsForOpportunity(opportunity, identity)
    .filter((draft) => !existingTypes.has(draft.draft_type))
    .map((draft) => ({
      opportunity_id: opportunity.id,
      client_id: opportunity.client_id,
      client_email: opportunity.client_email,
      business_memory_profile_id: opportunity.business_memory_profile_id,
      ...draft,
      approval_status: "draft",
      metadata: {
        noOutboundWithoutApproval: true,
        noReviewGating: true,
        noIncentivizedReviews: true,
      },
    }));
  if (rows.length === 0) return;
  const { error } = await db.from("reputation_drafts").insert(rows);
  if (error) throw new Error(`Reputation draft creation failed: ${error.message}`);
}

async function ensureTestimonialFromMemory(db: Db, identity: ClientIdentity, row: any) {
  if (!isTestimonialLibraryEnabled() || !normalizeText(row.testimonial)) return null;
  const testimonial = await upsertByLookup(
    db,
    "testimonial_library",
    {
      ...clientLookup(identity),
      source_table: "business_memory_reputation",
      source_id: row.id,
    },
    {
      client_id: identity.clientId,
      client_email: identity.clientEmail ? normalizeEmail(identity.clientEmail) : null,
      business_memory_profile_id: identity.businessMemoryProfileId,
      customer_name: firstNonEmpty(row.metadata?.customerName, "Customer"),
      business_name: identity.businessName,
      testimonial_date: new Date().toISOString().slice(0, 10),
      campaign_source: firstNonEmpty(row.metadata?.campaignSource, "Business Memory"),
      testimonial_text: row.testimonial,
      status: "pending",
      approved: false,
      source_table: "business_memory_reputation",
      source_id: row.id,
      metadata: { requiresHumanPermission: true, source: "business_memory" },
    },
  );
  return testimonial as TestimonialRow;
}

async function syncOpportunityToBusinessMemory(db: Db, identity: ClientIdentity, opportunity: ReputationOpportunityRow) {
  if (!identity.businessMemoryProfileId) return;
  try {
    const accepted = ["approved", "launched", "in_progress", "completed"].includes(opportunity.status);
    const rejected = ["dismissed", "archived"].includes(opportunity.status);
    await upsertByLookup(
      db,
      "business_memory_reputation",
      { profile_id: identity.businessMemoryProfileId, source_table: "reputation_opportunities", source_id: opportunity.id, memory_type: opportunity.opportunity_group === "referral" ? "referral_campaign" : opportunity.opportunity_group === "testimonial" ? "testimonial" : "review_request" },
      {
        profile_id: identity.businessMemoryProfileId,
        memory_type: opportunity.opportunity_group === "referral" ? "referral_campaign" : opportunity.opportunity_group === "testimonial" ? "testimonial" : "review_request",
        reviews_requested: opportunity.opportunity_group === "review" && accepted ? 1 : 0,
        reviews_received: opportunity.status === "completed" && opportunity.opportunity_group === "review" ? 1 : 0,
        referrals_generated: opportunity.status === "completed" && opportunity.opportunity_group === "referral" ? 1 : 0,
        testimonial: null,
        client_feedback: opportunity.notes,
        metadata: { opportunityType: opportunity.opportunity_type, status: opportunity.status, source: "reputation_engine" },
      },
    );
    await upsertByLookup(
      db,
      "business_memory_opportunities",
      { profile_id: identity.businessMemoryProfileId, source_table: "reputation_opportunities", source_id: opportunity.id },
      {
        profile_id: identity.businessMemoryProfileId,
        opportunity_type: opportunity.opportunity_type,
        opportunity_reason: opportunity.reason,
        opportunity_status: opportunity.status,
        accepted,
        rejected,
        dismissed: opportunity.status === "dismissed",
        completed: opportunity.status === "completed",
        estimated_value_cents: opportunity.potential_value_cents,
        actual_value_cents: 0,
        date_created: opportunity.created_at ?? new Date().toISOString(),
        date_closed: ["completed", "dismissed", "archived"].includes(opportunity.status) ? new Date().toISOString() : null,
        metadata: { source: "reputation_engine" },
      },
    );
    await upsertByLookup(
      db,
      "business_memory_timeline",
      {
        profile_id: identity.businessMemoryProfileId,
        event_type: "reputation",
        related_table: "reputation_opportunities",
        related_id: opportunity.id,
      },
      {
        profile_id: identity.businessMemoryProfileId,
        event_type: "reputation",
        title: "Reputation opportunity remembered",
        description: opportunity.reason,
        event_date: opportunity.updated_at ?? new Date().toISOString(),
        impact_cents: opportunity.potential_value_cents,
        status: opportunity.status,
        metadata: { opportunityType: opportunity.opportunity_type, group: opportunity.opportunity_group },
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
  const leadQueries: Array<Promise<any[]>> = [];
  if (adminMode) {
    leadQueries.push(safeRows("Market Capture leads", db.from("market_capture_leads").select("*").order("updated_at", { ascending: false }).limit(limit ?? 300)));
  } else {
    if (clientId) leadQueries.push(safeRows("Market Capture leads by client", db.from("market_capture_leads").select("*").eq("client_id", clientId).order("updated_at", { ascending: false }).limit(100)));
    if (normalizedEmail) leadQueries.push(safeRows("Market Capture leads by email", db.from("market_capture_leads").select("*").ilike("email", normalizedEmail).order("updated_at", { ascending: false }).limit(100)));
  }

  const leads = mergeById((await Promise.all(leadQueries)).flat());
  const leadIds = leads.map((lead) => lead.id).filter(Boolean);
  const campaignQueries: Array<Promise<any[]>> = [];
  if (adminMode) {
    campaignQueries.push(safeRows("Market Capture campaigns", db.from("market_capture_campaigns").select("*").order("updated_at", { ascending: false }).limit(limit ?? 300)));
  } else {
    if (clientId) campaignQueries.push(safeRows("Market Capture campaigns by client", db.from("market_capture_campaigns").select("*").eq("client_id", clientId).order("updated_at", { ascending: false }).limit(100)));
    if (leadIds.length > 0) campaignQueries.push(safeRows("Market Capture campaigns by lead", db.from("market_capture_campaigns").select("*").in("market_capture_lead_id", leadIds).order("updated_at", { ascending: false }).limit(100)));
  }

  const campaigns = mergeById((await Promise.all(campaignQueries)).flat());
  const campaignIds = campaigns.map((campaign) => campaign.id).filter(Boolean);
  const profileQueries: Array<Promise<any[]>> = [];
  if (adminMode) {
    profileQueries.push(safeRows("Business memory profiles", db.from("business_memory_profiles").select("*").order("updated_at", { ascending: false }).limit(limit ?? 300)));
  } else {
    if (clientId) profileQueries.push(safeRows("Business memory profiles by client", db.from("business_memory_profiles").select("*").eq("client_id", clientId).order("updated_at", { ascending: false }).limit(20)));
    if (normalizedEmail) profileQueries.push(safeRows("Business memory profiles by email", db.from("business_memory_profiles").select("*").ilike("client_email", normalizedEmail).order("updated_at", { ascending: false }).limit(20)));
  }
  const memoryProfiles = mergeById((await Promise.all(profileQueries)).flat());
  const profileIds = memoryProfiles.map((profile) => profile.id).filter(Boolean);

  const [reports, reputationMemory] = await Promise.all([
    campaignIds.length
      ? safeRows("Market Capture reports", db.from("market_capture_reports").select("*").in("campaign_id", campaignIds).order("updated_at", { ascending: false }).limit(limit ?? 500))
      : Promise.resolve([]),
    profileIds.length
      ? safeRows("Business memory reputation", db.from("business_memory_reputation").select("*").in("profile_id", profileIds).order("updated_at", { ascending: false }).limit(limit ?? 500))
      : Promise.resolve([]),
  ]);

  return { leads, campaigns, reports, memoryProfiles, reputationMemory };
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

async function syncContext(db: Db, context: Awaited<ReturnType<typeof loadSourceContext>>) {
  const leadsById = new Map(context.leads.map((lead) => [lead.id, lead]));
  const reportsByCampaign = rowsBy(context.reports, "campaign_id");
  const profilesById = new Map(context.memoryProfiles.map((profile) => [profile.id, profile]));
  let touched = 0;

  for (const campaign of context.campaigns) {
    const lead = leadsById.get(campaign.market_capture_lead_id) ?? null;
    const identity = await identityFromLeadCampaign(db, lead, campaign);
    if (!identity.clientId && !identity.clientEmail) continue;
    const reports = reportsByCampaign.get(campaign.id) ?? [];
    const area = targetArea(lead, campaign);
    const value = monthlyManagementValue(lead, campaign);

    if (campaignIsLive(campaign) || String(campaign.campaign_status) === "reporting") {
      await ensureOpportunity(db, identity, {
        opportunityGroup: "review",
        opportunityType: "completed_job_review_request",
        title: "Recent customers are ready for a review ask",
        reason: `${identity.businessName ?? "This business"} has an active or recently completed Market Capture campaign in ${area}. Review requests can turn completed work into visible trust.`,
        recommendedAction: "Confirm the customer list and approve a review request draft. Send to customers consistently, not only to customers expected to leave positive feedback.",
        estimatedImpactLabel: "Trust and conversion-rate opportunity",
        potentialValueCents: value,
        confidence: 72,
        urgency: 70,
        sourceTable: "market_capture_campaigns",
        sourceId: campaign.id,
        metadata: { targetArea: area, campaignStatus: campaign.campaign_status },
      });
      touched += 1;

      await ensureOpportunity(db, identity, {
        opportunityGroup: "referral",
        opportunityType: "neighbor_referral_campaign",
        title: "Ask happy customers for nearby referrals",
        reason: `The campaign is focused around ${area}. Referrals from nearby customers can compound neighborhood trust without adding ad-tech complexity.`,
        recommendedAction: "Create a simple referral request and approve the outreach list before sending.",
        estimatedImpactLabel: "Referral growth opportunity",
        potentialValueCents: value,
        confidence: 66,
        urgency: 56,
        sourceTable: "market_capture_campaigns",
        sourceId: campaign.id,
        metadata: { targetArea: area, directMailStatus: campaign.direct_mail_status },
      });
      touched += 1;
    }

    if (campaignHasResults(reports)) {
      await ensureOpportunity(db, identity, {
        opportunityGroup: "testimonial",
        opportunityType: "testimonial_opportunity",
        title: "Capture a testimonial from recent campaign activity",
        reason: "Campaign activity shows enough customer interaction to request approved proof. A real testimonial can improve trust across landing pages, proposals, and follow-up.",
        recommendedAction: "Ask for one approved testimonial and store permission before any public use.",
        estimatedImpactLabel: "Proof asset opportunity",
        potentialValueCents: value,
        confidence: 74,
        urgency: 62,
        sourceTable: "market_capture_reports",
        sourceId: reports[0]?.id ?? campaign.id,
        metadata: { reportCount: reports.length, noFakeTestimonials: true },
      });
      touched += 1;
    }
  }

  for (const row of context.reputationMemory) {
    const profile = profilesById.get(row.profile_id);
    if (!profile) continue;
    const identity = identityFromProfile(profile);
    await ensureTestimonialFromMemory(db, identity, row);
    if (numberValue(row.reviews_requested) > numberValue(row.reviews_received)) {
      await ensureOpportunity(db, identity, {
        opportunityGroup: "review",
        opportunityType: "review_reminder",
        title: "Review request follow-up is due",
        reason: "Business Memory shows review requests that have not yet produced review activity. A polite reminder can close the loop without pressure.",
        recommendedAction: "Review the original request list, approve a reminder, and avoid any incentive or sentiment filtering.",
        estimatedImpactLabel: "Review follow-up opportunity",
        confidence: 68,
        urgency: 66,
        sourceTable: "business_memory_reputation",
        sourceId: row.id,
        metadata: { reviewsRequested: row.reviews_requested, reviewsReceived: row.reviews_received },
      });
      touched += 1;
    }
    if (numberValue(row.referrals_generated) > 0) {
      await ensureOpportunity(db, identity, {
        opportunityGroup: "referral",
        opportunityType: "referral_follow_up",
        title: "Referral momentum deserves a follow-up",
        reason: "Business Memory shows referral activity. Following up quickly can turn goodwill into repeat introductions.",
        recommendedAction: "Approve a thank-you and referral follow-up draft before any customer outreach.",
        estimatedImpactLabel: "Referral momentum",
        confidence: 72,
        urgency: 58,
        sourceTable: "business_memory_reputation",
        sourceId: row.id,
        metadata: { referralsGenerated: row.referrals_generated },
      });
      touched += 1;
    }
  }

  await refreshReputationScoresAndReports(db);
  return { recordsTouched: touched };
}

async function refreshReputationScoresAndReports(db: Db) {
  const [opportunities, reviewCampaigns, referralCampaigns, testimonials, reviewRequests, referralRequests] = await Promise.all([
    safeRows("Reputation opportunities", db.from("reputation_opportunities").select("*").order("priority_score", { ascending: false }).limit(1000)),
    safeRows("Review campaigns", db.from("review_campaigns").select("*").limit(1000)),
    safeRows("Referral campaigns", db.from("referral_campaigns").select("*").limit(1000)),
    safeRows("Testimonials", db.from("testimonial_library").select("*").limit(1000)),
    safeRows("Review requests", db.from("review_requests").select("*").limit(1000)),
    safeRows("Referral requests", db.from("referral_requests").select("*").limit(1000)),
  ]);

  const clientKeys = new Set([
    ...opportunities.map(clientKeyFromRow),
    ...reviewCampaigns.map(clientKeyFromRow),
    ...referralCampaigns.map(clientKeyFromRow),
    ...testimonials.map(clientKeyFromRow),
  ].filter(Boolean));

  for (const key of clientKeys) {
    const clientOpportunities = opportunities.filter((row) => clientKeyFromRow(row) === key) as ReputationOpportunityRow[];
    const identity = identityFromRows(clientOpportunities.length ? clientOpportunities : [...reviewCampaigns, ...referralCampaigns, ...testimonials].filter((row) => clientKeyFromRow(row) === key));
    if (!identity) continue;
    const clientReviewCampaigns = reviewCampaigns.filter((row) => clientKeyFromRow(row) === key);
    const clientReferralCampaigns = referralCampaigns.filter((row) => clientKeyFromRow(row) === key);
    const clientTestimonials = testimonials.filter((row) => clientKeyFromRow(row) === key) as TestimonialRow[];
    const clientReviewRequests = reviewRequests.filter((row) => clientKeyFromRow(row) === key);
    const clientReferralRequests = referralRequests.filter((row) => clientKeyFromRow(row) === key);
    const topOpportunity = clientOpportunities[0] ?? null;
    if (isReputationScoreEnabled()) {
      await upsertReputationScore(db, identity, {
        opportunities: clientOpportunities,
        reviewCampaigns: clientReviewCampaigns,
        referralCampaigns: clientReferralCampaigns,
        testimonials: clientTestimonials,
        reviewRequests: clientReviewRequests,
        referralRequests: clientReferralRequests,
        topOpportunity,
      });
    }
    if (isReputationReportingEnabled()) {
      await upsertReputationReport(db, identity, {
        opportunities: clientOpportunities,
        reviewCampaigns: clientReviewCampaigns,
        referralCampaigns: clientReferralCampaigns,
        testimonials: clientTestimonials,
        reviewRequests: clientReviewRequests,
        referralRequests: clientReferralRequests,
        topOpportunity,
      });
    }
  }
}

async function upsertReputationScore(
  db: Db,
  identity: ClientIdentity,
  data: {
    opportunities: ReputationOpportunityRow[];
    reviewCampaigns: any[];
    referralCampaigns: any[];
    testimonials: TestimonialRow[];
    reviewRequests: any[];
    referralRequests: any[];
    topOpportunity: ReputationOpportunityRow | null;
  },
) {
  const reviewed = data.opportunities.filter((row) => !["new_opportunity", "dismissed"].includes(row.status)).length;
  const reviewActivityScore = clampScore(data.reviewCampaigns.length * 22 + data.reviewRequests.length * 14);
  const referralActivityScore = clampScore(data.referralCampaigns.length * 22 + data.referralRequests.length * 14);
  const testimonialActivityScore = clampScore(data.testimonials.length * 24 + data.testimonials.filter((row) => row.approved).length * 18);
  const followUpActivityScore = data.opportunities.length > 0 ? clampScore((reviewed / data.opportunities.length) * 100) : 10;
  const campaignActivityScore = clampScore((data.reviewCampaigns.filter((row) => ["ready", "active", "completed"].includes(String(row.status))).length + data.referralCampaigns.filter((row) => ["ready", "active", "completed"].includes(String(row.status))).length) * 22);
  const score = clampScore(
    reviewActivityScore * 0.22 +
      referralActivityScore * 0.2 +
      testimonialActivityScore * 0.22 +
      followUpActivityScore * 0.18 +
      campaignActivityScore * 0.18,
  );
  await upsertByLookup(db, "reputation_scores", clientLookup(identity), {
    client_id: identity.clientId,
    client_email: identity.clientEmail ? normalizeEmail(identity.clientEmail) : null,
    business_memory_profile_id: identity.businessMemoryProfileId,
    score,
    color: score >= 76 ? "green" : score >= 50 ? "yellow" : "red",
    review_activity_score: reviewActivityScore,
    referral_activity_score: referralActivityScore,
    testimonial_activity_score: testimonialActivityScore,
    follow_up_activity_score: followUpActivityScore,
    campaign_activity_score: campaignActivityScore,
    current_status: score >= 76 ? "healthy" : score >= 50 ? "needs_review" : "needs_data",
    recommended_action: data.topOpportunity?.recommended_action ?? "Add recent customer, campaign, and testimonial context so HomeReach can find reputation opportunities.",
    top_opportunity_id: data.topOpportunity?.id ?? null,
    calculated_at: new Date().toISOString(),
    metadata: {
      opportunityCount: data.opportunities.length,
      reviewCampaignCount: data.reviewCampaigns.length,
      referralCampaignCount: data.referralCampaigns.length,
      testimonialCount: data.testimonials.length,
    },
  });
}

async function upsertReputationReport(
  db: Db,
  identity: ClientIdentity,
  data: {
    opportunities: ReputationOpportunityRow[];
    reviewCampaigns: any[];
    referralCampaigns: any[];
    testimonials: TestimonialRow[];
    reviewRequests: any[];
    referralRequests: any[];
    topOpportunity: ReputationOpportunityRow | null;
  },
) {
  await upsertByLookup(
    db,
    "reputation_reports",
    {
      ...clientLookup(identity),
      reporting_period_start: startOfMonthIso(),
      reporting_period_end: endOfMonthIso(),
    },
    {
      client_id: identity.clientId,
      client_email: identity.clientEmail ? normalizeEmail(identity.clientEmail) : null,
      business_memory_profile_id: identity.businessMemoryProfileId,
      review_opportunities: data.opportunities.filter((row) => row.opportunity_group === "review").length,
      review_requests_sent: data.reviewRequests.filter((row) => row.status === "sent").length,
      referral_opportunities: data.opportunities.filter((row) => row.opportunity_group === "referral").length,
      referral_requests_sent: data.referralRequests.filter((row) => row.status === "sent").length,
      testimonials_captured: data.testimonials.length,
      campaign_activity: {
        reviewCampaigns: data.reviewCampaigns.length,
        referralCampaigns: data.referralCampaigns.length,
        activeCampaigns: [...data.reviewCampaigns, ...data.referralCampaigns].filter((row) => row.status === "active").length,
      },
      recommendations: data.topOpportunity?.recommended_action ?? "Keep review, referral, and testimonial requests consistent, approved, and customer-friendly.",
      metadata: { generatedBy: "reputation_engine" },
    },
  );
}

async function loadReputationData(db: Db, input: { clientId?: string | null; clientEmail?: string | null; adminMode?: boolean }): Promise<ReputationCenterData> {
  const normalizedEmail = normalizeEmail(input.clientEmail);
  const adminMode = Boolean(input.adminMode);
  const byClientOrEmail = async (table: string, orderColumn = "updated_at", limit = 300) => {
    if (adminMode) return safeRows(table, db.from(table).select("*").order(orderColumn, { ascending: false }).limit(limit));
    const queries: Array<Promise<any[]>> = [];
    if (input.clientId) queries.push(safeRows(`${table} by client`, db.from(table).select("*").eq("client_id", input.clientId).order(orderColumn, { ascending: false }).limit(limit)));
    if (normalizedEmail) queries.push(safeRows(`${table} by email`, db.from(table).select("*").ilike("client_email", normalizedEmail).order(orderColumn, { ascending: false }).limit(limit)));
    return mergeById((await Promise.all(queries)).flat());
  };

  const [opportunities, reviewCampaigns, referralCampaigns, testimonials, reviewRequests, referralRequests] = await Promise.all([
    byClientOrEmail("reputation_opportunities", "priority_score", adminMode ? 300 : 100),
    byClientOrEmail("review_campaigns"),
    byClientOrEmail("referral_campaigns"),
    byClientOrEmail("testimonial_library"),
    byClientOrEmail("review_requests"),
    byClientOrEmail("referral_requests"),
  ]);

  const scoreQuery = adminMode
    ? db.from("reputation_scores").select("*").order("score", { ascending: true }).limit(1).maybeSingle()
    : input.clientId
      ? db.from("reputation_scores").select("*").eq("client_id", input.clientId).maybeSingle()
      : db.from("reputation_scores").select("*").ilike("client_email", normalizedEmail).maybeSingle();
  const reportQuery = adminMode
    ? db.from("reputation_reports").select("*").order("reporting_period_end", { ascending: false }).limit(1).maybeSingle()
    : input.clientId
      ? db.from("reputation_reports").select("*").eq("client_id", input.clientId).order("reporting_period_end", { ascending: false }).limit(1).maybeSingle()
      : db.from("reputation_reports").select("*").ilike("client_email", normalizedEmail).order("reporting_period_end", { ascending: false }).limit(1).maybeSingle();

  const [score, report] = await Promise.all([
    safeSingle("Reputation score", scoreQuery),
    safeSingle("Reputation report", reportQuery),
  ]);

  const opportunityIds = opportunities.map((row) => row.id).filter(Boolean);
  const drafts = opportunityIds.length
    ? (await safeRows("Reputation drafts", db.from("reputation_drafts").select("*").in("opportunity_id", opportunityIds).order("created_at", { ascending: true }).limit(1000))) as ReputationDraftRow[]
    : [];
  const draftsByOpportunity = drafts.reduce<Record<string, ReputationDraftRow[]>>((acc, draft) => {
    acc[draft.opportunity_id] = [...(acc[draft.opportunity_id] ?? []), draft];
    return acc;
  }, {});

  return {
    enabled: true,
    safeMode: false,
    opportunities: opportunities as ReputationOpportunityRow[],
    draftsByOpportunity,
    reviewCampaigns,
    referralCampaigns,
    testimonials: testimonials as TestimonialRow[],
    reviewRequests,
    referralRequests,
    score: score as ReputationScoreRow | null,
    report: report as ReputationReportRow | null,
    metrics: calculateMetrics(opportunities as ReputationOpportunityRow[], reviewCampaigns, referralCampaigns, testimonials as TestimonialRow[], reviewRequests, referralRequests),
  };
}

function calculateMetrics(
  opportunities: ReputationOpportunityRow[],
  reviewCampaigns: any[],
  referralCampaigns: any[],
  testimonials: TestimonialRow[],
  reviewRequests: any[],
  referralRequests: any[],
): ReputationMetrics {
  return {
    reviewOpportunities: opportunities.filter((row) => row.opportunity_group === "review").length,
    referralOpportunities: opportunities.filter((row) => row.opportunity_group === "referral").length,
    testimonialsCollected: testimonials.length,
    reviewRequestsSent: reviewRequests.filter((row) => row.status === "sent").length,
    referralRequestsSent: referralRequests.filter((row) => row.status === "sent").length,
    reviewCampaignsActive: reviewCampaigns.filter((row) => ["ready", "active"].includes(String(row.status))).length,
    referralCampaignsActive: referralCampaigns.filter((row) => ["ready", "active"].includes(String(row.status))).length,
    openOpportunities: opportunities.filter((row) => OPEN_STATUSES.has(row.status)).length,
    recentWins: opportunities.filter((row) => ["launched", "completed"].includes(row.status)).length + testimonials.filter((row) => row.approved).length,
    potentialReferralValueCents: opportunities.filter((row) => row.opportunity_group === "referral").reduce((sum, row) => sum + numberValue(row.potential_value_cents), 0),
  };
}

export async function ensureReputationForClient({
  supabase,
  clientId,
  clientEmail,
}: {
  supabase: ServiceClient;
  clientId?: string | null;
  clientEmail?: string | null;
}) {
  if (!isReputationEngineEnabled() || !hasReputationPersistence()) return { recordsTouched: 0 };
  try {
    const db = asDb(supabase);
    const context = await loadSourceContext({ db, clientId, clientEmail });
    return await syncContext(db, context);
  } catch (error) {
    if (isMissingReputationSchema(error)) return { recordsTouched: 0 };
    throw error;
  }
}

export async function ensureReputationForAll({
  supabase,
  limit = 300,
}: {
  supabase: ServiceClient;
  limit?: number;
}) {
  if (!isReputationEngineEnabled() || !hasReputationPersistence()) return { recordsTouched: 0 };
  try {
    const db = asDb(supabase);
    const context = await loadSourceContext({ db, adminMode: true, limit });
    return await syncContext(db, context);
  } catch (error) {
    if (isMissingReputationSchema(error)) return { recordsTouched: 0 };
    throw error;
  }
}

export async function loadClientReputationCenter({
  supabase,
  user,
  autoSync = true,
}: {
  supabase: ServiceClient;
  user: Pick<User, "id"> & { email?: string | null };
  autoSync?: boolean;
}): Promise<ReputationCenterData> {
  if (!isReputationEngineEnabled()) return { enabled: false, safeMode: false, opportunities: [], draftsByOpportunity: {}, reviewCampaigns: [], referralCampaigns: [], testimonials: [], reviewRequests: [], referralRequests: [], score: null, report: null, metrics: emptyMetrics() };
  if (!hasReputationPersistence()) return { enabled: true, safeMode: true, opportunities: [], draftsByOpportunity: {}, reviewCampaigns: [], referralCampaigns: [], testimonials: [], reviewRequests: [], referralRequests: [], score: null, report: null, metrics: emptyMetrics(), message: "Reputation persistence is not configured." };
  try {
    const db = asDb(supabase);
    if (autoSync) await ensureReputationForClient({ supabase, clientId: user.id, clientEmail: user.email });
    return loadReputationData(db, { clientId: user.id, clientEmail: user.email });
  } catch (error) {
    return { enabled: true, safeMode: true, opportunities: [], draftsByOpportunity: {}, reviewCampaigns: [], referralCampaigns: [], testimonials: [], reviewRequests: [], referralRequests: [], score: null, report: null, metrics: emptyMetrics(), message: error instanceof Error ? error.message : "Reputation Center is in safe mode." };
  }
}

export async function loadAdminReputationQueue({
  supabase,
  autoSync = true,
}: {
  supabase: ServiceClient;
  autoSync?: boolean;
}): Promise<ReputationCenterData> {
  if (!isReputationEngineEnabled()) return { enabled: false, safeMode: false, opportunities: [], draftsByOpportunity: {}, reviewCampaigns: [], referralCampaigns: [], testimonials: [], reviewRequests: [], referralRequests: [], score: null, report: null, metrics: emptyMetrics() };
  if (!hasReputationPersistence()) return { enabled: true, safeMode: true, opportunities: [], draftsByOpportunity: {}, reviewCampaigns: [], referralCampaigns: [], testimonials: [], reviewRequests: [], referralRequests: [], score: null, report: null, metrics: emptyMetrics(), message: "Reputation persistence is not configured." };
  try {
    const db = asDb(supabase);
    if (autoSync) await ensureReputationForAll({ supabase });
    return loadReputationData(db, { adminMode: true });
  } catch (error) {
    return { enabled: true, safeMode: true, opportunities: [], draftsByOpportunity: {}, reviewCampaigns: [], referralCampaigns: [], testimonials: [], reviewRequests: [], referralRequests: [], score: null, report: null, metrics: emptyMetrics(), message: error instanceof Error ? error.message : "Reputation queue is in safe mode." };
  }
}

export async function recordReputationAction({
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
  const opportunity = (await safeSingle("Reputation opportunity", db.from("reputation_opportunities").select("*").eq("id", opportunityId).maybeSingle())) as ReputationOpportunityRow | null;
  if (!opportunity) throw new Error("Reputation opportunity not found.");
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
      noOutboundWithoutApproval: true,
    },
  };
  if (nextStatus === "launched") update.launched_at = now;
  if (nextStatus === "completed") update.completed_at = now;
  const { data, error } = await db.from("reputation_opportunities").update(update).eq("id", opportunityId).select("*").single();
  if (error) throw new Error(`Reputation action failed: ${error.message}`);
  if (draftId && actionType === "copy_draft") {
    const draft = await safeSingle("Reputation draft", db.from("reputation_drafts").select("copy_count").eq("id", draftId).maybeSingle());
    await db.from("reputation_drafts").update({ copy_count: numberValue(draft?.copy_count) + 1, last_copied_at: now }).eq("id", draftId);
  }
  const identity: ClientIdentity = {
    clientId: data.client_id,
    clientEmail: data.client_email,
    businessMemoryProfileId: data.business_memory_profile_id,
    businessName: null,
    contactName: null,
  };
  await ensureCampaignScaffold(db, data as ReputationOpportunityRow);
  await syncOpportunityToBusinessMemory(db, identity, data as ReputationOpportunityRow);
  await refreshReputationScoresAndReports(db);
  return { status: nextStatus };
}

function nextStatusForAction(actionType: string, current: ReputationStatus): ReputationStatus {
  if (actionType === "review") return "under_review";
  if (actionType === "assign") return "assigned";
  if (actionType === "approve") return "approved";
  if (actionType === "launch") return "launched";
  if (actionType === "complete") return "completed";
  if (actionType === "dismiss") return "dismissed";
  return current;
}

function emptyMetrics(): ReputationMetrics {
  return {
    reviewOpportunities: 0,
    referralOpportunities: 0,
    testimonialsCollected: 0,
    reviewRequestsSent: 0,
    referralRequestsSent: 0,
    reviewCampaignsActive: 0,
    referralCampaignsActive: 0,
    openOpportunities: 0,
    recentWins: 0,
    potentialReferralValueCents: 0,
  };
}
