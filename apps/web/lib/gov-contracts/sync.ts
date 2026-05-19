import { createServiceClient } from "@/lib/supabase/service";
import { buildSamGovFocusQueries, isGovContractFocus } from "./focus";
import { searchSamGovOpportunities } from "./sam-gov";
import { logGovContractAuditEvent } from "./data";
import type { GovContractFocus, GovContractOpportunity } from "./types";

export interface GovContractsSamSyncInput {
  keyword?: string;
  state?: string;
  naics?: string;
  psc?: string;
  setAside?: string;
  noticeType?: string;
  focus?: string;
  limit?: number;
  source?: "manual" | "cron_home_services" | string;
}

export interface GovContractsSamSyncResult {
  ok: boolean;
  status: number;
  error?: string;
  focus?: GovContractFocus;
  recordsSeen?: number;
  recordsUpserted?: number;
  recordsFailed?: number;
  queryCount?: number;
  strongFitCount?: number;
  homeServicesCount?: number;
}

function hasSupabaseServiceEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function focusLabel(focus?: GovContractFocus) {
  return focus ? ` ${focus.replace("_", " ")}` : "";
}

export function getGovContractsSyncReadiness() {
  return {
    samConfigured: Boolean(process.env.SAM_GOV_API_KEY),
    databaseConfigured: hasSupabaseServiceEnv(),
  };
}

export async function runGovContractsSamSync(input: GovContractsSamSyncInput = {}): Promise<GovContractsSamSyncResult> {
  if (!process.env.SAM_GOV_API_KEY) {
    return {
      ok: false,
      status: 503,
      error: "SAM_GOV_API_KEY is not configured. Add it in Vercel before running live SAM.gov sync.",
    };
  }

  if (!hasSupabaseServiceEnv()) {
    return {
      ok: false,
      status: 503,
      error: "Supabase service credentials are not configured, so synced opportunities cannot be stored.",
    };
  }

  const supabase = createServiceClient();
  const focus = isGovContractFocus(input.focus) ? input.focus : undefined;
  const runStartedAt = new Date().toISOString();
  const syncQuery = {
    ...input,
    focus,
    limit: input.limit ?? (focus ? 30 : 50),
  };

  const { data: syncRun, error: syncRunError } = await supabase
    .from("gov_contract_sync_runs")
    .insert({
      source_system: "sam.gov",
      status: "running",
      started_at: runStartedAt,
      query: syncQuery,
      message: "SAM.gov sync started.",
    })
    .select("id")
    .maybeSingle();

  if (syncRunError) {
    return {
      ok: false,
      status: 503,
      error:
        "Gov Contracts database tables are not available yet. Apply migration 096_gov_contracts_command_center.sql before running live SAM.gov sync.",
    };
  }

  const focusQueries = buildSamGovFocusQueries(focus, {
    keyword: input.keyword,
    state: input.state,
    psc: input.psc,
    setAside: input.setAside,
    noticeType: input.noticeType,
    limit: input.limit ?? (focus ? 30 : 50),
  });
  const queries =
    focusQueries.length > 0
      ? focusQueries
      : [
          {
            keyword: input.keyword,
            state: input.state,
            naics: input.naics,
            psc: input.psc,
            setAside: input.setAside,
            noticeType: input.noticeType,
            limit: input.limit ?? 50,
          },
        ];

  const seen = new Map<string, GovContractOpportunity>();
  const rawResponses: unknown[] = [];
  const failures: Array<{ status: number; error: string }> = [];

  for (const query of queries) {
    const result = await searchSamGovOpportunities(query);
    if (!result.ok) {
      failures.push({ status: result.status, error: result.error });
      continue;
    }
    rawResponses.push(result.raw ?? null);
    for (const opportunity of result.opportunities) {
      seen.set(`${opportunity.sourceSystem}:${opportunity.sourceId}`, opportunity);
    }
  }

  if (seen.size === 0 && failures.length > 0) {
    const firstFailure = failures[0]!;
    if (syncRun?.id) {
      await supabase
        .from("gov_contract_sync_runs")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          message: firstFailure.error,
          error: { failures },
        })
        .eq("id", syncRun.id);
    }
    return { ok: false, status: firstFailure.status, error: firstFailure.error };
  }

  const opportunities = [...seen.values()];
  let upserted = 0;
  let failed = 0;

  for (const opportunity of opportunities) {
    const { error } = await supabase.from("gov_contract_opportunities").upsert(
      {
        source_system: "sam.gov",
        source_id: opportunity.sourceId,
        source_url: opportunity.sourceUrl,
        title: opportunity.title,
        agency: opportunity.agency,
        department: opportunity.department,
        office: opportunity.office,
        solicitation_number: opportunity.solicitationNumber,
        notice_type: opportunity.noticeType,
        base_notice_type: opportunity.baseNoticeType,
        posted_date: opportunity.postedDate,
        response_deadline: opportunity.dueDate,
        questions_deadline: opportunity.questionsDeadline,
        site_visit_at: opportunity.siteVisitAt,
        naics_code: opportunity.naicsCode,
        psc_code: opportunity.pscCode,
        set_aside_code: opportunity.setAsideCode,
        set_aside_description: opportunity.setAsideDescription,
        place_of_performance: opportunity.location,
        estimated_value_cents: opportunity.estimatedValueCents,
        award_amount_cents: opportunity.awardAmountCents,
        fit_status: opportunity.fitStatus,
        fit_score: opportunity.fitScore,
        risk_score: opportunity.riskScore,
        urgency_score: opportunity.urgencyScore,
        score_breakdown: opportunity.scoreBreakdown,
        recommended_next_action: opportunity.recommendedNextAction,
        scoring_reason: opportunity.scoringReason,
        ai_summary: {
          plain_english: opportunity.summary,
          compliance_notes: opportunity.complianceNotes,
          missing_items: opportunity.missingItems,
        },
        attachments: opportunity.attachments,
        raw_source: opportunity,
        sync_status: "synced",
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: "source_system,source_id" }
    );

    if (error) failed += 1;
    else upserted += 1;
  }

  const message = `SAM.gov${focusLabel(focus)} sync complete: ${upserted} stored, ${failed} failed.`;
  const strongFitCount = opportunities.filter((opportunity) => opportunity.fitStatus === "strong_fit").length;
  const homeServicesCount = opportunities.filter((opportunity) =>
    ["238220", "561730", "238160"].includes(opportunity.naicsCode ?? "")
  ).length;

  if (syncRun?.id) {
    await supabase
      .from("gov_contract_sync_runs")
      .update({
        status: failed > 0 ? "partial" : "synced",
        finished_at: new Date().toISOString(),
        records_seen: opportunities.length,
        records_upserted: upserted,
        records_failed: failed,
        message,
        raw_response: rawResponses.length === 1 ? rawResponses[0] : { focus, query_count: queries.length, responses: rawResponses },
      })
      .eq("id", syncRun.id);
  }

  await logGovContractAuditEvent({
    eventType: "sam_sync_completed",
    summary: message,
    metadata: {
      focus,
      source: input.source ?? "manual",
      recordsSeen: opportunities.length,
      recordsUpserted: upserted,
      recordsFailed: failed,
      queryCount: queries.length,
      strongFitCount,
      homeServicesCount,
    },
  });

  return {
    ok: true,
    status: 200,
    focus,
    recordsSeen: opportunities.length,
    recordsUpserted: upserted,
    recordsFailed: failed,
    queryCount: queries.length,
    strongFitCount,
    homeServicesCount,
  };
}
