import { NextResponse } from "next/server";
import { requireAdminOrCron } from "@/lib/auth/api-guards";
import { createServiceClient } from "@/lib/supabase/service";
import { searchSamGovOpportunities } from "@/lib/gov-contracts/sam-gov";
import { logGovContractAuditEvent } from "@/lib/gov-contracts/data";

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
    limit?: number;
  };

  const supabase = createServiceClient();
  const runStartedAt = new Date().toISOString();
  const { data: syncRun } = await supabase
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

  const result = await searchSamGovOpportunities({
    keyword: body.keyword,
    state: body.state,
    naics: body.naics,
    psc: body.psc,
    setAside: body.setAside,
    noticeType: body.noticeType,
    limit: body.limit ?? 50,
  });

  if (!result.ok) {
    if (syncRun?.id) {
      await supabase
        .from("gov_contract_sync_runs")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          message: result.error,
          error: { status: result.status, message: result.error },
        })
        .eq("id", syncRun.id);
    }
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  let upserted = 0;
  let failed = 0;

  for (const opportunity of result.opportunities) {
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
        records_seen: result.opportunities.length,
        records_upserted: upserted,
        records_failed: failed,
        message: `SAM.gov sync complete: ${upserted} stored, ${failed} failed.`,
        raw_response: result.raw ?? null,
      })
      .eq("id", syncRun.id);
  }

  await logGovContractAuditEvent({
    eventType: "sam_sync_completed",
    summary: `SAM.gov sync complete: ${upserted} stored, ${failed} failed.`,
    metadata: { recordsSeen: result.opportunities.length, recordsUpserted: upserted, recordsFailed: failed },
  });

  return NextResponse.json({
    ok: true,
    recordsSeen: result.opportunities.length,
    recordsUpserted: upserted,
    recordsFailed: failed,
  });
}
