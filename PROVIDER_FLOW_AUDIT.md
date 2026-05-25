# Provider Flow Audit

Updated: 2026-05-25

Scope: Stripe, Supabase, Twilio, email providers, inbound webhooks, and deployment validation posture on the current `codex/current-main-audit-20260524` branch.

Safety posture: this provider pass made local code and documentation changes only. No provider calls were made, no production data was mutated, no live SMS/email was sent, no Stripe sessions or charges were created, and no secrets were printed.

## Executive Summary

The branch is much healthier than the original laptop-migration state: install, tests, typecheck, lint gate, build, GitHub Actions validation, and Vercel preview validation are passing. The Vercel project now has `TARGETED_CHECKOUT_SIGNING_SECRET` configured in production and branch preview scope, with no secret values printed.

The most important remaining items to fix next are:

1. Targeted checkout copy now avoids implying automatic recurring Stripe billing, but business intent still needs confirmation before any targeted add-on subscription-mode change.
2. Legacy `/api/stripe/checkout` is now default-disabled by `ENABLE_LEGACY_STRIPE_CHECKOUT`; active get-started checkout remains `/api/spots/checkout` in Stripe subscription mode.
3. Provider test-mode validation still needs to exercise Stripe, Twilio, and email webhooks against isolated data.
4. Stripe now has synthetic SDK-signature coverage, Twilio status/Postmark now have local provider-shaped sample-payload tests, and inbound SMS/Facebook signature behavior has focused unit coverage, but those are not substitutes for provider test-mode validation.
5. Meta/Facebook webhook POST routes now fail closed in production when `FACEBOOK_APP_SECRET` is missing and reject unsigned/invalid signatures before service-role work.
6. Facebook/APEX admin automation POST routes now require cron or authenticated operator access before service-role work can run.
7. Additional admin service-role routes for agent scans, agent status/runner surfaces, scraper, internal alerts, pricing/founding updates, Facebook mission logging, sales lead/revenue reads, send-capable sales/email routes, operator summaries, and admin health now require admin/sales session or cron access before privileged work.
8. The follow-up admin sweep now also covers CRM lead/detail/task/note/dedup/quarantine/reporting routes, automation sequence/enrollment controls, alert preferences, migration helpers, Facebook revenue-engine routes, and system-agent utility endpoints. Political candidate-intelligence sync/webhook routes were inspected and already have explicit secret gates.
9. Admin-adjacent non-`/api/admin` routes now also fail closed: admin inbox conversation reads/replies, growth activity logs, and targeted campaign admin status/send/mailed actions require admin access before service-role reads, Drizzle updates, or outbound communication helpers.
10. The SMS APEX command endpoint now validates Twilio signatures before trusted command execution and no longer exposes approved sender phone numbers through its public liveness response.
11. The public Facebook follow-up cron route now fails closed through the shared cron guard when `CRON_SECRET` is missing or invalid.
12. The public political candidate chat helper now honors `DISABLE_POLITICAL_AI=true` and falls back to static operational replies instead of calling OpenAI.
13. Public nonprofit and intake notification emails now HTML-escape user-controlled form values before rendering admin/applicant email bodies and clean dynamic subject fragments.
14. Public political map-plan saves now reject empty route/geography selections before service-role persistence work and reject oversized request bodies before JSON parsing.

Additional hardening completed after the first provider pass: generated public links for checkout-adjacent flows, SEO metadata, sitemap/robots, auth reset redirects, admin notifications, political proposal handoffs, internal alert deep links, and outreach/Facebook templates now route through shared app URL resolver logic instead of scattered hardcoded domains. The shared Stripe subscription Checkout helper also uses package-local resolver logic. The resolvers fall back to Vercel deployment URL names before localhost or static production defaults when canonical app URL aliases are absent.

## Provider Surface Map

### Political AI Provider Calls

Primary files:

- `apps/web/app/api/political/candidate-agent/chat/route.ts`
- `apps/web/lib/political/candidate-agent-chat.ts`
- `apps/web/lib/political/env.ts`
- `apps/web/lib/political/__tests__/candidate-agent-chat.test.ts`

Observed flow:

1. Public political chat is available only when `ENABLE_POLITICAL=true`.
2. Chat payloads are bounded and resolved to a supported candidate context before any answer is generated.
3. The helper now checks `DISABLE_POLITICAL_AI=true` before creating an OpenAI client.
4. When AI is disabled or `OPENAI_API_KEY` is absent, the route returns static fallback replies from the loaded campaign plan and compliance rules.
5. Human approval remains required before political outreach, proposal, checkout, or production use.

### Public Political Map Plan Persistence

Primary files:

- `apps/web/app/api/political/map-plans/route.ts`
- `apps/web/lib/political/map-plans.ts`
- `apps/web/lib/political/__tests__/map-plans.test.ts`

Observed flow:

1. `/api/political/map-plans` remains available only when `ENABLE_POLITICAL=true`.
2. The route reads the raw body, rejects bodies over 750 KB, and then parses JSON.
3. The persistence helper normalizes public map-plan inputs and requires at least one selected route or political geography before Supabase service-role work can begin.
4. Empty selections return a local-only response and do not create map sessions or plan rows.
5. Valid selections continue to the existing database-backed save path when Supabase service credentials are configured.
6. Human approval remains required before using saved political plans for outreach, creative, proposal, or campaign execution.

