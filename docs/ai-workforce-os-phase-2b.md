# AI Workforce OS Phase 2B - Manual Signal Sync

## Added

- `apps/web/lib/ai-orchestration/workforce-memory-sync.ts`
- `sync_signals` operation on `/api/admin/ai-orchestration/workforce-memory`
- `Sync Signals` control in the AI Workforce Data Foundation panel

## What It Does

The manual sync captures high-signal operational context from existing HomeReach systems and writes it into the Phase 2 durable memory foundation:

- Jason/user action readiness
- source freshness warnings
- agent mission-control blockers
- high-priority Action Center items
- Learning Engine ingestion freshness gaps

It creates or updates:

- persistent memory items
- supervised agent tasks
- ingestion queue records
- a workforce sync event

## Safety

This is an admin-triggered sync only. It does not execute the tasks it creates.

It does not:

- send SMS or email
- publish SEO/social content
- submit bids
- place supplier orders
- mutate Stripe or payment records
- launch campaigns
- approve political outreach
- bypass human review

## Go-Live Requirement

Migration `103_ai_workforce_memory_foundation.sql` must be applied before using the sync in production.

## Next Phase

Phase 2C should add domain-specific memory writers for:

- Political candidate strategy selections
- Procurement smart-buy recommendations
- Gov Contracts opportunity decisions
- Outreach lead responses
- Learning Engine approved recommendations
