import "server-only";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isCandidateLaunchAgentEnabled, isPoliticalAiDisabled, isPoliticalEnabled } from "./env";
import {
  loadCampaignsForCandidate,
  loadCandidate,
  loadCandidates,
  loadContactsForCandidate,
  type CampaignRow,
  type CandidateRow,
  type DistrictType,
  type GeographyType,
} from "./queries";
import { searchCandidateSuggestions, upsertCandidateIntelRecord } from "./candidate-intelligence/repository";
import { normalizeCandidateName } from "./candidate-intelligence/normalization";
import { fetchSerpapiCandidateIntel, isCandidateSerpApiEnabled } from "./candidate-intelligence/providers/serpapi";
import { getCandidateIntelSource } from "./candidate-intelligence/sources";
import { estimateHouseholds } from "./household-estimator";
import {
  generatePoliticalQuote,
  BelowMinimumVolumeError,
  NoHouseholdEstimateError,
} from "./quote";
import {
  MAX_POLITICAL_POSTCARD_PRICE_PER_PIECE_CENTS,
  MINIMUM_TOTAL_PIECES,
  POLITICAL_POSTCARD_POSTAGE_ESTIMATE_CENTS,
  POLITICAL_POSTCARD_PRINT_ESTIMATE_CENTS,
} from "./pricing-config";

type SupabaseLooseClient = Awaited<ReturnType<typeof createClient>> & {
  from(table: string): any;
};

export const CANDIDATE_AGENT_GUARDRAILS = [
  "Use public candidate, campaign, election, district, USPS, and aggregate geography data only.",
  "Do not create individual voter scores, ideology predictions, sensitive demographic targeting, or turnout-suppression logic.",
  "Keep recommendations at geography, route, ZIP, county, city, township, district, schedule, budget, and production-readiness level.",
  "Require human approval before any proposal, creative copy, outreach, or production handoff leaves HomeReach.",
  "Show confidence, missing data, source freshness, and compliance notes on every generated plan.",
] as const;