### Public Form Notification Emails

Primary files:

- `apps/web/app/api/nonprofit/route.ts`
- `apps/web/app/api/intake/[token]/route.ts`
- `apps/web/lib/security/email.ts`
- `apps/web/lib/security/__tests__/email.test.ts`
- `apps/web/lib/security/html.ts`
- `apps/web/lib/security/__tests__/html.test.ts`

Observed flow:

1. `/api/nonprofit` stores a public nonprofit application, then may send an admin notification and applicant confirmation email.
2. `/api/intake/[token]` updates a token-authenticated intake submission, then may send an admin notification email.
3. User-submitted values are still stored as submitted, but notification email HTML now escapes form values before rendering.
4. Dynamic subject fragments now strip control characters and collapse whitespace before sending.
5. No live emails were sent during validation.

### Stripe

Primary files:

- `apps/web/app/api/stripe/checkout/route.ts`
- `apps/web/lib/stripe/legacy-checkout.ts`
- `apps/web/lib/stripe/__tests__/legacy-checkout.test.ts`
- `apps/web/app/api/stripe/targeted-checkout/route.ts`
- `apps/web/app/api/webhooks/stripe/route.ts`
- `packages/services/src/stripe/app-url.ts`
- `packages/services/src/stripe/__tests__/app-url.test.ts`
- `packages/services/src/stripe/__tests__/webhook-signature.test.ts`
- `packages/services/src/stripe/index.ts`

Legacy main checkout flow:

1. Caller posts to `/api/stripe/checkout`.
2. Route first checks `ENABLE_LEGACY_STRIPE_CHECKOUT`.
3. Default behavior is `410 Legacy checkout route disabled` before Supabase auth, Zod parsing, Drizzle writes, or Stripe API calls.
4. If deliberately enabled, the legacy path still validates the request with Zod, reads the authenticated Supabase user, resolves city/bundle/business/order data through Drizzle, and creates a one-time Stripe Checkout session through `createOneTimeCheckoutSession`.
5. Active get-started checkout should continue to use `/api/spots/checkout`, which creates subscription-mode Checkout sessions.
6. Redirect and post-payment links use shared public app URL resolver logic.

Targeted route checkout flow:

1. Intake creates a targeted campaign and returns a signed checkout token when `TARGETED_CHECKOUT_SIGNING_SECRET` is configured.
2. Confirmation email links include the same signed token when the signing secret exists.
3. Public caller posts `campaignId`, `checkoutToken` or matching `checkoutEmail`, and optional `addons` to `/api/stripe/targeted-checkout`.
4. Route uses Supabase service role client to read `targeted_route_campaigns`.
5. Route rejects checkout unless the signed token validates for the campaign/email or the submitted email matches the campaign email.
6. Route filters add-ons to the known catalog before creating a Stripe Checkout session in `payment` mode.
7. Route writes `stripe_checkout_session_id` back to the campaign row.
8. User is redirected to Stripe via returned session URL.
9. Add-on copy now describes recurring services as first-month charges with ongoing service activated separately after onboarding unless true subscription mode is implemented later.

Property intelligence checkout flow:

1. Public caller posts tier, city, category, market size, business name, email, and phone to `/api/intelligence/checkout`.
2. Route parses and normalizes the payload before creating a Supabase service-role client; malformed JSON returns `400 Invalid checkout payload`.
3. Route reads `property_intelligence_tiers` and `founding_slots` through the Supabase service-role client.
4. Route creates a Stripe Checkout session with explicit `property_intelligence` metadata.
5. Route no longer writes `founding_memberships` or updates `founding_slots` before payment confirmation.
6. Signed Stripe webhook handling for `checkout.session.completed` now finalizes founding membership activation and recalculates slot usage from active memberships.
7. Repo search found references to `property_intelligence_tiers`, `founding_slots`, and `founding_memberships`, but did not find committed Drizzle schema or Supabase migration definitions for those tables. Treat production schema as out-of-band until verified through a controlled Supabase schema pull/audit.

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
- `apps/web/app/api/command/route.ts`
- `apps/web/app/api/webhooks/twilio/status/route.ts`
- `apps/web/app/api/webhooks/outreach/sms/route.ts`
- `apps/web/lib/outreach/twilio-status-webhook.ts`
- `apps/web/lib/outreach/inbound-sms-webhook.ts`
- `apps/web/lib/outreach/__tests__/inbound-sms-webhook.test.ts`

Outbound SMS flow:

1. App calls `sendSms`.
2. Outreach safety config can force test mode.
3. Prospecting SMS is blocked when manual approval mode is active or live prospecting is disabled.
4. Twilio send uses messaging service SID when available, otherwise a from number.
5. Optional `statusCallbackUrl` is passed to Twilio.

APEX SMS command flow:

1. Twilio posts owner SMS commands to `/api/command`.
2. The route parses form-encoded Twilio parameters.
3. The route now validates `X-Twilio-Signature` with `TWILIO_AUTH_TOKEN` and a canonical `/api/command` URL before checking approved senders.
4. Approved commands can route to guarded admin/agent endpoints using the server-side cron secret.
5. Public `GET /api/command` is liveness-only and now returns configuration booleans/counts, not approved sender phone numbers or the APEX number.

