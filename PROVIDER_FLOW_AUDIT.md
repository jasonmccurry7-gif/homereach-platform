# Provider Flow Audit

Updated: 2026-05-25

Scope: Stripe, Supabase, Twilio, email providers, inbound webhooks, and deployment validation posture on the current `codex/current-main-audit-20260524` branch.

Safety posture: this audit is read-only. No provider calls were made, no production data was mutated, no live SMS/email was sent, and no secrets were printed.

## Executive Summary

The branch is much healthier than the original laptop-migration state: install, tests, typecheck, lint gate, build, and GitHub Actions validation are passing. The latest Vercel deployment for commit `7ab5d0c` failed before the missing `TARGETED_CHECKOUT_SIGNING_SECRET` project env was repaired, so a fresh deployment is required to verify hosted build readiness.

The most important remaining items to fix next are:

1. Billing intent still needs confirmation where monthly language is paired with one-time Stripe payment sessions.
2. Provider test-mode validation still needs to exercise Stripe, Twilio, and email webhooks against isolated data.

## Provider Surface Map

### Stripe

Primary files:

- `apps/web/app/api/stripe/checkout/route.ts`
- `apps/web/app/api/stripe/targeted-checkout/route.ts`
- `apps/web/app/api/webhooks/stripe/route.ts`
- `packages/services/src/stripe/index.ts`

Primary checkout flow:

1. Authenticated user posts to `/api/stripe/checkout`.
2. Route validates request with Zod.
3. User is read from Supabase auth.
4. City, bundle, business, price snapshot, and pending order are resolved through Drizzle.
5. Stripe Checkout session is created through `createOneTimeCheckoutSession`.
6. Webhook later activates/reconciles the order.

Targeted route checkout flow:

1. Intake creates a targeted campaign and returns a signed checkout token when `TARGETED_CHECKOUT_SIGNING_SECRET` is configured.
2. Confirmation email links include the same signed token when the signing secret exists.
3. Public caller posts `campaignId`, `checkoutToken` or matching `checkoutEmail`, and optional `addons` to `/api/stripe/targeted-checkout`.
4. Route uses Supabase service role client to read `targeted_route_campaigns`.
5. Route rejects checkout unless the signed token validates for the campaign/email or the submitted email matches the campaign email.
6. Route filters add-ons to the known catalog before creating a Stripe Checkout session in `payment` mode.
7. Route writes `stripe_checkout_session_id` back to the campaign row.
8. User is redirected to Stripe via returned session URL.

Stripe webhook flow:

1. `/api/webhooks/stripe` reads the raw body.
2. `stripe-signature` is required and verified.
3. `claimStripeEvent` inserts or checks `stripe_webhook_events`.
4. Route dispatches by event type.
5. Processing result updates event status to `processed`, `skipped`, or `failed`.

### Supabase

Primary files:

- `apps/web/lib/supabase/client.ts`
- `apps/web/lib/supabase/server.ts`
- `apps/web/lib/supabase/service.ts`
- `packages/services/src/auth/index.ts`

Observed posture:

- Browser/server auth clients use anon key and cookies.
- Service-role clients are server-side and disable session persistence.
- Many admin/API modules depend on the service-role client.
- `packages/services/src/auth/index.ts` fails loudly when service env is missing.
- `apps/web/lib/supabase/service.ts` now also fails loudly when service env is missing.

### Twilio

Primary files:

- `packages/services/src/outreach/index.ts`
- `apps/web/app/api/webhooks/twilio/status/route.ts`
- `apps/web/app/api/webhooks/outreach/sms/route.ts`

Outbound SMS flow:

1. App calls `sendSms`.
2. Outreach safety config can force test mode.
3. Prospecting SMS is blocked when manual approval mode is active or live prospecting is disabled.
4. Twilio send uses messaging service SID when available, otherwise a from number.
5. Optional `statusCallbackUrl` is passed to Twilio.

Inbound status flow:

1. Twilio posts form data to `/api/webhooks/twilio/status`.
2. Route validates `X-Twilio-Signature` when `TWILIO_AUTH_TOKEN` exists.
3. Production fails closed when `TWILIO_AUTH_TOKEN` is missing.
4. Route inserts an append-only row into `twilio_message_status`.
5. Route returns TwiML 200 even if insert fails.

### Email Providers

Primary files:

- `packages/services/src/outreach/index.ts`
- `packages/services/src/outreach/postmark.ts`
- `apps/web/app/api/webhooks/postmark/route.ts`

Outbound email flow:

1. App calls `sendEmail`.
2. Provider is inferred from `EMAIL_PROVIDER` or available provider keys.
3. `OUTREACH_TEST_MODE`/safety config can return a fake success without sending.
4. Supported providers are Resend, Mailgun, and Postmark.
5. Prospecting identity rotation is handled in the outreach identity layer.

