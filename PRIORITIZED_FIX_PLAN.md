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

### Partially Resolved: Environment Name Drift Can Break Provider And Agent Workflows

What was wrong: Vercel has the static startup-required names, but several runtime paths used aliases that did not match deployed env names. The highest-risk examples were `NEXTAUTH_URL` missing while agent routes could fall back to `http://localhost:3000`, `SERP_API`/`HUNTER` existing while code expected `SERPAPI_KEY`/`HUNTER_API_KEY`, and `APEX_APPROVED_SENDER` existing while code read `APEX_APPROVED_SENDERS`.

Why it matters: operators can believe a provider is configured while the live route treats it as missing, and production agent orchestration can call localhost instead of the deployed site.

Files:

- `ENVIRONMENT_VARIABLES_AUDIT.md`
- `apps/web/app/api/admin/agents/run/route.ts`
- `apps/web/app/api/admin/agents/anchor/route.ts`
- `apps/web/app/api/admin/agents/closer/route.ts`
- `apps/web/app/api/admin/agents/echo/route.ts`
- `apps/web/app/api/admin/agents/scraper/route.ts`
- `apps/web/app/api/admin/sales/power-mode/end-of-day/route.ts`
- `apps/web/app/api/admin/system/agents/pulse/route.ts`
- `apps/web/app/api/command/route.ts`
- `apps/web/app/api/intelligence/checkout/route.ts`
- `apps/web/app/api/spots/checkout/route.ts`
- `apps/web/app/api/stripe/checkout/route.ts`
- `apps/web/app/api/webhooks/stripe/route.ts`
- `apps/web/app/layout.tsx`
- `apps/web/app/sitemap.ts`
- `apps/web/app/robots.ts`
- `apps/web/app/api/intake/[token]/route.ts`
- `apps/web/app/api/nonprofit/route.ts`
- `apps/web/app/api/admin/sales/close-deal/route.ts`
- `apps/web/app/api/facebook/webhook/route.ts`
- `apps/web/app/api/facebook/followup/route.ts`
- `apps/web/lib/engine/automation.ts`
- `apps/web/lib/runtime/app-url.ts`
- `apps/web/lib/seo/schema.ts`
- `apps/web/lib/seo/quality.ts`
- `apps/web/lib/political/candidate-intelligence/providers/serpapi.ts`
- `apps/web/lib/env.ts`
- `packages/services/src/targeted/index.ts`
- `turbo.json`
- `.env.example`

Fix applied: added a shared internal/public app URL resolver, removed localhost-only fallback from runtime admin/agent self-calls, moved APEX command agent routing off the hardcoded production domain, moved payment-adjacent checkout redirects and Stripe post-payment links onto the public resolver, moved SEO metadata/sitemap/robots/auth reset/admin notification/proposal/internal-alert/generated outreach links onto shared resolvers, added Vercel deployment URL fallbacks for missing canonical app URL aliases, accepted `SERP_API`/`HUNTER` aliases in the relevant provider readers, accepted both Apex approved-sender names, and aligned Twilio messaging-service env validation/templates with both names.

Validation: focused app URL helper test, full unit suite, typecheck, web lint gate, and web build with non-secret placeholder env all passed locally.

Safest remaining fix: add/verify missing canonical env names in Vercel where the feature is approved. Do not remove legacy Vercel names until history is confirmed.

Risk of fix: low for adding missing names; medium for changing runtime fallback behavior.

Approval needed: yes for Vercel env mutation; no for documentation-only audit.

### Email Provider Runtime Value Needs Explicit Confirmation

What is wrong: Vercel has `EMAIL_PROVIDER`, Mailgun names, and Postmark names, but no `RESEND_API_KEY`. The Vercel CLI metadata audit intentionally did not reveal the hidden `EMAIL_PROVIDER` value.

Why it matters: if production `EMAIL_PROVIDER=resend`, startup validation requires `RESEND_API_KEY` and the app should fail fast. If the intended provider is Mailgun or Postmark, the runbook needs to say that clearly so future operators do not add the wrong provider key or misread stale examples.

Files:

- `ENVIRONMENT_VARIABLES_AUDIT.md`
- `apps/web/lib/env.ts`
- `packages/services/src/outreach/index.ts`
- `packages/services/src/outreach/postmark.ts`
- `.env.example`

Safest fix: verify the provider value in Vercel without exposing it, then either add the matching missing key or update the docs/templates to mark the intended provider.

Risk of fix: low for verification; medium if changing provider behavior.

Approval needed: yes for Vercel env mutation or provider switching.

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

### Partially Resolved: Targeted Checkout Billing Copy Did Not Match Stripe Payment Mode

What was wrong: targeted checkout described multiple add-ons as monthly or billed going forward, but creates the Stripe Checkout session with `mode: "payment"`.

Why it mattered: customers could expect Stripe to start recurring billing while Stripe only collected a one-time first-month payment, creating missed recurring revenue or billing confusion.

Files:

- `apps/web/app/(funnel)/targeted/checkout/page.tsx`
- `apps/web/app/api/stripe/targeted-checkout/route.ts`

Fix applied: targeted checkout now labels recurring add-ons as ongoing services activated separately after onboarding, and Stripe line-item descriptions now describe the charge as the first month instead of implying automatic monthly billing. The route also uses the shared public app URL resolver.

Safest remaining fix: confirm the intended business model. If these add-ons should create automatic recurring Stripe subscriptions, implement subscription line items in Stripe test mode with webhook/data-model validation before any live switch.

Risk of remaining fix: high if payment mode changes blindly; medium if feature-flagged and tested in Stripe test mode.

Approval needed: yes before changing live billing behavior.

### Clarified: Legacy Main Stripe Checkout Uses One-Time Payment For Monthly Pricing Path

What was unclear: `/api/stripe/checkout` resolves a monthly bundle price and calls the one-time Checkout session path, while a subscription helper exists but is not wired into that route.

Clarification: repo search found no current caller for `/api/stripe/checkout`. The active homepage/get-started spot checkout posts to `/api/spots/checkout`, which creates Stripe Checkout with `mode: "subscription"` and monthly recurring line items.

Why it matters: the legacy route is still risky if reactivated or linked later because it can collect a one-time payment for a monthly-priced bundle.

Files:

- `apps/web/app/(funnel)/get-started/[citySlug]/[categorySlug]/checkout/checkout-form.tsx`
- `apps/web/app/api/spots/checkout/route.ts`
- `apps/web/app/api/stripe/checkout/route.ts`
- `packages/services/src/stripe/index.ts`

Safest fix: leave active `/api/spots/checkout` as the subscription path; either retire/guard the legacy `/api/stripe/checkout` route or clearly document it as inactive before any future reuse.

Risk of fix: medium if guarding/removing the legacy route; high if changing payment behavior without Stripe test-mode validation.

Approval needed: yes before live payment behavior changes; no for additional documentation or dead-route guards on the PR branch.

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
