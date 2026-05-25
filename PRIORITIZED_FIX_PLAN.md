# Prioritized Fix Plan

Updated: 2026-05-24

## CRITICAL

### Resolved: Stripe Webhook Could Drop Retried Events Stuck In Received

What was wrong: the Stripe webhook inserted a new event as `received`, but duplicate retries for an existing fresh `received` event returned 200 as `processing_duplicate`.

Why it mattered: if the first invocation crashed, timed out, or was killed after inserting `received` but before marking the event `failed` or `processed`, Stripe retries could be acknowledged without processing.

Files:

- `apps/web/app/api/webhooks/stripe/route.ts`
- `apps/web/lib/stripe/webhook-idempotency.ts`
- `apps/web/lib/stripe/__tests__/webhook-idempotency.test.ts`

Fix applied: added a tested five-minute stale lease decision helper, changed fresh in-flight `received` events to return retryable 409 instead of 200, allowed stale `received` and `failed` rows to be reclaimed, and removed the duplicate lookup/insert block.

Validation: focused Stripe idempotency test, full test suite, typecheck, web lint, and web build passed locally.

Approval needed: yes before Stripe provider testing; local branch code is repaired and awaiting remote gates/provider test mode.

### Provider-Backed Production Flow Validation Pending

What is wrong: Stripe, Twilio, email, Supabase, and webhook flows have not been exercised against provider test/dry-run paths on this branch.

Why it matters: these systems can affect payments, customer communication, auth activation, and revenue records.

Files:

- `apps/web/app/api/stripe/checkout/route.ts`
- `apps/web/app/api/stripe/targeted-checkout/route.ts`
- `apps/web/app/api/webhooks/stripe/route.ts`
- `apps/web/app/api/webhooks/twilio/status/route.ts`
- `apps/web/app/api/webhooks/postmark/route.ts`
- `apps/web/lib/supabase/*`
- `packages/services/src/outreach/*`

Safest fix: validate only in Stripe test mode and communication dry-run/test-mode first; do not send live SMS/email or mutate production records.

Risk of fix: medium to high if pointed at live providers or production data.

Approval needed: yes for any provider-mutating or production-data test.

## HIGH

### Targeted Route Checkout Is Public And Service-Role Backed

What is wrong: `/api/stripe/targeted-checkout` accepts only `campaignId`/`addons`, uses the Supabase service-role client, creates a Stripe Checkout session, and writes `stripe_checkout_session_id` to the campaign row.

Why it matters: anyone with a campaign UUID can attempt to create/update checkout sessions for that campaign. This may be intended for public quote-payment links, but it needs a signed token, ownership check, rate limit, or another explicit authorization boundary.

Files:

- `apps/web/app/api/stripe/targeted-checkout/route.ts`

Safest fix: add signed checkout tokens for public payment links, validate campaign status/token expiry before creating a session, and rate-limit the route. Keep all validation in test mode before live use.

Risk of fix: medium.

Approval needed: yes before changing live payment-link behavior.

### Twilio Status Webhook May Lose Delivery Telemetry Under RLS

What is wrong: `/api/webhooks/twilio/status` validates Twilio signatures but inserts delivery status rows using the session/anon Supabase server client, then returns 200 even if the insert fails.

Why it matters: Twilio requests do not have a Supabase user session. If RLS blocks anon inserts into `twilio_message_status`, delivery events will be lost while Twilio stops retrying.

Files:

- `apps/web/app/api/webhooks/twilio/status/route.ts`

Safest fix: after signature validation, use a service-role client for the narrow append-only insert or verify a dedicated insert-only RLS policy; add a no-send signed sample validation.

Risk of fix: medium.

Approval needed: yes before live Twilio validation; code/test preparation can proceed safely.

### GitHub CLI Not Authenticated

What is wrong: GitHub CLI is installed but not authenticated in this shell.

Why it matters: connector-backed PR creation works, but `gh` cannot inspect or rerun Actions from this shell.

Files: none.

Safest fix: authenticate `gh` when interactive account setup is convenient.

Risk of fix: low.

Approval needed: no production approval; account authentication required.

### Lint Warning Debt

What is wrong: `apps/web` linting now runs through ESLint CLI, but it reports 506 warnings.

Why it matters: warnings include unused variables, unescaped text, legacy `any` usage, direct anchor navigation, and hook dependency issues that can hide real defects over time.

Files:

- `apps/web/package.json`
- `apps/web/eslint.config.mjs`
- many `apps/web/app/**` and `apps/web/lib/**` modules

Safest fix: reduce warnings in focused passes by module, starting with revenue-critical intake, dashboard, and webhook-adjacent code.

Risk of fix: low to medium depending on module touched.

Approval needed: no for isolated cleanup; yes before touching protected revenue logic behavior.

### Build Skips Type And Lint Validation

What is wrong: `apps/web/next.config.ts` has `typescript.ignoreBuildErrors=true` and `eslint.ignoreDuringBuilds=true`.