Postmark inbound flow:

1. `/api/webhooks/postmark` can be disabled with `ENABLE_POSTMARK_WEBHOOK=false`.
2. Route uses Basic Auth credentials from env.
3. Production fails closed when credentials are missing.
4. Route logs into `email_events`.
5. Deliverability events can update `sales_leads.email_status`, but delivery/temporary-bounce updates cannot clear suppression states.
6. Route returns retryable 503 if the append-only `email_events` insert fails; lead-status update failures are logged without blocking the provider callback.

### Deployment And CI

Primary files:

- `.github/workflows/validate.yml`
- `apps/web/next.config.ts`
- `vercel.json`

Observed posture:

- GitHub Actions validation is passing on the current PR head.
- The latest Vercel deployment for commit `7ab5d0c` failed because `TARGETED_CHECKOUT_SIGNING_SECRET` was missing at build time.
- `TARGETED_CHECKOUT_SIGNING_SECRET` is now present as a sensitive Vercel env var in production and in the `codex/current-main-audit-20260524` branch preview environment; values were not printed.
- A fresh Vercel deployment is required to confirm the repaired project env.
- `next.config.ts` still ignores Next's internal build-time TypeScript/lint checks, so explicit CI gates remain mandatory.
- GitHub CLI is installed but not authenticated in this shell; the GitHub connector remains the working PR/Actions path.
- `/api/admin/outreach/health` now reports provider telemetry freshness and warnings when email/SMS sends exist without recent provider callbacks.
- GitHub Actions build env includes a non-secret `TARGETED_CHECKOUT_SIGNING_SECRET` placeholder so the production env guard is exercised in CI.

## Findings

### RESOLVED: Stripe Webhook Can Drop A Retried Event Stuck In `received`

Evidence:

- `apps/web/app/api/webhooks/stripe/route.ts:33` defines `claimStripeEvent`.
- `apps/web/app/api/webhooks/stripe/route.ts:41` inserts a new event with status `received`.
- `apps/web/app/api/webhooks/stripe/route.ts:60` treats an existing `received` event as `processing_duplicate`.
- `apps/web/app/api/webhooks/stripe/route.ts:143` returns 200 for `processing_duplicate`.

Why it mattered:

If the first invocation inserts `received` and then crashes, times out, or is killed before marking the event `failed` or `processed`, Stripe retries the same event. The retry sees `received`, returns 200, and Stripe stops retrying. That can permanently lose a paid-customer activation, subscription update, or billing reconciliation event.

Fix applied:

- Added `apps/web/lib/stripe/webhook-idempotency.ts` with a pure decision helper and a five-minute stale lease window.
- Added unit coverage in `apps/web/lib/stripe/__tests__/webhook-idempotency.test.ts`.
- Updated `/api/webhooks/stripe` so fresh in-flight `received` events return `409` and ask Stripe to retry instead of returning 200.
- Stale `received` events and `failed` events can now be reclaimed for processing.
- Removed the second insert/dedupe block from the webhook route.

Validation:

- `pnpm exec vitest run apps/web/lib/stripe/__tests__/webhook-idempotency.test.ts` passed.
- `pnpm test` passed with 103 tests.
- `pnpm exec turbo type-check --ui=stream` passed.
- `pnpm --filter @homereach/web lint` passed with existing warnings only.
- `pnpm --filter @homereach/web build` passed with non-secret placeholder env.

Live provider validation: still pending and must stay in Stripe test mode first.

### RESOLVED: Stripe Webhook Has Redundant Idempotency Blocks

Evidence:

- `apps/web/app/api/webhooks/stripe/route.ts:137` calls `claimStripeEvent`.
- `apps/web/app/api/webhooks/stripe/route.ts:151` performs another lookup/insert for the same event ID.

Why it mattered:

The second block is mostly harmless, but it makes webhook reasoning harder and increases the chance of contradictory behavior during a future fix.

Fix applied:

- Removed the duplicate lookup/insert block after `claimStripeEvent`.
- Kept the existing best-effort processed/failed ledger updates.

Validation: covered by the same local test/typecheck/lint/build pass listed above.

### RESOLVED: Targeted Checkout Trusted A Bare Campaign UUID

Original evidence before fix:

- `apps/web/app/api/stripe/targeted-checkout/route.ts` exposed public `POST`.
- The route accepted only `campaignId` and `addons`.
- The route created a Supabase service-role client.
- The route wrote `stripe_checkout_session_id` to the campaign row.

Why it matters:

