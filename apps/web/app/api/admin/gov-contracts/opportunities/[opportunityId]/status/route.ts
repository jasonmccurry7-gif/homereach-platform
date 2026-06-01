import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api-guards";
import { createServiceClient } from "@/lib/supabase/service";
import { logPlatformAuditEvent } from "@/lib/audit/platform-audit";
import {
  syncGovContractBidRoomLedger,
  syncGovContractSubmissionPackageLedger,
} from "@/lib/approvals/gov-contracts-ledger";
import { logGovContractAuditEvent } from "@/lib/gov-contracts/data";
import { buildGovContractSubmissionSafetyReport, loadGovContractBidWorkspace } from "@/lib/gov-contracts/execution";
import type { GovContractPipelineStatus } from "@/lib/gov-contracts/types";

const VALID_STATUSES: GovContractPipelineStatus[] = [
  "discovered",
  "new",
  "saved",
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
  "submitted",
  "under_evaluation",
  "awarded",
  "lost",
  "no_bid",
  "cancelled",
  "archived",
];

const APPROVAL_GATED_STATUSES: GovContractPipelineStatus[] = [
  "ready_to_submit",
  "submitted",
  "under_evaluation",
  "awarded",
];

const EXTERNAL_EVIDENCE_STATUSES: GovContractPipelineStatus[] = [
  "submitted",
  "under_evaluation",
  "awarded",
];

function hasSupabaseServiceEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function isApprovalGatedStatus(status: GovContractPipelineStatus) {
  return APPROVAL_GATED_STATUSES.includes(status);
}

function requiresExternalEvidence(status: GovContractPipelineStatus) {
  return EXTERNAL_EVIDENCE_STATUSES.includes(status);
}

