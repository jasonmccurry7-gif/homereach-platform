// ─────────────────────────────────────────────────────────────────────────────
// HomeReach SEO Engine - Feature Flag + Config Helpers
//
// Single source of truth for whether the SEO Deployment Engine is active.
// Modeled on lib/content-intel/env.ts (approved pattern).
//
// Flag-off behavior (ENABLE_SEO_ENGINE unset or != "true"):
//   - Every /api/admin/seo-engine/* route returns 404
//   - Every /advertise/* and /targeted/[citySlug] public route returns 404
//   - lib/seo/* registry reads return null/[]
//   - sitemap excludes all seo_pages rows
//   - No Claude API calls
//   - Admin UI renders null (v2)
//
// Foundation JSON-LD (Organization + WebSite) is NOT gated - those emit
// regardless as site-wide brand primitives.
// ─────────────────────────────────────────────────────────────────────────────

/** True if the entire SEO Deployment Engine is enabled. */
export function isSeoEngineEnabled(): boolean {
  return process.env.ENABLE_SEO_ENGINE === "true";
}

/** Double-flag gate for Claude-powered draft generation. Off by default. */
export function isSeoDraftGenerationEnabled(): boolean {
  return process.env.ENABLE_SEO_DRAFT_GENERATION === "true";
}

/** Gates the additive 301 redirect precheck in app/[slug]/page.tsx. */
export function isSeoLegacyRedirectEnabled(): boolean {
  return process.env.ENABLE_SEO_LEGACY_REDIRECT === "true";
}

/** Max published pages allowed in v1. Publish is blocked past this. */
export function getPublishedCap(): number {
  const raw = process.env.SEO_PUBLISHED_CAP;
  const n = raw ? parseInt(raw, 10) : 50;
  return Number.isFinite(n) && n > 0 ? n : 50;
}

/** Max publishes per 24h window in v1. Rate-limits accidental mass publishes. */
export function getPublishRateLimit(): number {
  const raw = process.env.SEO_PUBLISH_RATE_LIMIT;
  const n = raw ? parseInt(raw, 10) : 3;
  return Number.isFinite(n) && n > 0 ? n : 3;
}

/** HMAC secret for preview tokens. Unset disables preview. */
export function getPreviewSecret(): string | null {
  return process.env.SEO_PREVIEW_TOKEN_SECRET || null;
}

/** Anthropic key - reused from QA / Content Intel. */
export function getAnthropicKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error("[seo] ANTHROPIC_API_KEY is not set. Required when ENABLE_SEO_DRAFT_GENERATION=true.");
  }
  return key;
}

/** Claude model for draft generation. Default matches QA/content-intel defaults. */
export function getDraftModel(): string {
  return process.env.SEO_DRAFT_MODEL || "claude-sonnet-4-6";
}
