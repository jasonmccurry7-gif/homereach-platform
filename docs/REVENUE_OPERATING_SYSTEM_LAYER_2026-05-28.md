# Revenue Operating System Layer

## Purpose

The Daily Revenue Command Center turns the HomeReach admin homepage into the executive revenue operating layer. It is additive over the existing CRM, daily outreach, revenue messaging, approval queue, intake, deliverability, Postmark/Twilio webhooks, AI Workforce, political tools, and procurement systems.

## What It Adds

- Canonical revenue pipeline stages for every lead/opportunity.
- Lead scoring fields for engagement, response likelihood, urgency, conversion probability, and revenue priority.
- Unified `revenue_pipeline_items` table for sales leads, outreach prospects, intake recovery, approvals, and future channels.
- Unified `revenue_pipeline_tasks` table for next actions, reminders, approval tasks, follow-ups, reply tasks, and intake recovery.
- `revenue_strategy_insights` for AI/CRO recommendations on focus, scaling, pausing, messaging, timing, and sender performance.
- Admin homepage replacement: `Daily Revenue Command Center`.

## Required Pipeline Stages

- New Lead
- AI Queued
- Outreach Scheduled
- Email Sent
- Awaiting Response
- Follow-Up #1
- Follow-Up #2
- Follow-Up #3
- Replied
- Interested
- Intake Started
- Intake Completed
- Proposal Sent
- Negotiation
- Closed Won
- Closed Lost
- Future Opportunity
- Do Not Contact

## Existing Systems Preserved

- Stripe checkout and webhook flows.
- Intake form mutation paths.
- Auth/login.
- City/category exclusivity logic.
- Political campaign dashboards.
- Daily outreach sender controls.
- Revenue message approval queues.
- Deliverability and suppression tables.
- Postmark/Twilio webhook processing.

## Files

- `supabase/migrations/20260528150901_revenue_operating_system_layer.sql`
- `supabase/migrations/20260528154708_revenue_pipeline_task_fk_indexes.sql`
- `apps/web/lib/revenue-os/types.ts`
- `apps/web/lib/revenue-os/snapshot.ts`
- `apps/web/components/revenue-os/daily-revenue-command-center.tsx`
- `apps/web/app/(admin)/admin/page.tsx`
- `packages/db/src/schema/revenueOs.ts`
- `packages/db/src/schema/sales.ts`
- `packages/db/src/schema/index.ts`

## Rollout Notes

1. Production Supabase has the revenue operating system layer applied.
2. The admin homepage can still render with a `sales_leads` fallback if the migration is not applied in another environment, but it will show a partial-data warning.
3. Keep outbound sending approval-gated. This layer prioritizes and recommends; it does not bypass human approval.
4. Deploy to Vercel after reviewing the current dirty worktree, because many unrelated files are already modified.

## Verification

- `pnpm --dir apps/web exec tsc --noEmit --pretty false --skipLibCheck`
- `pnpm --dir packages/db exec tsc --noEmit --pretty false --skipLibCheck`
- `pnpm --dir packages/services exec tsc --noEmit --pretty false --skipLibCheck`
- `pnpm --dir apps/web run build`

## Known Rollout Blocker

Local Supabase was not running on `127.0.0.1:54322`, so local migration-list verification was unavailable. Production Supabase was verified through the Supabase connector after applying the migration.

## Production Supabase Verification

- `revenue_pipeline_items`: 4,138 rows.
- `revenue_pipeline_tasks`: 4,136 rows.
- `revenue_strategy_insights`: 2 seeded executive strategy guardrails.
- RLS enabled on all three new revenue tables.
- Covering indexes verified for all `revenue_pipeline_tasks` foreign keys.
