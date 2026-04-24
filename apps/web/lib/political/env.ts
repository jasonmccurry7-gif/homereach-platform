// ─────────────────────────────────────────────────────────────────────────────
// HomeReach — Political Command Center Feature Flag + Config Helpers
//
// Single source of truth for whether the Political Command Center is active
// at runtime. Modeled on lib/qa/env.ts, lib/content-intel/env.ts, and
// lib/lead-intel/env.ts — the approved per-subsystem flag pattern.
//
// Flag-off behavior (ENABLE_POLITICAL unset or not "true"):
//   - Every /admin/political* route returns 404
//   - Every /api/admin/political/* route returns 404
//   - The admin nav "Political" entry is not rendered
//   - No database writes against political_* tables
//   - No Anthropic / Claude API calls from this subsystem
//
// Kill switch (DISABLE_POLITICAL_AI=true):
//   - Freezes any AI-driven suggestion features in this subsystem while
//     keeping UI read-only and manual workflows intact. Mirrors the
//     DISABLE_CONTENT_INTEL_AI pattern.
//
// This file is NEW and does NOT modify apps/web/lib/env.ts (protected core).
//
// Non-negotiable compliance note: nothing in this module infers, predicts,
// or scores political beliefs, ideology, voter behavior, or persuasion
// likelihood. All "scoring" helpers that land in later phases operate
// only on operational signals (contact completeness, recency, election
// proximity). Enforced at code review; any future contributor editing
// this file must preserve that boundary.
// ─────────────────────────────────────────────────────────────────────────────

/** True if the entire Political Command Center is enabled. */
export function isPoliticalEnabled(): boolean {
  return process.env.ENABLE_POLITICAL === "true";
}

/**
 * Kill switch: freezes AI-driven suggestions (script generation, follow-up
 * drafting, etc.) while keeping the rest of the political UI usable. When
 * true, components should fall back to the static script library and not
 * call any AI provider.
 */
export function isPoliticalAiDisabled(): boolean {
  return process.env.DISABLE_POLITICAL_AI === "true";
}

/**
 * Anthropic key — reused from the QA / Content Intel subsystems.
 * Throws if accessed when the AI side is supposed to be active but the key
 * is missing, so a misconfiguration fails loudly instead of silently
 * producing empty suggestions.
 */
export function getAnthropicKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error(
      "[political] ANTHROPIC_API_KEY is not set. Required when ENABLE_POLITICAL=true and DISABLE_POLITICAL_AI is not set.",
    );
  }
  return key;
}

/**
 * Claude model for neutral script suggestions. Defaults to the cheap, fast
 * haiku tier (matches content-intel). Can be overridden per environment.
 */
export function getPoliticalAssistantModel(): string {
  return process.env.POLITICAL_ASSISTANT_MODEL || "claude-haiku-4-5-20251001";
}

/**
 * Quote engine configuration — safe-by-default overrides so the pricing
 * lookup tables ship without an env change. These mirror the brief's
 * default pricing bands and can be shifted per-deployment for A/B testing
 * without a code change.
 */

/** Cap on political_campaign rows returned by a single dashboard query. */
export function getDashboardRowCap(): number {
  const raw = process.env.POLITICAL_DASHBOARD_ROW_CAP;
  const n = raw ? parseInt(raw, 10) : 500;
  return Number.isFinite(n) && n > 0 ? n : 500;
}

/**
 * Shared secret required by the political cron trigger endpoint.
 *
 * Resolution order:
 *   1. POLITICAL_CRON_SECRET     — optional dedicated secret for this subsystem
 *   2. CONTENT_INTEL_CRON_SECRET — reused so operators don't have to juggle
 *      a second env var (matches the lead-intel convention)
 *   3. CRON_SECRET               — Vercel's standard env var for its built-in
 *      Cron feature. When the cron is configured via apps/web/vercel.json,
 *      Vercel sends `Authorization: Bearer ${CRON_SECRET}`. Including it
 *      here means an operator can enable Vercel Cron by setting CRON_SECRET
 *      alone (no need to duplicate the value into the two above names).
 *   4. null                      — endpoint returns 503 "Cron not configured"
 *
 * Any ONE of the three env vars being set enables the endpoint. That's
 * intentional — the operator picks whichever convention fits their setup,
 * and the guard checks all three on every request (cheap string comparisons).
 */
export function getPoliticalCronSecret(): string | null {
  return (
    process.env.POLITICAL_CRON_SECRET ||
    process.env.CONTENT_INTEL_CRON_SECRET ||
    process.env.CRON_SECRET ||
    null
  );
}