Inbound status flow:

1. Twilio posts form data to `/api/webhooks/twilio/status`.
2. Route validates `X-Twilio-Signature` when `TWILIO_AUTH_TOKEN` exists.
3. Production fails closed when `TWILIO_AUTH_TOKEN` is missing.
4. Route inserts an append-only row into `twilio_message_status`.
5. Route returns retryable 503 if the append-only telemetry insert or handler fails.

Inbound SMS reply flow:

1. Twilio posts form data to `/api/webhooks/outreach/sms`.
2. Route validates `X-Twilio-Signature` when `TWILIO_AUTH_TOKEN` exists.
3. Production fails closed when `TWILIO_AUTH_TOKEN` is missing.
4. STOP/START keywords update opt-out state and return empty TwiML without sending an auto-reply.
5. Normal replies first pass through `processInboundRevenueMessage` for the revenue messaging ledger and approval queue.
6. Known legacy `outreach_contacts` also persist to `outreach_replies`.
7. Unknown or unmatched replies are acknowledged only when the revenue bridge captured the event or was deliberately disabled; bridge failures or missing event-ledger IDs return retryable 503 so Twilio can retry.

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

### Facebook And Admin Automation

Primary files:

- `apps/web/app/api/webhooks/facebook/route.ts`
- `apps/web/app/api/facebook/webhook/route.ts`
- `apps/web/app/api/admin/sales/facebook/alert/route.ts`
- `apps/web/app/api/admin/sales/facebook/daily-score/route.ts`
- `apps/web/app/api/admin/system/apex/route.ts`
- `apps/web/lib/facebook/webhook-auth.ts`
- `apps/web/lib/facebook/__tests__/webhook-auth.test.ts`
- `apps/web/lib/auth/api-guards.ts`
- `apps/web/lib/auth/request-secret.ts`
- `apps/web/lib/auth/__tests__/request-secret.test.ts`

Access-control flow:

1. Meta webhooks require a configured `FACEBOOK_APP_SECRET` in production, reject unsigned or invalid signatures, and fail closed before service-role work if the secret is missing.
2. `/api/admin/sales/facebook/alert` now requires either `CRON_SECRET` via `x-cron-secret`/Bearer token or an authenticated admin/sales-agent session before any Twilio alert attempt.
3. `/api/admin/sales/facebook/daily-score` now requires `CRON_SECRET` or authenticated admin before service-role scoring work.
4. `/api/admin/system/apex` now requires `CRON_SECRET` or authenticated admin before the multi-agent orchestration sweep can run.
5. Webhook verify-token handling requires `FACEBOOK_WEBHOOK_VERIFY_TOKEN`/legacy `FACEBOOK_VERIFY_TOKEN` in production and no longer uses a production default token.
6. Shared Meta signature/verify-token parsing is isolated in `apps/web/lib/facebook/webhook-auth.ts` and covered by focused tests.
7. Shared request-secret parsing is isolated in `apps/web/lib/auth/request-secret.ts` and covered by focused tests.
8. `/api/facebook/followup` now uses the shared `requireCron()` guard so missing `CRON_SECRET` returns `503` instead of allowing the send-capable follow-up sweep to run.

### Deployment And CI

Primary files:

- `.github/workflows/validate.yml`
- `apps/web/next.config.ts`
- `vercel.json`

Observed posture:

- GitHub Actions validation is passing on the current PR head.
- The Vercel deployment for commit `2d525aa` passed after the `TARGETED_CHECKOUT_SIGNING_SECRET` env repair.
- `TARGETED_CHECKOUT_SIGNING_SECRET` is now present as a sensitive Vercel env var in production and in the `codex/current-main-audit-20260524` branch preview environment; values were not printed.
- Stripe CLI is installed as `stripe version 1.41.2`, but it is not authenticated yet and no Stripe account commands were run.
- `PROVIDER_TEST_MODE_RUNBOOK.md` now defines the safe provider-tool validation path.
- `next.config.ts` still ignores Next's internal build-time TypeScript/lint checks, so explicit CI gates remain mandatory.
- GitHub CLI is installed but not authenticated in this shell; the GitHub connector remains the working PR/Actions path.
- `/api/admin/outreach/health` now reports provider telemetry freshness and warnings when email/SMS sends exist without recent provider callbacks.
- GitHub Actions build env includes a non-secret `TARGETED_CHECKOUT_SIGNING_SECRET` placeholder so the production env guard is exercised in CI.

### Admin Service-Role Access Sweep

Primary files:

