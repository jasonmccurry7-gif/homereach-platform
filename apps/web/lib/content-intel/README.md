# HomeReach Content Intelligence — Operator Guide

Daily YouTube → APEX → Sales dashboard pipeline. Built additively, fully flag-gated.
Approved and implemented 2026-04-18.

## Required env vars (set in Vercel before flipping the flag)

| Var | Required | Notes |
|---|---|---|
| `ENABLE_CONTENT_INTEL` | yes | Master flag. Must be `"true"` to activate. |
| `DISABLE_CONTENT_INTEL_AI` | no | Kill switch. `"true"` = no Claude calls, UI read-only. |
| `YOUTUBE_API_KEY` | yes | YouTube Data API v3. Free tier ≈ 10k units/day; one search ≈ 100 units. |
| `YT_TRANSCRIPT_API_KEY` | yes | Supadata (or equivalent). Env var name: `YT_TRANSCRIPT_API_KEY`. |
| `CONTENT_INTEL_TRANSCRIPT_BASE` | no | Overrides the default `https://api.supadata.ai/v1`. |
| `CONTENT_INTEL_CRON_SECRET` | yes | Random string. Required by the scheduled task to hit `/cron/run`. |
| `CONTENT_INTEL_DAILY_CAP` | no | Default 15. Hard cap on videos ingested per run. |
| `ANTHROPIC_API_KEY` | yes | Shared with the Q&A subsystem. |
| `CONTENT_INTEL_EXTRACTOR_MODEL` | no | Default `claude-haiku-4-5-20251001`. |
| `CONTENT_INTEL_TRANSLATOR_MODEL` | no | Default `claude-haiku-4-5-20251001`. |

## Launch checklist

1. **Apply migrations** 052, 053, 054 in order (Supabase SQL editor or CLI).
2. **Set env vars** in Vercel for production.
3. **Flip the flag**: set `ENABLE_CONTENT_INTEL=true` and redeploy.
4. **Confirm the scheduled task** is registered: `homereach-content-intel-daily` (6:00 AM local daily).
5. **Smoke test**:
   ```bash
   curl -X POST https://YOUR_HOST/api/admin/content-intel/cron/run \
     -H "Authorization: Bearer $CONTENT_INTEL_CRON_SECRET"
   ```
   Expect JSON summary with `ok:true`.
6. **Open `/admin/content-intel`** — review the ingestion queue + insights.
7. **Open `/admin/sales-dashboard`** — three new cards appear above the existing widget.

## Instant kill

Set **any one** of these and redeploy:

- `ENABLE_CONTENT_INTEL=false` → entire subsystem 404s, UI hidden.
- `DISABLE_CONTENT_INTEL_AI=true` → no Claude calls (transcripts still fetched).
- Change `CONTENT_INTEL_CRON_SECRET` → scheduled task stops working until updated.

## What's protected (never touched)

- All migrations 001–051
- `lib/env.ts` (startup env validation)
- Stripe, Twilio, Mailgun, auth, intake, spots, QA subsystem
- Any table without the `ci_` prefix

## Data model

- `ci_category_topics` → per-category YouTube search terms
- `ci_trusted_channels` → force-include list (Dan Martell seeded)
- `ci_ingestion_rules` → global knobs (single row, `id='default'`)
- `ci_theme_performance_memory` → learned weights per (category, theme)
- `ci_ingestion_queue` → every video ever fetched (dedup PK)
- `ci_insights` → tactical takeaways with APEX sub-scores
- `ci_actions`, `ci_scripts`, `ci_offers`, `ci_automations`, `ci_enhancements` → execution artifacts
- `ci_patterns` → promoted winning themes
- `ci_outcome_events` → win/neutral/fail feedback
- `ci_weight_deltas` → learning audit log

## Output caps (per pipeline run)

Enforced by `apex-filter.ts`:

- 3 actions
- 2 scripts
- 1 offer
- 1 automation
- 1 enhancement

APEX threshold: insight must score ≥15 (sum of revenue + speed + ease + advantage, each 1..5).

## Category rotation

6 verticals × 3 videos = 18 > 15 daily cap. Rotation by UTC weekday is defined in `pipeline.ts` `VERTICAL_ROTATION`. Dan Martell is forced-included every day regardless.

## If something breaks

1. Check `/admin/content-intel` → Queue tab for `status=failed` rows with `skip_reason`.
2. Check Vercel logs for `[content-intel]` prefixed errors.
3. Set `DISABLE_CONTENT_INTEL_AI=true` to halt Claude spend while you diagnose.
4. Hard-revert: delete the single line `<ContentIntelCards />` + its import in `apps/web/app/(admin)/admin/sales-dashboard/page.tsx`, and set `ENABLE_CONTENT_INTEL=false`. Nothing else depends on this subsystem.
