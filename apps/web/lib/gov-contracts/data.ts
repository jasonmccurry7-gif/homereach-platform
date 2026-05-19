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

type AnyRow = Record<string, any>;

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

function locationFromRow(row: AnyRow) {
  const place = (row.place_of_performance ?? {}) as Record<string, any>;
  const fallbackLabel = [place.city, place.state, place.zip].filter(Boolean).join(", ");
  return {
    city: place.city ?? null,
    state: place.state ?? null,
    zip: place.zip ?? null,
    country: place.country ?? "USA",
    label: place.label ?? (fallbackLabel || "Place of performance not listed"),
  };
}

export function normalizeGovContractRow(row: AnyRow): GovContractOpportunity {
  const location = locationFromRow(row);
  const summary =
    row.ai_summary?.plain_english ??
    row.ai_summary?.summary ??
    "Review official solicitation details, attachments, deadlines, and compliance requirements before any pursuit decision.";

  const scored = scoreGovContractOpportunity({
    title: row.title ?? "Untitled opportunity",
    agency: row.agency,
    noticeType: row.notice_type,
    naicsCode: row.naics_code,
    pscCode: row.psc_code,
    setAsideDescription: row.set_aside_description,
    dueDate: isoOrNull(row.response_deadline),
    estimatedValueCents: moneyCents(row.estimated_value_cents),
    locationState: location.state,
    summary,
  });

  const opportunity: GovContractOpportunity = {
    id: String(row.id),
    sourceSystem: row.source_system === "sam.gov" ? "sam.gov" : "manual",
    sourceId: String(row.source_id ?? row.id),
    sourceUrl: row.source_url ?? null,
    title: row.title ?? "Untitled opportunity",
    agency: row.agency ?? "Agency not listed",
    department: row.department ?? null,
    office: row.office ?? null,
    solicitationNumber: row.solicitation_number ?? null,
    noticeType: row.notice_type ?? "Notice",
    baseNoticeType: row.base_notice_type ?? null,
    postedDate: isoOrNull(row.posted_date),
    dueDate: isoOrNull(row.response_deadline),
    questionsDeadline: isoOrNull(row.questions_deadline),
    siteVisitAt: isoOrNull(row.site_visit_at),
    naicsCode: row.naics_code ?? null,
    pscCode: row.psc_code ?? null,
    setAsideCode: row.set_aside_code ?? null,
    setAsideDescription: row.set_aside_description ?? null,
    estimatedValueCents: moneyCents(row.estimated_value_cents),
    awardAmountCents: moneyCents(row.award_amount_cents),
    location,
    pipelineStatus: (row.pipeline_status ?? "new") as GovContractPipelineStatus,
    fitStatus: row.fit_status ?? scored.fitStatus,
    fitScore: Number(row.fit_score ?? scored.fitScore),
    riskScore: Number(row.risk_score ?? scored.riskScore),
    urgencyScore: Number(row.urgency_score ?? scored.urgencyScore),
    urgency: scored.urgency,
    scoreBreakdown: row.score_breakdown ?? scored.scoreBreakdown,
    recommendedNextAction: row.recommended_next_action ?? "",
    scoringReason: row.scoring_reason ?? scored.scoringReason,
    summary,
    complianceNotes: row.ai_summary?.compliance_notes ?? [
      "AI score is advisory only.",
      "Human approval is required before pricing, certification claims, subcontractor commitments, or bid submission.",
    ],
    attachments: Array.isArray(row.attachments) ? row.attachments : [],
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
  const filtered = opportunities.filter((o) => {
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

  return [...filtered].sort((a, b) => {
    switch (filters.sort) {
      case "due":
        return new Date(a.dueDate ?? "2999-01-01").getTime() - new Date(b.dueDate ?? "2999-01-01").getTime();
      case "urgency":
        return b.urgencyScore - a.urgencyScore;
      case "value":
        return (b.estimatedValueCents ?? 0) - (a.estimatedValueCents ?? 0);
      case "agency":
        return a.agency.localeCompare(b.agency);
      case "status":
        return a.pipelineStatus.localeCompare(b.pipelineStatus);
      case "fit":
      default:
        return b.fitScore - a.fitScore;
    }
  });
}

function buildSummary(opportunities: GovContractOpportunity[]): GovContractDashboardData["summary"] {
  return {
    newOpportunities: opportunities.filter((o) => o.pipelineStatus === "new").length,
    strongFit: opportunities.filter((o) => o.fitStatus === "strong_fit").length,
    deadlinesThisWeek: opportunities.filter((o) => o.urgency === "high" || o.urgency === "critical").length,
    bidsInProgress: opportunities.filter((o) => ["reviewing", "strong_fit", "need_subcontractor", "bid_prep", "awaiting_approval"].includes(o.pipelineStatus)).length,
    submittedBids: opportunities.filter((o) => o.pipelineStatus === "submitted").length,
    awardedBids: opportunities.filter((o) => o.pipelineStatus === "awarded").length,
    estimatedPipelineValueCents: opportunities.reduce((sum, o) => sum + (o.estimatedValueCents ?? 0), 0),
    pendingApprovals: opportunities.filter((o) => o.pipelineStatus === "awaiting_approval").length,
    missingDocuments: opportunities.reduce((sum, o) => sum + o.missingItems.length, 0),
    requiredActionsToday: opportunities.filter((o) => o.urgency === "critical" || o.pipelineStatus === "awaiting_approval").length,
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
        databaseReady: true,
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
        configured: Boolean(process.env.SAM_GOV_API_KEY),
        databaseReady: false,
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
