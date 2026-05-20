import { createServiceClient } from "@/lib/supabase/service";

export type SourceFreshnessStatus = "fresh" | "aging" | "stale" | "missing" | "unavailable";

export interface SourceFreshnessItem {
  key: string;
  label: string;
  status: SourceFreshnessStatus;
  lastSeenAt: string | null;
  ageHours: number | null;
  staleAfterHours: number;
  sourceTable: string;
  summary: string;
  nextStep: string;
}

export interface SourceFreshnessReport {
  generatedAt: string;
  summary: {
    total: number;
    fresh: number;
    aging: number;
    stale: number;
    missing: number;
    unavailable: number;
  };
  items: SourceFreshnessItem[];
}

function nowIso() {
  return new Date().toISOString();
}

function hasSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function hoursSince(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.round((Date.now() - parsed) / 3_600_000));
}

function statusForAge(ageHours: number | null, staleAfterHours: number): SourceFreshnessStatus {
  if (ageHours === null) return "missing";
  if (ageHours >= staleAfterHours) return "stale";
  if (ageHours >= staleAfterHours * 0.65) return "aging";
  return "fresh";
}

function summarize(items: SourceFreshnessItem[]): SourceFreshnessReport["summary"] {
  return {
    total: items.length,
    fresh: items.filter((item) => item.status === "fresh").length,
    aging: items.filter((item) => item.status === "aging").length,
    stale: items.filter((item) => item.status === "stale").length,
    missing: items.filter((item) => item.status === "missing").length,
    unavailable: items.filter((item) => item.status === "unavailable").length,
  };
}

function buildItem(args: {
  key: string;
  label: string;
  sourceTable: string;
  lastSeenAt: string | null;
  staleAfterHours: number;
  nextStep: string;
  unavailableError?: string | null;
}): SourceFreshnessItem {
  if (args.unavailableError) {
    return {
      key: args.key,
      label: args.label,
      sourceTable: args.sourceTable,
      status: "unavailable",
      lastSeenAt: null,
      ageHours: null,
      staleAfterHours: args.staleAfterHours,
      summary: `${args.sourceTable} is unavailable: ${args.unavailableError}`,
      nextStep: "Apply migrations, verify RLS/service permissions, or confirm the source table exists.",
    };
  }

  const ageHours = hoursSince(args.lastSeenAt);
  const status = statusForAge(ageHours, args.staleAfterHours);
  return {
    key: args.key,
    label: args.label,
    sourceTable: args.sourceTable,
    status,
    lastSeenAt: args.lastSeenAt,
    ageHours,
    staleAfterHours: args.staleAfterHours,
    summary: args.lastSeenAt
      ? `${args.label} last updated ${ageHours} hour${ageHours === 1 ? "" : "s"} ago.`
      : `${args.label} has no recorded freshness timestamp yet.`,
    nextStep: status === "fresh"
      ? "No immediate action required."
      : args.nextStep,
  };
}

export async function getSourceFreshnessReport(): Promise<SourceFreshnessReport> {
  if (!hasSupabaseEnv()) {
    const unavailable = [
      "candidate_intel_sync_runs",
      "ci_ingestion_queue",
      "gov_contract_sync_runs",
      "revenue_webhook_events",
      "auto_sequences",
    ].map((table) => buildItem({
      key: table,
      label: table.replace(/_/g, " "),
      sourceTable: table,
      lastSeenAt: null,
      staleAfterHours: 24,
      nextStep: "Configure Supabase before source freshness can be checked.",
      unavailableError: "Supabase env is missing",
    }));
    return { generatedAt: nowIso(), summary: summarize(unavailable), items: unavailable };
  }

  const supabase = createServiceClient();

  async function latest(table: string, select: string, orderColumn: string, filter?: (query: any) => any) {
    let query = supabase.from(table).select(select).order(orderColumn, { ascending: false, nullsFirst: false }).limit(1);
    if (filter) query = filter(query);
    const { data, error } = await query.maybeSingle();
    if (error) return { row: null, error: error.message };
    return { row: data as Record<string, any> | null, error: null };
  }

  const [
    candidateSync,
    learningQueue,
    govSync,
    webhookEvents,
    procurementSequence,
  ] = await Promise.all([
    latest("candidate_intel_sync_runs", "started_at,completed_at,status", "started_at"),
    latest("ci_ingestion_queue", "processed_at,created_at,status", "processed_at"),
    latest("gov_contract_sync_runs", "created_at,status,message", "created_at"),
    latest("revenue_webhook_events", "created_at,provider,event_type,processing_status", "created_at"),
    latest("auto_sequences", "updated_at,status,business_line", "updated_at", (query) => query.eq("business_line", "inventory_procurement")),
  ]);

  const items: SourceFreshnessItem[] = [
    buildItem({
      key: "candidate_intelligence",
      label: "Candidate Intelligence",
      sourceTable: "candidate_intel_sync_runs",
      lastSeenAt: candidateSync.row?.completed_at ?? candidateSync.row?.started_at ?? null,
      staleAfterHours: 72,
      nextStep: "Run candidate intelligence sync or verify political source credentials.",
      unavailableError: candidateSync.error,
    }),
    buildItem({
      key: "learning_engine_ingestion",
      label: "Learning Engine Ingestion",
      sourceTable: "ci_ingestion_queue",
      lastSeenAt: learningQueue.row?.processed_at ?? learningQueue.row?.created_at ?? null,
      staleAfterHours: 72,
      nextStep: "Run the Learning Engine ingestion job after credentials and review mode are confirmed.",
      unavailableError: learningQueue.error,
    }),
    buildItem({
      key: "gov_contract_sync",
      label: "Gov Contracts Sync",
      sourceTable: "gov_contract_sync_runs",
      lastSeenAt: govSync.row?.created_at ?? null,
      staleAfterHours: 36,
      nextStep: "Run SAM.gov home-services sync or confirm SAM_GOV_API_KEY and cron are configured.",
      unavailableError: govSync.error,
    }),
    buildItem({
      key: "messaging_webhooks",
      label: "Messaging Webhook Events",
      sourceTable: "revenue_webhook_events",
      lastSeenAt: webhookEvents.row?.created_at ?? null,
      staleAfterHours: 168,
      nextStep: "Confirm Postmark/Twilio webhooks are configured and production traffic is expected.",
      unavailableError: webhookEvents.error,
    }),
    buildItem({
      key: "procurement_sequence",
      label: "Procurement Email Sequence",
      sourceTable: "auto_sequences",
      lastSeenAt: procurementSequence.row?.updated_at ?? null,
      staleAfterHours: 168,
      nextStep: "Confirm the inventory/procurement email sequence is active and recently reviewed.",
      unavailableError: procurementSequence.error,
    }),
  ];

  return {
    generatedAt: nowIso(),
    summary: summarize(items),
    items,
  };
}
