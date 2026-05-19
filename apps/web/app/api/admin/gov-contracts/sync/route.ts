import { NextResponse } from "next/server";
import { requireAdminOrCron } from "@/lib/auth/api-guards";
import { createServiceClient } from "@/lib/supabase/service";
import { buildSamGovFocusQueries, isGovContractFocus } from "@/lib/gov-contracts/focus";
import { searchSamGovOpportunities } from "@/lib/gov-contracts/sam-gov";
import { logGovContractAuditEvent } from "@/lib/gov-contracts/data";
import type { GovContractOpportunity } from "@/lib/gov-contracts/types";

function hasSupabaseServiceEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function GET(req: Request) {
  const guard = await requireAdminOrCron(req);
  if (!guard.ok) return guard.response;

  return NextResponse.json({
    ok: true,
    samConfigured: Boolean(process.env.SAM_GOV_API_KEY),
    databaseConfigured: hasSupabaseServiceEnv(),
    message: process.env.SAM_GOV_API_KEY
      ? "SAM.gov sync is configured."
      : "SAM_GOV_API_KEY is required before live opportunity sync can run.",
  });
}

export async function POST(req: Request) {
  const guard = await requireAdminOrCron(req);
  if (!guard.ok) return guard.response;

  if (!process.env.SAM_GOV_API_KEY) {
    return NextResponse.json(
      {
        ok: false,
        error: "SAM_GOV_API_KEY is not configured. Add it in Vercel before running live SAM.gov sync.",
      },
      { status: 503 }
    );
  }

  if (!hasSupabaseServiceEnv()) {
    return NextResponse.json(
      {
        ok: false,
        error: "Supabase service credentials are not configured, so synced opportunities cannot be stored.",
      },
      { status: 503 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    keyword?: string;
    state?: string;
    naics?: string;
    psc?: string;
    setAside?: string;
    noticeType?: string;
    focus?: string;
    limit?: number;
  };

  const supabase = createServiceClient();
  const runStartedAt = new Date().toISOString();
  const { data: syncRun, error: syncRunError } = await supabase
    .from("gov_contract_sync_runs")
    .insert({
      source_system: "sam.gov",
      status: "running",
      started_at: runStartedAt,
      query: body,
      message: "SAM.gov sync started.",
    })
    .select("id")
    .maybeSingle();

  if (syncRunError) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Gov Contracts database tables are not available yet. Apply migration 096_gov_contracts_command_center.sql before running live SAM.gov sync.",
      },
      { status: 503 }
    );
  }

  const focus = isGovContractFocus(body.focus) ? body.focus : undefined;
  const focusQueries = buildSamGovFocusQueries(focus, {
    keyword: body.keyword,
    state: body.state,
    psc: body.psc,
    setAside: body.setAside,
    noticeType: body.noticeType,
    limit: body.limit ?? (focus ? 30 : 50),
  });
  const queries =
    focusQueries.length > 0
      ? focusQueries
      : [
          {
            keyword: body.keyword,
            state: body.state,
            naics: body.naics,
            psc: body.psc,
            setAside: body.setAside,
            noticeType: body.noticeType,
            limit: body.limit ?? 50,
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
    return NextResponse.json({ ok: false, error: firstFailure.error }, { status: firstFailure.status });
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

  if (syncRun?.id) {
    await supabase
      .from("gov_contract_sync_runs")
      .update({
        status: failed > 0 ? "partial" : "synced",
        finished_at: new Date().toISOString(),
        records_seen: opportunities.length,
        records_upserted: upserted,
        records_failed: failed,
        message: `SAM.gov${focus ? ` ${focus.replace("_", " ")}` : ""} sync complete: ${upserted} stored, ${failed} failed.`,
        raw_response: rawResponses.length === 1 ? rawResponses[0] : { focus, query_count: queries.length, responses: rawResponses },
      })
      .eq("id", syncRun.id);
  }

  await logGovContractAuditEvent({
    eventType: "sam_sync_completed",
    summary: `SAM.gov${focus ? ` ${focus.replace("_", " ")}` : ""} sync complete: ${upserted} stored, ${failed} failed.`,
    metadata: { focus, recordsSeen: opportunities.length, recordsUpserted: upserted, recordsFailed: failed, queryCount: queries.length },
  });

  return NextResponse.json({
    ok: true,
    focus,
    recordsSeen: opportunities.length,
    recordsUpserted: upserted,
    recordsFailed: failed,
  });
}