- `apps/web/app/api/admin/agents/atlas/route.ts`
- `apps/web/app/api/admin/agents/anchor/route.ts`
- `apps/web/app/api/admin/agents/beacon/route.ts`
- `apps/web/app/api/admin/agents/closer/route.ts`
- `apps/web/app/api/admin/agents/echo/route.ts`
- `apps/web/app/api/admin/agents/horizon/route.ts`
- `apps/web/app/api/admin/agents/run/route.ts`
- `apps/web/app/api/admin/agents/scout/route.ts`
- `apps/web/app/api/admin/agents/scraper/route.ts`
- `apps/web/app/api/admin/agents/sentinel/route.ts`
- `apps/web/app/api/admin/alerts/send/route.ts`
- `apps/web/app/api/admin/founding/slots/route.ts`
- `apps/web/app/api/admin/pricing/bundle/route.ts`
- `apps/web/app/api/admin/pricing/city/route.ts`
- `apps/web/app/api/admin/sales/facebook/mission/route.ts`
- `apps/web/app/api/admin/system/agents/pulse/route.ts`
- `apps/web/app/api/admin/agents/echo/route.ts`
- `apps/web/app/api/admin/agents/closer/route.ts`
- `apps/web/app/api/admin/sales/nudge/route.ts`
- `apps/web/app/api/admin/sales/power-mode/end-of-day/route.ts`
- `apps/web/app/api/admin/sales/alert/route.ts`
- `apps/web/app/api/admin/sales/call-scripts/route.ts`
- `apps/web/app/api/admin/alerts/preferences/route.ts`
- `apps/web/app/api/admin/automation/enroll/route.ts`
- `apps/web/app/api/admin/automation/sequences/route.ts`
- `apps/web/app/api/admin/crm/companies/route.ts`
- `apps/web/app/api/admin/crm/dedup/route.ts`
- `apps/web/app/api/admin/crm/fb-audit/route.ts`
- `apps/web/app/api/admin/crm/launch-readiness/route.ts`
- `apps/web/app/api/admin/crm/lead/route.ts`
- `apps/web/app/api/admin/crm/leaderboard/route.ts`
- `apps/web/app/api/admin/crm/leads/route.ts`
- `apps/web/app/api/admin/crm/metrics/route.ts`
- `apps/web/app/api/admin/crm/notes/route.ts`
- `apps/web/app/api/admin/crm/quarantine/route.ts`
- `apps/web/app/api/admin/crm/tasks/route.ts`
- `apps/web/app/api/admin/facebook/route.ts`
- `apps/web/app/api/admin/migration/debug/route.ts`
- `apps/web/app/api/admin/migration/route.ts`
- `apps/web/app/api/admin/system/agents/kaizen/route.ts`
- `apps/web/app/api/admin/system/agents/ledger/route.ts`
- `apps/web/app/api/admin/system/agents/prospector/route.ts`
- `apps/web/app/api/admin/system/agents/pulse/route.ts`
- `apps/web/app/api/admin/system/agents/route.ts`

Access-control flow:

1. Agent scan/status/runner routes (`anchor`, `atlas`, `beacon`, `closer`, `echo`, `horizon`, `run`, `scout`, `scraper`, `sentinel`) now require authenticated admin or `CRON_SECRET` for automation POSTs, and admin access for status GETs.
2. Internal alert send POST now requires authenticated admin or `CRON_SECRET` before resolving phones, inserting alert rows, or sending SMS.
3. Internal alert callers now pass `x-cron-secret` for trusted automation calls.
4. Founding slot GET/PUT and pricing mutation routes now require authenticated admin.
5. Facebook mission GET/POST now requires authenticated admin or sales-agent session.
6. Remaining unguarded service-role mutation scan results are expected public/provider surfaces: targeted checkout proof boundary, intelligence checkout, and Twilio status signature flow.
7. Follow-up admin service-role scan now finds no unguarded `apps/web/app/api/admin` service-client routes outside custom authorized routes. This second sweep covered sensitive read routes and send-capable routes, not only POST/PUT mutation routes.
8. Explicit sales `agent_id` scope now uses a shared helper: sales agents are limited to their own agent id, while admins can intentionally request another rep. This covers sales funnel, leads, next-lead, replies, insights, Facebook scorecard, Facebook mission, Facebook alert, close-deal, at-risk deals, priority actions, call lists, call logs, call stats, follow-up sequence logging, and power-mode checks.
9. Sales call-script writes are admin-only; call-script reads remain available to admin/sales-agent sessions. Sales alert logging now requires admin/sales-agent access and rejects sales-agent attempts to alert leads assigned to another rep.
10. CRM lead/list/detail, note/task creation, Facebook audit/reporting reads, alert preferences, and Facebook revenue-engine routes now require authenticated admin or sales-agent access before returning or mutating operator data.
11. Automation sequence/enrollment, CRM dedup/quarantine/company/migration, CRM metric-write, and system-agent identity routes now require admin access.
12. System-agent execution routes for pulse, prospector, kaizen, and ledger now require admin or cron access before operational work begins.
13. Political candidate-intelligence sync and webhook routes already require dedicated cron/webhook secrets and fail closed when secrets or feature flags are missing, so they were documented rather than changed.

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
- `pnpm exec vitest run packages/services/src/stripe/__tests__/webhook-signature.test.ts` passed.
- `pnpm test` passed with 103 tests.
- `pnpm exec turbo type-check --ui=stream` passed.
- `pnpm --filter @homereach/web lint` passed with existing warnings only.
- `pnpm --filter @homereach/web build` passed with non-secret placeholder env.

Live provider validation: still pending and must stay in Stripe test mode first.

Synthetic signature validation:

