import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api-guards";
import { logPlatformAuditEvent } from "@/lib/audit/platform-audit";
import { syncRevenueApprovalLedger } from "@/lib/approvals/revenue-approval-ledger";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

type ApprovalMetadata = Record<string, unknown>;

type ApprovalRow = {
  id: string;
  thread_id: string | null;
  suggestion_id: string | null;
  business_line: string;
  channel: string;
  status: string;
  title: string;
  message_body: string | null;
  metadata: ApprovalMetadata | null;
};

type ActionPayload = {
  action?: string;
  reviewNotes?: string;
  reason?: string;
};

const APPROVABLE_STATUSES = new Set(["draft", "needs_review", "rejected"]);
const REJECTABLE_STATUSES = new Set(["draft", "needs_review", "approved", "scheduled"]);

function jsonError(error: string, status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, error, ...extra }, { status });
}

function metadataObject(value: unknown): ApprovalMetadata {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as ApprovalMetadata)
    : {};
}

function asTrimmedString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function mergeReviewMetadata(
  metadata: ApprovalMetadata | null,
  patch: ApprovalMetadata,
): ApprovalMetadata {
  const existing = metadataObject(metadata);
  return {
    ...existing,
    approval_review: {
      ...(metadataObject(existing.approval_review)),
      ...patch,
    },
    last_review_action: patch.status,
    last_reviewed_at: patch.reviewed_at,
    human_approval_required: true,
  };
}

function releaseMetadataForApprovedSend(
  metadata: ApprovalMetadata | null,
  approval: ApprovalRow,
  guard: { user?: { id?: string | null; email?: string | null } },
  reviewedAt: string,
  reviewNotes?: string | null,
): ApprovalMetadata {
  const existing = metadataObject(metadata);
  const sourceSystem = asTrimmedString(existing.source_system);
  const taskId = asTrimmedString(existing.daily_outreach_task_id);
  const dailyOutreachApproval = sourceSystem === "daily_outreach_tasks" && Boolean(taskId);
  const politicalApproval = approval.business_line === "political";

  return {
    ...mergeReviewMetadata(existing, {
      status: "approved",
      reviewed_at: reviewedAt,
      reviewed_by: guard.user?.id ?? null,
      reviewer_email: guard.user?.email ?? null,
      review_notes:
        reviewNotes ??
        "Human approved this revenue message draft. Approved-send automation may send it only after backend suppression, reputation, sender, business-hours, political-plan, and test-mode checks pass.",
      execution_boundary:
        "Human approval granted for this draft. Send automation remains gated by backend controls; no payment, pricing, campaign, procurement, or publish action was executed by this approval.",
    }),
    approval_status: "approved",
    human_approved: true,
    human_approval_required: true,
    human_approved_at: reviewedAt,
    human_approved_by: guard.user?.id ?? null,
    human_approved_by_email: guard.user?.email ?? null,
    auto_send_enabled: dailyOutreachApproval,
    auto_send_disabled: dailyOutreachApproval ? false : existing.auto_send_disabled ?? true,
    requires_manual_send: dailyOutreachApproval ? false : existing.requires_manual_send ?? true,
    manual_send_only: dailyOutreachApproval ? false : existing.manual_send_only ?? true,
    release_to_auto_send: dailyOutreachApproval && (!politicalApproval || isPlanStatusApprovalSafe(existing.plan_status) || hasOwnerOverride(existing)),
    autonomous_send_allowed: dailyOutreachApproval && (!politicalApproval || isPlanStatusApprovalSafe(existing.plan_status) || hasOwnerOverride(existing)),
    auto_send_release_note: dailyOutreachApproval
      ? "Released by human approval for the approved-send automation sweeper. Final send still requires backend policy, suppression, sender, reputation, and channel gates."
      : "Not released for automation because this draft is not linked to a daily outreach task.",
  };
}

function isPlanStatusApprovalSafe(value: unknown) {
  return ["approved", "proposal_ready", "production_ready"].includes(
    String(value ?? "").toLowerCase(),
  );
}

