# AI COO Operating Layer Service Kit

## Positioning

AI COO is HomeReach's internal-first operating intelligence layer. It is not sold as a standalone public product yet. Its job is to help clients and operators answer one question quickly:

What should happen next?

## Production Scope

- Client dashboard: `/dashboard`
- Admin queue: `/admin/ai-coo-queue`
- Recommendation feed API: `/api/ai-coo/recommendations`
- Admin generation API: `/api/admin/ai-coo/generate`
- Recommendation action API: `/api/ai-coo/recommendations/[recommendationId]`
- Smoke test: `pnpm smoke:ai-coo`

## What It Does

- Finds revenue, cost savings, reputation, growth, risk, renewal, and upsell opportunities from existing HomeReach records.
- Prioritizes recommendations by value, urgency, and confidence.
- Shows a short client feed instead of overwhelming dashboards.
- Routes the full queue to admin for review.
- Generates copyable drafts when available.
- Tracks recommendation actions, status changes, and copy events.
- Stores client success scores and recommendation history for Business Memory.

## What It Does Not Do

- It does not send outreach.
- It does not launch campaigns.
- It does not change pricing or subscriptions.
- It does not charge customers.
- It does not publish content.
- It does not place vendor orders or commit spend.
- It does not guarantee revenue, savings, leads, rankings, approvals, or outcomes.

## Approval Gates

Human approval is required before any downstream action moves beyond advisory status, including:

- Customer-facing outreach.
- Campaign creation or launch.
- Proposal or pricing use.
- Payment, subscription, refund, or discount changes.
- Political, procurement, SAM.gov, legal, or compliance-sensitive outputs.

## Operating Workflow

1. Admin opens `/admin/ai-coo-queue`.
2. Admin clicks `Generate Recommendations`.
3. AI COO refreshes recommendations from current records and connected internal engines.
4. Admin reviews priority, confidence, estimated value, and recommended action.
5. Admin approves, assigns, drafts, dismisses, or creates a downstream task.
6. Client sees only the highest-signal opportunities in `/dashboard`.
7. Accepted, dismissed, copied, and completed actions are logged to recommendation history.
8. Business Memory ingests the resulting recommendation and action history.

## Feature Flags

- `ENABLE_AI_COO`
- `ENABLE_AI_COO_QUEUE`
- `ENABLE_AI_COO_RECOMMENDATIONS`
- `ENABLE_AI_COO_DRAFTS`
- `ENABLE_AI_COO_SCORES`
- `ENABLE_AI_COO_CLIENT_FEED`
- `ENABLE_AI_COO_ADMIN_QUEUE`

Flags default on unless set to `false`. If Supabase persistence is unavailable, UI and APIs degrade to safe mode.

## Database Layer

AI COO depends on these existing tables:

- `opportunity_categories`
- `ai_coo_recommendations`
- `ai_coo_actions`
- `ai_coo_drafts`
- `client_success_scores`
- `recommendation_history`

The smoke test checks table reachability, required opportunity categories, route protection, and API guardrails without mutating production data.

## Reporting Metrics

- Recommendations generated.
- Approved recommendations.
- Dismissed recommendations.
- Completed recommendations.
- Estimated revenue value.
- Estimated savings value.
- Acceptance rate.
- Client success score.
- Recommendation history and action counts.

## Rollback

- Set `ENABLE_AI_COO=false` to hide the layer.
- Set `ENABLE_AI_COO_CLIENT_FEED=false` to hide client dashboard recommendations while keeping admin review available.
- Set `ENABLE_AI_COO_ADMIN_QUEUE=false` to disable the admin queue.
- Remove the catalog smoke command only after replacing it with equivalent production verification.

## Production Verification

Run:

```bash
pnpm smoke:ai-coo
pnpm smoke:service-catalog
pnpm smoke:foundation
```

Expected behavior:

- `/dashboard` is protected or loads for an authenticated client.
- `/admin/ai-coo-queue` is protected or loads for an authenticated admin.
- Unauthenticated recommendation feed, generation, and action APIs return `401` or `403`.
- Required AI COO tables are reachable when Supabase service credentials exist.
- Required opportunity categories exist.
