# AI Workforce OS Phase 2C - Domain Memory Writers

## Added

- `apps/web/lib/ai-orchestration/workforce-domain-sync.ts`
- `sync_domain_memory` operation on `/api/admin/ai-orchestration/workforce-memory`
- `Sync Domain Memory` control in the AI Workforce Data Foundation panel

## What It Captures

This phase lets existing HomeReach business domains write high-signal context into the shared AI Workforce memory foundation:

- Political candidate targets, creative review needs, and launch-plan status
- Inventory/procurement outreach sequence status
- Gov Contracts strong-fit opportunities and review tasks
- Outreach/revenue messaging replies and approval queue items
- Learning Engine insights, enhancements, automations, and review items

## Safety

This is still manual and admin-triggered. It creates memory, supervised tasks, ingestion review records, and event logs only.

It does not:

- send SMS, email, or DMs
- publish SEO/social content
- submit government bids
- place supplier orders
- mutate Stripe or payment records
- launch political campaigns
- approve political outreach
- infer individual voter beliefs or create voter-level persuasion scores

## Political Compliance Boundary

Political records are stored only as candidate, creative, geography, plan, approval, and operations context. The sync does not create individual ideology scoring, voter persuasion scoring, protected-class targeting, or voter-level turnout predictions.

## Go-Live Requirement

Migration `103_ai_workforce_memory_foundation.sql` must be applied before using the domain sync in production.

## Next Phase

Phase 2D should connect domain-specific UI actions to write memory automatically when a human approves, rejects, comments, or moves a record between workflow states.
