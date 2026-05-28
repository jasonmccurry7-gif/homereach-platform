import "server-only";

import { createServiceClient } from "@/lib/supabase/service";

export type PlatformAuditSeverity = "info" | "low" | "medium" | "high" | "critical";
export type PlatformAuditActor = "human" | "ai" | "system" | "cron" | "webhook" | "integration";
export type PlatformAuditResult =
  | "success"
  | "failure"
  | "blocked"
  | "pending_approval"
  | "skipped"
  | "warning";
export type PlatformApprovalState =
  | "not_required"
  | "draft"
  | "needs_review"
  | "approved"
  | "rejected"
  | "sent"
  | "canceled";

export type PlatformAuditEventInput = {
  actorType?: PlatformAuditActor;
  actorId?: string | null;
  actorLabel?: string | null;
  module: string;
  actionType: string;
  entityType?: string | null;
  entityId?: string | null;
  sourceTable?: string | null;
  sourceId?: string | null;
  customerId?: string | null;
  campaignId?: string | null;
  channel?: string | null;
  provider?: string | null;
  resultStatus?: PlatformAuditResult;
  approvalState?: PlatformApprovalState;
  severity?: PlatformAuditSeverity;
  message?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
};

export async function logPlatformAuditEvent(input: PlatformAuditEventInput): Promise<void> {
  try {
    const db = createServiceClient();
    const { error } = await db.from("platform_audit_events").insert({
      actor_type: input.actorType ?? "system",
      actor_id: input.actorId ?? null,
      actor_label: input.actorLabel ?? null,
      module: input.module,
      action_type: input.actionType,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      source_table: input.sourceTable ?? null,
      source_id: input.sourceId ?? null,
      customer_id: input.customerId ?? null,
      campaign_id: input.campaignId ?? null,
      channel: input.channel ?? null,
      provider: input.provider ?? null,
      result_status: input.resultStatus ?? "success",
      approval_state: input.approvalState ?? "not_required",
      severity: input.severity ?? "info",
      message: input.message ?? null,
      error_message: input.errorMessage ?? null,
      metadata: input.metadata ?? {},
    });

    if (error && error.code !== "42P01") {
      console.warn("[platform-audit] insert skipped:", error.message);
    }
  } catch (err) {
    console.warn("[platform-audit] insert skipped:", err instanceof Error ? err.message : String(err));
  }
}
