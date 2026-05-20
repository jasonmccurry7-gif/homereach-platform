# `lib/seo/` - SEO Deployment Engine

Scaffolding for the HomeReach SEO Deployment Engine. Mirrors the pattern established by `lib/content-intel/` and `lib/qa/`.

**Status:** Step 5 of the 20-step plan. Flag-gated. No live surface depends on this yet.

## Feature flags

| Env var | Default | Effect when ON |
|---|---|---|
| `ENABLE_SEO_ENGINE` | unset (off) | Master switch. Turns on `/advertise/*`, `/targeted/[citySlug]`, admin API, registry reads. |
| `ENABLE_SEO_DRAFT_GENERATION` | unset (off) | Enables the Claude-powered draft generation endpoint. Requires `ENABLE_SEO_ENGINE=true` also. |
| `ENABLE_SEO_LEGACY_REDIRECT` | unset (off) | Enables the additive 301 precheck in `app/[slug]/page.tsx`. |
| `SEO_PREVIEW_TOKEN_SECRET` | unset | HMAC secret for preview tokens. Unset disables preview. |
| `SEO_PUBLISHED_CAP` | `50` | Max published pages in v1. Publish is blocked past this. |
| `SEO_PUBLISH_RATE_LIMIT` | `3` | Max publishes per 24h window in v1. |
| `SEO_DRAFT_MODEL` | `claude-sonnet-4-6` | Claude model for draft generation. |

## Files

- `env.ts` - feature flag + config helpers
- `registry.ts` - Supabase reads for seo_pages
- `blocks.ts` - TypeScript types for the 15-block content catalog
- `schema.ts` - JSON-LD builders (Organization, WebSite, Service, FAQPage, BreadcrumbList, LocalBusiness)
- `quality.ts` - wrapper around `seo_pages_quality_check()` RPC + CTA HEAD check
- `inventory-rules.ts` - wrapper around `seo_pages_inventory_ok()` RPC + live scarcity reads
- `preview.ts` - HMAC preview tokens (1h TTL)
- `README.md` - this file

## Usage boundaries

**This library is library-only.** Nothing in `lib/seo/` imports from or is imported by a live surface outside `lib/seo/` and `components/seo/` until Step 10 ships the public render routes.

**Every exported function short-circuits when `ENABLE_SEO_ENGINE` is off.** Flag-off equivalent: library is dead code.

## Reference docs

- `SEO_Inspection_Report.md` - current codebase audit
- `SEO_v0_Foundation_and_URL_Strategy.md` - sitemap/robots/analytics + legacy decision framework
- `SEO_Page_System_Design.md` - 4 page types, 15 block catalog, content quality rules
- `SEO_Deployment_Engine_Spec.md` - data model, admin workflow, rollout, safety
- `SEO_Growth_OS_20_Steps.md` - the full 20-step implementation plan

## Migration

- `supabase/migrations/059_seo_pages.sql` - creates `seo_pages`, `seo_page_versions`, `seo_pages_quality_check()`, `seo_pages_inventory_ok()`, version trigger, RLS policies
- `supabase/migrations/060_drop_seo_engine.sql` - rollback; applies cleanly with `IF EXISTS` guards

## Rollback

Three tiers:

1. Unset `ENABLE_SEO_ENGINE` in Vercel env. All surfaces 404 in ~30s.
2. `UPDATE seo_pages SET status = 'archived' WHERE ...` to take specific pages offline.
3. Apply `060_drop_seo_engine.sql` in Supabase SQL editor to drop all engine tables, functions, policies.