- A signed SDK-generated `checkout.session.completed` payload constructs a Stripe event successfully.
- A payload signed with the wrong webhook secret is rejected.
- Missing `STRIPE_WEBHOOK_SECRET` fails closed before any payload is trusted.
- Stripe CLI is now installed, but provider-tool forwarding validation remains pending until test/sandbox auth and isolated DB setup are ready.

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

### PARTIALLY RESOLVED: Targeted Checkout Billing Copy Did Not Match One-Time Payment Mode

Original evidence before copy fix:

- `apps/web/app/api/stripe/targeted-checkout/route.ts` described maintenance and automation add-ons as monthly or billed going forward.
- `apps/web/app/(funnel)/targeted/checkout/page.tsx` showed selected recurring add-ons as monthly add-ons billed next month.
- `apps/web/app/api/stripe/targeted-checkout/route.ts` creates the Checkout session with `mode: "payment"`.

Why it mattered:

Customer-facing billing language and Stripe billing behavior could diverge. That can create missed recurring revenue or customer trust issues.

Fix applied:

- Updated targeted checkout UI copy to say ongoing add-ons are activated after onboarding instead of billed next month by the current checkout.
- Updated Stripe line-item descriptions to describe first-month add-on charges and separate ongoing activation.
- Updated `/api/stripe/targeted-checkout` to use the shared public app URL resolver instead of reading only `NEXT_PUBLIC_APP_URL`.
- Updated active spot checkout, legacy Stripe checkout, intelligence checkout, and Stripe post-payment webhook links to use the same shared public app URL resolver.
- Updated the shared `createSubscriptionCheckoutSession` helper to use package-local app URL resolver logic with canonical alias and Vercel deployment URL fallbacks.

Residual risk:

- If the business wants automatic recurring billing for targeted add-ons, the route still needs a future Stripe `subscription` mode implementation with webhook and data-model validation in test mode first.

Risk of remaining fix: high if payment mode changes blindly; medium if feature-flagged and tested.

### GUARDED: Legacy Main Stripe Checkout Still Uses One-Time Session For Monthly Bundle Path

Evidence:

- `apps/web/app/api/stripe/checkout/route.ts:181` notes subscription checkout is future work.
- `apps/web/app/api/stripe/checkout/route.ts:185` confirms current checkout uses `mode:"payment"`.
- `packages/services/src/stripe/index.ts:53` defines `createOneTimeCheckoutSession`.
- `packages/services/src/stripe/index.ts:138` already defines `createSubscriptionCheckoutSession`, but the main route does not use it yet.
- `createSubscriptionCheckoutSession` now uses package-local app URL resolver logic for future success/cancel URLs, but the legacy route still does not call it.
- Repo search found no current caller for `/api/stripe/checkout`.
- The active get-started spot checkout posts to `/api/spots/checkout`, which uses `mode: "subscription"` and recurring monthly line items.
- The route now returns `410` unless `ENABLE_LEGACY_STRIPE_CHECKOUT=true`.

Why it matters:

If the legacy route is reactivated or linked later, it can collect a one-time payment instead of establishing recurring revenue.

Fix applied:

- Added `apps/web/lib/stripe/legacy-checkout.ts` and focused tests for the exact flag behavior.
- Added a fail-closed guard at the top of `/api/stripe/checkout`, before auth, database writes, or Stripe API calls.
- Registered `ENABLE_LEGACY_STRIPE_CHECKOUT=false` in env validation, Turbo env tracking, `.env.example`, and the production env template.

Validation:

- `pnpm exec vitest run apps/web/lib/stripe/__tests__/legacy-checkout.test.ts` passed.
- `pnpm test` passed with 141 tests.
- `pnpm exec turbo type-check --ui=stream` passed.
- `pnpm --filter @homereach/web lint` passed with existing warnings only.
- `pnpm --filter @homereach/web build` passed with non-secret placeholder env and `ENABLE_LEGACY_STRIPE_CHECKOUT=false`.

Safest remaining fix:

- Keep active spot checkout on `/api/spots/checkout`.
- Keep `ENABLE_LEGACY_STRIPE_CHECKOUT` absent or false unless the legacy route is deliberately revalidated.
- Test any future payment-mode change in Stripe test mode before any live switch.

Risk of fix: low for the default-disabled guard; high if payment mode is changed blindly.

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
- Added retryable 503 behavior for insert failures and unexpected handler errors, so Twilio can retry telemetry callbacks instead of receiving false-success 200.
- Added a pure Twilio status helper and provider-shaped tests for delivered, undelivered, malformed, signed sample callbacks, and retry-decision behavior without sending SMS.

Validation:

- `pnpm exec vitest run apps/web/lib/outreach/__tests__/twilio-status-webhook.test.ts` passed.
- `pnpm test` passed.
- `pnpm exec turbo type-check --ui=stream` passed.
- `pnpm --filter @homereach/web lint` passed with existing warnings.
- `pnpm --filter @homereach/web build` passed with non-secret placeholder env.

Residual risk:

- No live Twilio webhook was invoked. Provider validation should use a signed sample payload first and avoid sending live SMS.

### RESOLVED: Inbound SMS Replies Could Be Acknowledged After Bridge Capture Failure

Original evidence before fix:

