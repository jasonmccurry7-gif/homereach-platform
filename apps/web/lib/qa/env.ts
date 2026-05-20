// ─────────────────────────────────────────────────────────────────────────────
// HomeReach — Q&A Feature Flag Helper
//
// Single source of truth for whether the Sales Intelligence + Q&A system is
// active at runtime. This module is the ONLY check that the Q&A routes,
// components, and nav entries consult.
//
// When ENABLE_QA_SYSTEM is not "true", the Q&A routes return 404, the nav
// entry is not rendered, and no Claude API calls are made.
//
// This file is NEW and does NOT modify apps/web/lib/env.ts (the protected
// core env-validation module). To add ENABLE_QA_SYSTEM to the startup
// validation, follow the pattern in INTEGRATION_PATCH.md.
// ─────────────────────────────────────────────────────────────────────────────

/** True if the Q&A system is enabled for this deployment. */
export function isQaEnabled(): boolean {
  return process.env.ENABLE_QA_SYSTEM === "true";
}

/** True if the AI answer generation is disabled (kill switch). */
export function isQaAiDisabled(): boolean {
  return process.env.DISABLE_QA_AI === "true";
}

/** Per-agent daily AI-answer cap (V1 default: 200). */
export function getQaDailyCap(): number {
  const raw = process.env.QA_DAILY_CAP_PER_AGENT;
  const n = raw ? parseInt(raw, 10) : 200;
  return Number.isFinite(n) && n > 0 ? n : 200;
}

/** Anthropic API key (server-only). Throws if missing when Q&A AI is enabled. */
export function getAnthropicKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error(
      "[qa] ANTHROPIC_API_KEY is not set. Required when ENABLE_QA_SYSTEM=true and DISABLE_QA_AI!=true.",
    );
  }
  return key;
}

/** Claude model for real-time Q&A answer generation. */
export function getQaAnswerModel(): string {
  return process.env.QA_ANSWER_MODEL || "claude-sonnet-4-6";
}

/** Claude (or fallback) model for background ingestion jobs (V2). */
export function getQaIngestionModel(): string {
  return process.env.QA_INGESTION_MODEL || "claude-haiku-4-5-20251001";
}

/**
 * Optional OpenAI embedding key used only as a fallback when Claude embeddings
 * are unavailable. If not set, knowledge search falls back to lexical-only.
 */
export function getEmbeddingKey(): string | null {
  return process.env.QA_EMBEDDING_OPENAI_KEY || null;
}