Anyone who obtains or guesses a campaign UUID can create checkout sessions and update that campaign's Stripe checkout session ID. This may be intended for quote-payment links, but it needs a signed token, ownership check, or another explicit authorization mechanism.

Fix applied:

- Added `packages/services/src/targeted/checkout-token.ts` with HMAC-signed, expiring targeted checkout tokens.
- Added focused token unit tests in `packages/services/src/targeted/__tests__/checkout-token.test.ts`.
- Updated targeted intake API and confirmation emails to include signed checkout tokens when `TARGETED_CHECKOUT_SIGNING_SECRET` exists.
- Updated the checkout page so legacy/no-token links require the customer to confirm the campaign email before checkout can start.
- Updated `/api/stripe/targeted-checkout` to require either a valid token or matching customer email before service-role-backed Stripe session creation.
- Filtered posted add-ons to the known add-on catalog before creating Stripe metadata/line items.
- Preserved valid tokens on Stripe cancel URLs.
- Added `TARGETED_CHECKOUT_SIGNING_SECRET` to production env validation and Turbo global env tracking.
- Added `TARGETED_CHECKOUT_SIGNING_SECRET` placeholders to the env example/template files.

Validation:

- `pnpm exec vitest run packages/services/src/targeted/__tests__/checkout-token.test.ts` passed.
- `pnpm test` passed with 110 tests.
- `pnpm exec turbo type-check --ui=stream` passed.
- `pnpm --filter @homereach/web lint` passed with existing warnings only.
- `pnpm --filter @homereach/web build` passed with non-secret placeholder env including `TARGETED_CHECKOUT_SIGNING_SECRET`.
- Browser smoke against local `next start`: no-token checkout link showed email confirmation with Pay disabled; token-bearing link hid the email prompt and enabled Pay.

Residual risk:

- Vercel production and the branch preview now have `TARGETED_CHECKOUT_SIGNING_SECRET`, but the latest failed deployment predated that repair; a fresh deployment still needs to pass before promotion.
- Route-level rate limiting is still recommended as a separate hardening pass.

### MEDIUM: Targeted Checkout Promises Monthly Billing But Uses One-Time Payment Mode

Evidence:

- `apps/web/app/api/stripe/targeted-checkout/route.ts:71` says maintenance is `$97/mo going forward`.
- `apps/web/app/api/stripe/targeted-checkout/route.ts:73`, `:76`, `:78`, and `:81` describe add-ons as billed monthly.
- `apps/web/app/api/stripe/targeted-checkout/route.ts:85` creates the Checkout session with `mode: "payment"`.

Why it matters:

Customer-facing billing language and Stripe billing behavior can diverge. That can create missed recurring revenue or customer trust issues.

Safest fix:

- Either change copy to clearly describe a first-month one-time charge with separate follow-up subscription setup, or implement subscription line items in Stripe test mode.

Risk of fix: medium.

### MEDIUM: Main Checkout Still Uses One-Time Session For Monthly Bundle Path

Evidence:

- `apps/web/app/api/stripe/checkout/route.ts:181` notes subscription checkout is future work.
- `apps/web/app/api/stripe/checkout/route.ts:185` confirms current checkout uses `mode:"payment"`.
- `packages/services/src/stripe/index.ts:53` defines `createOneTimeCheckoutSession`.
- `packages/services/src/stripe/index.ts:138` already defines `createSubscriptionCheckoutSession`, but the main route does not use it yet.

Why it matters:

If current offers are meant to be recurring subscriptions, the active path can collect a one-time payment instead of establishing recurring revenue.

Safest fix:

- Confirm business intent for each product type.
- Use subscription checkout only after reservation/spot assignment prerequisites are validated.
- Test in Stripe test mode before any live switch.

Risk of fix: high if changed blindly; medium if behind feature flag/test path.

### RESOLVED: Twilio Status Webhook Used Session/Anon Supabase Client

Original evidence before fix:

- `apps/web/app/api/webhooks/twilio/status/route.ts` imported `createClient` from the server Supabase auth helper.
- The route used that session/anon client for a public Twilio webhook insert.
- The route logged insert errors but returned 200.

Why it matters:

Twilio requests do not have a Supabase user session. If RLS does not allow anon inserts into `twilio_message_status`, delivery status events may never persist, while Twilio still receives 200 and stops retrying.

Fix applied:

- Switched the route to `createServiceClient()` only after Twilio signature validation.
- Kept the mutation contract narrow: append-only insert into `twilio_message_status`; no send-side table updates.
- Updated route comments to document why service-role is used here.

Validation:

- `pnpm exec turbo type-check --ui=stream` passed.
- `pnpm --filter @homereach/web build` passed with non-secret placeholder env.

Residual risk:

