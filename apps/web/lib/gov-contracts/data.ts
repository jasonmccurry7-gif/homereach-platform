import { createServiceClient } from "@/lib/supabase/service";
import { buildSampleGovContractsDashboard, SAMPLE_GOV_CONTRACT_OPPORTUNITIES } from "./sample-data";
import { recommendedActionFor, scoreGovContractOpportunity } from "./scoring";
import type {
  GovContractDashboardData,
  GovContractDashboardFilters,
  GovContractOpportunity,
  GovContractPipelineStatus,
  GovContractAuditEventInput,
} from "./types";

type AnyRow = Record<string, unknown>;

function hasSupabaseServiceEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function moneyCents(value: unknown) {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function isoOrNull(value: unknown) {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function rowObject(value: unknown): AnyRow {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as AnyRow) : {};
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function stringOr(value: unknown, fallback: string) {
  return stringOrNull(value) ?? fallback;
}

function locationFromRow(row: AnyRow) {
  const place = rowObject(row.place_of_performance);
  const city = stringOrNull(place.city);
  const state = stringOrNull(place.state);
  const zip = stringOrNull(place.zip);
  return {
    city,
    state,
    zip,
    country: stringOr(place.country, "USA"),
    label: stringOrNull(place.label) ?? ([city, state, zip].filter(Boolean).join(", ") || "Place of performance not listed"),
  };
}

export function normalizeGovContractRow(row: AnyRow): GovContractOpportunity {
  const location = locationFromRow(row);
  const aiSummary = rowObject(row.ai_summary);
  const summary =
    stringOrNull(aiSummary.plain_english) ??
    stringOrNull(aiSummary.summary) ??
    "Review official solicitation details, attachments, deadlines, and compliance requirements before any pursuit decision.";

  const scored = scoreGovContractOpportunity({
    title: stringOr(row.title, "Untitled opportunity"),
    agency: stringOrNull(row.agency),
    noticeType: stringOrNull(row.notice_type),
    naicsCode: stringOrNull(row.naics_code),
    pscCode: stringOrNull(row.psc_code),
    setAsideDescription: stringOrNull(row.set_aside_description),
    dueDate: isoOrNull(row.response_deadline),
    estimatedValueCents: moneyCents(row.estimated_value_cents),
    locationState: location.state,
    summary,
  });

  const opportunity: GovContractOpportunity = {
    id: String(row.id),
    sourceSystem: row.source_system === "sam.gov" ? "sam.gov" : "manual",
    sourceId: String(row.source_id ?? row.id),
    sourceUrl: stringOrNull(row.source_url),
    title: stringOr(row.title, "Untitled opportunity"),
    agency: stringOr(row.agency, "Agency not listed"),
    department: stringOrNull(row.department),
    office: stringOrNull(row.office),
    solicitationNumber: stringOrNull(row.solicitation_number),
    noticeType: stringOr(row.notice_type, "Notice"),
    baseNoticeType: stringOrNull(row.base_notice_type),
    contractType: stringOrNull(row.contract_type),
    responseMethod: stringOrNull(row.response_method),
    incumbentVendor: stringOrNull(row.incumbent_vendor),
    postedDate: isoOrNull(row.posted_date),
    dueDate: isoOrNull(row.response_deadline),
    questionsDeadline: isoOrNull(row.questions_deadline),
    siteVisitAt: isoOrNull(row.site_visit_at),
    naicsCode: stringOrNull(row.naics_code),
    pscCode: stringOrNull(row.psc_code),
    setAsideCode: stringOrNull(row.set_aside_code),
    setAsideDescription: stringOrNull(row.set_aside_description),
    estimatedValueCents: moneyCents(row.estimated_value_cents),
    awardAmountCents: moneyCents(row.award_amount_cents),
    location,
    pipelineStatus: (row.pipeline_status ?? "new") as GovContractPipelineStatus,
    fitStatus: (stringOrNull(row.fit_status) ?? scored.fitStatus) as GovContractOpportunity["fitStatus"],
    fitScore: Number(row.fit_score ?? scored.fitScore),
    riskScore: Number(row.risk_score ?? scored.riskScore),
    urgencyScore: Number(row.urgency_score ?? scored.urgencyScore),
    urgency: scored.urgency,
    scoreBreakdown: Object.keys(rowObject(row.score_breakdown)).length
      ? (rowObject(row.score_breakdown) as unknown as GovContractOpportunity["scoreBreakdown"])
      : scored.scoreBreakdown,
    recommendedNextAction: stringOr(row.recommended_next_action, ""),
    scoringReason: stringOr(row.scoring_reason, scored.scoringReason),
    summary,
    complianceNotes: Array.isArray(aiSummary.compliance_notes) ? aiSummary.compliance_notes.map(String) : [
      "AI score is advisory only.",
      "Human approval is required before pricing, certification claims, subcontractor commitments, or bid submission.",
    ],
    attachments: Array.isArray(row.attachments) ? (row.attachments as GovContractOpportunity["attachments"]) : [],
    requiredDocuments: Array.isArray(row.required_documents)
      ? row.required_documents.map((item: unknown) => String(item))
      : [],
    submissionInstructions:
      row.submission_instructions && typeof row.submission_instructions === "object"
        ? (row.submission_instructions as Record<string, unknown>)
        : {},
    amendmentCount: Array.isArray(row.amendments) ? row.amendments.length : 0,
    missingItems: scored.missingItems,
    lastSyncedAt: isoOrNull(row.last_synced_at),
    isSample: false,
  };

  return {
    ...opportunity,
    recommendedNextAction: opportunity.recommendedNextAction || recommendedActionFor(opportunity),
  };
}

function applyFilters(opportunities: GovContractOpportunity[], filters: GovContractDashboardFilters) {
  return opportunities.filter((o) => {
    const haystack = [o.title, o.agency, o.department, o.office, o.solicitationNumber, o.summary]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (filters.keyword && !haystack.includes(filters.keyword.toLowerCase())) return false;
    if (filters.naics && o.naicsCode !== filters.naics) return false;
    if (filters.psc && o.pscCode !== filters.psc) return false;
    if (filters.agency && !o.agency.toLowerCase().includes(filters.agency.toLowerCase())) return false;
    if (filters.state && o.location.state?.toLowerCase() !== filters.state.toLowerCase()) return false;
    if (filters.setAside && o.setAsideCode !== filters.setAside) return false;
    if (filters.noticeType && !o.noticeType.toLowerCase().includes(filters.noticeType.toLowerCase())) return false;
    if (filters.status && filters.status !== "all" && o.pipelineStatus !== filters.status) return false;
    return true;
  });
}

function buildSummary(opportunities: GovContractOpportunity[]): GovContractDashboardData["summary"] {
  const estimatedPipelineValueCents = opportunities.reduce((sum, o) => sum + (o.estimatedValueCents ?? 0), 0);
  return {
    newOpportunities: opportunities.filter((o) => o.pipelineStatus === "new").length,
    strongFit: opportunities.filter((o) => o.fitStatus === "strong_fit").length,
    deadlinesThisWeek: opportunities.filter((o) => o.urgency === "high" || o.urgency === "critical").length,
    bidsInProgress: opportunities.filter((o) => [
      "reviewing",
      "qualifying",
      "strong_fit",
      "need_subcontractor",
      "bid_prep",
      "waiting_on_documents",
      "waiting_on_subcontractor_quote",
      "pricing_review",
      "compliance_review",
      "awaiting_approval",
      "ready_for_approval",
      "ready_to_submit",
    ].includes(o.pipelineStatus)).length,
    submittedBids: opportunities.filter((o) => ["submitted", "under_evaluation"].includes(o.pipelineStatus)).length,
    awardedBids: opportunities.filter((o) => o.pipelineStatus === "awarded").length,
    estimatedPipelineValueCents,
    pendingApprovals: opportunities.filter((o) => o.pipelineStatus === "awaiting_approval").length,
    missingDocuments: opportunities.reduce((sum, o) => sum + o.missingItems.length, 0),
    requiredActionsToday: opportunities.filter((o) => o.urgency === "critical" || o.pipelineStatus === "awaiting_approval").length,
    expectedProfitCents: Math.round(estimatedPipelineValueCents * 0.18),
    complianceRisks: opportunities.filter((o) => o.riskScore >= 65 || o.missingItems.length >= 3).length,
    cashFlowExposureCents: opportunities.reduce((sum, o) => {
      const value = o.estimatedValueCents ?? 0;
      return sum + Math.round(value * (o.scoreBreakdown.subcontractability >= 68 ? 0.42 : 0.24));
    }, 0),
    activeSubcontractorNeeds: opportunities.filter((o) => o.scoreBreakdown.subcontractability >= 68 || o.pipelineStatus === "need_subcontractor").length,
  };
}

export async function loadGovContractDashboard(filters: GovContractDashboardFilters = {}): Promise<GovContractDashboardData> {
  if (!hasSupabaseServiceEnv()) {
    const sample = buildSampleGovContractsDashboard();
    return { ...sample, opportunities: applyFilters(sample.opportunities, filters), summary: buildSummary(applyFilters(sample.opportunities, filters)) };
  }

  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("gov_contract_opportunities")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) throw error;

    const opportunities = applyFilters((data ?? []).map(normalizeGovContractRow), filters);
    const { data: latestRun } = await supabase
      .from("gov_contract_sync_runs")
      .select("created_at,status,message")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      sourceLabel: "database",
      opportunities,
      summary: buildSummary(opportunities),
      sync: {
        configured: Boolean(process.env.SAM_GOV_API_KEY),
        status: process.env.SAM_GOV_API_KEY ? "ready" : "not_configured",
        lastRunAt: latestRun?.created_at ?? null,
        message:
          latestRun?.message ??
          (process.env.SAM_GOV_API_KEY
            ? "SAM.gov API key is configured. Use the sync API or cron to refresh opportunities."
            : "SAM_GOV_API_KEY is not configured yet. Dashboard is ready for manual records and sample fallback."),
      },
    };
  } catch {
    const sample = buildSampleGovContractsDashboard();
    const opportunities = applyFilters(sample.opportunities, filters);
    return {
      ...sample,
      opportunities,
      summary: buildSummary(opportunities),
      sync: {
        ...sample.sync,
        status: "sample_data",
        message:
          "Gov Contracts tables are not reachable yet, so this admin view is using clearly labeled sample planning records.",
      },
    };
  }
}

export async function loadGovContractOpportunity(id: string) {
  const sample = SAMPLE_GOV_CONTRACT_OPPORTUNITIES.find((o) => o.id === id || o.sourceId === id);
  if (!hasSupabaseServiceEnv()) return sample ?? null;

  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("gov_contract_opportunities")
      .select("*")
      .or(`id.eq.${id},source_id.eq.${id}`)
      .limit(1)
      .maybeSingle();

    if (error || !data) return sample ?? null;
    return normalizeGovContractRow(data);
  } catch {
    return sample ?? null;
  }
}

export async function logGovContractAuditEvent(input: GovContractAuditEventInput) {
  if (!hasSupabaseServiceEnv()) return { ok: true, persisted: false };
  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from("gov_contract_audit_logs").insert({
      opportunity_id: input.opportunityId ?? null,
      event_type: input.eventType,
      actor_id: input.actorId ?? null,
      summary: input.summary,
      metadata: input.metadata ?? {},
    });
    if (error) throw error;
    return { ok: true, persisted: true };
  } catch {
    return { ok: true, persisted: false };
  }
}