- `apps/web/app/api/webhooks/outreach/sms/route.ts` caught `processInboundRevenueMessage` failures and continued.
- If the incoming phone number did not match legacy `outreach_contacts`, the route returned empty TwiML even after the revenue messaging bridge failed or returned no event ID.

Why it mattered:

Unknown or newly sourced SMS replies may only exist in the revenue messaging ledger. Acknowledging Twilio before the bridge captures the reply can hide a lead response, customer issue, political reply, or opt-in conversation that should enter the approval queue.

Fix applied:

- Added `apps/web/lib/outreach/inbound-sms-webhook.ts` with pure inbound SMS signature validation and retry decision helpers.
- Updated `/api/webhooks/outreach/sms` so unmatched replies return retryable 503 when the revenue bridge throws or reports `processed: true` without an event ID.
- Preserved the legacy known-contact path: when a contact is found, the route still writes `outreach_replies` and returns 200, avoiding duplicate retry pressure after legacy capture.
- Kept bridge-disabled behavior acknowledged, so deliberate `REVENUE_MESSAGING_BRIDGE_ENABLED=false` operation does not force retries.

Validation:

- `pnpm exec vitest run apps/web/lib/outreach/__tests__/inbound-sms-webhook.test.ts` passed.
- `pnpm test` passed.
- `pnpm exec turbo type-check --ui=stream` passed.
- `pnpm --filter @homereach/web lint` passed with existing warnings.
- `pnpm --filter @homereach/web build` passed with non-secret placeholder env.

Residual risk:

- No live inbound SMS was invoked. Provider validation should use a signed sample payload and no live sends first.

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
- Added local tests for Postmark Basic Auth and email event-row mapping using provider-shaped sample data.
- Updated `/api/webhooks/postmark` so `email_events` insert failures return retryable 503 instead of false-success 200.
- Kept `sales_leads.email_status` updates best-effort after the event is logged.
- Constrained `valid` and `bounced_temporary` updates so they cannot overwrite `bounced_permanent`, `complained`, or `unsubscribed`.

Validation:

- `pnpm exec vitest run apps/web/lib/email/__tests__/postmark-webhook.test.ts` passed.
- `pnpm test` passed.
- `pnpm exec turbo type-check --ui=stream` passed.
- `pnpm --filter @homereach/web lint` passed with existing warnings.
- `pnpm --filter @homereach/web build` passed with non-secret placeholder env.

Residual risk:

- No live Postmark webhook was invoked. Provider validation should use sample payloads and test Basic Auth before any live email volume.

### RESOLVED: Facebook/APEX Admin Automation POSTs Could Run Without Auth

Original evidence before fix:

- `apps/web/app/api/admin/sales/facebook/alert/route.ts` accepted public POSTs, used the Supabase service-role client, and could attempt Twilio alerts.
- `apps/web/app/api/admin/sales/facebook/daily-score/route.ts` only warned when `x-cron-secret` was missing or wrong, then computed scores with the service-role client.
- `apps/web/app/api/admin/system/apex/route.ts` only warned when `x-cron-secret` was missing or wrong, then ran the orchestration sweep.

Why it mattered:

These routes are not customer-facing provider webhooks; they are operator automation surfaces. Public invocation could trigger internal SMS alerts, score recomputation, or multi-agent workflows using privileged service-role access.

Fix applied:

- Added `requireAdminSalesAgentOrCron` for routes that can be used by authenticated sales/admin UI or trusted internal callers.
- Moved request-secret extraction into `apps/web/lib/auth/request-secret.ts`.
- Added focused tests for `x-cron-secret` and Bearer-token parsing.
- Required `requireAdminSalesAgentOrCron` on Facebook alert POST.
- Required `requireAdminOrCron` on Facebook daily score and APEX orchestration POST.

Validation:

- `pnpm exec vitest run apps/web/lib/auth/__tests__/request-secret.test.ts` passed.
- `pnpm test` passed.
- `pnpm exec turbo type-check --ui=stream` passed.
- `pnpm --filter @homereach/web lint` passed with existing warnings.
- `pnpm --filter @homereach/web build` passed with non-secret placeholder env.

Residual risk:

- No live Meta webhook was invoked. Provider validation should use signed sample payloads or Meta test tooling before any production Facebook automation is trusted.

### RESOLVED: Meta Webhooks Could Process Unsigned Payloads When App Secret Was Missing

Original evidence before fix:

- `apps/web/app/api/webhooks/facebook/route.ts` skipped signature enforcement when `FACEBOOK_APP_SECRET` was absent and used a default verify token.
- `apps/web/app/api/facebook/webhook/route.ts` skipped signature enforcement when `FACEBOOK_APP_SECRET` was absent and could process Messenger/comment payloads with service-role data access.

Why it mattered:

These are public provider webhook routes. In production, missing Meta secrets should disable trust rather than allowing unsigned payloads to create Facebook leads, messages, alerts, or internal automation attempts.

Fix applied:

- Added `apps/web/lib/facebook/webhook-auth.ts` for timing-safe Meta SHA-256 signature validation and verify-token resolution.
- Added focused tests for valid signatures, invalid signatures, production missing-secret failure, development local allowance, verify-token precedence, and production missing-token failure.
- Updated both Facebook webhook POST routes to reject unsigned/invalid payloads before service-role work.
- Updated both Facebook webhook GET verification handlers to fail closed in production if no verify token is configured.

