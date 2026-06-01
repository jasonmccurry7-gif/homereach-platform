import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import { buildOutreachMarketingIntelligence } from "@/lib/marketing-intelligence/outreach";
import type { DailyContentGenerationContext } from "./types";

type GenericRow = Record<string, unknown>;

export async function loadDailyContentGenerationContext(): Promise<DailyContentGenerationContext> {
  const db = createServiceClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const [contentIntel, aiOutputs, performanceSignals, winningPatterns, salesEvents] =
    await Promise.all([
      queryMaybe("ci_insights", () =>
        db
          .from("ci_insights")
          .select("id,category,theme,insight_text,status,apex_score,created_at")
          .eq("status", "approved")
          .order("apex_score", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(6),
      ),
      queryMaybe("ai_outputs", () =>
        db
          .from("ai_outputs")
          .select(
            "id,title,agent_name,workflow,output_type,content,created_at,winning_output",
          )
          .eq("approval_status", "approved")
          .eq("verification_status", "verified")
          .eq("status", "active")
          .order("winning_output", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(6),
      ),
      queryMaybe("content_learning_events", () =>
        db
          .from("content_learning_events")
          .select("id,event_type,signal,score,platform,metadata,occurred_at")
          .in("signal", [
            "revenue_or_lead_signal",
            "strong_engagement_signal",
            "performance_signal",
          ])
          .order("score", { ascending: false })
          .order("occurred_at", { ascending: false })
          .limit(8),
      ),
      queryMaybe("ci_patterns", () =>
        db
          .from("ci_patterns")
          .select("id,category,pattern,weight,win_count,last_win_at")
          .order("weight", { ascending: false })
          .order("last_win_at", { ascending: false })
          .limit(8),
      ),
      queryMaybe("sales_events", () =>
        db
          .from("sales_events")
          .select("id,action_type,channel,city,category,revenue_cents,lead_id,message,metadata,created_at")
          .gte("created_at", thirtyDaysAgo)
          .order("created_at", { ascending: false })
          .limit(150),
      ),
    ]);

  const outreachIntelligence = buildOutreachMarketingIntelligence(
    salesEvents.map((row) => ({
      id: asString(row.id),
      action_type: asString(row.action_type),
      channel: asString(row.channel),
      city: asString(row.city),
      category: asString(row.category),
      revenue_cents: Number(row.revenue_cents ?? 0),
      lead_id: asString(row.lead_id),
      message: asString(row.message),
      metadata: row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {},
      created_at: asString(row.created_at),
    })),
    [],
  );

  return {
    loadedAt: new Date().toISOString(),
    contentIntel: contentIntel.map((row) => ({
      id: String(row.id),
      source: "content_intel" as const,
      title: String(row.theme ?? row.category ?? "Approved content signal"),
      category: String(row.category ?? "content"),
      summary: truncate(String(row.insight_text ?? ""), 280),
      score:
        typeof row.apex_score === "number"
          ? row.apex_score
          : Number(row.apex_score ?? 0),
      createdAt: asString(row.created_at),
    })),
    aiOutputs: aiOutputs.map((row) => ({
      id: String(row.id),
      source: "ai_output" as const,
      title: String(row.title ?? "Verified AI Asset"),
      category: String(
        row.workflow ?? row.output_type ?? row.agent_name ?? "ai_asset",
      ),
      summary: truncate(String(row.content ?? ""), 280),
      score: row.winning_output === true ? 1 : 0,
      createdAt: asString(row.created_at),
    })),
    performanceSignals: [
      ...performanceSignals.map((row) => {
        const metadata =
          row.metadata && typeof row.metadata === "object"
            ? (row.metadata as Record<string, unknown>)
            : {};
        return {
          id: String(row.id),
          source: "performance_pattern" as const,
          title: String(row.signal ?? "Performance signal").replaceAll(
            "_",
            " ",
          ),
          category: "content_performance",
          summary: truncate(buildPerformanceSummary(row, metadata), 280),
          score:
            typeof row.score === "number" ? row.score : Number(row.score ?? 0),
          createdAt: asString(row.occurred_at),
        };
      }),
      ...winningPatterns.map((row) => ({
        id: String(row.id),
        source: "performance_pattern" as const,
        title: "Winning pattern",
        category: String(row.category ?? "content_performance"),
        summary: truncate(String(row.pattern ?? ""), 280),
        score:
          typeof row.weight === "number" ? row.weight : Number(row.weight ?? 0),
        createdAt: asString(row.last_win_at),
      })),
      ...outreachIntelligence.patternMemory.map((pattern, index) => ({
        id: `outreach-pattern-${index}`,
        source: "performance_pattern" as const,
        title: `Winning ${pattern.patternType}`,
        category: `outreach_${pattern.channel}`,
        summary: truncate(`${pattern.pattern} (${pattern.guidance})`, 280),
        score: pattern.deals > 0 ? 1 : pattern.replies / 10,
        createdAt: outreachIntelligence.generatedAt,
      })),
    ],
  };
}

async function queryMaybe<T extends GenericRow[]>(
  label: string,
  run: () => PromiseLike<{
    data: T | null;
    error: { message?: string; code?: string } | null;
  }>,
): Promise<T> {
  try {
    const result = await run();
    if (result.error) {
      console.warn(
        `[daily-content-context] ${label} skipped: ${result.error.message ?? result.error.code}`,
      );
      return [] as unknown as T;
    }
    return (result.data ?? []) as T;
  } catch (error) {
    console.warn(
      `[daily-content-context] ${label} skipped: ${error instanceof Error ? error.message : String(error)}`,
    );
    return [] as unknown as T;
  }
}

function truncate(value: string, maxLength: number) {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > maxLength
    ? `${compact.slice(0, maxLength - 1).trim()}...`
    : compact;
}

function asString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function buildPerformanceSummary(
  row: GenericRow,
  metadata: Record<string, unknown>,
) {
  const totals =
    metadata.totals && typeof metadata.totals === "object"
      ? (metadata.totals as Record<string, unknown>)
      : {};
  const signals = [
    row.platform ? `Platform: ${row.platform}` : null,
    totals.views ? `Views: ${totals.views}` : null,
    totals.comments ? `Comments: ${totals.comments}` : null,
    totals.shares ? `Shares: ${totals.shares}` : null,
    totals.saves ? `Saves: ${totals.saves}` : null,
    totals.dms_generated ? `DMs: ${totals.dms_generated}` : null,
    totals.leads_generated ? `Leads: ${totals.leads_generated}` : null,
    metadata.paidAdCandidate ? "Potential paid-test candidate" : null,
  ].filter(Boolean);

  return signals.length > 0
    ? signals.join(". ")
    : `Observed ${String(row.signal ?? "performance")} with score ${String(row.score ?? 0)}.`;
}
