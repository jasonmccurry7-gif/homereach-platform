# HomeReach AI Workforce OS - Phase 1A

Date: 2026-05-19

## Purpose

Phase 1A exposes and organizes the AI Workforce foundations that already exist in HomeReach without turning on any new autonomous production behavior.

The priority is consolidation:

- Use the existing AI orchestration stack instead of creating another command center.
- Use the existing Content Intelligence pipeline as the Learning Engine.
- Keep all send, publish, payment, procurement, bid, creative approval, political outreach, and production actions human-controlled.

## What This Phase Connects

Existing foundations now map into one operating model:

- `/admin/agents` - AI workforce registry, readiness, Action Center, briefings, autopilot approvals, and internal tasks.
- `/admin/content-intel` - Learning Engine, powered by the existing Content Intelligence pipeline.
- `/admin/inbox` - revenue messaging and outreach command layer.
- `/admin/gov-contracts` - SAM.gov opportunity operations.
- `/admin/growth` - SEO and growth intelligence surface.
- `/political/candidate-agent` - political campaign agent surface.
- `/inventory-purchasing/dashboard` - procurement savings surface.

## Safety Boundary

Phase 1A does not:

- Send email or SMS.
- Publish website, blog, SEO, or social content.
- Place procurement orders.
- Submit government bids.
- Change Stripe or checkout behavior.
- Change political proposal, checkout, or production locks.
- Trigger autonomous code deployment.
- Create a new database table.
- Create a duplicate dashboard.

## Learning Engine Architecture

The Learning Engine is the existing `content-intel` subsystem with clearer positioning:

1. Ingest trusted sources.
2. Pull transcripts or source text where available.
3. Extract tactical ideas.
4. Score with APEX.
5. Store insights and generated artifacts.
6. Require human review.
7. Learn from win/fail feedback.
8. Later, send approved recommendations into the Unified Action Center.

## Next Safe Phases

1. Broaden the Learning Engine taxonomy beyond home-service categories.
2. Add source-type metadata for YouTube, RSS, webpage, competitor, screenshot, manual note, and API feed.
3. Add duplicate/conflict detection against existing HomeReach routes, APIs, migrations, and dashboard agents.
4. Add "create implementation task" action that writes to the existing Action Center/autopilot internal task flow.
5. Add weekly Learning Engine briefing, dashboard-only first.
6. Add a durable source health panel for YouTube, transcript provider, Anthropic, cron, and Supabase.

## Required Credentials Before Live Ingestion

- `ENABLE_CONTENT_INTEL=true`
- `YOUTUBE_API_KEY`
- `YT_TRANSCRIPT_API_KEY`
- `ANTHROPIC_API_KEY`
- `CONTENT_INTEL_CRON_SECRET`

Keep `DISABLE_CONTENT_INTEL_AI=true` only when testing ingestion without model calls.
