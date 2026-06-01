# Revenue Critical Systems

Audit date: 2026-05-10

This file defines protected systems, expected behavior, observed files, and change controls.

## Protected Change Control

Before changing any protected flow:

1. Snapshot files and current behavior.
2. Confirm relevant env vars without exposing values.
3. Identify DB tables touched.
4. Test locally/staging with test provider credentials.
5. Create rollback path.
6. Validate with non-destructive smoke tests.

## Homepage CTA To Intake

| Area | Files |
| --- | --- |
| Homepage | `apps/web/app/page.tsx` |
| Funnel shell | `apps/web/app/(funnel)/layout.tsx` |
| City selection | `apps/web/app/(funnel)/get-started/page.tsx` |
| Data | `apps/web/lib/funnel/queries.ts` |

Flow:

1. User lands on `/`.
2. CTA routes to `/get-started`.
3. Active cities load from `cities`.
4. City cards link to `/get-started/:citySlug`.

Risk: availability numbers are estimated in `getActiveCities`; not a strict inventory lock.

## City Selection And Category Exclusivity

| Area | Files |
| --- | --- |
| City route | `apps/web/app/(funnel)/get-started/[citySlug]/page.tsx` |
| Category route | `apps/web/app/(funnel)/get-started/[citySlug]/[categorySlug]/page.tsx` |
| Queries | `apps/web/lib/funnel/queries.ts` |
| Spot API | `apps/web/app/api/spots/availability/route.ts`, `apps/web/app/api/spots/resolve/route.ts` |

Tables:

- `cities`
- `categories`
- `orders`
- `businesses`
- `spot_assignments`
- `bundles`

Risk: different paths use different sources of truth. Funnel bundle availability counts paid/active `orders`; `/api/spots/availability` checks `spot_assignments`. These must be reconciled before production scale.

## Spot Selection And Checkout

| Area | Files |
| --- | --- |
| Spot selection page | `apps/web/app/spots/[citySlug]/[categorySlug]/page.tsx` |
| Spot checkout | `apps/web/app/api/spots/checkout/route.ts` |
| Legacy/general Stripe checkout | `apps/web/app/api/stripe/checkout/route.ts` |
| Stripe service | `packages/services/src/stripe/index.ts` |
| Stripe webhook | `apps/web/app/api/webhooks/stripe/route.ts` |

Flow:

1. User picks city/category.
2. App resolves slugs to IDs.
3. App checks availability.
4. Checkout route creates or reuses pending business.
5. Checkout route creates pending order/reservation.
6. Stripe Checkout session is created.
7. Stripe webhook marks order paid and business active.
8. Marketing campaign is created.

Risks:

- Original git-backed repo has type/export issues around db schema.
- Stripe API versions differ between routes/package service.
- Reservation/availability source of truth is inconsistent between `orders` and `spot_assignments`.
- Webhook has no dedicated processed-events ledger.

## Auth/Login

| Area | Files |
| --- | --- |
| Login | `apps/web/app/(auth)/login/*` |
| Signup | `apps/web/app/(auth)/signup/*` |
| Password reset | `apps/web/app/(auth)/forgot-password/*`, `apps/web/app/(auth)/reset-password/*` |
| Middleware | `apps/web/middleware.ts` |
| Supabase clients | `apps/web/lib/supabase/*` |
| Auth actions | `apps/web/app/actions/auth.ts` |

Risk: admin APIs under `/api/admin/*` are not protected by middleware path matching and need route-level role guards.

## Client Dashboard

| Area | Files |
| --- | --- |
| Dashboard layout | `apps/web/app/(dashboard)/layout.tsx` |
| Dashboard | `apps/web/app/(dashboard)/dashboard/page.tsx` |
| Billing | `apps/web/app/(dashboard)/billing/page.tsx` |
| Campaign | `apps/web/app/(dashboard)/campaign/page.tsx` |
| Replies | `apps/web/app/(dashboard)/replies/page.tsx` |
| Settings | `apps/web/app/(dashboard)/settings/*` |

Protected by middleware for authenticated users.

## Admin/Sales Dashboard

Admin surfaces include CRM, sales dashboard, sales engine, leads, intake, spots, pricing, political, content intel, QA, agents, operator, and war room.

Risks:

- Page routes redirect to login as expected in local smoke tests.
- API routes require a separate auth audit and hardening pass.
- Several admin pages use service role or server clients.

## SMS And Email

SMS:

- Send paths exist in sales events, nudge, close-deal, Facebook alerts, services outreach.
- Inbound Twilio webhook: `/api/webhooks/outreach/sms`.
- Status callback webhook: `/api/webhooks/twilio/status`.

Email:

- Mailgun is used in several admin/sales routes.
- Resend is used by `packages/services/src/outreach/index.ts`.
- Postmark webhook observability exists.
- Postmark sending helper exists but is not fully wired.

Risk: provider routing is fragmented. A production email provider policy is needed before bulk sending.

## Political Revenue Flow

| Area | Files |
| --- | --- |
| Public political pages | `apps/web/app/political/*` |
| Admin political dashboard | `apps/web/app/(admin)/admin/political/*` |
| Quote engine | `apps/web/lib/political/quote.ts` |
| Proposal helpers | `apps/web/lib/political/proposals.ts` |
| Contract helpers | `apps/web/lib/political/contracts.ts` |
| Public proposal | `apps/web/app/p/[token]/*` |
| Public contract | `apps/web/app/c/[token]/*` |

Known limitation from docs: political payment status relies on success redirect; closing the tab after Stripe payment can leave order pending until manual reconciliation.

