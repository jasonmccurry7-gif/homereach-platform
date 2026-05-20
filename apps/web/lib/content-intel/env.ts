// ─────────────────────────────────────────────────────────────────────────────
// HomeReach — Content Intelligence Feature Flag + Config Helpers
//
// Single source of truth for whether the Content Intelligence pipeline is
// active at runtime. Modeled on lib/qa/env.ts (the QA precedent that was
// approved 2026-04-17).
//
// Flag-off behavior:
//   - Every /api/admin/content-intel/* route returns 404
//   - No YouTube API calls
//   - No Supadata transcript fetches
//   - No Claude API calls
//   - The ContentIntelCards component renders null
//   - The admin nav entry is not rendered
//
// This file is NEW and does NOT modify apps/web/lib/env.ts.
// ─────────────────────────────────────────────────────────────────────────────

/** True if the entire Content Intelligence system is enabled. */
export function isContentIntelEnabled(): boolean {
  return process.env.ENABLE_CONTENT_INTEL === "true";
}

/** Kill switch: freezes Claude API calls while keeping UI read-only. */
export function isContentIntelAiDisabled(): boolean {
  return process.env.DISABLE_CONTENT_INTEL_AI === "true";
}

/** Hard cap on videos ingested per pipeline run. Default 15. */
export function getDailyVideoCap(): number {
  const raw = process.env.CONTENT_INTEL_DAILY_CAP;
  const n = raw ? parseInt(raw, 10) : 15;
  return Number.isFinite(n) && n > 0 ? n : 15;
}

/** Shared secret required by the cron trigger endpoint. */
export function getCronSecret(): string | null {
  return process.env.CONTENT_INTEL_CRON_SECRET || null;
}

/** YouTube Data API v3 key. */
export function getYoutubeKey(): string {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    throw new Error(
      "[content-intel] YOUTUBE_API_KEY is not set. Required when ENABLE_CONTENT_INTEL=true.",
    );
  }
  return key;
}

/** Transcript provider API key (Supadata or equivalent). */
export function getTranscriptKey(): string {
  const key = process.env.YT_TRANSCRIPT_API_KEY;
  if (!key) {
    throw new Error(
      "[content-intel] YT_TRANSCRIPT_API_KEY is not set. Required when ENABLE_CONTENT_INTEL=true.",
    );
  }
  return key;
}

/** Anthropic key — reused from the QA subsystem. */
export function getAnthropicKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error("[content-intel] ANTHROPIC_API_KEY is not set.");
  }
  return key;
}

/** Claude model for insight extraction (cheap, high-volume). */
export function getExtractorModel(): string {
  return process.env.CONTENT_INTEL_EXTRACTOR_MODEL || "claude-haiku-4-5-20251001";
}

/** Claude model for Dan Martell SaaS→services translation. */
export function getTranslatorModel(): string {
  return process.env.CONTENT_INTEL_TRANSLATOR_MODEL || "claude-haiku-4-5-20251001";
}