- No live Twilio webhook was invoked. Provider validation should use a signed sample payload first and avoid sending live SMS.

### RESOLVED: Postmark Webhook Acknowledged Email Event DB Failures

Original evidence before fix:

- `apps/web/app/api/webhooks/postmark/route.ts` logged `email_events` insert failure and continued.
- The same route caught handler errors and returned 200.
- Delivery events could mark `sales_leads.email_status` as `valid` without guarding against already-suppressed lead states.

Why it mattered:

Email provider callbacks are the durable source for bounce, complaint, unsubscribe, and delivery telemetry. Acknowledging an event that was not logged can hide deliverability risk, and allowing a delivery event to clear a suppression state can reopen unsafe outreach.

Fix applied:

- Added `apps/web/lib/email/postmark-webhook.ts` to isolate Postmark classification, recipient normalization, and lead-status write filters.
- Added unit tests for delivery, hard bounce, temporary bounce, complaint, unsubscribe, and recipient normalization behavior.
- Updated `/api/webhooks/postmark` so `email_events` insert failures return retryable 503 instead of false-success 200.
- Kept `sales_leads.email_status` updates best-effort after the event is logged.
- Constrained `valid` and `bounced_temporary` updates so they cannot overwrite `bounced_permanent`, `complained`, or `unsubscribed`.

Validation:

- `pnpm exec vitest run apps/web/lib/email/__tests__/postmark-webhook.test.ts` passed.
- `pnpm exec turbo type-check --ui=stream` passed.

Residual risk:

- No live Postmark webhook was invoked. Provider validation should use sample payloads and test Basic Auth before any live email volume.

### MEDIUM: Stripe API Version Needs Scheduled Upgrade Review

Evidence:

- `packages/services/src/stripe/index.ts:23` uses `2025-02-24.acacia`.
- `apps/web/app/api/stripe/targeted-checkout/route.ts:12` uses `2025-02-24.acacia`.

Why it matters:

The app is pinned to a specific Stripe API version, which is safer than floating. It still needs a planned upgrade review to avoid falling behind provider behavior and type expectations.

Safest fix:

- Do not change this casually.
- Schedule a Stripe upgrade lane with test fixtures for checkout sessions, subscriptions, and webhooks.

Risk of fix: medium.

### RESOLVED: Supabase Service Client Could Fail More Clearly

Evidence:

- `packages/services/src/auth/index.ts:13` through `:20` already has clearer fail-loud behavior.
- `apps/web/lib/supabase/service.ts` now mirrors the same explicit env validation pattern.

Why it matters:

Missing envs can produce less actionable runtime failures in app routes.

Fix applied:

- Added a small `requireEnv` helper and required `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` before creating the service-role client.

Validation:

- `pnpm test` passed.
- `pnpm exec turbo type-check --ui=stream` passed.
- `pnpm --filter @homereach/web lint` passed with existing warnings only.
- `pnpm --filter @homereach/web build` passed with non-secret placeholder env.

## Positive Controls Already Present

- Stripe signatures are required and verified before webhook dispatch.
- Primary checkout requires an authenticated Supabase user.
- Primary checkout derives founding and military discount eligibility server-side instead of trusting client input.
- Outreach service supports test mode.
- Prospecting SMS is guarded by manual approval and live-prospecting flags.
- Postmark webhook can be disabled with `ENABLE_POSTMARK_WEBHOOK=false`.
- Postmark webhook fails closed in production if Basic Auth is not configured.
- Twilio status webhook validates signatures and fails closed in production if `TWILIO_AUTH_TOKEN` is missing.
- Admin outreach health now flags stale or missing provider telemetry after same-day email/SMS send activity.
- Communication provider code is centralized enough to support reputation controls.

## Safe Validation Path

1. Keep production env untouched.
2. Add local unit tests for Stripe event claim states before code changes.
3. Run Stripe CLI/test-mode webhook replay only against a test database or isolated local test schema.
4. Validate targeted checkout with signed test campaigns before enabling public links.
5. Validate Twilio status insert with a signed sample request and no live SMS send.
6. Validate Postmark webhook with sample payloads and test Basic Auth.
7. Add admin health checks for provider telemetry freshness, not just table readability.
8. Only then perform provider-level test-mode checks.

## Production Readiness Gate

Current status: not ready for provider-live promotion yet.

Reason: the branch passes local code validation and GitHub Actions, and the Stripe retry-drop, public targeted checkout authorization, Twilio telemetry durability, and Postmark callback durability risks have tested branch fixes. The `TARGETED_CHECKOUT_SIGNING_SECRET` Vercel env repair is complete, but the hosted Vercel build must be retried and provider test-mode validation still needs completion before production-sensitive flows are trusted.
