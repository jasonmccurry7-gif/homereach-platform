// ─────────────────────────────────────────────────────────────────────────────
// HomeReach — Q&A Usage Logger & Daily Cap
// ─────────────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from "@supabase/supabase-js";
import { getQaDailyCap } from "./env";

type SupaClient = SupabaseClient<any, any, any>;

export type UsageEventType =
  | "question_asked"
  | "answer_generated"
  | "answer_generation_failed"
  | "reply_added"
  | "script_copied"
  | "attached_to_lead"
  | "marked_best"
  | "marked_official"
  | "knowledge_searched"
  | "dedupe_checked";

export async function logUsage(
  supa: SupaClient,
  row: {
    eventType: UsageEventType;
    agentId: string;
    questionId?: string | null;
    answerId?: string | null;
    replyId?: string | null;
    scriptId?: string | null;
    leadId?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    await supa.from("qa_usage_logs").insert({
      event_type: row.eventType,
      agent_id: row.agentId,
      question_id: row.questionId ?? null,
      answer_id: row.answerId ?? null,
      reply_id: row.replyId ?? null,
      script_id: row.scriptId ?? null,
      lead_id: row.leadId ?? null,
      metadata: row.metadata ?? {},
    });
  } catch (err) {
    // Never let logging fail a user request — just console the error.
    console.error("[qa] usage log failed:", err);
  }
}

/**
 * Checks if the agent has exceeded today's AI-answer cap.
 * Returns { capped, count, cap } so the caller can show a soft-warning UI.
 */
export async function checkDailyCap(
  supa: SupaClient,
  agentId: string,
): Promise<{ capped: boolean; count: number; cap: number }> {
  const cap = getQaDailyCap();
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);

  const { count, error } = await supa
    .from("qa_usage_logs")
    .select("id", { count: "exact", head: true })
    .eq("agent_id", agentId)
    .eq("event_type", "answer_generated")
    .gte("created_at", since.toISOString());

  if (error) {
    // Fail open: do not block users if the cap check query fails.
    return { capped: false, count: 0, cap };
  }

  const n = count ?? 0;
  return { capped: n >= cap, count: n, cap };
}
