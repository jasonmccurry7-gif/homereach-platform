# Tech Debt Report

Audit date: 2026-05-10

## Structural Debt

- Two migration streams exist: `packages/db/supabase/migrations` and `supabase/migrations`.
- Drizzle schema source does not cover every table in migrations.
- Barrel exports lag behind feature additions.
- Generated/runtime artifacts are mixed into the repo root.
- Active development happened in OneDrive, causing dependency traversal instability.

## Architecture Debt

- API route authorization is decentralized.
- Service role client is easy to import without a guard contract.
- Provider integrations are scattered across route handlers and packages.
- Email provider strategy is unclear: Mailgun, Resend, and Postmark all exist.
- Stripe checkout logic is duplicated across spot, general, targeted, intelligence, and political flows.
- Spot inventory logic uses more than one truth source.

## Product/Feature Debt

- Political data acquisition has deliberate Phase 1A gaps: review approval does not promote to live tables yet.
- Political crawler tables are placeholders; no crawler executes today.
- Political payment webhook is missing.
- Mobile app is placeholder.
- Content/SEO generation has placeholder rendering areas.
- Review engine send path is not fully live.

## QA Debt

- Existing tests are limited, primarily pricing tests.
- No broad route/API contract test suite.
- No auth matrix tests for admin APIs.
- No webhook replay/idempotency tests.
- No smoke script that exercises the full public funnel without provider side effects.

## Observability Debt

- Twilio and email observability tables exist.
- Stripe lacks processed event ledger.
- Admin cron execution logs are inconsistent by subsystem.
- Provider send failures often log but do not surface operator alerts.

## Recommended Debt Burn-Down

1. Create `docs/system-intelligence` generated inventories after moving to clean local git copy.
2. Add shared auth/cron/provider guard helpers.
3. Normalize provider send modules.
4. Introduce a canonical DB migration ledger.
5. Add route-level smoke tests.
6. Add webhook replay tests.
7. Add a production readiness CI job.

