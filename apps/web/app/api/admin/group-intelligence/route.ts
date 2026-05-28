import { NextResponse } from "next/server";
import { logPlatformAuditEvent } from "@/lib/audit/platform-audit";
import { requireAdmin } from "@/lib/auth/api-guards";
import {
  createGroupObservation,
  loadGroupIntelligenceDashboard,
  markDraftCopied,
  saveObservationAsLead,
  updateObservationStatus,
} from "@/lib/group-intelligence/repository";
import {
  GROUP_OBSERVATION_STATUSES,
  type GroupDraftType,
  type GroupObservationStatus,
} from "@/lib/group-intelligence/types";

export async function GET(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  const minScoreRaw = url.searchParams.get("minScore");
  const data = await loadGroupIntelligenceDashboard({
    status: url.searchParams.get("status"),
    category: url.searchParams.get("category"),
    group: url.searchParams.get("group"),
    query: url.searchParams.get("q"),
    minScore: minScoreRaw && Number.isFinite(Number(minScoreRaw)) ? Number(minScoreRaw) : null,
  });

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => ({}));
  const groupName = stringValue(body.groupName);
  const sourceText = stringValue(body.sourceText);
  if (!groupName || !sourceText) {
    return NextResponse.json({ error: "Group name and post/comment text are required." }, { status: 400 });
  }

  try {
    const result = await createGroupObservation(
      {
        groupName,
        groupUrl: stringValue(body.groupUrl),
        groupType: stringValue(body.groupType),
        postAuthorName: stringValue(body.postAuthorName),
        businessName: stringValue(body.businessName),
        businessType: stringValue(body.businessType),
        postUrl: stringValue(body.postUrl),
        observedAt: stringValue(body.observedAt),
        sourceText,
        notes: stringValue(body.notes),
      },
      guard.user?.id ?? null,
    );

    await logPlatformAuditEvent({
      actorType: "human",
      actorId: guard.user?.id ?? null,
      module: "group_intelligence",
      actionType: "create_observation",
      entityType: "group_intelligence_observation",
      entityId: result.observation.id,
      sourceTable: "group_intelligence_observations",
      sourceId: result.observation.id,
      channel: "facebook_group",
      provider: "manual_import",
      resultStatus: "pending_approval",
      approvalState: "needs_review",
      severity: result.observation.opportunityScore >= 80 ? "medium" : "low",
      message: "Group observation analyzed and copy-only drafts queued for human review.",
      metadata: {
        group_name: groupName,
        category: result.observation.opportunityCategory,
        score: result.observation.opportunityScore,
        safety_notes: result.analysis.safetyNotes,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logPlatformAuditEvent({
      actorType: "human",
      actorId: guard.user?.id ?? null,
      module: "group_intelligence",
      actionType: "create_observation",
      resultStatus: "failure",
      approvalState: "needs_review",
      severity: "medium",
      errorMessage: message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => ({}));
  const action = stringValue(body.action);
  if (!action) return NextResponse.json({ error: "Action is required." }, { status: 400 });

  try {
    if (action === "update_status") {
      const observationId = requireString(body.observationId, "Observation id is required.");
      const status = normalizeStatus(body.status);
      const observation = await updateObservationStatus({
        observationId,
        status,
        notes: stringValue(body.notes),
        followUpDueAt: stringValue(body.followUpDueAt),
      });
      await auditAction(guard.user?.id ?? null, action, observationId, {
        status,
        follow_up_due_at: observation.followUpDueAt,
      });
      return NextResponse.json({ ok: true, observation });
    }

    if (action === "mark_copied") {
      const draftId = requireString(body.draftId, "Draft id is required.");
      const draftType = normalizeDraftType(body.draftType);
      const draft = await markDraftCopied({
        draftId,
        draftType,
        userId: guard.user?.id ?? null,
      });
      await auditAction(guard.user?.id ?? null, action, String(draft.observation_id), {
        draft_id: draftId,
        draft_type: draftType,
        copied_only: true,
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "save_as_lead") {
      const observationId = requireString(body.observationId, "Observation id is required.");
      const result = await saveObservationAsLead(observationId, guard.user?.id ?? null);
      await auditAction(guard.user?.id ?? null, action, observationId, {
        lead_id: result.leadId,
        source: "Facebook Group Intelligence",
      });
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ error: "Unsupported Group Intelligence action." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function auditAction(
  userId: string | null,
  actionType: string,
  observationId: string,
  metadata: Record<string, unknown>,
) {
  await logPlatformAuditEvent({
    actorType: "human",
    actorId: userId,
    module: "group_intelligence",
    actionType,
    entityType: "group_intelligence_observation",
    entityId: observationId,
    sourceTable: "group_intelligence_observations",
    sourceId: observationId,
    channel: "facebook_group",
    provider: "manual_import",
    resultStatus: actionType === "save_as_lead" ? "success" : "pending_approval",
    approvalState: actionType === "save_as_lead" ? "not_required" : "needs_review",
    severity: "low",
    message: "Group Intelligence operator action logged. No external message was sent.",
    metadata,
  });
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function requireString(value: unknown, message: string) {
  const text = stringValue(value);
  if (!text) throw new Error(message);
  return text;
}

function normalizeStatus(value: unknown): GroupObservationStatus {
  if (GROUP_OBSERVATION_STATUSES.includes(value as GroupObservationStatus)) {
    return value as GroupObservationStatus;
  }
  throw new Error("Invalid status.");
}

function normalizeDraftType(value: unknown): GroupDraftType {
  if (
    value === "public_comment" ||
    value === "private_dm" ||
    value === "follow_up" ||
    value === "facebook_post_idea"
  ) {
    return value;
  }
  throw new Error("Invalid draft type.");
}