Validation:

- `pnpm exec vitest run apps/web/lib/facebook/__tests__/webhook-auth.test.ts` passed.
- `pnpm test` passed.
- `pnpm exec turbo type-check --ui=stream` passed.
- `pnpm --filter @homereach/web lint` passed with existing warnings.
- `pnpm --filter @homereach/web build` passed with non-secret placeholder env.

Residual risk:

- No live Meta webhook was invoked. Validate only with signed provider/test payloads before trusting Facebook production automation.

### RESOLVED: Admin Service-Role Routes Could Run Without Operator Access

Original evidence before fix:

- Multiple `/api/admin/agents/*` POST/GET routes created Supabase service-role clients and read/logged operational data without admin or cron checks.
- `/api/admin/alerts/send` could resolve personal alert phones, insert internal alert rows, and potentially send SMS without an operator or cron gate.
- `/api/admin/founding/slots`, `/api/admin/pricing/bundle`, and `/api/admin/pricing/city` could expose or mutate revenue/pricing configuration without an admin check.
- `/api/admin/sales/facebook/mission` could read Facebook mission data and log mission completion rows without an operator check.

Why it mattered:

These are admin surfaces that use service-role access. Public invocation could leak operational data, change pricing/founding controls, create noisy sales events, or trigger internal alert workflows.

Fix applied:

- Added `requireAdminOrCron` to service-role agent scan/runner POSTs and internal alert sending.
- Added `requireAdmin` to agent status GET routes and service-role runner status reads.
- Restricted scraper execution to admin-or-cron instead of any authenticated user.
- Restricted sales call-script writes to admins and sales lead alerts to admin/sales sessions, with lead ownership enforcement for sales agents.
- Added `requireAdmin` to founding slot and pricing configuration routes.
- Added `requireAdminOrSalesAgent` to Facebook mission GET/POST.
- Updated internal alert self-calls to pass `x-cron-secret` so trusted automation can still use the newly guarded alert route.

Validation:

- Service-role route scan now leaves only expected public/provider exceptions: targeted checkout, intelligence checkout, and Twilio status.
- Full test suite, typecheck, web lint, and web build passed locally after the change.

Residual risk:

- This first sweep covered the highest-risk mutation/send surfaces. The follow-up read-route sweep below covers broader dashboard data exposure.

### RESOLVED: Sensitive Admin Read And Send Routes Could Run Without Operator Access

Original evidence before fix:

- Several `/api/admin/sales/*` GET routes returned lead, reply, funnel, leaderboard, insight, and Facebook scorecard data using the Supabase service-role client without an explicit API guard.
- `/api/admin/sales/close-deal` could send SMS/email close messages and update lead state without an authenticated admin/sales-agent gate.
- `/api/admin/sales/nudge`, `/api/admin/sales/power-mode/end-of-day`, and `/api/admin/email/warmup/send` relied on cron checks that allowed public execution if `CRON_SECRET` was missing.
- `/api/admin/founding/members`, `/api/admin/intelligence/pricing`, `/api/admin/alerts/log`, `/api/admin/email/warmup/status`, `/api/admin/operator/summary`, and `/api/admin/health` exposed privileged operational/revenue/system data without explicit admin or cron access checks.

Fix applied:

- Added `requireAdmin` to admin-only data surfaces.
- Added `requireAdminOrSalesAgent` to sales-agent dashboard/read and close-deal surfaces.
- Added `requireAdminOrCron` to cron/manual operational jobs and admin health.
- Forwarded the authenticated cookie from `/api/admin/operator/summary` to guarded internal dashboard subfetches so the dashboard can still aggregate protected child endpoints for authenticated admins.
- Added a tested `resolveAgentScope` helper and applied it to explicit `agent_id` sales/Facebook routes so sales agents cannot read or act as another rep by changing query/body values. The second scope pass covered at-risk deals, priority actions, call lists, call logs, call stats, follow-up sequence logging, and power-mode checks.

Validation:

- Follow-up service-role scan across `apps/web/app/api/admin` now reports no unguarded service-client routes outside custom authorized political sync routes.
- Full local unit suite, typecheck, web lint, and web build passed after this second access-control sweep.

Residual risk:

