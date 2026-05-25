# Prioritized Fix Plan

Updated: 2026-05-25

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

Why it matters: these systems can affect payments, customer communication, auth activation, and revenue records. Stripe now has synthetic signature coverage, and Twilio/Postmark now have local provider-shaped sample-payload coverage, but live provider integrations still need isolated test-mode validation.

Files:

- `apps/web/app/api/stripe/checkout/route.ts`
- `apps/web/app/api/stripe/targeted-checkout/route.ts`
- `apps/web/app/api/webhooks/stripe/route.ts`
- `packages/services/src/stripe/__tests__/webhook-signature.test.ts`
- `apps/web/app/api/webhooks/twilio/status/route.ts`
- `apps/web/app/api/webhooks/postmark/route.ts`
- `apps/web/lib/outreach/twilio-status-webhook.ts`
- `apps/web/lib/supabase/*`
- `packages/services/src/outreach/*`

Safest fix: validate only in Stripe test mode and communication dry-run/test-mode first; do not send live SMS/email or mutate production records.

Risk of fix: medium to high if pointed at live providers or production data.

Approval needed: yes for any provider-mutating or production-data test.

Current tooling status: Stripe CLI is installed, but not authenticated. Use `PROVIDER_TEST_MODE_RUNBOOK.md` and test/sandbox credentials only.

### Resolved: Targeted Route Checkout Trusted A Bare Campaign UUID

What was wrong: `/api/stripe/targeted-checkout` accepted only `campaignId`/`addons`, used the Supabase service-role client, created a Stripe Checkout session, and wrote `stripe_checkout_session_id` to the campaign row.

Why it mattered: anyone with a campaign UUID could attempt to create/update checkout sessions for that campaign. Public quote-payment links need an explicit proof boundary before service-role-backed payment work.

Files:

- `packages/services/src/targeted/checkout-token.ts`
- `packages/services/src/targeted/__tests__/checkout-token.test.ts`
- `packages/services/src/targeted/index.ts`
- `apps/web/app/api/targeted/intake/route.ts`
- `apps/web/app/(funnel)/targeted/intake/page.tsx`
- `apps/web/app/(funnel)/targeted/checkout/page.tsx`
- `apps/web/app/api/stripe/targeted-checkout/route.ts`
- `apps/web/lib/env.ts`
- `.env.example`
- `apps/web/.env.production.template`
- `turbo.json`

Fix applied: added HMAC-signed targeted checkout tokens, attached tokens to intake-created and email checkout links, added a customer-email fallback for legacy/no-token links, required token or matching email before Stripe session creation, filtered add-ons to the known catalog, and registered `TARGETED_CHECKOUT_SIGNING_SECRET` as a production env requirement in validation and templates.

Validation: focused token tests, full test suite, typecheck, web lint, web build, and local browser smoke passed.

Approval needed: Vercel production and the branch preview now have `TARGETED_CHECKOUT_SIGNING_SECRET`; a fresh deployment must pass before promotion, and provider-live Stripe testing must remain in test mode first.

## HIGH

### Resolved: Twilio Status Webhook Could Lose Delivery Telemetry Under RLS

What was wrong: `/api/webhooks/twilio/status` validated Twilio signatures but inserted delivery status rows using the session/anon Supabase server client, then returned 200 even if the insert failed.

Why it mattered: Twilio requests do not have a Supabase user session. If RLS blocked anon inserts into `twilio_message_status`, delivery events could be lost while Twilio stopped retrying.

Files:

- `apps/web/app/api/webhooks/twilio/status/route.ts`
- `apps/web/lib/outreach/twilio-status-webhook.ts`
- `apps/web/lib/outreach/__tests__/twilio-status-webhook.test.ts`

Fix applied: after signature validation, the route now uses the Supabase service-role client for the narrow append-only `twilio_message_status` insert and keeps the existing no-send mutation boundary. Twilio status payload parsing and insert-row mapping are isolated in a helper with provider-shaped sample tests.

Validation: focused Twilio helper tests, full test suite, typecheck, web lint, and web build passed locally after the change.

Approval needed: no for the code change; yes before live Twilio validation or any SMS send.

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

### Resolved: Postmark Webhook Could Lose Email Telemetry And Clear Suppressions

What was wrong: `/api/webhooks/postmark` returned 200 even if the append-only `email_events` insert failed, and delivery events could mark a lead `valid` without guarding against existing suppression states.

Why it mattered: email webhook data protects sender reputation. Lost bounce/complaint/unsubscribe telemetry can hide deliverability risk, and clearing a suppression state can reopen unsafe outreach.

Files:

- `apps/web/app/api/webhooks/postmark/route.ts`
- `apps/web/lib/email/postmark-webhook.ts`
- `apps/web/lib/email/__tests__/postmark-webhook.test.ts`

Fix applied: event-log insert failures now return retryable 503; lead-status updates remain best-effort after the event is logged; `valid` and `bounced_temporary` updates are filtered so they cannot overwrite `bounced_permanent`, `complained`, or `unsubscribed`. Postmark Basic Auth and email event-row mapping now have local provider-shaped tests.

Validation: focused Postmark helper tests, full test suite, typecheck, web lint, and web build passed locally.

Approval needed: no for the code change; yes before provider-live validation or email sending.

### Resolved: Provider Telemetry Health Only Showed Counts, Not Freshness

What was wrong: `/api/admin/outreach/health` showed email and SMS webhook event counts, but it did not flag cases where sends happened today and provider telemetry was missing or stale.

Why it mattered: operators need an obvious warning when delivery callbacks stop arriving after outbound activity, especially before scaling email/SMS volume.

Files:

- `apps/web/app/api/admin/outreach/health/route.ts`
- `apps/web/lib/outreach/telemetry-health.ts`
- `apps/web/lib/outreach/__tests__/telemetry-health.test.ts`

Fix applied: added a read-only `metrics.telemetry_freshness` block with latest callback timestamps, age, same-day send activity, stale flags, and source/freshness warnings.

Validation: focused telemetry health tests, full test suite, Turbo typecheck, web lint, and web build passed locally.

Approval needed: no; this is read-only admin observability.

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