function hasOwnerOverride(metadata: ApprovalMetadata) {
  return metadata.owner_override === true || metadata.political_send_override === true;
}

async function fetchApproval(
  db: ReturnType<typeof createServiceClient>,
  approvalId: string,
) {
  const { data, error } = await db
    .from("revenue_message_approval_queue")
    .select("id,thread_id,suggestion_id,business_line,channel,status,title,message_body,metadata")
    .eq("id", approvalId)
    .maybeSingle<ApprovalRow>();

  if (error) throw error;
  return data;
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ approvalId: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  let body: ActionPayload;
  try {
    body = (await req.json()) as ActionPayload;
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  const action = asTrimmedString(body.action);
  if (action !== "approve" && action !== "reject") {
    return jsonError("Action must be approve or reject.", 400);
  }

  const { approvalId } = await context.params;
  const db = createServiceClient();
  const now = new Date().toISOString();

  try {
    const approval = await fetchApproval(db, approvalId);
    if (!approval) return jsonError("Approval item not found.", 404);

    if (action === "approve") {
      if (!APPROVABLE_STATUSES.has(approval.status)) {
        return jsonError("Only draft, needs_review, or rejected revenue drafts can be approved.", 409, {
          approval_status: approval.status,
        });
      }

      if (!asTrimmedString(approval.message_body)) {
        return jsonError("Message body is required before approval.", 400);
      }

      const approvalMetadata = metadataObject(approval.metadata);
      const isCandidateAgentPoliticalDraft =
        approval.business_line === "political" &&
        asTrimmedString(approvalMetadata.workflow) === "candidate_agent_sales_follow_up";
      if (
        isCandidateAgentPoliticalDraft &&
        !isPlanStatusApprovalSafe(approvalMetadata.plan_status) &&
        !hasOwnerOverride(approvalMetadata)
      ) {
        return jsonError(
          "Political plan must be reviewed before this outreach draft can be approved.",
          409,
          { plan_status: approvalMetadata.plan_status ?? null },
        );
      }

      const nextMetadata = releaseMetadataForApprovedSend(
        metadataObject(approval.metadata),
        approval,
        guard,
        now,
        asTrimmedString(body.reviewNotes),
      );

      const { data: updated, error } = await db
        .from("revenue_message_approval_queue")
        .update({
          status: "approved",
          updated_at: now,
          metadata: nextMetadata,
        })
        .eq("id", approval.id)
        .select("id,status,updated_at")
        .single();

      if (error) throw error;

      const ledgerResult = await syncRevenueApprovalLedger(
        {
          id: approval.id,
          businessLine: approval.business_line,
          channel: approval.channel,
          status: "approved",
          title: approval.title,
          messageBody: approval.message_body,
          metadata: nextMetadata,
          threadId: approval.thread_id,
          suggestionId: approval.suggestion_id,
          createdAt: updated.updated_at,
          updatedAt: updated.updated_at,
        },
        {
          actorId: guard.user?.id ?? null,
          actorLabel: guard.user?.email ?? "admin",
          eventType: "revenue_approval_approved",
        },
      );
      if (!ledgerResult.ok && ledgerResult.error) {
        console.warn("[approval-ledger] revenue approval approve sync skipped:", ledgerResult.error);
      }

      const dailyOutreachTaskId = asTrimmedString(nextMetadata.daily_outreach_task_id);
      if (dailyOutreachTaskId && nextMetadata.auto_send_enabled === true) {
        await db
          .from("daily_outreach_tasks")
          .update({
            approval_status: "approved",
            send_status: "approved_pending_send",
            manual_approval_required: false,
            approved_at: now,
            approved_by: guard.user?.id ?? null,
            updated_at: now,
          })
          .eq("id", dailyOutreachTaskId)
          .in("send_status", ["draft", "queued_for_review", "failed"]);
      }

      if (approval.suggestion_id) {
        await db
          .from("revenue_ai_suggestions")
          .update({
            status: "approved",
            updated_at: now,
          })
          .eq("id", approval.suggestion_id);
      }

      await logPlatformAuditEvent({
        actorType: "human",
        actorId: guard.user?.id ?? null,
        actorLabel: guard.user?.email ?? "admin",
        module: "revenue_messaging",
        actionType: "approval_draft_approved",
        entityType: "revenue_message_approval_queue",
        entityId: approval.id,
        sourceTable: "revenue_message_approval_queue",
        sourceId: approval.id,
        channel: approval.channel,
        provider: "manual_review",
        resultStatus: "success",
        approvalState: "approved",
        severity: "medium",
        message: "Revenue message draft approved. External send remains a separate explicit action.",
        metadata: {
          thread_id: approval.thread_id,
          suggestion_id: approval.suggestion_id,
          business_line: approval.business_line,
          previous_status: approval.status,
        },
      });

      return NextResponse.json({ ok: true, approval: updated, message: "Revenue draft approved." });
    }

    if (!REJECTABLE_STATUSES.has(approval.status)) {
      return jsonError("Only draft, needs_review, approved, or scheduled revenue drafts can be rejected.", 409, {
        approval_status: approval.status,
      });
    }

    const reason =
      asTrimmedString(body.reason) ??
      asTrimmedString(body.reviewNotes) ??
      "Rejected by operator.";
    const nextMetadata = mergeReviewMetadata(approval.metadata, {
      status: "rejected",
      reviewed_at: now,
      reviewed_by: guard.user?.id ?? null,
      reviewer_email: guard.user?.email ?? null,
      rejection_reason: reason,
      execution_boundary:
        "Rejected in review. No outbound message, payment, pricing change, campaign change, or procurement action was executed.",
    });

    const { data: updated, error } = await db
      .from("revenue_message_approval_queue")
      .update({
        status: "rejected",
        updated_at: now,
        metadata: nextMetadata,
      })
      .eq("id", approval.id)
      .select("id,status,updated_at")
      .single();

    if (error) throw error;

    const ledgerResult = await syncRevenueApprovalLedger(
      {
        id: approval.id,
        businessLine: approval.business_line,
        channel: approval.channel,
        status: "rejected",
        title: approval.title,
        messageBody: approval.message_body,
        metadata: nextMetadata,
        threadId: approval.thread_id,
        suggestionId: approval.suggestion_id,
        createdAt: updated.updated_at,
        updatedAt: updated.updated_at,
      },
      {
        actorId: guard.user?.id ?? null,
        actorLabel: guard.user?.email ?? "admin",
        eventType: "revenue_approval_rejected",
      },
    );
    if (!ledgerResult.ok && ledgerResult.error) {
      console.warn("[approval-ledger] revenue approval reject sync skipped:", ledgerResult.error);
    }

    if (approval.suggestion_id) {
      await db
        .from("revenue_ai_suggestions")
        .update({
          status: "rejected",
          updated_at: now,
        })
        .eq("id", approval.suggestion_id);
    }

    await logPlatformAuditEvent({
      actorType: "human",
      actorId: guard.user?.id ?? null,
      actorLabel: guard.user?.email ?? "admin",
      module: "revenue_messaging",
      actionType: "approval_draft_rejected",
      entityType: "revenue_message_approval_queue",
      entityId: approval.id,
      sourceTable: "revenue_message_approval_queue",
      sourceId: approval.id,
      channel: approval.channel,
      provider: "manual_review",
      resultStatus: "success",
      approvalState: "rejected",
      severity: "medium",
      message: "Revenue message draft rejected. No outbound action was performed.",
      metadata: {
        thread_id: approval.thread_id,
        suggestion_id: approval.suggestion_id,
        business_line: approval.business_line,
        previous_status: approval.status,
        rejection_reason: reason,
      },
    });

    return NextResponse.json({ ok: true, approval: updated, message: "Revenue draft rejected." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Revenue approval action failed.";
    const status = message.includes("relation") || message.includes("does not exist") ? 503 : 500;
    return jsonError(message, status);
  }
}