export interface CandidateAgentRow {
  id: string;
  candidateId: string;
  campaignId: string | null;
  agentName: string;
  status: CandidateAgentStatus;
  currentTask: string | null;
  lastAction: string | null;
  confidenceScore: number;
  queueCount: number;
  complianceStatus: string;
  humanApprovalRequired: boolean;
  lastRunAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type CandidateAgentStatus =
  | "idle"
  | "researching"
  | "research_complete"
  | "planning"
  | "plan_ready"
  | "approved"
  | "production_ready"
  | "blocked"
  | "error";

export interface CandidateResearchRow {
  id: string;
  agentId: string;
  candidateId: string;
  campaignId: string | null;
  status: string;
  candidateSummary: string;
  raceSummary: string;
  researchJson: CandidateResearchOutput;
  missingData: string[];
  dataSources: DataSourceUsed[];
  confidenceScore: number;
  sourceFreshness: string;
  generatedAt: string;
  createdAt: string;
}

export interface CandidateLaunchPlanRow {
  id: string;
  agentId: string;
  candidateId: string;
  campaignId: string | null;
  status: LaunchPlanStatus;
  planName: string;
  planJson: CandidateLaunchPlanOutput;
  candidateSummary: string;
  recommendedStrategy: string;
  totalHouseholds: number;
  totalEstimatedCostCents: number;
  confidenceScore: number;
  complianceNotes: string[];
  humanApprovedAt: string | null;
  humanApprovedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export type LaunchPlanStatus =
  | "draft"
  | "needs_review"
  | "approved"
  | "proposal_ready"
  | "production_ready"
  | "archived";

export interface CandidateLaunchPhaseRow {
  id: string;
  planId: string;
  phaseNumber: number;
  phaseKey: string;
  objective: string;
  recommendedSendDate: string | null;
  deliveryWindowStart: string | null;
  deliveryWindowEnd: string | null;
  targetGeography: string;
  householdCount: number;
  estimatedPrintCostCents: number;
  estimatedPostageCostCents: number;
  totalEstimatedCostCents: number;
  messageTheme: string;
  creativeBrief: string;
  qrRecommendation: string | null;
  complianceNotes: string[];
  whyThisPhaseMatters: string;
  sourceLabels: string[];
  createdAt: string;
}

export interface CandidateAgentActivity {
  id: string;
  agentId: string | null;
  candidateId: string | null;
  campaignId: string | null;
  activityType: string;
  status: string;
  message: string;
  payload: Record<string, unknown>;
  actorUserId: string | null;
  createdAt: string;
}

export interface DataSourceUsed {
  label: string;
  url?: string | null;
  type: "home_reach" | "public" | "configured_source" | "operator" | "map_source";
  freshness?: string;
  confidence?: number;
}

export interface CandidateResearchOutput {
  candidate_summary: string;
  race_summary: string;
  public_profile: {
    candidate_name: string;
    office_sought: string | null;
    state: string;
    geography: string;
    public_party_or_committee: string | null;
    election_date: string | null;
    website: string | null;
    contact: string[];
  };
  missing_information: string[];
  data_sources: DataSourceUsed[];
  confidence_score: number;
  source_freshness: string;
  compliance_notes: string[];
  next_best_actions: string[];
}

export interface CandidateLaunchPlanOutput {
  candidate_summary: string;
  race_summary: string;
  recommended_strategy: string;
  phases: CandidateLaunchPlanPhase[];
  geography_recommendations: GeographyRecommendation[];
  budget_options: BudgetOption[];
  timeline: Array<{ label: string; date: string | null; note: string }>;
  creative_briefs: Array<{ phase_key: string; title: string; brief: string }>;
  compliance_notes: string[];
  data_sources: DataSourceUsed[];
  confidence_score: number;
  next_best_actions: string[];
}

export interface CandidateLaunchPlanPhase {
  phase_number: number;
  phase_key: string;
  phase_objective: string;
  recommended_send_date: string | null;
  recommended_delivery_window: {
    start: string | null;
    end: string | null;
  };
  target_geography: string;
  household_count: number;
  billable_piece_count: number;
  estimated_print_cost_cents: number;
  estimated_postage_cost_cents: number;
  price_per_postcard_cents: number;
  total_estimated_cost_cents: number;
  message_theme: string;
  creative_brief: string;
  qr_landing_page_recommendation: string;
  compliance_disclaimer_notes: string[];
  why_this_phase_matters: string;
}

export interface GeographyRecommendation {
  geography_type: string;
  geography_key: string;
  label: string;
  household_count: number;
  route_count: number;
  estimated_cost_cents: number;
  selection_reason: string;
  data_confidence: string;
}

export interface BudgetOption {
  label: string;
  phases: number;
  households_per_phase: number;
  total_pieces: number;
  estimated_total_cents: number;
  per_postcard_cents: number;
  note: string;
}

export interface CandidateAgentDashboardRow {
  candidate: CandidateRow;
  agent: CandidateAgentRow | null;
  latestResearch: CandidateResearchRow | null;
  latestPlan: CandidateLaunchPlanRow | null;
  activity: CandidateAgentActivity[];
  nextAction: string;
}

export interface CandidateAgentDashboard {
  schemaReady: boolean;
  migrationHint: string | null;
  rows: CandidateAgentDashboardRow[];
  metrics: {
    candidates: number;
    agents: number;
    researchComplete: number;
    plansReady: number;
    approvalsNeeded: number;
    productionReady: number;
  };
  guardrails: readonly string[];
}

export interface CandidateAgentWorkspace {
  schemaReady: boolean;
  migrationHint: string | null;
  candidate: CandidateRow | null;
  campaigns: CampaignRow[];
  agent: CandidateAgentRow | null;
  latestResearch: CandidateResearchRow | null;
  latestPlan: CandidateLaunchPlanRow | null;
  phases: CandidateLaunchPhaseRow[];
  activity: CandidateAgentActivity[];
  guardrails: readonly string[];
}

export interface ManualCandidateInput {
  candidateName: string;
  officeSought?: string | null;
  state?: string | null;
  districtType?: DistrictType | null;
  geographyType?: GeographyType | null;
  geographyValue?: string | null;
  electionDate?: string | null;
  electionYear?: number | null;
  partyOptionalPublic?: string | null;
  campaignWebsite?: string | null;
  campaignEmail?: string | null;
  campaignPhone?: string | null;
  sourceUrl?: string | null;
  notes?: string | null;
  campaignName?: string | null;
}

export interface CandidateLaunchPlanEditInput {
  planId: string;
  recommendedStrategy?: string | null;
  operatorNotes?: string | null;
}

export class CandidateLaunchAgentSchemaError extends Error {
  constructor(message = "Candidate Launch Agent migration has not been applied.") {
    super(message);
    this.name = "CandidateLaunchAgentSchemaError";
  }
}

const AGENT_COLUMNS = [
  "id",
  "candidate_id",
  "campaign_id",
  "agent_name",
  "status",
  "current_task",
  "last_action",
  "confidence_score",
  "queue_count",
  "compliance_status",
  "human_approval_required",
  "last_run_at",
  "metadata",
  "created_at",
  "updated_at",
].join(", ");

const RESEARCH_COLUMNS = [
  "id",
  "agent_id",
  "candidate_id",
  "campaign_id",
  "status",
  "candidate_summary",
  "race_summary",
  "research_json",
  "missing_data",
  "data_sources",
  "confidence_score",
  "source_freshness",
  "generated_at",
  "created_at",
].join(", ");

const PLAN_COLUMNS = [
  "id",
  "agent_id",
  "candidate_id",
  "campaign_id",
  "status",
  "plan_name",
  "plan_json",
  "candidate_summary",
  "recommended_strategy",
  "total_households",
  "total_estimated_cost_cents",
  "confidence_score",
  "compliance_notes",
  "human_approved_at",
  "human_approved_by",
  "created_at",
  "updated_at",
].join(", ");

const PHASE_COLUMNS = [
  "id",
  "plan_id",
  "phase_number",
  "phase_key",
  "objective",
  "recommended_send_date",
  "delivery_window_start",
  "delivery_window_end",
  "target_geography",
  "household_count",
  "estimated_print_cost_cents",
  "estimated_postage_cost_cents",
  "total_estimated_cost_cents",
  "message_theme",
  "creative_brief",
  "qr_recommendation",
  "compliance_notes",
  "why_this_phase_matters",
  "source_labels",
  "created_at",
].join(", ");

const ACTIVITY_COLUMNS = [
  "id",
  "agent_id",
  "candidate_id",
  "campaign_id",
  "activity_type",
  "status",
  "message",
  "payload",
  "actor_user_id",
  "created_at",
].join(", ");

function isSchemaMissingError(error: unknown): boolean {
  const value = String((error as { message?: unknown; code?: unknown })?.message ?? error ?? "");
  const code = String((error as { code?: unknown })?.code ?? "");
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    value.includes("political_candidate_agents") ||
    value.includes("political_mail_launch_plans") ||
    value.includes("candidate_intel_") ||
    value.includes("Could not find the table")
  );
}

function throwIfSchemaMissing(error: unknown): never {
  if (isSchemaMissingError(error)) throw new CandidateLaunchAgentSchemaError();
  throw error instanceof Error ? error : new Error(String(error));
}

function normalizeText(value: unknown, max = 500): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function normalizeState(value: unknown): string {
  const raw = normalizeText(value, 2);
  return (raw ?? "OH").toUpperCase();
}

function normalizeDistrictType(value: unknown): DistrictType | null {
  return value === "federal" || value === "state" || value === "local" ? value : null;
}

function normalizeGeographyType(value: unknown): GeographyType | null {
  return value === "state" || value === "county" || value === "city" || value === "district"
    ? value
    : null;
}

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function daysUntil(date: string | null): number | null {
  if (!date) return null;
  const target = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  return Math.ceil((target.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

function formatGeography(candidate: CandidateRow, campaign?: CampaignRow | null): string {
  const type = candidate.geographyType ?? campaign?.geographyType ?? null;
  const value = candidate.geographyValue ?? campaign?.geographyValue ?? null;
  if (!type || !value) return candidate.state;
  return `${type}: ${value} / ${candidate.state}`;
}

function rowToAgent(row: any): CandidateAgentRow {
  return {
    id: row.id,
    candidateId: row.candidate_id,
    campaignId: row.campaign_id,
    agentName: row.agent_name,
    status: row.status,
    currentTask: row.current_task,
    lastAction: row.last_action,
    confidenceScore: Number(row.confidence_score ?? 0),
    queueCount: Number(row.queue_count ?? 0),
    complianceStatus: row.compliance_status,
    humanApprovalRequired: Boolean(row.human_approval_required),
    lastRunAt: row.last_run_at,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToResearch(row: any): CandidateResearchRow {
  return {
    id: row.id,
    agentId: row.agent_id,
    candidateId: row.candidate_id,
    campaignId: row.campaign_id,
    status: row.status,
    candidateSummary: row.candidate_summary,
    raceSummary: row.race_summary,
    researchJson: (row.research_json ?? {}) as CandidateResearchOutput,
    missingData: Array.isArray(row.missing_data) ? row.missing_data : [],
    dataSources: Array.isArray(row.data_sources) ? row.data_sources : [],
    confidenceScore: Number(row.confidence_score ?? 0),
    sourceFreshness: row.source_freshness,
    generatedAt: row.generated_at,
    createdAt: row.created_at,
  };
}

function rowToPlan(row: any): CandidateLaunchPlanRow {
  return {
    id: row.id,
    agentId: row.agent_id,
    candidateId: row.candidate_id,
    campaignId: row.campaign_id,
    status: row.status,
    planName: row.plan_name,
    planJson: (row.plan_json ?? {}) as CandidateLaunchPlanOutput,
    candidateSummary: row.candidate_summary,
    recommendedStrategy: row.recommended_strategy,
    totalHouseholds: Number(row.total_households ?? 0),
    totalEstimatedCostCents: Number(row.total_estimated_cost_cents ?? 0),
    confidenceScore: Number(row.confidence_score ?? 0),
    complianceNotes: Array.isArray(row.compliance_notes) ? row.compliance_notes : [],
    humanApprovedAt: row.human_approved_at,
    humanApprovedBy: row.human_approved_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToPhase(row: any): CandidateLaunchPhaseRow {
  return {
    id: row.id,
    planId: row.plan_id,
    phaseNumber: Number(row.phase_number ?? 0),
    phaseKey: row.phase_key,
    objective: row.objective,
    recommendedSendDate: row.recommended_send_date,
    deliveryWindowStart: row.delivery_window_start,
    deliveryWindowEnd: row.delivery_window_end,
    targetGeography: row.target_geography,
    householdCount: Number(row.household_count ?? 0),
    estimatedPrintCostCents: Number(row.estimated_print_cost_cents ?? 0),
    estimatedPostageCostCents: Number(row.estimated_postage_cost_cents ?? 0),
    totalEstimatedCostCents: Number(row.total_estimated_cost_cents ?? 0),
    messageTheme: row.message_theme,
    creativeBrief: row.creative_brief,
    qrRecommendation: row.qr_recommendation,
    complianceNotes: Array.isArray(row.compliance_notes) ? row.compliance_notes : [],
    whyThisPhaseMatters: row.why_this_phase_matters,
    sourceLabels: Array.isArray(row.source_labels) ? row.source_labels : [],
    createdAt: row.created_at,
  };
}

function rowToActivity(row: any): CandidateAgentActivity {
  return {
    id: row.id,
    agentId: row.agent_id,
    candidateId: row.candidate_id,
    campaignId: row.campaign_id,
    activityType: row.activity_type,
    status: row.status,
    message: row.message,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    actorUserId: row.actor_user_id,
    createdAt: row.created_at,
  };
}

async function logActivity(
  supabase: SupabaseLooseClient,
  args: {
    agentId?: string | null;
    candidateId?: string | null;
    campaignId?: string | null;
    activityType: string;
    status?: string;
    message: string;
    payload?: Record<string, unknown>;
    actorUserId?: string | null;
  },
): Promise<void> {
  const { error } = await supabase.from("political_agent_activity_log").insert({
    agent_id: args.agentId ?? null,
    candidate_id: args.candidateId ?? null,
    campaign_id: args.campaignId ?? null,
    activity_type: args.activityType,
    status: args.status ?? "complete",
    message: args.message,
    payload: args.payload ?? {},
    actor_user_id: args.actorUserId ?? null,
  });
  if (error && !isSchemaMissingError(error)) throw error;
}

async function updateAgent(
  supabase: SupabaseLooseClient,
  agentId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase
    .from("political_candidate_agents")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", agentId);
  if (error) throwIfSchemaMissing(error);
}

async function latestResearchForCandidate(
  supabase: SupabaseLooseClient,
  candidateId: string,
): Promise<CandidateResearchRow | null> {
  const { data, error } = await supabase
    .from("political_candidate_research")
    .select(RESEARCH_COLUMNS)
    .eq("candidate_id", candidateId)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throwIfSchemaMissing(error);
  return data ? rowToResearch(data) : null;
}

async function latestPlanForCandidate(
  supabase: SupabaseLooseClient,
  candidateId: string,
): Promise<CandidateLaunchPlanRow | null> {
  const { data, error } = await supabase
    .from("political_mail_launch_plans")
    .select(PLAN_COLUMNS)
    .eq("candidate_id", candidateId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throwIfSchemaMissing(error);
  return data ? rowToPlan(data) : null;
}

async function loadPhasesForPlan(
  supabase: SupabaseLooseClient,
  planId: string | null,
): Promise<CandidateLaunchPhaseRow[]> {
  if (!planId) return [];
  const { data, error } = await supabase
    .from("political_mail_launch_phases")
    .select(PHASE_COLUMNS)
    .eq("plan_id", planId)
    .order("phase_number", { ascending: true });
  if (error) throwIfSchemaMissing(error);
  return ((data ?? []) as any[]).map(rowToPhase);
}

async function loadActivityForCandidate(
  supabase: SupabaseLooseClient,
  candidateId: string,
  limit = 8,
): Promise<CandidateAgentActivity[]> {
  const { data, error } = await supabase
    .from("political_agent_activity_log")
    .select(ACTIVITY_COLUMNS)
    .eq("candidate_id", candidateId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throwIfSchemaMissing(error);
  return ((data ?? []) as any[]).map(rowToActivity);
}

export async function ensureCandidateAgent(
  candidateId: string,
  campaignId?: string | null,
  actorUserId?: string | null,
): Promise<CandidateAgentRow> {
  if (!isPoliticalEnabled() || !isCandidateLaunchAgentEnabled()) {
    throw new Error("Candidate Launch Agent is disabled.");
  }

  const supabase = (await createClient()) as SupabaseLooseClient;
  let q = supabase
    .from("political_candidate_agents")
    .select(AGENT_COLUMNS)
    .eq("candidate_id", candidateId)
    .order("created_at", { ascending: true })
    .limit(1);
  q = campaignId ? q.eq("campaign_id", campaignId) : q.is("campaign_id", null);
  const existing = await q.maybeSingle();
  if (existing.error) throwIfSchemaMissing(existing.error);
  if (existing.data) return rowToAgent(existing.data);

  const { data, error } = await supabase
    .from("political_candidate_agents")
    .insert({
      candidate_id: candidateId,
      campaign_id: campaignId ?? null,
      status: "idle",
      current_task: "Ready for public research",
      last_action: "Agent assigned",
      confidence_score: 0,
      queue_count: 1,
      compliance_status: "guardrails_active",
      human_approval_required: true,
      metadata: {
        guardrails: CANDIDATE_AGENT_GUARDRAILS,
        aiProviderCallsDisabled: isPoliticalAiDisabled(),
      },
    })
    .select(AGENT_COLUMNS)
    .single();
  if (error) throwIfSchemaMissing(error);
  const agent = rowToAgent(data);
  await logActivity(supabase, {
    agentId: agent.id,
    candidateId,
    campaignId: campaignId ?? null,
    activityType: "agent_assigned",
    message: "Candidate Campaign Launch Agent assigned with political compliance guardrails active.",
    actorUserId,
  });
  return agent;
}

export async function createManualCandidateWithAgent(
  input: ManualCandidateInput,
  actorUserId?: string | null,
): Promise<{ candidateId: string; campaignId: string | null; agentId: string | null }> {
  const supabase = (await createClient()) as SupabaseLooseClient;
  const candidateName = normalizeText(input.candidateName, 180);
  if (!candidateName) throw new Error("Candidate name is required.");

  const state = normalizeState(input.state);
  const districtType = normalizeDistrictType(input.districtType);
  const geographyType = normalizeGeographyType(input.geographyType);
  const geographyValue = normalizeText(input.geographyValue, 180);
  const electionDate = normalizeText(input.electionDate, 10);
  const electionYear =
    input.electionYear ??
    (electionDate ? new Date(`${electionDate}T12:00:00Z`).getUTCFullYear() : null);

  const { data: candidate, error } = await supabase
    .from("campaign_candidates")
    .insert({
      candidate_name: candidateName,
      office_sought: normalizeText(input.officeSought, 180),
      district_type: districtType,
      race_level: districtType ?? "local",
      election_year: electionYear,
      election_date: electionDate,
      state,
      geography_type: geographyType,
      geography_value: geographyValue,
      party_optional_public: normalizeText(input.partyOptionalPublic, 120),
      campaign_website: normalizeText(input.campaignWebsite, 260),
      campaign_email: normalizeText(input.campaignEmail, 180),
      campaign_phone: normalizeText(input.campaignPhone, 50),
      source_url: normalizeText(input.sourceUrl, 260),
      source_type: "manual_launch_agent",
      candidate_status: "active",
      status: "new",
      notes: normalizeText(input.notes, 1000),
      data_verified_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw error;

  let campaignId: string | null = null;
  const campaignName = normalizeText(input.campaignName, 180);
  if (campaignName) {
    const created = await supabase
      .from("political_campaigns")
      .insert({
        candidate_id: candidate.id,
        campaign_name: campaignName,
        office: normalizeText(input.officeSought, 180),
        district_type: districtType,
        race_type: districtType,
        geography_type: geographyType,
        geography_value: geographyValue,
        pipeline_status: "prospect",
        stage: "new",
        owner_id: actorUserId ?? null,
        election_date: electionDate,
      })
      .select("id")
      .single();
    if (created.error) throw created.error;
    campaignId = created.data.id;
  }

  let agentId: string | null = null;
  try {
    const agent = await ensureCandidateAgent(candidate.id, campaignId, actorUserId);
    agentId = agent.id;
  } catch (error) {
    if (!isSchemaMissingError(error)) throw error;
  }

  revalidatePath("/admin/political");
  revalidatePath("/admin/political/candidate-agent");
  return { candidateId: candidate.id, campaignId, agentId };
}

function candidateSerpApiRefreshHours(): number {
  const raw = Number(process.env.CANDIDATE_SERPAPI_MIN_REFRESH_HOURS ?? 24);
  return Number.isFinite(raw) && raw >= 1 ? raw : 24;
}

async function hasFreshCandidateSerpApiRecord(
  supabase: SupabaseLooseClient,
  candidate: CandidateRow,
): Promise<boolean> {
  const cutoff = new Date(Date.now() - candidateSerpApiRefreshHours() * 60 * 60 * 1000).toISOString();
  const query = await supabase
    .from("candidate_intel_source_records")
    .select("id")
    .eq("source_key", "serpapi_candidate_search_v1")
    .eq("normalized_name", normalizeCandidateName(candidate.candidateName))
    .eq("state", candidate.state)
    .gte("updated_at", cutoff)
    .limit(1)
    .maybeSingle();
  if (query.error) {
    if (isSchemaMissingError(query.error)) return true;
    throw query.error;
  }
  return Boolean(query.data);
}

async function refreshCandidateSerpApiIntel(
  supabase: SupabaseLooseClient,
  candidate: CandidateRow,
): Promise<{ refreshed: boolean; source?: DataSourceUsed; warnings: string[] }> {
  if (!isCandidateSerpApiEnabled()) return { refreshed: false, warnings: [] };
  if (await hasFreshCandidateSerpApiRecord(supabase, candidate)) {
    return {
      refreshed: false,
      source: {
        label: "SerpAPI candidate web search",
        type: "configured_source",
        freshness: `cached within ${candidateSerpApiRefreshHours()}h`,
        confidence: 55,
      },
      warnings: [],
    };
  }

  const result = await fetchSerpapiCandidateIntel({
    candidateName: candidate.candidateName,
    officeName: candidate.officeSought,
    state: candidate.state,
    cycle: candidate.electionYear ?? undefined,
    maxRecords: 5,
  });
  if (result.skipped || result.records.length === 0) {
    return { refreshed: false, warnings: result.reason ? [result.reason] : result.warnings ?? [] };
  }

  for (const record of result.records) {
    await upsertCandidateIntelRecord(supabase, record);
  }

  return {
    refreshed: true,
    source: {
      label: "SerpAPI candidate web search",
      type: "configured_source",
      freshness: "refreshed during candidate research",
      confidence: Math.max(...result.records.map((record) => record.confidence), 0),
    },
    warnings: result.warnings ?? [],
  };
}

type CandidateSerpApiRefreshResult = Awaited<ReturnType<typeof refreshCandidateSerpApiIntel>>;

async function loadCandidateIntelHints(
  supabase: SupabaseLooseClient,
  candidate: CandidateRow,
): Promise<{
  sources: DataSourceUsed[];
  hints: Array<Record<string, unknown>>;
  confidenceBoost: number;
}> {
  try {
    let suggestions = await searchCandidateSuggestions(supabase, {
      query: candidate.candidateName,
      state: candidate.state,
      limit: 3,
    });
    const shouldTrySerpApi =
      isCandidateSerpApiEnabled() &&
      (suggestions.length === 0 || !candidate.campaignWebsite || !candidate.sourceUrl);
    const serpApi: CandidateSerpApiRefreshResult = shouldTrySerpApi
      ? await refreshCandidateSerpApiIntel(supabase, candidate).catch((error) => ({
          refreshed: false,
          warnings: [error instanceof Error ? error.message : String(error)],
        }))
      : { refreshed: false, warnings: [] };
    if (serpApi.refreshed) {
      suggestions = await searchCandidateSuggestions(supabase, {
        query: candidate.candidateName,
        state: candidate.state,
        limit: 3,
      });
    }
    const sources: DataSourceUsed[] = [];
    if (serpApi.source) sources.push(serpApi.source);
    const hints: Array<Record<string, unknown>> = [];
    for (const suggestion of suggestions) {
      hints.push({
        candidateName: suggestion.candidateName,
        officeName: suggestion.officeName,
        districtLabel: suggestion.districtLabel,
        electionDate: suggestion.electionDate,
        filingStatus: suggestion.filingStatus,
        score: suggestion.score,
        sourceConfidence: suggestion.sourceConfidence,
        sourceKeys: suggestion.sourceKeys,
      });
      for (const sourceKey of suggestion.sourceKeys) {
        const source = getCandidateIntelSource(sourceKey);
        sources.push({
          label: source?.label ?? sourceKey,
          type: "configured_source",
          freshness: "candidate intelligence cache",
          confidence: suggestion.sourceConfidence,
        });
      }
    }
    for (const warning of serpApi.warnings) {
      hints.push({
        sourceKey: "serpapi_candidate_search_v1",
        warning,
      });
    }
    return {
      sources,
      hints,
      confidenceBoost: Math.min(20, Math.max(0, Math.round(suggestions[0]?.score ?? 0) * 20)),
    };
  } catch (error) {
    if (!isSchemaMissingError(error)) {
      return {
        sources: [
          {
            label: "Candidate intelligence cache unavailable",
            type: "home_reach",
            freshness: "not loaded",
            confidence: 0,
          },
        ],
        hints: [],
        confidenceBoost: 0,
      };
    }
    return { sources: [], hints: [], confidenceBoost: 0 };
  }
}

function buildSources(candidate: CandidateRow, intelSources: DataSourceUsed[]): DataSourceUsed[] {
  const sources: DataSourceUsed[] = [
    {
      label: "HomeReach campaign candidate record",
      type: "home_reach",
      freshness: candidate.dataVerifiedAt ? `verified ${candidate.dataVerifiedAt}` : "operator entered",
      confidence: candidate.completenessScore ?? undefined,
    },
  ];

  if (candidate.sourceUrl) {
    sources.push({
      label: candidate.sourceType || "Candidate source URL",
      url: candidate.sourceUrl,
      type: "public",
      freshness: candidate.dataVerifiedAt ?? "manual review needed",
    });
  }
  if (candidate.campaignWebsite) {
    sources.push({
      label: "Campaign website",
      url: candidate.campaignWebsite,
      type: "public",
      freshness: "manual review recommended",
    });
  }
  if (candidate.facebookUrl) {
    sources.push({ label: "Facebook page", url: candidate.facebookUrl, type: "public" });
  }
  return [...sources, ...intelSources];
}

function missingDataForCandidate(candidate: CandidateRow): string[] {
  const missing: string[] = [];
  if (!candidate.officeSought) missing.push("Office sought");
  if (!candidate.electionDate) missing.push("Election date");
  if (!candidate.districtType) missing.push("Race level");
  if (!candidate.geographyType || !candidate.geographyValue) missing.push("District/county/city geography");
  if (!candidate.campaignWebsite) missing.push("Campaign website");
  if (!candidate.campaignEmail && !candidate.campaignManagerEmail) missing.push("Campaign email");
  if (!candidate.campaignPhone) missing.push("Campaign phone");
  if (!candidate.sourceUrl) missing.push("Official filing/source URL");
  return missing;
}

function confidenceForCandidate(
  candidate: CandidateRow,
  missing: string[],
  intelBoost: number,
): number {
  const knownFields = 8 - Math.min(8, missing.length);
  const completeness = Math.round((knownFields / 8) * 50);
  const score = 30 + completeness + intelBoost + Math.min(15, candidate.priorityScore ?? 0);
  return Math.min(95, Math.max(20, score));
}

export async function runCandidateResearch(
  candidateId: string,
  actorUserId?: string | null,
): Promise<{ agent: CandidateAgentRow; research: CandidateResearchRow }> {
  const candidate = await loadCandidate(candidateId);
  if (!candidate) throw new Error("Candidate not found.");
  const campaigns = await loadCampaignsForCandidate(candidateId);
  const campaign = campaigns[0] ?? null;
  const contacts = await loadContactsForCandidate(candidateId);
  const agent = await ensureCandidateAgent(candidateId, campaign?.id ?? null, actorUserId);
  const supabase = (await createClient()) as SupabaseLooseClient;

  await updateAgent(supabase, agent.id, {
    status: "researching",
    current_task: "Reviewing public candidate/campaign fields and cached candidate intelligence",
    last_action: "Research started",
    last_run_at: new Date().toISOString(),
  });

  const intel = await loadCandidateIntelHints(supabase, candidate);
  const missing = missingDataForCandidate(candidate);
  const sources = buildSources(candidate, intel.sources);
  const confidence = confidenceForCandidate(candidate, missing, intel.confidenceBoost);
  const geography = formatGeography(candidate, campaign);
  const contactSummary = [
    candidate.campaignEmail,
    candidate.campaignPhone,
    candidate.campaignManagerEmail,
    ...contacts.map((contact) => contact.email || contact.phone).filter(Boolean),
  ].filter((item): item is string => Boolean(item));

  const candidateSummary = `${candidate.candidateName} is tracked as an active public campaign prospect for ${candidate.officeSought ?? "an office not yet specified"} in ${geography}.`;
  const raceSummary = `Current operational record: ${candidate.districtType ?? "unclassified"} race, election ${candidate.electionDate ?? candidate.electionYear ?? "date missing"}, geography ${geography}.`;
  const researchJson: CandidateResearchOutput = {
    candidate_summary: candidateSummary,
    race_summary: raceSummary,
    public_profile: {
      candidate_name: candidate.candidateName,
      office_sought: candidate.officeSought,
      state: candidate.state,
      geography,
      public_party_or_committee: candidate.partyOptionalPublic,
      election_date: candidate.electionDate,
      website: candidate.campaignWebsite,
      contact: contactSummary,
    },
    missing_information: missing,
    data_sources: sources,
    confidence_score: confidence,
    source_freshness: candidate.dataVerifiedAt ? "verified operator record" : "manual review needed",
    compliance_notes: [...CANDIDATE_AGENT_GUARDRAILS],
    next_best_actions: [
      missing.length > 0 ? `Fill missing fields: ${missing.slice(0, 4).join(", ")}` : "Confirm public source freshness.",
      "Generate a multi-phase postcard plan for geography, cost, and schedule review.",
      "Use maps/routes to replace household estimates with final USPS counts before proposal send.",
    ],
  };

  const inserted = await supabase
    .from("political_candidate_research")
    .insert({
      agent_id: agent.id,
      candidate_id: candidate.id,
      campaign_id: campaign?.id ?? null,
      status: "complete",
      candidate_summary: candidateSummary,
      race_summary: raceSummary,
      research_json: {
        ...researchJson,
        candidate_intelligence_hints: intel.hints,
      },
      missing_data: missing,
      data_sources: sources,
      confidence_score: confidence,
      source_freshness: researchJson.source_freshness,
      generated_at: new Date().toISOString(),
    })
    .select(RESEARCH_COLUMNS)
    .single();
  if (inserted.error) throwIfSchemaMissing(inserted.error);

  await updateAgent(supabase, agent.id, {
    status: "research_complete",
    current_task: "Ready to generate multi-phase postcard launch plan",
    last_action: "Candidate research complete",
    confidence_score: confidence,
    queue_count: missing.length,
    last_run_at: new Date().toISOString(),
  });
  await logActivity(supabase, {
    agentId: agent.id,
    candidateId: candidate.id,
    campaignId: campaign?.id ?? null,
    activityType: "research_complete",
    message: `Research complete at ${confidence}% confidence. ${missing.length} missing field(s) remain.`,
    payload: { missing, sources: sources.map((source) => source.label) },
    actorUserId,
  });

  revalidatePath("/admin/political");
  revalidatePath("/admin/political/candidate-agent");
  revalidatePath(`/admin/political/${candidate.id}`);
  return { agent: { ...agent, status: "research_complete", confidenceScore: confidence }, research: rowToResearch(inserted.data) };
}

function resolvePlanningInputs(candidate: CandidateRow, campaign?: CampaignRow | null) {
  const geographyType = candidate.geographyType ?? campaign?.geographyType ?? "district";
  const geographyValue =
    candidate.geographyValue ??
    campaign?.geographyValue ??
    candidate.officeSought ??
    candidate.state;
  const districtType = candidate.districtType ?? campaign?.districtType ?? "local";
  const electionDate = candidate.electionDate ?? campaign?.electionDate ?? null;
  const estimated = estimateHouseholds(candidate.state, geographyType, geographyValue);
  const fallbackHouseholds =
    districtType === "federal"
      ? 310_000
      : districtType === "state"
        ? 85_000
        : geographyType === "county"
          ? 80_000
          : geographyType === "city"
            ? 25_000
            : 18_000;
  return {
    geographyType,
    geographyValue,
    districtType,
    electionDate,
    households: estimated ?? fallbackHouseholds,
    householdSource: estimated === null ? "operator_estimate_required" : "seeded_public_estimate",
  };
}

function buildPhaseSchedule(electionDate: string | null, phaseCount: number): string[] {
  if (!electionDate) {
    const start = addDays(new Date(), 14);
    return Array.from({ length: phaseCount }, (_, index) => dateOnly(addDays(start, index * 21)));
  }
  const election = new Date(`${electionDate}T12:00:00Z`);
  if (Number.isNaN(election.getTime())) return buildPhaseSchedule(null, phaseCount);
  const offsets = phaseCount >= 5 ? [-120, -90, -60, -30, -10] : [-90, -60, -30, -10];
  return offsets.slice(-phaseCount).map((offset, index) => {
    const candidateDate = addDays(election, offset);
    const minDate = addDays(new Date(), 7 + index * 7);
    return dateOnly(candidateDate > minDate ? candidateDate : minDate);
  });
}

function phaseTemplates(phaseCount: number) {
  const templates = [
    {
      key: "name_id",
      objective: "Candidate introduction/name ID",
      theme: "Introduce the candidate and the office sought with a clear local credibility frame.",
      brief: "Feature candidate photo or campaign mark, office sought, official election date, and a simple QR code to the campaign landing page.",
      why: "Early mail builds recognition before the campaign asks voters to process policy or contrast messaging.",
    },
    {
      key: "local_priorities",
      objective: "Issue/local priority postcard",
      theme: "Explain the campaign's public local priorities in plain language.",
      brief: "Use three short public priorities, district/city/county context, and a QR code to a public issues page.",
      why: "A second touch gives the campaign room to connect its public platform to the geography being mailed.",
    },
    {
      key: "credibility",
      objective: "Contrast or credibility postcard",
      theme: "Credibility, endorsements, public record, or campaign contrast where legally approved.",
      brief: "Prepare a compliance-reviewed layout with source-backed claims, disclaimer placement, and no deceptive synthetic content.",
      why: "This phase turns awareness into a concrete reason to remember the campaign while leaving final copy under human approval.",
    },
    {
      key: "election_reminder",
      objective: "GOTV/election reminder postcard",
      theme: "Election date, vote-by-mail/early voting public reminders, and campaign contact path.",
      brief: "Prioritize date, polling/election resources, QR code, and required political disclaimer block.",
      why: "The final reminder improves operational timing by landing near the public election calendar without using individual turnout scoring.",
    },
    {
      key: "final_week",
      objective: "Final-week push",
      theme: "Compressed final reminder for the highest-priority public geography and mail window.",
      brief: "Short message, high legibility, official election date, landing page QR, disclaimer, and production-ready proofing.",
      why: "A final-week push can reinforce public timing when the calendar and USPS delivery window still allow it.",
    },
  ];
  return templates.slice(0, phaseCount);
}

function quotePhase(args: {
  state: string;
  geographyType: GeographyType;
  geographyValue: string;
  districtType: DistrictType;
  households: number;
  daysUntilElection: number | null;
}) {
  const billablePieces = Math.max(MINIMUM_TOTAL_PIECES, Math.floor(args.households));
  try {
    const quote = generatePoliticalQuote({
      state: args.state,
      geographyType: args.geographyType,
      geographyValue: args.geographyValue,
      districtType: args.districtType,
      householdCountOverride: billablePieces,
      drops: 1,
      daysUntilElection: args.daysUntilElection,
    });
    return {
      billablePieces,
      pricePerPostcardCents: Math.min(
        quote.pricePerPieceCents,
        MAX_POLITICAL_POSTCARD_PRICE_PER_PIECE_CENTS,
      ),
      totalCents: quote.subtotalCents,
    };
  } catch (error) {
    if (error instanceof BelowMinimumVolumeError || error instanceof NoHouseholdEstimateError) {
      return {
        billablePieces,
        pricePerPostcardCents: MAX_POLITICAL_POSTCARD_PRICE_PER_PIECE_CENTS,
        totalCents: billablePieces * MAX_POLITICAL_POSTCARD_PRICE_PER_PIECE_CENTS,
      };
    }
    throw error;
  }
}

async function loadMapGeographyHint(
  supabase: SupabaseLooseClient,
  state: string,
  geographyType: GeographyType,
  geographyValue: string,
): Promise<{
  sources: DataSourceUsed[];
  publicElectionHistory: Array<Record<string, unknown>>;
  dataConfidence: string;
}> {
  try {
    const { data, error } = await supabase
      .from("political_geographies")
      .select("name, geography_key, party_advantage, aggregate_metrics, data_confidence, source_updated_at")
      .eq("state", state)
      .eq("geography_type", geographyType)
      .ilike("name", `%${geographyValue}%`)
      .limit(3);
    if (error) throw error;
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    if (rows.length === 0) {
      return {
        sources: [
          {
            label: "Map layer source pending for exact geography",
            type: "map_source",
            freshness: "operator verification needed",
          },
        ],
        publicElectionHistory: [],
        dataConfidence: "estimated",
      };
    }
    return {
      sources: rows.map((row) => ({
        label: `Political geography layer: ${String(row.name ?? row.geography_key)}`,
        type: "map_source",
        freshness: String(row.source_updated_at ?? "source date unavailable"),
        confidence: row.data_confidence === "exact" ? 95 : 70,
      })),
      publicElectionHistory: rows.map((row) => ({
        geography_key: row.geography_key,
        party_advantage: row.party_advantage,
        aggregate_metrics: row.aggregate_metrics,
        data_confidence: row.data_confidence,
      })),
      dataConfidence: String(rows[0]?.data_confidence ?? "estimated"),
    };
  } catch {
    return {
      sources: [
        {
          label: "Political map source unavailable in this environment",
          type: "map_source",
          freshness: "not loaded",
        },
      ],
      publicElectionHistory: [],
      dataConfidence: "estimated",
    };
  }
}

export async function generateCandidateLaunchPlan(
  candidateId: string,
  actorUserId?: string | null,
): Promise<{
  agent: CandidateAgentRow;
  research: CandidateResearchRow;
  plan: CandidateLaunchPlanRow;
  phases: CandidateLaunchPhaseRow[];
}> {
  const candidate = await loadCandidate(candidateId);
  if (!candidate) throw new Error("Candidate not found.");
  const campaigns = await loadCampaignsForCandidate(candidateId);
  const campaign = campaigns[0] ?? null;
  const agent = await ensureCandidateAgent(candidateId, campaign?.id ?? null, actorUserId);
  const supabase = (await createClient()) as SupabaseLooseClient;

  await updateAgent(supabase, agent.id, {
    status: "planning",
    current_task: "Building multi-phase postcard launch plan",
    last_action: "Plan generation started",
    last_run_at: new Date().toISOString(),
  });

  let research = await latestResearchForCandidate(supabase, candidate.id);
  if (!research) {
    const result = await runCandidateResearch(candidate.id, actorUserId);
    research = result.research;
  }

  const planning = resolvePlanningInputs(candidate, campaign);
  const days = daysUntil(planning.electionDate);
  const phaseCount = planning.electionDate && (days ?? 999) > 45 ? 5 : 4;
  const sendDates = buildPhaseSchedule(planning.electionDate, phaseCount);
  const templates = phaseTemplates(phaseCount);
  const mapHint = await loadMapGeographyHint(
    supabase,
    candidate.state,
    planning.geographyType,
    planning.geographyValue,
  );

  const sources = [
    ...(research.dataSources ?? []),
    ...mapHint.sources,
    {
      label: "HomeReach political quote engine",
      type: "home_reach" as const,
      freshness: "current code",
      confidence: 90,
    },
    {
      label: "USPS route counts required before production",
      type: "operator" as const,
      freshness: "route verification pending",
      confidence: 60,
    },
  ];

  const phases: CandidateLaunchPlanPhase[] = templates.map((template, index) => {
    const sendDate = sendDates[index] ?? null;
    const send = sendDate ? new Date(`${sendDate}T12:00:00Z`) : null;
    const deliveryStart = send ? dateOnly(addDays(send, 7)) : null;
    const deliveryEnd = send ? dateOnly(addDays(send, 14)) : null;
    const quote = quotePhase({
      state: candidate.state,
      geographyType: planning.geographyType,
      geographyValue: planning.geographyValue,
      districtType: planning.districtType,
      households: planning.households,
      daysUntilElection: days,
    });
    return {
      phase_number: index + 1,
      phase_key: template.key,
      phase_objective: template.objective,
      recommended_send_date: sendDate,
      recommended_delivery_window: { start: deliveryStart, end: deliveryEnd },
      target_geography: `${planning.geographyType}: ${planning.geographyValue}`,
      household_count: planning.households,
      billable_piece_count: quote.billablePieces,
      estimated_print_cost_cents:
        quote.billablePieces * POLITICAL_POSTCARD_PRINT_ESTIMATE_CENTS,
      estimated_postage_cost_cents:
        quote.billablePieces * POLITICAL_POSTCARD_POSTAGE_ESTIMATE_CENTS,
      price_per_postcard_cents: quote.pricePerPostcardCents,
      total_estimated_cost_cents: quote.totalCents,
      message_theme: template.theme,
      creative_brief: template.brief,
      qr_landing_page_recommendation:
        candidate.campaignWebsite ?? "Create a campaign landing page before proposal send.",
      compliance_disclaimer_notes: [
        "Include political mail disclaimer block before proof approval.",
        "Human review required for claims, contrast copy, and candidate authorization language.",
      ],
      why_this_phase_matters: template.why,
    };
  });

  const totalEstimatedCostCents = phases.reduce(
    (sum, phase) => sum + phase.total_estimated_cost_cents,
    0,
  );
  const totalPieces = phases.reduce((sum, phase) => sum + phase.billable_piece_count, 0);
  const perPostcard = totalPieces > 0 ? Math.round(totalEstimatedCostCents / totalPieces) : 0;

  const geographyRecommendations: GeographyRecommendation[] = [
    {
      geography_type: planning.geographyType,
      geography_key: `${candidate.state}:${planning.geographyType}:${planning.geographyValue}`,
      label: `${planning.geographyValue} (${candidate.state})`,
      household_count: planning.households,
      route_count: Math.max(1, Math.round(planning.households / 520)),
      estimated_cost_cents: phases[0]?.total_estimated_cost_cents ?? 0,
      selection_reason:
        planning.householdSource === "seeded_public_estimate"
          ? "Selected from candidate geography with seeded household estimate; replace with final USPS route counts before production."
          : "Selected from candidate geography with fallback household estimate; operator must verify counts before proposal send.",
      data_confidence: mapHint.dataConfidence,
    },
  ];

  const output: CandidateLaunchPlanOutput = {
    candidate_summary: research.candidateSummary,
    race_summary: research.raceSummary,
    recommended_strategy:
      "Launch a geography-first postcard cadence that introduces the candidate, reinforces public priorities, supports credibility/contrast after human approval, and closes with election reminders tied to public calendar timing.",
    phases,
    geography_recommendations: geographyRecommendations,
    budget_options: [
      {
        label: "Focused launch",
        phases: 2,
        households_per_phase: planning.households,
        total_pieces: phases.slice(0, 2).reduce((sum, phase) => sum + phase.billable_piece_count, 0),
        estimated_total_cents: phases
          .slice(0, 2)
          .reduce((sum, phase) => sum + phase.total_estimated_cost_cents, 0),
        per_postcard_cents: Math.min(perPostcard, MAX_POLITICAL_POSTCARD_PRICE_PER_PIECE_CENTS),
        note: "Two-touch launch for short windows or smaller budgets.",
      },
      {
        label: "Recommended launch",
        phases: phases.length,
        households_per_phase: planning.households,
        total_pieces: totalPieces,
        estimated_total_cents: totalEstimatedCostCents,
        per_postcard_cents: Math.min(perPostcard, MAX_POLITICAL_POSTCARD_PRICE_PER_PIECE_CENTS),
        note: "Full cadence for name ID, public priorities, credibility, and election reminders.",
      },
    ],
    timeline: phases.map((phase) => ({
      label: phase.phase_objective,
      date: phase.recommended_send_date,
      note: `Expected in-home ${phase.recommended_delivery_window.start ?? "TBD"} to ${phase.recommended_delivery_window.end ?? "TBD"}.`,
    })),
    creative_briefs: phases.map((phase) => ({
      phase_key: phase.phase_key,
      title: phase.phase_objective,
      brief: phase.creative_brief,
    })),
    compliance_notes: [
      ...CANDIDATE_AGENT_GUARDRAILS,
      "Pricing is capped at roughly $0.70 per postcard before add-ons.",
      "Final USPS route counts, source URLs, mailer disclaimer, and human creative approval are required before client-facing proposal send.",
    ],
    data_sources: sources,
    confidence_score: Math.min(95, Math.max(35, research.confidenceScore + (mapHint.publicElectionHistory.length ? 5 : 0))),
    next_best_actions: [
      "Verify USPS route counts on the synchronized map.",
      "Attach official filing/source URL if missing.",
      "Review creative briefs and generate an internal proposal draft.",
      "Approve plan only after source and compliance checklist review.",
    ],
  };

  const insertedPlan = await supabase
    .from("political_mail_launch_plans")
    .insert({
      agent_id: agent.id,
      candidate_id: candidate.id,
      campaign_id: campaign?.id ?? null,
      status: "needs_review",
      plan_name: `${candidate.candidateName} postcard launch plan`,
      plan_json: output,
      candidate_summary: output.candidate_summary,
      recommended_strategy: output.recommended_strategy,
      total_households: planning.households,
      total_estimated_cost_cents: totalEstimatedCostCents,
      confidence_score: output.confidence_score,
      compliance_notes: output.compliance_notes,
    })
    .select(PLAN_COLUMNS)
    .single();
  if (insertedPlan.error) throwIfSchemaMissing(insertedPlan.error);

  const plan = rowToPlan(insertedPlan.data);
  const phasePayload = phases.map((phase) => ({
    plan_id: plan.id,
    phase_number: phase.phase_number,
    phase_key: phase.phase_key,
    objective: phase.phase_objective,
    recommended_send_date: phase.recommended_send_date,
    delivery_window_start: phase.recommended_delivery_window.start,
    delivery_window_end: phase.recommended_delivery_window.end,
    target_geography: phase.target_geography,
    household_count: phase.household_count,
    estimated_print_cost_cents: phase.estimated_print_cost_cents,
    estimated_postage_cost_cents: phase.estimated_postage_cost_cents,
    total_estimated_cost_cents: phase.total_estimated_cost_cents,
    message_theme: phase.message_theme,
    creative_brief: phase.creative_brief,
    qr_recommendation: phase.qr_landing_page_recommendation,
    compliance_notes: phase.compliance_disclaimer_notes,
    why_this_phase_matters: phase.why_this_phase_matters,
    source_labels: sources.map((source) => source.label).slice(0, 8),
  }));
  const insertedPhases = await supabase
    .from("political_mail_launch_phases")
    .insert(phasePayload)
    .select(PHASE_COLUMNS);
  if (insertedPhases.error) throwIfSchemaMissing(insertedPhases.error);

  const primaryGeography = geographyRecommendations[0]!;
  for (const phase of (insertedPhases.data ?? []) as any[]) {
    await supabase.from("political_mail_phase_geographies").insert({
      phase_id: phase.id,
      geography_type: primaryGeography.geography_type,
      geography_key: primaryGeography.geography_key,
      label: primaryGeography.label,
      household_count: primaryGeography.household_count,
      route_count: primaryGeography.route_count,
      estimated_cost_cents: primaryGeography.estimated_cost_cents,
      selection_reason: primaryGeography.selection_reason,
    });
  }

  await supabase.from("political_district_intelligence").insert({
    candidate_id: candidate.id,
    campaign_id: campaign?.id ?? null,
    state: candidate.state,
    geography_type: planning.geographyType,
    geography_value: planning.geographyValue,
    household_estimate: planning.households,
    route_opportunity_summary: {
      estimatedRouteCount: geographyRecommendations[0]?.route_count ?? 0,
      householdSource: planning.householdSource,
      routeVerificationRequired: true,
    },
    public_election_history: mapHint.publicElectionHistory,
    source_labels: sources.map((source) => source.label).slice(0, 10),
    data_confidence: mapHint.dataConfidence,
    source_updated_at: new Date().toISOString(),
  });

  await updateAgent(supabase, agent.id, {
    status: "plan_ready",
    current_task: "Awaiting human review and proposal draft",
    last_action: "Multi-phase launch plan generated",
    confidence_score: output.confidence_score,
    queue_count: output.next_best_actions.length,
    last_run_at: new Date().toISOString(),
  });
  await logActivity(supabase, {
    agentId: agent.id,
    candidateId: candidate.id,
    campaignId: campaign?.id ?? null,
    activityType: "plan_generated",
    message: `Generated ${phases.length}-phase postcard launch plan with ${totalPieces.toLocaleString()} estimated pieces.`,
    payload: {
      planId: plan.id,
      totalEstimatedCostCents,
      perPostcardCents: Math.min(perPostcard, MAX_POLITICAL_POSTCARD_PRICE_PER_PIECE_CENTS),
    },
    actorUserId,
  });

  revalidatePath("/admin/political");
  revalidatePath("/admin/political/candidate-agent");
  revalidatePath(`/admin/political/${candidate.id}`);
  return {
    agent: { ...agent, status: "plan_ready", confidenceScore: output.confidence_score },
    research,
    plan,
    phases: ((insertedPhases.data ?? []) as any[]).map(rowToPhase),
  };
}

export async function approveCandidateLaunchPlan(
  planId: string,
  actorUserId?: string | null,
  notes?: string | null,
): Promise<CandidateLaunchPlanRow> {
  const supabase = (await createClient()) as SupabaseLooseClient;
  const existing = await supabase
    .from("political_mail_launch_plans")
    .select(PLAN_COLUMNS)
    .eq("id", planId)
    .single();
  if (existing.error) throwIfSchemaMissing(existing.error);
  const plan = rowToPlan(existing.data);
  const checklist = {
    public_geography_only: true,
    no_individual_voter_scoring: true,
    no_sensitive_demographic_targeting: true,
    no_ideology_prediction: true,
    human_approval_before_client_send: true,
    source_review_required_before_final_proposal: true,
  };
  const approval = await supabase.from("political_plan_approvals").insert({
    plan_id: plan.id,
    candidate_id: plan.candidateId,
    approved_by: actorUserId ?? null,
    approval_status: "approved",
    notes: normalizeText(notes, 1000),
    compliance_checklist: checklist,
  });
  if (approval.error) throwIfSchemaMissing(approval.error);

  const updated = await supabase
    .from("political_mail_launch_plans")
    .update({
      status: "approved",
      human_approved_at: new Date().toISOString(),
      human_approved_by: actorUserId ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", plan.id)
    .select(PLAN_COLUMNS)
    .single();
  if (updated.error) throwIfSchemaMissing(updated.error);
  await updateAgent(supabase, plan.agentId, {
    status: "approved",
    current_task: "Plan approved; proposal draft can be reviewed",
    last_action: "Human approval recorded",
  });
  await logActivity(supabase, {
    agentId: plan.agentId,
    candidateId: plan.candidateId,
    campaignId: plan.campaignId,
    activityType: "plan_approved",
    message: "Human approval recorded for Candidate Launch Agent plan.",
    payload: checklist,
    actorUserId,
  });
  revalidatePath("/admin/political/candidate-agent");
  revalidatePath(`/admin/political/${plan.candidateId}`);
  return rowToPlan(updated.data);
}

export async function updateCandidateLaunchPlanDraft(
  input: CandidateLaunchPlanEditInput,
  actorUserId?: string | null,
): Promise<CandidateLaunchPlanRow> {
  const supabase = (await createClient()) as SupabaseLooseClient;
  const planId = normalizeText(input.planId, 80);
  if (!planId) throw new Error("Plan id is required.");

  const existing = await supabase
    .from("political_mail_launch_plans")
    .select(PLAN_COLUMNS)
    .eq("id", planId)
    .single();
  if (existing.error) throwIfSchemaMissing(existing.error);

  const plan = rowToPlan(existing.data);
  if (plan.status === "production_ready") {
    throw new Error("Production-ready plans cannot be edited here. Clone or regenerate a new plan first.");
  }

  const recommendedStrategy = normalizeText(input.recommendedStrategy, 4000);
  const operatorNotes = normalizeText(input.operatorNotes, 2000);
  if (!recommendedStrategy && !operatorNotes) {
    throw new Error("Add a strategy edit or operator note before saving.");
  }

  const editedAt = new Date().toISOString();
  const planJson: CandidateLaunchPlanOutput = {
    ...plan.planJson,
    recommended_strategy: recommendedStrategy ?? plan.planJson.recommended_strategy,
    compliance_notes: Array.from(
      new Set([
        ...(plan.planJson.compliance_notes ?? []),
        "Plan was edited by an operator; human approval is required again before proposal, outreach, creative, or production handoff.",
      ]),
    ),
    next_best_actions: [
      "Review saved operator edits and re-approve before any client-facing use.",
      ...(plan.planJson.next_best_actions ?? []).filter(
        (item) => item !== "Review saved operator edits and re-approve before any client-facing use.",
      ),
    ],
  };

  const updated = await supabase
    .from("political_mail_launch_plans")
    .update({
      status: "needs_review",
      plan_json: {
        ...planJson,
        operator_edit: {
          edited_at: editedAt,
          edited_by: actorUserId ?? null,
          notes: operatorNotes,
        },
      },
      recommended_strategy: recommendedStrategy ?? plan.recommendedStrategy,
      compliance_notes: planJson.compliance_notes,
      human_approved_at: null,
      human_approved_by: null,
      updated_at: editedAt,
    })
    .eq("id", plan.id)
    .select(PLAN_COLUMNS)
    .single();
  if (updated.error) throwIfSchemaMissing(updated.error);

  await updateAgent(supabase, plan.agentId, {
    status: "plan_ready",
    current_task: "Operator edits saved; plan needs human re-approval",
    last_action: "Launch plan edited",
    queue_count: Math.max(1, plan.planJson.next_best_actions?.length ?? 1),
  });
  await logActivity(supabase, {
    agentId: plan.agentId,
    candidateId: plan.candidateId,
    campaignId: plan.campaignId,
    activityType: "plan_edited",
    message: "Launch plan edits saved. Prior approval was reset and re-review is required.",
    payload: {
      planId: plan.id,
      recommendedStrategyEdited: Boolean(recommendedStrategy),
      operatorNotesPresent: Boolean(operatorNotes),
    },
    actorUserId,
  });

  revalidatePath("/admin/political");
  revalidatePath("/admin/political/candidate-agent");
  revalidatePath(`/admin/political/${plan.candidateId}`);
  return rowToPlan(updated.data);
}

export async function markCandidatePlanProductionReady(
  planId: string,
  actorUserId?: string | null,
): Promise<CandidateLaunchPlanRow> {
  const supabase = (await createClient()) as SupabaseLooseClient;
  const existing = await supabase
    .from("political_mail_launch_plans")
    .select(PLAN_COLUMNS)
    .eq("id", planId)
    .single();
  if (existing.error) throwIfSchemaMissing(existing.error);
  const plan = rowToPlan(existing.data);
  if (plan.status !== "approved" && plan.status !== "proposal_ready") {
    throw new Error("Plan must be human-approved before production queue staging.");
  }
  const updated = await supabase
    .from("political_mail_launch_plans")
    .update({ status: "production_ready", updated_at: new Date().toISOString() })
    .eq("id", planId)
    .select(PLAN_COLUMNS)
    .single();
  if (updated.error) throwIfSchemaMissing(updated.error);
  await updateAgent(supabase, plan.agentId, {
    status: "production_ready",
    current_task: "Production queue staging complete; payment/design checks remain required",
    last_action: "Marked production ready",
  });
  await logActivity(supabase, {
    agentId: plan.agentId,
    candidateId: plan.candidateId,
    campaignId: plan.campaignId,
    activityType: "production_ready",
    message: "Plan staged as production-ready after human approval. Payment/design checks still apply.",
    payload: { planId },
    actorUserId,
  });
  revalidatePath("/admin/political/candidate-agent");
  revalidatePath(`/admin/political/${plan.candidateId}`);
  return rowToPlan(updated.data);
}

export async function loadCandidateAgentDashboard(limit = 80): Promise<CandidateAgentDashboard> {
  const candidates = await loadCandidates({}, limit);
  const fallback: CandidateAgentDashboard = {
    schemaReady: false,
    migrationHint: "Run supabase migration 089_political_candidate_launch_agents.sql to enable the launch-agent tables.",
    rows: candidates.map((candidate) => ({
      candidate,
      agent: null,
      latestResearch: null,
      latestPlan: null,
      activity: [],
      nextAction: "Apply launch-agent migration",
    })),
    metrics: {
      candidates: candidates.length,
      agents: 0,
      researchComplete: 0,
      plansReady: 0,
      approvalsNeeded: 0,
      productionReady: 0,
    },
    guardrails: CANDIDATE_AGENT_GUARDRAILS,
  };

  if (candidates.length === 0) return { ...fallback, schemaReady: true, migrationHint: null };
  const ids = candidates.map((candidate) => candidate.id);
  const supabase = (await createClient()) as SupabaseLooseClient;

  const agentsQuery = await supabase
    .from("political_candidate_agents")
    .select(AGENT_COLUMNS)
    .in("candidate_id", ids);
  if (agentsQuery.error) {
    if (isSchemaMissingError(agentsQuery.error)) return fallback;
    throw agentsQuery.error;
  }

  const researchesQuery = await supabase
    .from("political_candidate_research")
    .select(RESEARCH_COLUMNS)
    .in("candidate_id", ids)
    .order("generated_at", { ascending: false })
    .limit(limit * 3);
  if (researchesQuery.error) throwIfSchemaMissing(researchesQuery.error);

  const plansQuery = await supabase
    .from("political_mail_launch_plans")
    .select(PLAN_COLUMNS)
    .in("candidate_id", ids)
    .order("created_at", { ascending: false })
    .limit(limit * 3);
  if (plansQuery.error) throwIfSchemaMissing(plansQuery.error);

  const activityQuery = await supabase
    .from("political_agent_activity_log")
    .select(ACTIVITY_COLUMNS)
    .in("candidate_id", ids)
    .order("created_at", { ascending: false })
    .limit(limit * 4);
  if (activityQuery.error) throwIfSchemaMissing(activityQuery.error);

  const agentByCandidate = new Map<string, CandidateAgentRow>();
  for (const row of (agentsQuery.data ?? []) as any[]) {
    if (!agentByCandidate.has(row.candidate_id)) agentByCandidate.set(row.candidate_id, rowToAgent(row));
  }
  const researchByCandidate = new Map<string, CandidateResearchRow>();
  for (const row of (researchesQuery.data ?? []) as any[]) {
    if (!researchByCandidate.has(row.candidate_id)) researchByCandidate.set(row.candidate_id, rowToResearch(row));
  }
  const planByCandidate = new Map<string, CandidateLaunchPlanRow>();
  for (const row of (plansQuery.data ?? []) as any[]) {
    if (!planByCandidate.has(row.candidate_id)) planByCandidate.set(row.candidate_id, rowToPlan(row));
  }
  const activityByCandidate = new Map<string, CandidateAgentActivity[]>();
  for (const row of (activityQuery.data ?? []) as any[]) {
    const activity = rowToActivity(row);
    const list = activityByCandidate.get(row.candidate_id) ?? [];
    if (list.length < 4) list.push(activity);
    activityByCandidate.set(row.candidate_id, list);
  }

  const rows = candidates.map((candidate) => {
    const agent = agentByCandidate.get(candidate.id) ?? null;
    const latestResearch = researchByCandidate.get(candidate.id) ?? null;
    const latestPlan = planByCandidate.get(candidate.id) ?? null;
    return {
      candidate,
      agent,
      latestResearch,
      latestPlan,
      activity: activityByCandidate.get(candidate.id) ?? [],
      nextAction: latestPlan
        ? latestPlan.status === "needs_review"
          ? "Review and approve plan"
          : latestPlan.status === "approved"
            ? "Generate proposal draft"
            : "Monitor production/payment readiness"
        : latestResearch
          ? "Generate multi-phase plan"
          : agent
            ? "Run candidate research"
            : "Assign launch agent",
    };
  });

  return {
    schemaReady: true,
    migrationHint: null,
    rows,
    metrics: {
      candidates: candidates.length,
      agents: rows.filter((row) => row.agent).length,
      researchComplete: rows.filter((row) => row.latestResearch).length,
      plansReady: rows.filter((row) => row.latestPlan).length,
      approvalsNeeded: rows.filter((row) => row.latestPlan?.status === "needs_review").length,
      productionReady: rows.filter((row) => row.latestPlan?.status === "production_ready").length,
    },
    guardrails: CANDIDATE_AGENT_GUARDRAILS,
  };
}

export async function loadCandidateAgentWorkspace(
  candidateId: string,
): Promise<CandidateAgentWorkspace> {
  const candidate = await loadCandidate(candidateId);
  if (!candidate) {
    return {
      schemaReady: true,
      migrationHint: null,
      candidate: null,
      campaigns: [],
      agent: null,
      latestResearch: null,
      latestPlan: null,
      phases: [],
      activity: [],
      guardrails: CANDIDATE_AGENT_GUARDRAILS,
    };
  }
  const campaigns = await loadCampaignsForCandidate(candidateId);
  const supabase = (await createClient()) as SupabaseLooseClient;
  try {
    const campaign = campaigns[0] ?? null;
    let q = supabase
      .from("political_candidate_agents")
      .select(AGENT_COLUMNS)
      .eq("candidate_id", candidateId)
      .order("created_at", { ascending: true })
      .limit(1);
    q = campaign ? q.eq("campaign_id", campaign.id) : q.is("campaign_id", null);
    const agentQuery = await q.maybeSingle();
    if (agentQuery.error) throwIfSchemaMissing(agentQuery.error);
    const latestPlan = await latestPlanForCandidate(supabase, candidateId);
    return {
      schemaReady: true,
      migrationHint: null,
      candidate,
      campaigns,
      agent: agentQuery.data ? rowToAgent(agentQuery.data) : null,
      latestResearch: await latestResearchForCandidate(supabase, candidateId),
      latestPlan,
      phases: await loadPhasesForPlan(supabase, latestPlan?.id ?? null),
      activity: await loadActivityForCandidate(supabase, candidateId, 12),
      guardrails: CANDIDATE_AGENT_GUARDRAILS,
    };
  } catch (error) {
    if (!isSchemaMissingError(error)) throw error;
    return {
      schemaReady: false,
      migrationHint: "Run supabase migration 089_political_candidate_launch_agents.sql to enable this workspace.",
      candidate,
      campaigns,
      agent: null,
      latestResearch: null,
      latestPlan: null,
      phases: [],
      activity: [],
      guardrails: CANDIDATE_AGENT_GUARDRAILS,
    };
  }
}

export async function generateCandidateProposalDraft(candidateId: string): Promise<{
  subject: string;
  body: string;
  bullets: string[];
}> {
  const workspace = await loadCandidateAgentWorkspace(candidateId);
  if (!workspace.candidate || !workspace.latestPlan) {
    throw new Error("Generate a launch plan before drafting a proposal.");
  }
  const plan = workspace.latestPlan.planJson;
  const cost = workspace.latestPlan.totalEstimatedCostCents / 100;
  return {
    subject: `${workspace.candidate.candidateName} postcard launch plan`,
    body: [
      `I put together a geography-first postcard launch plan for ${workspace.candidate.candidateName}.`,
      `The current recommendation covers ${workspace.latestPlan.totalHouseholds.toLocaleString()} estimated households per phase with ${plan.phases.length} mail phases.`,
      `Estimated total investment is about ${cost.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}, with postcard pricing capped at roughly $0.70 per piece before optional add-ons.`,
      "Before this becomes client-facing, we should verify USPS route counts, public source freshness, disclaimer language, and creative approval.",
    ].join("\n\n"),
    bullets: [
      "Geography-only planning, no individual voter scoring.",
      `${plan.phases.length} recommended postcard phases.`,
      `${workspace.latestPlan.confidenceScore}% planning confidence.`,
      "Human approval required before send or production handoff.",
    ],
  };
}

export async function generateSalesFollowUpDraft(candidateId: string): Promise<{
  channel: "email";
  subject: string;
  body: string;
}> {
  const workspace = await loadCandidateAgentWorkspace(candidateId);
  if (!workspace.candidate) throw new Error("Candidate not found.");
  const plan = workspace.latestPlan;
  return {
    channel: "email",
    subject: plan
      ? `Next step: approve ${workspace.candidate.candidateName}'s postcard launch plan`
      : `Next step: build ${workspace.candidate.candidateName}'s postcard launch plan`,
    body: plan
      ? `I have a ${plan.planJson.phases.length}-phase postcard plan ready for review. The next best step is to verify route counts, approve the compliance checklist, and turn it into a client-facing proposal draft.`
      : "The Candidate Launch Agent is ready to research the public campaign record and build a multi-phase postcard plan. I recommend running research first, then generating the plan from the verified geography.",
  };
}

export function candidateLaunchAgentFeatureReady(): boolean {
  return isPoliticalEnabled() && isCandidateLaunchAgentEnabled();
}
