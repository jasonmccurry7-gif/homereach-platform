import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import type { ApprovalSpineItem } from "./types";
import { loadApprovalSpine } from "./spine";

type ExistingLedgerRow = {
  id: string;
  source_key: string;
  approval_state: string | null;
};

export type ApprovalLedgerPayload = {
  source_key: string;
  source_system: string;
  source_table: string | null;
  source_id: string;
  source_href: string | null;
  domain: string;
  approval_kind: string;
  title: string;
  detail: string;
  source_status: string;
  approval_state: string;
  lane: string;
  priority: string;
  approval_required: boolean;
  human_approval_required: boolean;
  sensitive_action: boolean;
  requested_by?: string | null;
  assigned_to?: string | null;
  decided_by?: string | null;
  decided_at?: string | null;
  related_entity_type?: string | null;
  related_entity_id?: string | null;
  channel?: string | null;
  provider?: string | null;
  next_action: string;
  guardrail: string;
  policy_flags?: string[];
  compliance_notes?: string | null;
  action_target: Record<string, unknown>;
  evidence?: Record<string, unknown>;
  metadata: Record<string, unknown>;
  due_at?: string | null;
  source_created_at?: string | null;
  source_updated_at?: string | null;
  updated_at: string;
};

type SyncApprovalLedgerOptions = {
  actorId?: string | null;
  actorLabel?: string | null;
  eventType?: string;
  eventNotes?: string;
  eventMetadata?: Record<string, unknown>;
  syncSource?: string;
};

type SyncApprovalLedgerResult = {
  ok: boolean;
  synced: number;
  events: number;
  error: string | null;
};

function normalizeApprovalState(item: ApprovalSpineItem) {
  const status = item.status.toLowerCase();

  if (item.lane === "blocked") return "blocked";
  if (item.lane === "ready_to_send") return "ready_to_send";
  if (item.lane === "ready_to_publish") return "ready_to_publish";
  if (status.includes("published")) return "published";
  if (status.includes("submitted")) return "submitted";
  if (status.includes("sent")) return "sent";
  if (status.includes("rejected")) return "rejected";
  if (status.includes("revision")) return "revision_needed";
  if (status.includes("approved")) return "approved";
  if (status.includes("draft")) return "draft";
  if (status.includes("not_required")) return "not_required";

  return "needs_review";
}

function jsonRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toLedgerPayload(item: ApprovalSpineItem) {
  const approvalState = normalizeApprovalState(item);

  return {
    source_key: item.sourceKey,
    source_system: item.sourceSystem,
    source_table: item.sourceTable,
    source_id: item.sourceId,
    source_href: item.href,
    domain: item.domain,
    approval_kind: item.approvalKind,
    title: item.title,
    detail: item.detail,
    source_status: item.status,
    approval_state: approvalState,
    lane: item.lane,
    priority: item.priority,
    approval_required: approvalState !== "not_required" && item.lane !== "learning",
    human_approval_required: approvalState !== "not_required" && item.lane !== "learning",
    sensitive_action: item.lane !== "learning",
    next_action: item.nextAction,
    guardrail: item.guardrail,
    action_target: jsonRecord(item.actionTarget),
    due_at: item.dueAt,
    source_created_at: item.createdAt,
    source_updated_at: item.createdAt,
    metadata: {
      source_label: item.source,
      projected_from: "approval_spine",
    },
    updated_at: new Date().toISOString(),
  };
}

export async function syncApprovalLedgerPayloads(
  payload: ApprovalLedgerPayload[],
  options: SyncApprovalLedgerOptions = {},
): Promise<SyncApprovalLedgerResult> {
  if (!payload.length) {
    return { ok: true, synced: 0, events: 0, error: null };
  }

  const db = createServiceClient();
  const sourceKeys = payload.map((item) => item.source_key);

  const { data: existingRows, error: existingError } = await db
    .from("approval_ledger")
    .select("id,source_key,approval_state")
    .in("source_key", sourceKeys);

  if (existingError) {
    return { ok: false, synced: 0, events: 0, error: existingError.message };
  }

  const existingByKey = new Map(
    ((existingRows ?? []) as ExistingLedgerRow[]).map((row) => [row.source_key, row]),
  );

  const { data: syncedRows, error: syncError } = await db
    .from("approval_ledger")
    .upsert(payload, { onConflict: "source_key" })
    .select("id,source_key,approval_state");

  if (syncError) {
    return { ok: false, synced: 0, events: 0, error: syncError.message };
  }

  const eventRows = ((syncedRows ?? []) as ExistingLedgerRow[])
    .map((row) => {
      const previous = existingByKey.get(row.source_key);
      if (previous && previous.approval_state === row.approval_state) return null;

      return {
        approval_id: row.id,
        event_type: options.eventType ?? (previous ? "state_changed" : "ledger_created"),
        from_state: previous?.approval_state ?? null,
        to_state: row.approval_state,
        actor_user_id: options.actorId ?? null,
        actor_label: options.actorLabel ?? "approval_ledger_sync",
        notes: options.eventNotes ?? (
          previous
            ? "Approval ledger state updated from the projected approval spine."
            : "Approval ledger row created from the projected approval spine."
        ),
        metadata: {
          source_key: row.source_key,
          sync_source: options.syncSource ?? "approval_spine",
          ...(options.eventMetadata ?? {}),
        },
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  if (!eventRows.length) {
    return { ok: true, synced: payload.length, events: 0, error: null };
  }

  const { error: eventError } = await db.from("approval_ledger_events").insert(eventRows);

  return {
    ok: !eventError,
    synced: payload.length,
    events: eventError ? 0 : eventRows.length,
    error: eventError?.message ?? null,
  };
}

export async function syncApprovalLedgerPayload(
  payload: ApprovalLedgerPayload,
  options: SyncApprovalLedgerOptions = {},
): Promise<SyncApprovalLedgerResult> {
  return syncApprovalLedgerPayloads([payload], options);
}

export async function syncApprovalLedgerFromItems(
  items: ApprovalSpineItem[],
  options: SyncApprovalLedgerOptions = {},
): Promise<SyncApprovalLedgerResult> {
  return syncApprovalLedgerPayloads(
    items.map(toLedgerPayload),
    {
      syncSource: "approval_spine",
      ...options,
    },
  );
}

export async function syncApprovalLedgerFromSpine(
  options: SyncApprovalLedgerOptions = {},
): Promise<SyncApprovalLedgerResult> {
  const spine = await loadApprovalSpine({ mode: "sync" });
  const result = await syncApprovalLedgerFromItems(spine.queue, options);
  if (!result.ok) return result;

  return {
    ...result,
    error: spine.errors.length ? spine.errors.join("; ") : null,
  };
}