export async function POST(
  req: Request,
  context: { params: Promise<{ opportunityId: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { opportunityId } = await context.params;
  const decodedOpportunityId = decodeURIComponent(opportunityId);
  const body = (await req.json().catch(() => ({}))) as {
    status?: GovContractPipelineStatus;
    note?: string;
    approvalConfirmed?: boolean;
    externalSubmissionReference?: string;
    submissionReference?: string;
    awardReference?: string;
  };
  const note = body.note?.trim() ?? "";
  const externalReference =
    body.externalSubmissionReference?.trim() ||
    body.submissionReference?.trim() ||
    body.awardReference?.trim() ||
    "";

  if (!body.status || !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ ok: false, error: "Invalid pipeline status." }, { status: 400 });
  }

  const approvalGated = isApprovalGatedStatus(body.status);
  let workspaceOpportunity:
    | Awaited<ReturnType<typeof loadGovContractBidWorkspace>>["opportunity"]
    | null = null;

  if (approvalGated && (!body.approvalConfirmed || !note)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "This status requires explicit human approval and a note. The platform records approved status only; it does not submit bids, certify compliance, accept awards, or bind HomeReach.",
      },
      { status: 409 }
    );
  }

  if (approvalGated) {
    const { opportunity, workspace } = await loadGovContractBidWorkspace(decodedOpportunityId);
    workspaceOpportunity = opportunity;
    if (!opportunity || !workspace) {
      return NextResponse.json({ ok: false, error: "Bid workspace not found for approval-gated status." }, { status: 404 });
    }

    if (opportunity.isSample || !workspace.persisted || !hasSupabaseServiceEnv()) {
      const errorMessage =
        "Approval-gated statuses require a persisted database bid room. Sample or offline review records cannot be marked ready/submitted/awarded.";
      const blockers = [errorMessage];
      await logGovContractAuditEvent({
        opportunityId: opportunity.isSample ? null : opportunity.id,
        actorId: guard.user?.id,
        eventType: "pipeline_status_blocked",
        summary: `Pipeline status ${body.status} blocked by persistence gate.`,
        metadata: { status: body.status, note, blockers },
      });
      await logPlatformAuditEvent({
        actorType: "human",
        actorId: guard.user?.id ?? null,
        module: "government_contracts",
        actionType: "pipeline_status_blocked",
        entityType: "gov_contract_opportunity",
        entityId: opportunity.id,
        sourceTable: "gov_contract_opportunities",
        sourceId: opportunity.id,
        resultStatus: "blocked",
        approvalState: "needs_review",
        severity: "high",
        message: `Government contract status ${body.status} blocked by persistence gate.`,
        metadata: { status: body.status, note, blockers },
      });
      return NextResponse.json({ ok: false, error: errorMessage, blockers }, { status: 409 });
    }

    const safety = buildGovContractSubmissionSafetyReport(opportunity, workspace);
    if (!safety.ready) {
      await logGovContractAuditEvent({
        opportunityId: opportunity.id,
        actorId: guard.user?.id,
        eventType: "pipeline_status_blocked",
        summary: `Pipeline status ${body.status} blocked by bid readiness checks.`,
        metadata: { status: body.status, note, blockers: safety.blockers, warnings: safety.warnings },
      });
      await logPlatformAuditEvent({
        actorType: "human",
        actorId: guard.user?.id ?? null,
        module: "government_contracts",
        actionType: "pipeline_status_blocked",
        entityType: "gov_contract_opportunity",
        entityId: opportunity.id,
        sourceTable: "gov_contract_opportunities",
        sourceId: opportunity.id,
        resultStatus: "blocked",
        approvalState: "needs_review",
        severity: "high",
        message: `Government contract status ${body.status} blocked by bid readiness checks.`,
        metadata: { status: body.status, note, blockers: safety.blockers, warnings: safety.warnings },
      });
      return NextResponse.json(
        {
          ok: false,
          error: "Bid is not ready for this approval-gated status.",
          blockers: safety.blockers,
          warnings: safety.warnings,
          requiredHumanActions: safety.requiredHumanActions,
        },
        { status: 409 }
      );
    }

    if (requiresExternalEvidence(body.status) && !externalReference) {
      const errorMessage =
        "Submitted, under-evaluation, and awarded statuses require an external confirmation, portal reference, award notice, or similar human-entered evidence.";
      const blockers = [errorMessage];
      await logGovContractAuditEvent({
        opportunityId: opportunity.id,
        actorId: guard.user?.id,
        eventType: "pipeline_status_blocked",
        summary: `Pipeline status ${body.status} blocked by missing external evidence.`,
        metadata: { status: body.status, note, blockers },
      });
      await logPlatformAuditEvent({
        actorType: "human",
        actorId: guard.user?.id ?? null,
        module: "government_contracts",
        actionType: "pipeline_status_blocked",
        entityType: "gov_contract_opportunity",
        entityId: opportunity.id,
        sourceTable: "gov_contract_opportunities",
        sourceId: opportunity.id,
        resultStatus: "blocked",
        approvalState: "needs_review",
        severity: "high",
        message: `Government contract status ${body.status} blocked by missing external evidence.`,
        metadata: { status: body.status, note, blockers },
      });
      return NextResponse.json({ ok: false, error: errorMessage, blockers }, { status: 409 });
    }
  }

  if (decodedOpportunityId.startsWith("sample-") || !hasSupabaseServiceEnv()) {
    return NextResponse.json({
      ok: true,
      persisted: false,
      status: body.status,
      message: "Sample opportunity updated locally. Apply the database migration to persist status changes.",
    });
  }

  const supabase = createServiceClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("gov_contract_opportunities")
    .update({
      pipeline_status: body.status,
      updated_at: now,
    })
    .eq("id", decodedOpportunityId);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const { data: bidRoom } = await supabase
    .from("gov_contract_bid_rooms")
    .select("id,opportunity_id,bid_stage,approval_status,submission_readiness_score,estimated_value_cents,final_approval_by,final_approval_at,submitted_at,award_status,created_at,updated_at")
    .eq("opportunity_id", decodedOpportunityId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (bidRoom?.id) {
    const bidRoomUpdate: Record<string, unknown> = {
      bid_stage: body.status,
      updated_at: now,
    };
    if (approvalGated) {
      bidRoomUpdate.approval_status = "approved";
      bidRoomUpdate.final_approval_at = now;
      bidRoomUpdate.final_approval_by = guard.user?.id ?? null;
    }
    if (requiresExternalEvidence(body.status)) {
      bidRoomUpdate.submitted_at = now;
    }
    if (body.status === "awarded") {
      bidRoomUpdate.award_status = "awarded";
    }

    const { data: updatedBidRoom } = await supabase
      .from("gov_contract_bid_rooms")
      .update(bidRoomUpdate)
      .eq("id", bidRoom.id)
      .select("id,opportunity_id,bid_stage,approval_status,submission_readiness_score,estimated_value_cents,final_approval_by,final_approval_at,submitted_at,award_status,created_at,updated_at")
      .single();

    const submissionUpdate: Record<string, unknown> = {
      status: body.status,
      updated_at: now,
    };
    if (approvalGated) {
      submissionUpdate.approval_status = "approved";
      submissionUpdate.approved_by = guard.user?.id ?? null;
      submissionUpdate.approved_at = now;
    }
    if (requiresExternalEvidence(body.status)) {
      submissionUpdate.submitted_by = guard.user?.id ?? null;
      submissionUpdate.submitted_at = now;
    }

    await supabase
      .from("gov_contract_submission_packages")
      .update(submissionUpdate)
      .eq("bid_room_id", bidRoom.id)
      .select("id");

    const { data: updatedSubmissionPackage } = await supabase
      .from("gov_contract_submission_packages")
      .select("id,bid_room_id,opportunity_id,package_name,status,approval_status,submission_method,deadline_at,approved_by,approved_at,submitted_by,submitted_at,created_at,updated_at")
      .eq("bid_room_id", bidRoom.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (updatedBidRoom) {
      const bidRoomLedgerResult = await syncGovContractBidRoomLedger({
        id: String(updatedBidRoom.id),
        opportunityId: String(updatedBidRoom.opportunity_id ?? decodedOpportunityId),
        opportunityTitle: workspaceOpportunity?.title ?? null,
        agency: workspaceOpportunity?.agency ?? null,
        bidStage: String(updatedBidRoom.bid_stage ?? body.status),
        approvalStatus: String(updatedBidRoom.approval_status ?? (approvalGated ? "approved" : "not_requested")),
        submissionReadinessScore: Number(updatedBidRoom.submission_readiness_score ?? 0),
        estimatedValueCents: Number(updatedBidRoom.estimated_value_cents ?? workspaceOpportunity?.estimatedValueCents ?? 0),
        finalApprovalBy: typeof updatedBidRoom.final_approval_by === "string" ? updatedBidRoom.final_approval_by : null,
        finalApprovalAt: typeof updatedBidRoom.final_approval_at === "string" ? updatedBidRoom.final_approval_at : null,
        submittedAt: typeof updatedBidRoom.submitted_at === "string" ? updatedBidRoom.submitted_at : null,
        awardStatus: typeof updatedBidRoom.award_status === "string" ? updatedBidRoom.award_status : null,
        createdAt: typeof updatedBidRoom.created_at === "string" ? updatedBidRoom.created_at : now,
        updatedAt: typeof updatedBidRoom.updated_at === "string" ? updatedBidRoom.updated_at : now,
      }, {
        actorId: guard.user?.id ?? null,
        actorLabel: "gov_contract_status_route",
        eventType: "gov_contract_bid_room_status_updated",
      });
      if (!bidRoomLedgerResult.ok) {
        console.warn("[approval-ledger] gov contract bid room status sync skipped:", bidRoomLedgerResult.error);
      }
    }

    if (updatedSubmissionPackage) {
      const submissionLedgerResult = await syncGovContractSubmissionPackageLedger({
        id: String(updatedSubmissionPackage.id),
        bidRoomId: String(updatedSubmissionPackage.bid_room_id ?? bidRoom.id),
        opportunityId: String(updatedSubmissionPackage.opportunity_id ?? decodedOpportunityId),
        opportunityTitle: workspaceOpportunity?.title ?? null,
        agency: workspaceOpportunity?.agency ?? null,
        packageName: String(updatedSubmissionPackage.package_name ?? "Submission package"),
        status: String(updatedSubmissionPackage.status ?? body.status),
        approvalStatus: String(updatedSubmissionPackage.approval_status ?? (approvalGated ? "approved" : "not_requested")),
        submissionMethod: typeof updatedSubmissionPackage.submission_method === "string" ? updatedSubmissionPackage.submission_method : null,
        deadlineAt: typeof updatedSubmissionPackage.deadline_at === "string" ? updatedSubmissionPackage.deadline_at : null,
        approvedBy: typeof updatedSubmissionPackage.approved_by === "string" ? updatedSubmissionPackage.approved_by : null,
        approvedAt: typeof updatedSubmissionPackage.approved_at === "string" ? updatedSubmissionPackage.approved_at : null,
        submittedBy: typeof updatedSubmissionPackage.submitted_by === "string" ? updatedSubmissionPackage.submitted_by : null,
        submittedAt: typeof updatedSubmissionPackage.submitted_at === "string" ? updatedSubmissionPackage.submitted_at : null,
        createdAt: typeof updatedSubmissionPackage.created_at === "string" ? updatedSubmissionPackage.created_at : now,
        updatedAt: typeof updatedSubmissionPackage.updated_at === "string" ? updatedSubmissionPackage.updated_at : now,
      }, {
        actorId: guard.user?.id ?? null,
        actorLabel: "gov_contract_status_route",
        eventType: "gov_contract_submission_package_status_updated",
      });
      if (!submissionLedgerResult.ok) {
        console.warn("[approval-ledger] gov contract submission package status sync skipped:", submissionLedgerResult.error);
      }
    }
  }

  await logGovContractAuditEvent({
    opportunityId: decodedOpportunityId,
    actorId: guard.user?.id,
    eventType: "pipeline_status_updated",
    summary: `Pipeline status changed to ${body.status}.`,
    metadata: {
      note,
      approvalConfirmed: Boolean(body.approvalConfirmed),
      externalReference: externalReference || null,
      bidRoomId: bidRoom?.id ?? null,
    },
  });

  await logPlatformAuditEvent({
    actorType: "human",
    actorId: guard.user?.id ?? null,
    module: "government_contracts",
    actionType: "pipeline_status_updated",
    entityType: "gov_contract_opportunity",
    entityId: decodedOpportunityId,
    sourceTable: "gov_contract_opportunities",
    sourceId: decodedOpportunityId,
    resultStatus: "success",
    approvalState: approvalGated ? "approved" : "not_required",
    severity: approvalGated ? "high" : "info",
    message: `Government contract pipeline status changed to ${body.status}.`,
    metadata: {
      note,
      approvalConfirmed: Boolean(body.approvalConfirmed),
      externalReference: externalReference || null,
      bidRoomId: bidRoom?.id ?? null,
    },
  });

  return NextResponse.json({ ok: true, persisted: true, status: body.status });
}
