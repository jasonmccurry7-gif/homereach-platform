# HomeReach AI Workforce OS - Phase 1B

Date: 2026-05-19

## Purpose

Phase 1B broadens the Learning Engine from a home-service sales research feed into a full HomeReach AI Workforce OS research layer.

This phase remains additive and review-only.

## Added Learning Categories

The Learning Engine now recognizes these admin-only lanes:

- shared postcards
- targeted campaigns
- political
- procurement
- outreach
- SEO
- inventory
- AI agents
- revenue
- executive operations
- system reliability
- automation
- dashboard UX
- government contracts
- creative
- sales scaling

The existing home-service categories remain intact and are still the only categories shown to sales agents through the sales dashboard cards.

## Pipeline Behavior

The daily rotation now covers the broader Learning Engine categories when matching `ci_category_topics` rows exist. The pipeline remains:

- feature-flagged by `ENABLE_CONTENT_INTEL`
- capped by `CONTENT_INTEL_DAILY_CAP`
- transcript-gated where configured
- human-reviewed before action

## Safety Boundary

This phase does not:

- Send outreach.
- Publish content.
- Create public pages.
- Place orders.
- Submit bids.
- Change Stripe/payment flows.
- Change political checkout locks.
- Execute code deployments.

## Database Change

Migration `102_learning_engine_taxonomy.sql` adds/refreshes topic seeds in `ci_category_topics`.

It does not create new tables or modify protected production tables.

## Next Safe Phase

Phase 1C should connect approved Learning Engine insights to the existing Unified Action Center as internal implementation tasks. That should reuse the existing `unified_action_items`, `ai_autopilot_approval_requests`, `ai_autopilot_execution_runs`, and `crm_tasks` flow instead of creating another backlog.
