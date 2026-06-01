import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import type {
  ApprovalActionTarget,
  ApprovalLane,
  ApprovalPriority,
  ApprovalSpineItem,
} from "./types";

type ApprovalLedgerStatusRow = {
  source_key: string;
  approval_state: string | null;
  updated_at: string | null;
};

type ApprovalLedgerQueueRow = {
  source_key: string;
  source_system: string | null;
  source_table: string | null;
  source_id: string | null;
  domain: ApprovalSpineItem["domain"] | null;
  approval_kind: string | null;
  title: string | null;
  detail: string | null;
  source_status: string | null;
  source_href: string | null;
  lane: string | null;
  priority: string | null;
  next_action: string | null;
  guardrail: string | null;
  action_target: unknown;
  due_at: string | null;
  source_created_at: string | null;
  metadata: Record<string, unknown> | null;
};

export type ApprovalLedgerStatus = {
  available: boolean;
  totalRows: number;
  mirroredRows: number;
  missingRows: number;
  blockedRows: number;
  lastSyncedAt: string | null;
  error: string | null;
};

function asActionTarget(value: unknown, fallback: ApprovalActionTarget): ApprovalActionTarget {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;

  const target = value as Record<string, unknown>;
  const kind = typeof target.kind === "string" ? target.kind : "";
  const id = typeof target.id === "string" ? target.id : fallback.id;
  const status = typeof target.status === "string" ? target.status : fallback.status;

  if (kind === "daily_video") return { kind, id, status };
  if (kind === "platform_post") {
    return {
      kind,
      id,
      status,
      videoId: typeof target.videoId === "string" ? target.videoId : "",
    };
  }
  if (kind === "facebook_draft") return { kind, id, status };
  if (kind === "ai_output") {
    return {
      kind,
      id,
      status,
      isWinning: typeof target.isWinning === "boolean" ? target.isWinning : undefined,
    };
  }
  if (kind === "revenue_approval") {
    return {
      kind,
      id,
      status,
      channel: typeof target.channel === "string" ? target.channel : "message",
      messageBody:
        typeof target.messageBody === "string" || target.messageBody === null
          ? target.messageBody
          : null,
    };
  }
  if (kind === "link_only") return { kind, id, status };

  return fallback;
}

function asLane(value: unknown, fallback: ApprovalLane): ApprovalLane {
  return value === "blocked" ||
    value === "needs_approval" ||
    value === "ready_to_send" ||
    value === "ready_to_publish" ||
    value === "learning"
    ? value
    : fallback;
}

function asPriority(value: unknown, fallback: ApprovalPriority): ApprovalPriority {
  return value === "critical" || value === "high" || value === "normal" ? value : fallback;
}

export async function loadApprovalLedgerStatus(
  expectedSourceKeys: string[],
): Promise<ApprovalLedgerStatus> {
  const db = createServiceClient();
  const query = expectedSourceKeys.length
    ? db.from("approval_ledger").select("source_key,approval_state,updated_at").in("source_key", expectedSourceKeys)
    : db.from("approval_ledger").select("source_key,approval_state,updated_at").limit(200);

  const { data, error } = await query;

  if (error) {
    const missingTable = error.code === "42P01";
    return {
      available: false,
      totalRows: 0,
      mirroredRows: 0,
      missingRows: expectedSourceKeys.length,
      blockedRows: 0,
      lastSyncedAt: null,
      error: missingTable
        ? "Approval ledger migration is not applied in this environment yet."
        : error.message,
    };
  }

  const rows = (data ?? []) as ApprovalLedgerStatusRow[];
  const rowKeys = new Set(rows.map((row) => row.source_key));

  return {
    available: true,
    totalRows: rows.length,
    mirroredRows: expectedSourceKeys.length
      ? expectedSourceKeys.filter((key) => rowKeys.has(key)).length
      : rows.length,
    missingRows: expectedSourceKeys.length
      ? expectedSourceKeys.filter((key) => !rowKeys.has(key)).length
      : 0,
    blockedRows: rows.filter((row) => String(row.approval_state ?? "").toLowerCase() === "blocked").length,
    lastSyncedAt: rows
      .map((row) => row.updated_at)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null,
    error: null,
  };
}

export async function loadApprovalLedgerQueue(
  projectedItems: ApprovalSpineItem[],
): Promise<{ items: ApprovalSpineItem[] | null; error: string | null }> {
  if (!projectedItems.length) {
    return { items: [], error: null };
  }

  const db = createServiceClient();
  const { data, error } = await db
    .from("approval_ledger")
    .select("source_key,source_system,source_table,source_id,domain,approval_kind,title,detail,source_status,source_href,lane,priority,next_action,guardrail,action_target,due_at,source_created_at,metadata")
    .in("source_key", projectedItems.map((item) => item.sourceKey));

  if (error) {
    return {
      items: null,
      error: error.code === "42P01"
        ? "Approval ledger migration is not applied in this environment yet."
        : error.message,
    };
  }

  const rows = (data ?? []) as ApprovalLedgerQueueRow[];
  const rowsByKey = new Map(rows.map((row) => [row.source_key, row]));

  return {
    items: projectedItems.map((item) => {
      const row = rowsByKey.get(item.sourceKey);
      if (!row) return item;

      const metadata = row.metadata ?? {};

      return {
        ...item,
        sourceSystem: row.source_system ?? item.sourceSystem,
        sourceTable: row.source_table ?? item.sourceTable,
        sourceId: row.source_id ?? item.sourceId,
        domain: row.domain ?? item.domain,
        approvalKind: row.approval_kind ?? item.approvalKind,
        source: typeof metadata.source_label === "string" ? metadata.source_label : item.source,
        title: row.title ?? item.title,
        detail: row.detail ?? item.detail,
        status: row.source_status ?? item.status,
        href: row.source_href ?? item.href,
        lane: asLane(row.lane, item.lane),
        priority: asPriority(row.priority, item.priority),
        nextAction: row.next_action ?? item.nextAction,
        guardrail: row.guardrail ?? item.guardrail,
        createdAt: row.source_created_at ?? item.createdAt,
        dueAt: row.due_at ?? item.dueAt,
        actionTarget: asActionTarget(row.action_target, item.actionTarget),
      };
    }),
    error: null,
  };
}
