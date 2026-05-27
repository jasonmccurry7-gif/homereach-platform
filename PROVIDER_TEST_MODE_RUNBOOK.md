# Provider Test Mode Runbook

Updated: 2026-05-25

Scope: Stripe, Twilio, Postmark, Supabase, and Vercel validation after the provider hardening passes on `codex/current-main-audit-20260524`.

Safety posture: no live charges, no live SMS, no live email, no production database mutation, and no secret values in logs or commits.

## Current Tool Status

- Stripe CLI: installed with Scoop, `stripe version 1.41.2`.
- Stripe CLI auth: not configured yet; `C:\Users\jason\.config\stripe\config.toml` does not exist.
- Supabase CLI: installed, `2.100.1`.
- Vercel CLI: installed, `54.2.0`.
- ngrok: not installed.
- Local env files in this checkout: `.env`, `.env.local`, and `apps/web/.env.local` are not present.

Reference source: Stripe's official CLI docs say the CLI can forward sandbox events to a local endpoint with `stripe listen --forward-to`, trigger webhook events, and authenticate with `stripe login` or a test/restricted key. See https://docs.stripe.com/stripe-cli/install and https://docs.stripe.com/stripe-cli/use-cli.

## Non-Negotiable Guards

- Use Stripe test or sandbox keys only. Do not use `sk_live_`.
- Use a local or isolated Supabase database for webhook mutation tests.
- Do not point Stripe, Twilio, or Postmark sample callbacks at production webhooks.
- Do not commit `.env.local`, webhook signing secrets, API keys, or provider CLI config.
- Do not run customer-facing SMS/email sends during this validation.
- Do not promote this branch to production until provider validation results are documented.

## Stripe CLI Validation

Goal: validate the route receives signed Stripe events through Stripe's provider tooling without creating live charges.

Prerequisites:

- Stripe CLI authenticated to a test/sandbox account.
- Local app env uses Stripe test keys, an isolated Supabase database, and a local `NEXT_PUBLIC_APP_URL`.
- Local app server is running on `http://127.0.0.1:3000`.

Commands:

```powershell
stripe login
```

Alternative when browser login is not usable:

```powershell
stripe login --interactive
```

Start the app with isolated test env:

```powershell
pnpm --filter @homereach/web dev
```

Forward only the events HomeReach currently handles:

```powershell
stripe listen --events checkout.session.completed,payment_intent.payment_failed,charge.refunded,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,invoice.paid,invoice.payment_failed --forward-to http://127.0.0.1:3000/api/webhooks/stripe
```

Copy only the generated `whsec_...` value into local `.env.local` as `STRIPE_WEBHOOK_SECRET`. Never commit it.

Basic route/signature smoke:

```powershell
stripe trigger checkout.session.completed
stripe trigger payment_intent.payment_failed
stripe trigger invoice.payment_failed
```

Expected result:

- Stripe CLI reports delivery to `/api/webhooks/stripe`.
- The app returns a 2xx for valid unhandled or gracefully skipped test events.
- Invalid signatures continue to fail with 400.
- No production DB rows are mutated.

Business reconciliation validation:

- Generic `stripe trigger checkout.session.completed` payloads may not contain HomeReach order or targeted campaign metadata.
- To validate real order/campaign reconciliation, create a HomeReach test checkout through the local app using Stripe test keys and isolated DB records, then complete the test Checkout Session.
- Use Stripe test cards only.

## Twilio Status Callback Validation

Goal: validate signature handling and append-only telemetry shape without sending SMS.

Current local coverage:

- `apps/web/lib/outreach/__tests__/twilio-status-webhook.test.ts` verifies provider-shaped delivered, undelivered, malformed, and signed sample callback behavior.

Provider-tool validation requirement:

- Use Twilio test credentials or a locally generated signed callback pointed at a local app server.
- The app env must use an isolated database because `/api/webhooks/twilio/status` inserts into `twilio_message_status`.
- Do not send live SMS.

Expected result:

- Valid signed callbacks return TwiML 200.
- Invalid signatures fail closed in production mode.
- `twilio_message_status` receives append-only telemetry rows only in the isolated DB.

## Postmark Webhook Validation

Goal: validate Basic Auth and email telemetry persistence without sending email.

Current local coverage:

- `apps/web/lib/email/__tests__/postmark-webhook.test.ts` verifies Basic Auth, recipient normalization, event classification, suppression-safe status updates, and provider-shaped event-row mapping.

Provider-tool validation requirement:

- Use a local app server and isolated DB.
- Configure `POSTMARK_WEBHOOK_USER` and `POSTMARK_WEBHOOK_PASSWORD` with test-only values.
- POST sample payloads to `http://127.0.0.1:3000/api/webhooks/postmark` with Basic Auth.
- Do not send live email.

Expected result:

- Valid Basic Auth sample payloads return 2xx and create `email_events` rows in isolated DB.
- Invalid or missing Basic Auth fails closed when `NODE_ENV=production`.
- Delivery and temporary-bounce events cannot clear permanent suppression states.

## Supabase Validation

Goal: prove provider webhook mutations use the intended database and service-role boundary.

Commands:

```powershell
supabase --version
supabase status
```

Validation requirements:

- Confirm the project/ref points to local or test infrastructure before any webhook mutation test.
- Confirm service-role env exists without printing it.
- Confirm `stripe_webhook_events`, `twilio_message_status`, and `email_events` exist in the isolated database.
- Confirm RLS does not allow public anonymous writes to telemetry tables, while service-role inserts succeed server-side.

## Vercel Validation

Current status:

- `TARGETED_CHECKOUT_SIGNING_SECRET` exists in Vercel production and branch-preview scope; values were not printed.
- Current branch preview passed after the env repair.

Before production promotion:

- Reconfirm required env names in production without printing values.
- Confirm branch preview is green on the exact commit being promoted.
- Confirm provider callbacks are still pointed at test/sandbox endpoints until production go-live approval.

## Stop Conditions

Stop immediately and document the failure if any of these occur:

- Any command tries to use `sk_live_`.
- A provider callback points at a production URL during test-mode validation.
- The local app is configured with production Supabase credentials.
- A test would send SMS/email to a real customer.
- A test would charge a real payment method.
- A webhook returns false-success while failing to persist required telemetry.