- Unauthenticated external monitors or undocumented callers must now use an admin session or cron secret, which is intentional for service-role admin data.
- Team-wide sales and Facebook leaderboards intentionally remain visible to authenticated admin/sales-agent sessions in this pass and need product review before restricting visibility.
- Public intelligence checkout no longer activates founding membership or slot data before confirmed payment; the remaining risk is schema drift because the referenced property-intelligence tables are not present in committed schema or migrations.

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
- Twilio status webhook now returns retryable 503 for telemetry insert/handler failures after signature validation.
- Inbound SMS reply webhook signature validation and unmatched-reply retry decisions are covered by focused helper tests.
- Inbound SMS reply webhook now returns retryable 503 for unmatched replies when the revenue messaging bridge fails or misses the event ledger.
- APEX SMS command POSTs now require valid Twilio signatures before trusted command execution, and the liveness response no longer exposes configured phone numbers.
- Facebook webhook signature validation and production missing-secret/verify-token behavior are covered by focused helper tests.
- Facebook alert, Facebook daily score, and APEX orchestration POSTs now require cron or authenticated operator access before service-role work.
- Facebook follow-up cron now fails closed when `CRON_SECRET` is missing.
- Public nonprofit and intake notification emails now escape user-controlled HTML before rendering and clean dynamic subject fragments.
- Public political map-plan persistence now rejects empty route/geography selections before service-role writes and rejects oversized request bodies before JSON parsing.
- Admin service-role agent scans, internal alerts, founding/pricing updates, Facebook mission logging, sensitive sales/admin reads, sales-agent ownership-scoped dashboard routes, send-capable sales/email jobs, operator summaries, and admin health now require operator, sales-agent, or cron access as appropriate.
- CRM, automation, migration, alert-preference, Facebook revenue-engine, and system-agent utility admin routes now require shared role/cron guards before privileged reads or mutations.
- Admin inbox conversation routes and targeted campaign admin routes now require `requireAdmin()` before privileged reads, writes, or communication sends.
- Admin outreach health now flags stale or missing provider telemetry after same-day email/SMS send activity.
- Communication provider code is centralized enough to support reputation controls.

Latest validation for this follow-up guard sweep:

- Focused ESLint on touched admin CRM/automation/migration/Facebook/system-agent routes passed with only pre-existing warnings.
- `pnpm exec turbo type-check --ui=stream` passed across 5 packages.
- `pnpm test` passed with 172 tests.
- `pnpm --filter @homereach/web lint` passed with 495 warnings and 0 errors.
- Placeholder-env `pnpm --filter @homereach/web build` passed and generated 248 routes.
- `git diff --check` and the admin route guard scanner passed.
- Focused ESLint on admin-adjacent conversation and targeted admin routes passed with only pre-existing warnings.
- Focused inbound SMS signature helper tests, request-secret helper tests, agent-scope helper tests, focused ESLint on `/api/command` and `/api/facebook/followup`, full `pnpm test` with 174 tests, full workspace typecheck, full web lint with 495 existing warnings and 0 errors, placeholder-env web build with 248 routes, and `git diff --check` passed after the APEX command/Facebook cron hardening patch.
- Focused political candidate chat kill-switch tests, full `pnpm test` with 175 tests, full workspace typecheck across 5 packages, full web lint with 495 existing warnings and 0 errors, placeholder-env web build with 248 routes, and `git diff --check` passed after the political AI kill-switch hardening patch.
- Focused HTML escaping and email subject tests, focused ESLint on the helpers and touched public form routes, full `pnpm test` with 179 tests, full workspace typecheck across 5 packages, full web lint with 495 existing warnings and 0 errors, placeholder-env web build with 248 routes, and `git diff --check` passed after the public form email hardening patch.
- Focused map-plan persistence tests, focused ESLint on the route/helper/test files, full `pnpm test` with 181 tests, full workspace typecheck across 5 packages, full web lint with 495 existing warnings and 0 errors, and placeholder-env web build with 248 routes passed after the public political map-plan hardening patch.

## Safe Validation Path

1. Keep production env untouched.
2. Add local unit tests for Stripe event claim states before code changes.
3. Run Stripe CLI/test-mode webhook replay only against a test database or isolated local test schema.
4. Validate targeted checkout with signed test campaigns before enabling public links.
5. Validate Twilio status insert with a signed sample request and no live SMS send.
6. Validate inbound SMS reply handling with signed sample requests, including unmatched-number bridge failure behavior, and no live SMS send.
7. Validate Postmark webhook with sample payloads and test Basic Auth.
8. Probe Facebook webhook POSTs without signatures and expect 401/503 without service-role mutations or Facebook sends.
9. Probe Facebook/APEX admin automation POSTs without credentials and expect 401/403 without service-role mutations or SMS sends.
10. Probe `/api/command` POST without `X-Twilio-Signature` and expect 403 before any internal self-call.
11. Probe newly guarded admin service-role POST/PUT routes without credentials and expect 401/403 without mutations or SMS sends.
12. Probe newly guarded admin read/send surfaces without credentials and expect 401/403 without exposing lead, alert, revenue, health, or warmup data.
13. Probe `/api/political/map-plans` with an empty JSON payload and expect local-only rejection or module-disabled `404` with no database writes.
14. Add admin health checks for provider telemetry freshness, not just table readability.
15. Only then perform provider-level test-mode checks.

## Production Readiness Gate

Current status: not ready for provider-live promotion yet.

Reason: the branch passes local code validation, GitHub Actions, and Vercel preview validation. The Stripe retry-drop, public targeted checkout authorization, public intelligence checkout activation timing, Twilio telemetry durability, inbound SMS reply capture, APEX SMS command signature validation, Facebook cron fail-closed behavior, Postmark callback durability, Meta webhook fail-closed, public form email rendering, public political map-plan persistence, and admin service-role access risks have tested branch fixes. Stripe now has synthetic signature verification coverage and the `TARGETED_CHECKOUT_SIGNING_SECRET` Vercel env repair is complete, but provider test-mode validation still needs completion before production-sensitive flows are trusted. Property-intelligence schema remains a controlled-audit item because the referenced tables are not present in committed schema or migrations.