Why it matters: Next build can pass even when typecheck/lint are broken.

Files:

- `apps/web/next.config.ts`

Safest fix: keep explicit `turbo type-check --ui=stream` as the release gate now; remove build ignores only after lint is fixed.

Risk of fix: medium; flipping both immediately could block deployment due lint drift.

Approval needed: no, but should be sequenced after lint repair.

### New AI/Political/Procurement Modules Need Workflow QA

What is wrong: current main includes large new systems that passed compile/build/route smoke but not full workflow validation.

Why it matters: these systems touch executive workflows, political planning, AI orchestration, and procurement positioning.

Files:

- `apps/web/lib/ai-orchestration/*`
- `apps/web/app/political/*`
- `apps/web/lib/political/*`
- `apps/web/app/inventory-purchasing/*`
- `apps/web/lib/gov-contracts/*`

Safest fix: run module-level read-only QA first, then test mutations in dry-run/test mode.

Risk of fix: low for audit; medium for mutation validation.

Approval needed: provider-mutating tests require explicit test-mode controls.

## MEDIUM

### Targeted Checkout Billing Copy Does Not Match Stripe Payment Mode

What is wrong: targeted checkout describes multiple add-ons as monthly or billed going forward, but creates the Stripe Checkout session with `mode: "payment"`.

Why it matters: customers may expect recurring services while Stripe only collects a one-time payment, creating either missed recurring revenue or billing confusion.

Files:

- `apps/web/app/api/stripe/targeted-checkout/route.ts`

Safest fix: confirm the intended business model; either adjust the copy to first-month/one-time language or implement subscription line items in Stripe test mode.

Risk of fix: medium.

Approval needed: yes before changing live billing behavior/copy.

### Main Bundle Checkout Still Uses One-Time Payment For Monthly Pricing Path

What is wrong: `/api/stripe/checkout` resolves a monthly bundle price but currently calls the one-time Checkout session path. The subscription helper exists but is not yet wired into the main route.

Why it matters: if the live offer is meant to be recurring, the current path may collect a one-time payment instead of establishing subscription revenue.

Files:

- `apps/web/app/api/stripe/checkout/route.ts`
- `packages/services/src/stripe/index.ts`

Safest fix: confirm product intent, then gate any subscription switch behind reservation/spot prerequisites and Stripe test-mode validation.

Risk of fix: high if changed blindly; medium if feature-flagged and tested.

Approval needed: yes before live payment behavior changes.

### Postmark Webhook Needs Telemetry Alerting For DB Failures

What is wrong: `/api/webhooks/postmark` intentionally returns 200 even if `email_events` insert or `sales_leads.email_status` update fails.

Why it matters: this prevents provider retry storms, but it can also hide deliverability telemetry loss unless logs are drained and alerted.

Files:

- `apps/web/app/api/webhooks/postmark/route.ts`

Safest fix: keep safe acknowledgement behavior, but add structured logging/alerting and admin health checks for webhook logging tables.

Risk of fix: low to medium.

Approval needed: no for local health-check code; yes before provider-live validation.

### Political Launch Depends On Feature Flag

What is wrong: `/political/*` intentionally returns `404` unless `ENABLE_POLITICAL=true`.

Why it matters: production visibility depends on Vercel env configuration.

Files:

- `apps/web/lib/political/env.ts`
- Vercel environment

Safest fix: decide whether political should be public in production, then set `ENABLE_POLITICAL` accordingly.

Risk of fix: low.

Approval needed: business/product approval recommended before public launch.

### Temporary Patch Artifacts Exist Locally

What is wrong: two local patch reference files exist in the current worktree.

Why it matters: they are useful for rollback/reference but should not be committed.

Files:

- `PORT_VALIDATED_TYPEFIXES_20260524.patch`
- `REFERENCE_STABILIZATION_CANDIDATE_DIFF_20260524.patch`

Safest fix: leave untracked or move to an ignored local notes area before final PR.

Risk of fix: low.

Approval needed: no.

## LOW

### Resolved: Supabase Service Client Env Validation

What was wrong: `apps/web/lib/supabase/service.ts` used non-null env assertions instead of explicit env validation.

Why it mattered: missing env values could produce less actionable runtime failures in routes that depend on the service-role client.

Files:

- `apps/web/lib/supabase/service.ts`
- `packages/services/src/auth/index.ts`

Fix applied: mirrored the explicit fail-loud validation pattern already used in `packages/services/src/auth/index.ts`.

Validation: tests, typecheck, lint, and web build passed locally.

Approval needed: no.

### Turbo Defaults To TUI

What is wrong: `turbo.json` uses `ui: "tui"`, which can hang in this shell.

Why it matters: local command reliability is worse on Windows/Codex shell.

Files:

- `turbo.json`

Safest fix: use `pnpm exec turbo type-check --ui=stream` for validation, or change project default to stream if CI/local consistency is preferred.

Risk of fix: low.

Approval needed: no.
