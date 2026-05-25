# Prioritized Fix Plan

Updated: 2026-05-25

## CRITICAL

### Resolved: Public Intelligence Checkout Activated Founding Membership Before Payment

What was wrong: `/api/intelligence/checkout` created a Stripe Checkout session, then immediately inserted an `active` `founding_memberships` row and decremented `founding_slots` before Stripe confirmed payment.

Why it mattered: a public caller could consume founding inventory and create active founding-member records by starting checkout and abandoning payment. This was a revenue-integrity and inventory-accuracy risk.

Files:

- `apps/web/app/api/intelligence/checkout/route.ts`
- `apps/web/app/api/webhooks/stripe/route.ts`
- `apps/web/lib/intelligence/checkout.ts`
- `apps/web/lib/intelligence/__tests__/checkout.test.ts`
- `apps/web/app/(funnel)/intelligence/checkout/intelligence-checkout-client.tsx`
- `apps/web/app/(admin)/admin/founding/page.tsx`

Fix applied: public checkout creation now adds explicit `property_intelligence` Stripe metadata and no longer writes `founding_memberships` or updates `founding_slots`. The signed Stripe webhook now finalizes founding memberships only after `checkout.session.completed`, then recalculates slot usage from active memberships so webhook retries stay idempotent. Malformed JSON checkout payloads now return `400 Invalid checkout payload` before Supabase or Stripe work can begin.

Additional schema concern: `property_intelligence_tiers`, `founding_slots`, and `founding_memberships` are referenced by app code but are not present in committed Drizzle schema or Supabase migration files found by repo search. Production may have out-of-band tables; before any schema migration, pull/verify the live schema in a controlled Supabase workflow.

Validation: focused property-intelligence checkout helper tests, full unit suite, full workspace typecheck, web lint, and web build with non-secret test-shaped env passed locally after the change.

Approval needed: no for local code hardening and documentation; yes before Stripe provider-live validation or production data reconciliation.

### Critical: Property Intelligence Webhook References A Missing Live Column

What is wrong: a read-only Supabase metadata check confirmed the live `HomeReach` project has `property_intelligence_tiers`, `founding_slots`, and `founding_memberships`, but those tables are not represented in committed migrations. More urgently, live `founding_memberships` does not have `stripe_checkout_session_id`, while `apps/web/app/api/webhooks/stripe/route.ts` queries and inserts that column when finalizing a paid property-intelligence founding checkout.

Why it matters: a paid property-intelligence founding checkout can reach Stripe `checkout.session.completed`, then fail during webhook finalization because the idempotency lookup references a missing column. That can leave paid founding memberships uncreated, slot counts stale, admin dashboards inaccurate, and Stripe retries stuck until the schema drift is repaired.

Files:

- `apps/web/app/api/webhooks/stripe/route.ts`
- `apps/web/app/api/intelligence/checkout/route.ts`
- `apps/web/app/(funnel)/intelligence/page.tsx`
- `apps/web/app/(admin)/admin/founding/page.tsx`
- `PROPERTY_INTELLIGENCE_SCHEMA_AUDIT.md`

Safest fix: take a controlled Supabase schema snapshot, create an additive migration for `founding_memberships.stripe_checkout_session_id text`, add a unique index for webhook idempotency, bring the three out-of-band property-intelligence tables under committed migration/schema control, validate on a Supabase branch or isolated test database, and only then apply to production. A local migration proposal now exists at `supabase/migrations/20260525175220_property_intelligence_schema_alignment.sql`; it has not been applied to the live project.

Risk of fix: low-to-medium if limited to an additive nullable column and index, but high operational sensitivity because it touches payment finalization. Production DDL requires backup/snapshot and an explicit rollback path.

Validation: `git diff --check` passed after creating the migration proposal. `supabase migration list --local` could not run because the local Supabase Postgres service is not running on `127.0.0.1:54322`.

Approval needed: yes before applying live Supabase DDL or replaying Stripe webhooks. No for documentation or a migration proposal.

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
- `apps/web/app/api/webhooks/outreach/sms/route.ts`
- `apps/web/app/api/webhooks/postmark/route.ts`
- `apps/web/lib/outreach/twilio-status-webhook.ts`
- `apps/web/lib/outreach/inbound-sms-webhook.ts`
- `apps/web/lib/supabase/*`
- `packages/services/src/outreach/*`

Safest fix: validate only in Stripe test mode and communication dry-run/test-mode first; do not send live SMS/email or mutate production records.

Risk of fix: medium to high if pointed at live providers or production data.

Approval needed: yes for any provider-mutating or production-data test.

Current tooling status: Stripe CLI is installed, but not authenticated. Use `PROVIDER_TEST_MODE_RUNBOOK.md` and test/sandbox credentials only.

### Resolved: APEX SMS Command Endpoint Trusted Spoofable Form Fields

What was wrong: `/api/command` parsed inbound SMS form fields and trusted the `From` value before validating Twilio's request signature. If a caller spoofed an approved sender phone number, the route could call protected admin/agent routes using the server's `CRON_SECRET`.

Why it mattered: APEX is an operator command surface. Even though downstream routes have cron/admin guards, this endpoint could have become a remote-control bridge because it supplied the cron secret on internal self-calls after only checking a request-provided phone number.

Files:

- `apps/web/app/api/command/route.ts`
- `apps/web/lib/outreach/inbound-sms-webhook.ts`
- `apps/web/lib/outreach/__tests__/inbound-sms-webhook.test.ts`

Fix applied: added Twilio signature validation to `/api/command` before approved-sender checks or command execution, using the shared inbound SMS signature helper with a custom canonical path for `/api/command`. The public liveness response now returns only configuration booleans/counts and no longer exposes approved sender phone numbers or the APEX number.

Validation: focused inbound SMS helper tests, focused request-secret/agent-scope tests, focused ESLint on the touched route/helper files, full `pnpm test` with 174 tests, full workspace typecheck, full web lint with existing warning debt only, placeholder-env web build with 248 routes, and `git diff --check` passed locally. No live Twilio request or command execution was performed.

Approval needed: no for fail-closed hardening; yes before live Twilio command validation or any command that can trigger sends, pricing, payments, campaign changes, or provider-side activity.

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
- `packages/services/src/stripe/app-url.ts`
- `packages/services/src/stripe/__tests__/app-url.test.ts`
- `packages/services/src/targeted/index.ts`
- `turbo.json`
- `.env.example`

Fix applied: added shared internal/public app URL resolver logic, removed localhost-only fallback from runtime admin/agent self-calls, moved APEX command agent routing off the hardcoded production domain, moved payment-adjacent checkout redirects and Stripe post-payment links onto the public resolver, moved the shared Stripe subscription Checkout helper onto package-local resolver logic, moved SEO metadata/sitemap/robots/auth reset/admin notification/proposal/internal-alert/generated outreach links onto shared resolvers, added Vercel deployment URL fallbacks for missing canonical app URL aliases, accepted `SERP_API`/`HUNTER` aliases in the relevant provider readers, accepted both Apex approved-sender names, and aligned Twilio messaging-service env validation/templates with both names.

Validation: focused app URL helper tests, focused Stripe app URL resolver test, full unit suite, typecheck, web lint gate, and web build with non-secret placeholder env all passed locally.

Safest remaining fix: add/verify missing canonical env names in Vercel where the feature is approved. Do not remove legacy Vercel names until history is confirmed.

Risk of fix: low for adding missing names; medium for changing runtime fallback behavior.

Approval needed: yes for Vercel env mutation; no for documentation-only audit.

### Resolved: Email Provider Routing Drift Could Break Send-Capable Sales Flows

What was wrong: most outbound email paths used the central `sendEmail()` router, but `/api/admin/sales/close-deal` still sent email through a direct Mailgun helper. Separately, the email warmup job attempted to switch sender identity by mutating `process.env.MAILGUN_FROM_EMAIL` and `process.env.MAILGUN_FROM_NAME` during each send.

Why it mattered: if production is configured for `EMAIL_PROVIDER=resend` or `EMAIL_PROVIDER=postmark`, close-deal email could fail unless Mailgun credentials also existed. Warmup env mutation was risky in shared serverless execution and could fail to set the intended sender because `DEFAULT_FROM_EMAIL` can take precedence over `MAILGUN_FROM_EMAIL`.

Files:

- `packages/services/src/outreach/index.ts`
- `apps/web/app/api/admin/email/warmup/send/route.ts`
- `apps/web/app/api/admin/email/warmup/__tests__/send-route.test.ts`
- `apps/web/app/api/admin/sales/close-deal/route.ts`
- `apps/web/app/api/admin/sales/__tests__/close-deal.test.ts`
- `EMAIL_PROVIDER_ROUTING_AUDIT.md`

Fix applied: the email warmup route now passes `fromEmail` and `fromName` directly to `sendEmail()` for seed and real-prospect sends and no longer mutates provider environment variables. The close-deal route now sends email through central `sendEmail()` with the agent sender identity instead of using a direct Mailgun helper.

Validation: focused close-deal route test passed with 1 test, focused close-deal ESLint passed with 0 warnings/errors, full `pnpm test` passed with 198 tests across 29 files, full workspace typecheck passed across 5 packages, full web lint passed with 492 existing warnings and 0 errors, placeholder-env web build generated 247 static pages, and `git diff --check` passed.

Safest remaining fix: treat Twilio close-deal routing separately because moving the existing SMS helper to `sendSms()` may intentionally introduce safety gates that block live sends unless configured.

Risk of fix: low for the warmup identity fix; medium for close-deal provider migration because it is revenue-sensitive and send-capable. The implemented close-deal change was kept narrow and covered with focused tests.

Approval needed: no for local branch code hardening and docs; yes before live email/SMS send validation or production automation runs.

### Resolved: Shared SMS Routing Could Override Explicit Agent Sender Numbers

What was wrong: `sendSms()` accepted explicit `fromNumber` values from customer-facing sales flows, but if `OUTREACH_TWILIO_MESSAGING_SERVICE_SID` or `TWILIO_MESSAGING_SERVICE_SID` existed in env, the final Twilio payload used the messaging service instead of the explicit agent number.

Why it mattered: agent sender identity matters for reply continuity, coordinated outreach, and Josh/Chelsi/Heather/Jason identity separation. The old behavior made SMS sender identity depend on env configuration even when the caller supplied a specific `agent_identities.twilio_phone` value.

Files:

- `packages/services/src/outreach/index.ts`
- `packages/services/src/outreach/__tests__/sms.test.ts`
- `SMS_PROVIDER_ROUTING_AUDIT.md`

Fix applied: shared `sendSms()` now preserves explicit `fromNumber` values over env-derived messaging-service defaults, while still honoring an explicitly supplied `messagingServiceSid` when a caller intentionally passes one.

Validation: focused shared SMS routing tests passed with 5 tests, services typecheck passed, full `pnpm test` passed with 203 tests across 30 files, full workspace typecheck passed across 5 packages, full web lint passed with 492 existing warnings and 0 errors, placeholder-env web build generated 247 static pages, and `git diff --check` passed.

Safest remaining fix: review close-deal SMS separately before routing that route through central `sendSms()` because test-mode, approval, messaging-service, and status-callback semantics can intentionally alter live behavior.

Risk of fix: low to medium. The code change is centralized and covered by tests, but SMS sender selection is revenue/reputation-sensitive.

Approval needed: no for this branch-local sender identity hardening; yes before live Twilio validation, live SMS sends, production messaging-service config changes, or close-deal SMS behavior changes.

### Resolved: Public Form Email Notifications Rendered Unsanitized HTML

What was wrong: public nonprofit registration and shared-postcard intake submissions rendered user-controlled fields directly into HTML email bodies, and dynamic subject fragments were not cleaned for control characters.

Why it mattered: malicious or malformed form values could change the rendered admin/applicant notification email, hide content, inject links, or make spam payloads harder to review safely.

Files:

- `apps/web/app/api/nonprofit/route.ts`
- `apps/web/app/api/intake/[token]/route.ts`
- `apps/web/lib/security/html.ts`
- `apps/web/lib/security/__tests__/html.test.ts`

Fix applied: added small HTML escaping and email subject-cleaning helpers. User-controlled nonprofit and intake values are escaped before rendering notification email HTML, and dynamic subject fragments strip control characters and collapse whitespace. Stored submission values are unchanged.

Validation: focused HTML escaping and email subject tests passed, focused ESLint on the helpers and touched public form routes passed, full `pnpm test` passed with 179 tests, full workspace typecheck passed across 5 packages, full web lint passed with 495 existing warnings and 0 errors, placeholder-env web build generated 248 routes, and `git diff --check` passed locally.

Approval needed: no for the defensive rendering change; yes before sending live test emails or changing public form business behavior.

### Resolved: Public Political Map Plans Could Persist Empty Selections

What was wrong: `/api/political/map-plans` accepted public JSON payloads and the persistence helper could proceed to Supabase service-role work even when no carrier routes or political geographies were selected. The route also parsed public request bodies without a route-level size guard.

Why it mattered: empty public saves could create low-value map session/plan rows and unnecessary service-role database activity. Oversized bodies increased public endpoint abuse risk before any business value was present.

Files:

- `apps/web/app/api/political/map-plans/route.ts`
- `apps/web/lib/political/map-plans.ts`
- `apps/web/lib/political/__tests__/map-plans.test.ts`

Fix applied: the helper now computes normalized routes/geographies before Supabase credentials are checked and returns a local-only result when both selections are empty. The route now rejects map-plan request bodies over 750 KB before JSON parsing and persistence. Meaningful selections still continue to the existing persistence path when Supabase service credentials are configured.

Validation: focused map-plan persistence tests passed, focused ESLint on the touched route/helper/test files passed, full `pnpm test` passed with 181 tests, full workspace typecheck passed across 5 packages, full web lint passed with 495 existing warnings and 0 errors, and placeholder-env web build generated 248 routes locally.

Approval needed: no for the defensive public endpoint hardening; yes before changing political launch posture, live political workflows, or production database records.

### Resolved: Public Political Candidate Search Exposed Direct Contact Fields

What was wrong: `/api/political/candidates/search` is a public feature-flagged autocomplete route backed by the Supabase service-role client. It returned the full internal `CandidateSuggestion` shape, including direct campaign email and phone fields that the public autofill UI does not use.

Why it mattered: public autocomplete should return only the operational fields needed to prefill race, geography, election, and map-planning context. Direct contact fields raise scraping, reputation, and political-workflow approval risk even when the source data is public.

Files:

- `apps/web/app/api/political/candidates/search/route.ts`
- `apps/web/lib/political/candidate-suggestions-public.ts`
- `apps/web/lib/political/__tests__/candidate-suggestions-public.test.ts`

Fix applied: added a public candidate-suggestion helper that clamps query length, state, and result limit before lookup, then strips campaign email and phone fields from the public API response while leaving the internal repository/admin data model unchanged.

Validation: focused public candidate suggestion tests passed and focused ESLint on the route/helper/test files passed locally.

Approval needed: no for data minimization; yes before launching broader political traffic, changing candidate research/contact workflows, or using candidate contact details for outreach.

### Partially Resolved: Public Political Endpoints Lacked Basic Anti-Abuse Controls

What was wrong: public political candidate search, map-plan save, and candidate-agent chat endpoints had input-size/data-minimization/kill-switch controls, but no request-rate guard before service-role lookup, public request-body processing, or AI provider work.

Why it mattered: public endpoints that touch service-role-backed workflows can be abused for scraping, noisy database work, or expensive request processing even when business logic is otherwise guarded.

Files:

- `apps/web/app/api/political/candidates/search/route.ts`
- `apps/web/app/api/political/map-plans/route.ts`
- `apps/web/app/api/political/candidate-agent/chat/route.ts`
- `apps/web/lib/security/public-rate-limit.ts`
- `apps/web/lib/security/__tests__/public-rate-limit.test.ts`

Fix applied: added a small in-process public rate-limit helper keyed by route scope and hashed client IP, then applied it to political candidate search, public map-plan saves, and public candidate-agent chat. Candidate search allows a generous autocomplete budget; map-plan saves use a tighter save-oriented window; political chat is limited before request parsing or AI provider work. Rejected requests return `429` with rate-limit metadata.

Safest remaining fix: promote this first-layer control into a distributed Vercel Firewall, Edge Config/Redis, or provider-backed limiter before broad public launch. The current helper is intentionally lightweight and per-process; it is not a global quota system across serverless instances.

Validation: focused public rate-limit helper tests, focused political candidate chat tests, focused ESLint on the helper plus touched political public routes, full unit suite, full workspace typecheck, full web lint, placeholder-env web build, and `git diff --check` passed locally.

Approval needed: no for defensive route guards; yes before broader WAF/firewall configuration changes or public traffic launch decisions.

### Partially Resolved: Public Lead-Capture Endpoints Lacked Basic Anti-Abuse Controls

What was wrong: public lead-capture routes accepted unauthenticated POST requests, parsed request bodies, and could create records or trigger operator/customer notifications without a route-level request-rate guard.

Why it mattered: lead forms are revenue-positive, but they are also public mutation surfaces. Abuse can create noisy records, trigger internal notifications, consume email/SMS safety budgets, and make operators chase low-quality submissions.

Files:

- `apps/web/app/api/nonprofit/route.ts`
- `apps/web/app/api/waitlist/route.ts`
- `apps/web/app/api/targeted-campaign/route.ts`
- `apps/web/app/api/targeted/leads/route.ts`
- `apps/web/app/api/targeted/intake/route.ts`
- `apps/web/app/api/intake/[token]/route.ts`

Fix applied: applied the shared public rate-limit helper before body parsing on nonprofit applications, waitlist submissions, targeted campaign leads, targeted lead creation, targeted intake, and tokenized shared-postcard intake. Limits are intentionally generous enough for normal conversion paths and tighter where a route can send internal alerts or customer confirmations.

Safest remaining fix: move these first-layer per-process limits into a distributed traffic-control layer before scaling paid traffic. Continue the same review across payment-adjacent checkout creation before broad launch.

Validation: focused public rate-limit helper tests, focused ESLint on the touched lead-capture route files, full unit suite, full workspace typecheck, full web lint, placeholder-env web build, and `git diff --check` passed locally.

Approval needed: no for defensive route guards; yes before Vercel Firewall changes, payment-flow behavior changes, or live-send testing.

### Partially Resolved: Payment-Adjacent Checkout Creation Needed First-Layer Abuse Controls

What was wrong: active checkout creation routes could reach Supabase service-role reads/writes, pending order or campaign updates, and Stripe Checkout session creation without a first-layer request-rate guard. Existing auth/token/payment controls still mattered, but they did not reduce repeated request pressure before expensive or provider-adjacent work.

Why it mattered: checkout endpoints are revenue-critical. Abuse or repeated retries can create noisy pending reservations, consume Stripe/session capacity, write checkout session ids, and increase operational confusion before a customer has paid.

Files:

- `apps/web/app/api/spots/checkout/route.ts`
- `apps/web/app/api/stripe/targeted-checkout/route.ts`
- `apps/web/app/api/intelligence/checkout/route.ts`
- `apps/web/lib/security/__tests__/checkout-rate-limits.test.ts`
- `CHECKOUT_ANTI_ABUSE_AUDIT.md`

Fix applied: applied the shared in-process public rate-limit helper to the active spot subscription checkout, targeted campaign checkout, and property-intelligence checkout routes. The guard runs before body parsing or service-role/Stripe work where applicable, returns `429` with retry metadata when exceeded, and adds `RateLimit-*` metadata to normal validation/error/success responses. Pricing, auth, token verification, inventory checks, billing mode, Stripe metadata, and webhook behavior were not changed.

Safest remaining fix: move checkout rate limiting to a distributed Vercel Firewall/Edge/Redis/provider-backed control before paid traffic scaling, then run Stripe test-mode success-path validation against isolated data.

Validation: focused checkout/security helper tests passed with 18 tests; full `pnpm test` passed with 187 tests across 25 files; full workspace typecheck passed across 5 packages; full web lint passed with 495 existing warnings and 0 errors; placeholder-env web build generated 248 routes; and `git diff --check` passed. Focused checkout-route ESLint had 0 errors and one pre-existing `maxSpots` warning in `/api/spots/checkout`.

Approval needed: no for this defensive first-layer route guard; yes before Stripe provider testing, payment behavior changes, production traffic-control configuration, or live promotion.

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

Fix applied: after signature validation, the route now uses the Supabase service-role client for the narrow append-only `twilio_message_status` insert and keeps the existing no-send mutation boundary. Insert failures and unexpected handler errors now return retryable 503 instead of false-success 200. Twilio status payload parsing, insert-row mapping, signature URL calculation, and retry-decision behavior are isolated in a helper with provider-shaped sample tests.

Validation: focused Twilio helper tests, full test suite, typecheck, web lint, and web build passed locally after the change.

Approval needed: no for the code change; yes before live Twilio validation or any SMS send.

### Resolved: Inbound SMS Reply Webhook Could Acknowledge Uncaptured Replies

What was wrong: `/api/webhooks/outreach/sms` caught revenue messaging bridge failures and still returned empty TwiML for unknown phone numbers that did not match legacy `outreach_contacts`.

Why it mattered: for unmatched/new leads, the revenue messaging ledger may be the only durable capture path. Returning 200 after a bridge failure can make Twilio stop retrying and silently lose an inbound reply.

Files:

- `apps/web/app/api/webhooks/outreach/sms/route.ts`
- `apps/web/lib/outreach/inbound-sms-webhook.ts`
- `apps/web/lib/outreach/__tests__/inbound-sms-webhook.test.ts`

Fix applied: added focused inbound SMS signature validation and retry decision helpers, then changed unmatched replies to return retryable 503 when the bridge throws or reports `processed: true` without an event ID. Known legacy contacts still persist to `outreach_replies` and acknowledge Twilio, so the fix does not create duplicate retry pressure after legacy capture.

Validation: focused inbound SMS helper tests with valid/invalid signature and retry-decision coverage, full test suite, typecheck, web lint, and web build passed locally after the change.

Approval needed: no for the code change; yes before live Twilio validation or any SMS send.

### Resolved: Facebook/APEX Admin Automation POSTs Could Run Without Auth

What was wrong: Facebook alert sending, Facebook daily scoring, and APEX orchestration POST routes could run with service-role access even when a request did not provide a valid cron secret or authenticated operator session.

Why it mattered: these routes can send internal SMS alerts, recompute operator metrics, and trigger multi-agent workflows. Public invocation is an operational and reputation risk even if customer-facing sends remain guarded elsewhere.

Files:

- `apps/web/app/api/admin/sales/facebook/alert/route.ts`
- `apps/web/app/api/admin/sales/facebook/daily-score/route.ts`
- `apps/web/app/api/admin/system/apex/route.ts`
- `apps/web/lib/auth/api-guards.ts`
- `apps/web/lib/auth/request-secret.ts`
- `apps/web/lib/auth/__tests__/request-secret.test.ts`

Fix applied: added a shared `requireAdminSalesAgentOrCron` guard, moved request-secret parsing into a pure helper with tests, required admin/sales-agent-or-cron for Facebook alerts, and required admin-or-cron for Facebook daily scoring and APEX orchestration.

Validation: focused request-secret tests, full test suite, typecheck, web lint, and web build passed locally after the change.

Approval needed: no for access-control hardening; yes before any live automation send/provider validation.

### Resolved: Facebook Follow-Up Cron Could Fail Open When CRON_SECRET Was Missing

What was wrong: `/api/facebook/followup` only rejected unauthorized callers when `CRON_SECRET` existed. If the secret was missing in production, the public cron endpoint could run service-role reads, update Facebook lead/message records, and attempt Facebook follow-up sends.

Why it mattered: missing cron secrets should disable send-capable automation, not open it. This endpoint can create outbound Facebook messages and mutate lead state.

Files:

- `apps/web/app/api/facebook/followup/route.ts`
- `apps/web/lib/auth/api-guards.ts`
- `apps/web/lib/auth/request-secret.ts`

Fix applied: replaced the optional inline secret check with the shared `requireCron()` guard, which returns `503` when `CRON_SECRET` is not configured and `401` when the provided Bearer or `x-cron-secret` value is wrong.

Validation: focused ESLint on the touched route passed, focused request-secret helper tests passed, full `pnpm test` with 174 tests, full workspace typecheck, full web lint with existing warning debt only, placeholder-env web build with 248 routes, and `git diff --check` passed locally. No Facebook send or provider call was executed.

Approval needed: no for fail-closed hardening; yes before live Facebook automation validation or any outbound Facebook messaging.

### Resolved: Meta/Facebook Webhooks Could Process Unsigned Payloads When Secret Was Missing

What was wrong: public Facebook webhook POST routes skipped signature enforcement when `FACEBOOK_APP_SECRET` was missing; one route also used a default verify token fallback.

Why it mattered: missing Meta secrets in production should stop trust at the edge. Otherwise unsigned payloads could reach service-role Facebook lead/message handling or internal alert paths.

Files:

- `apps/web/app/api/webhooks/facebook/route.ts`
- `apps/web/app/api/facebook/webhook/route.ts`
- `apps/web/lib/facebook/webhook-auth.ts`
- `apps/web/lib/facebook/__tests__/webhook-auth.test.ts`

Fix applied: added a shared timing-safe Meta webhook auth helper, required `FACEBOOK_APP_SECRET` in production before accepting POST payloads, rejected invalid/missing signatures before service-role work, and required a configured verify token in production for Meta subscription handshakes.

Validation: focused Facebook webhook auth tests, full test suite, typecheck, web lint, and web build passed locally after the change.

Approval needed: no for fail-closed hardening; yes before live Meta webhook validation or any Facebook send/reply automation.

### Resolved: Admin Service-Role Routes Could Run Without Operator Access

What was wrong: several admin service-role routes could run without an authenticated admin/sales session or cron secret, including agent scans, internal alert sending, founding slot updates, pricing updates, and Facebook mission logging.

Why it mattered: these routes can read privileged operational data, mutate pricing/founding configuration, log activity, or send internal SMS alerts. They are admin surfaces and should not be publicly invokable.

Files:

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

Fix applied: added existing admin/cron/sales-agent guards before service-role work and updated internal alert self-calls to pass the cron secret for trusted automation calls. Follow-up hardening now also protects AI workforce agent status GET routes, the agent runner, scraper, anchor/closer retention-follow-up agents, call-script create/update, and sales lead alert logging. Sales agents can trigger lead alerts only for leads assigned to them; call-script writes are admin-only while call-script reads remain available to admin/sales-agent sessions.

Validation: service-role route scan, focused admin-agent guard scan, focused TypeScript check, focused ESLint on touched routes, full test suite, typecheck, web lint, and web build passed locally after the access-control sweeps.

Approval needed: no for access-control hardening; yes before any live alert-send validation or production automation send.

### Resolved: Sensitive Admin Read And Send Routes Could Run Without Operator Access

What was wrong: a broader set of admin service-role routes exposed lead, reply, funnel, leaderboard, insight, alert, warmup, health, founding-member, and operator-summary data without explicit API guards. Some send-capable routes also allowed public execution if `CRON_SECRET` was missing.

Why it mattered: these routes expose customer/prospect data, revenue state, operator health, internal alert history, and sales performance data. Send-capable routes could trigger SMS/email workflows or mutate lead state without a verified operator, sales-agent, or cron caller.

Files:

- `apps/web/app/api/admin/sales/close-deal/route.ts`
- `apps/web/app/api/admin/sales/nudge/route.ts`
- `apps/web/app/api/admin/sales/power-mode/end-of-day/route.ts`
- `apps/web/app/api/admin/email/warmup/send/route.ts`
- `apps/web/app/api/admin/email/warmup/status/route.ts`
- `apps/web/app/api/admin/alerts/log/route.ts`
- `apps/web/app/api/admin/founding/members/route.ts`
- `apps/web/app/api/admin/intelligence/pricing/route.ts`
- `apps/web/app/api/admin/operator/summary/route.ts`
- `apps/web/app/api/admin/health/route.ts`
- `apps/web/app/api/admin/sales/leads/route.ts`
- `apps/web/app/api/admin/sales/next-lead/route.ts`
- `apps/web/app/api/admin/sales/replies/route.ts`
- `apps/web/app/api/admin/sales/funnel/route.ts`
- `apps/web/app/api/admin/sales/leaderboard/route.ts`
- `apps/web/app/api/admin/sales/insights/route.ts`
- `apps/web/app/api/admin/sales/facebook/scorecard/route.ts`
- `apps/web/app/api/admin/sales/facebook/leaderboard/route.ts`

Fix applied: added `requireAdmin`, `requireAdminOrSalesAgent`, or `requireAdminOrCron` at route entry based on caller intent. `/api/admin/operator/summary` now forwards the authenticated request cookie to protected internal dashboard subfetches.

Additional scope hardening: added a tested shared agent-scope helper so authenticated sales agents cannot use explicit `agent_id` query/body values to read or act as another rep. Applied to sales funnel, leads, next-lead, replies, insights, Facebook scorecard, Facebook mission logging, Facebook alert routing, close-deal sending, at-risk deals, priority actions, call lists, call logs, call stats, follow-up sequence logging, and power-mode checks. Admins retain explicit cross-agent scope where needed; rep-specific call/power routes now require an intentional agent scope for admins.

Additional agent-surface hardening: AI workforce status and runner routes under `apps/web/app/api/admin/agents` now require admin/cron access before service-role reads or automation dispatch. The scraper now uses the shared admin-or-cron guard instead of accepting any authenticated user. Sales call-script writes are admin-only, and sales lead alert logging now requires admin/sales-agent access plus lead ownership for sales agents.

Validation: follow-up service-role scan across `apps/web/app/api/admin` reports no unguarded service-client routes outside custom authorized political sync routes. Full unit suite, typecheck, web lint, and web build passed locally after this second sweep.

Approval needed: no for access-control hardening; yes before live send/provider validation.

### Resolved: Remaining Admin CRM, Automation, Facebook, Migration, And Agent Utility Routes Needed Role Gates

What was wrong: a follow-up scan found additional `/api/admin` routes that either used service-role access or session Supabase access without the shared admin/sales-agent/cron guard layer. These routes exposed or mutated CRM lead detail, notes, tasks, deduplication clusters, quarantine state, automation sequences/enrollments, Facebook revenue-engine opportunities, migrated-client records, alert preferences, and system-agent state.

Why it mattered: these routes sit behind admin paths and can expose lead/customer revenue data, mutate pipeline activity, update migration records, or run system-agent/reporting work. Even when RLS might block some session-client calls, the API boundary should fail closed before privileged business logic begins.

Files:

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

Fix applied: added `requireAdmin`, `requireAdminOrSalesAgent`, or `requireAdminOrCron` at route entry based on the least-privilege caller model. Admin-only gates now protect automation configuration, dedup/quarantine/migration, company revenue records, CRM metric writes, system-agent identity management, and manual leaderboard refreshes. Admin/sales-agent gates now protect lead detail/list, notes/tasks, alert preferences, Facebook audit reads, CRM reporting reads, and Facebook revenue-engine work. Sales agents are scoped to their own Facebook opportunity pipeline while admins can intentionally inspect other agents. System-agent execution routes now require admin or cron access. Political candidate-intelligence sync/webhook routes were inspected and left unchanged because they already require explicit secrets and fail closed when not configured.

Validation: focused ESLint on the touched admin CRM/automation/migration/Facebook/system-agent routes passed with only pre-existing warnings. Full workspace typecheck, full unit suite, web lint, placeholder-env web build, `git diff --check`, and a follow-up scanner over `apps/web/app/api/admin` passed; the scanner found no remaining routes matching the unguarded Supabase/admin access pattern outside known custom guards.

Approval needed: no for access-control hardening; yes before any live send/provider or production-data mutation validation.

### Resolved: Admin Inbox And Targeted Admin Routes Were Not Explicitly Admin-Gated

What was wrong: `/api/conversations` and `/api/conversations/[id]/*` are used by the admin inbox and could read conversation data, mark messages read, persist outbound replies, and optionally send SMS without an admin guard. `/api/targeted/admin/*` routes were admin-named and could update campaign/lead state or send intake/mailed/review communications after only a generic logged-in-user check. `/api/admin/growth/log` trusted route placement/middleware comments but did not enforce an API-level admin guard before growth activity reads/writes.

Why it mattered: conversation replies and targeted campaign lifecycle actions are revenue and reputation sensitive. Public or non-admin execution could expose prospect conversations, mutate campaign state, or trigger outbound communication.

Files:

- `apps/web/app/api/conversations/route.ts`
- `apps/web/app/api/conversations/[id]/read/route.ts`
- `apps/web/app/api/conversations/[id]/reply/route.ts`
- `apps/web/app/api/targeted/admin/update-status/route.ts`
- `apps/web/app/api/targeted/admin/send-intake/route.ts`
- `apps/web/app/api/targeted/admin/mark-mailed/route.ts`
- `apps/web/app/api/admin/growth/log/route.ts`

Fix applied: added `requireAdmin()` before any service-role reads, conversation repository writes, optional Twilio send path, targeted Drizzle updates, growth log reads/writes, or targeted communication sends.

Validation: focused ESLint on the seven touched routes passed with only pre-existing `status as any` warnings in the targeted status route. Full workspace typecheck, full unit suite, full web lint, placeholder-env web build, admin-like route scanner, and `git diff --check` passed locally.

Approval needed: no for access-control hardening; yes before live communication send validation.

### GitHub CLI Not Authenticated

What is wrong: GitHub CLI is installed but not authenticated in this shell.

Why it matters: connector-backed PR creation works, but `gh` cannot inspect or rerun Actions from this shell.

Files: none.

Safest fix: authenticate `gh` when interactive account setup is convenient.

Risk of fix: low.

Approval needed: no production approval; account authentication required.

### Partially Resolved: Non-Admin Service-Role Routes Needed API-Level Role Gates

What was wrong: `/api/agent/*` service-role routes created the Supabase service-role client after checking only for an authenticated user. The agent UI layout blocks non-admin/non-sales-agent users, but direct API calls should not rely on page-level redirects. A later proxy-wrapper review also found `/api/agent/log-action` and `/api/agent/preferences` verified only a generic session before forwarding to downstream admin APIs; the downstream targets were guarded, but non-agent authenticated users could still reach proxy routing and, for log-action, body parsing before rejection.

Why it matters: service-role routes bypass RLS and expose sales lead/reply/dashboard data. Even when queries are scoped by `assigned_agent_id`, authenticated client users should not be allowed to exercise agent service-role endpoints. Proxy wrappers should also fail closed at their own API boundary instead of relying only on the downstream admin route to reject unauthorized sessions.

Files:

- `apps/web/app/api/agent/dashboard/route.ts`
- `apps/web/app/api/agent/leads/route.ts`
- `apps/web/app/api/agent/leads/[leadId]/route.ts`
- `apps/web/app/api/agent/actions/route.ts`
- `apps/web/app/api/agent/replies/route.ts`
- `apps/web/app/api/agent/log-action/route.ts`
- `apps/web/app/api/agent/preferences/route.ts`
- `NON_ADMIN_SERVICE_ROLE_AUDIT.md`
- `AGENT_PROXY_GUARD_AUDIT.md`

Fix applied: added `requireAdminOrSalesAgent()` before service-role access and used `resolveAgentScope()` to preserve admin preview while blocking sales agents from requesting another rep. Lead detail now filters by `assigned_agent_id` for sales-agent sessions before returning a row. Follow-up hardening also moved the authenticated agent proxy wrappers onto `requireAdminOrSalesAgent()` before body parsing or proxy forwarding while preserving downstream admin guards, authenticated-user `agent_id` enforcement, and cookie forwarding.

Safest remaining fix: perform browser-level authenticated QA for the agent dashboard and mobile agent action/preference flows with test users. Public service-role read route rate limiting has been added for spot resolution, spot availability, and political route coverage, but should still move to a distributed edge/provider-backed layer before traffic scaling.

Validation: service-role agent route validation passed earlier with focused agent-route ESLint, focused auth guard tests, focused `@homereach/web` typecheck, full test suite, workspace typecheck, web lint, and placeholder-env build. The proxy-wrapper follow-up passed focused agent proxy guard tests with 4 tests, focused auth guard tests with 4 tests, focused agent proxy/auth ESLint with 0 warnings/errors, focused `@homereach/web` typecheck, full `pnpm test` with 196 tests across 27 files, full workspace typecheck across 5 packages, full web lint with 493 existing warnings and 0 errors, placeholder-env web build with 247 static pages, and `git diff --check`. GitHub Actions `Validate` run #56 passed, Vercel deployment `dpl_7yeeUfDqkGMXsnZEpuLnRzGoCr5L` reached `READY`, and hosted unauthenticated probes confirmed `/api/agent/preferences` and invalid-body `/api/agent/log-action` both return 401 before proxy success paths.

Approval needed: no for API boundary hardening; yes before changing agent assignment/business logic or live send behavior.

### Partially Resolved: Public Service-Role Read Routes Needed First-Layer Rate Limiting

What was wrong: `/api/spots/resolve`, `/api/spots/availability`, and `/api/political/routes/coverage` are public routes that resolve city/category slug, availability state, or political route coverage data through service-role-backed reads without request-volume guards.

Why it matters: the route is read-only, but public unbounded service-role reads can create avoidable database load and catalog-enumeration pressure.

Files:

- `apps/web/app/api/spots/resolve/route.ts`
- `apps/web/app/api/spots/availability/route.ts`
- `apps/web/lib/security/__tests__/public-read-rate-limits.test.ts`
- `PUBLIC_READ_ANTI_ABUSE_AUDIT.md`

Fix applied: added `spots:resolve`, `spots:availability`, and `political:routes-coverage` public rate-limit scopes before service-role client creation, canonical availability work, or political route coverage lookup work. The routes return 429 retry metadata after 120 lookups/checks per IP per minute per scope and add `RateLimit-*` metadata to normal responses. The routes remain read-only funnel/planning helpers.

Safest remaining fix: move public read/mutation/checkout rate limiting to a distributed edge/provider-backed control before paid traffic scaling.

Validation: `/api/spots/resolve` validation is complete through GitHub Actions `Validate` run #50 and hosted Vercel probing. After adding `/api/spots/availability`, focused public-read/shared rate-limit tests passed with 5 tests, focused route/helper/test ESLint passed with 0 warnings/errors, focused `@homereach/web` typecheck passed, full `pnpm test` passed with 190 tests across 26 files, full workspace typecheck passed across 5 packages, full web lint passed with 494 existing warnings and 0 errors, placeholder-env web build generated 247 static pages, GitHub Actions `Validate` run #52 passed, and hosted availability probes returned 400 for missing/invalid parameters with rate-limit metadata. After adding `/api/political/routes/coverage`, focused public-read/shared rate-limit tests passed with 7 tests, focused route/helper/test ESLint passed with 0 warnings/errors, focused `@homereach/web` typecheck passed, full `pnpm test` passed with 192 tests across 26 files, full workspace typecheck passed across 5 packages, full web lint passed with 494 existing warnings and 0 errors, placeholder-env web build generated 247 static pages, `git diff --check` passed locally, GitHub Actions `Validate` run #54 passed, Vercel deployment `dpl_45dw7h9yCUfi9Mb9pokUkPzp25Pq` reached `READY`, and the hosted route coverage probe returned 200 read-only empty coverage plus rate-limit metadata.

Approval needed: no for local anti-abuse guard; yes before changing funnel lookup behavior, availability behavior, or distributed production firewall policy.

### Lint Warning Debt

What is wrong: `apps/web` linting now runs through ESLint CLI, but it reports 494 warnings.

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

### Resolved: Political Candidate Chat Did Not Honor The AI Kill Switch

What was wrong: the public political candidate-agent chat helper checked for `OPENAI_API_KEY` and could call OpenAI even when the existing subsystem kill switch `DISABLE_POLITICAL_AI=true` was set.

Why it mattered: political AI output must be easy to freeze while keeping read-only/manual planning tools online. The route has compliance prompting and static fallback behavior, but the operator kill switch needs to stop model calls deterministically.

Files:

- `apps/web/lib/political/candidate-agent-chat.ts`
- `apps/web/lib/political/env.ts`
- `apps/web/lib/political/__tests__/candidate-agent-chat.test.ts`

Fix applied: `getOpenAIClient()` now returns `null` when `DISABLE_POLITICAL_AI=true`, which forces the existing static fallback reply path and avoids provider calls.

Validation: focused candidate-agent chat kill-switch test passed. Full `pnpm test` passed with 175 tests, full workspace typecheck passed across 5 packages, full web lint passed with 495 existing warnings and 0 errors, placeholder-env web build generated 248 routes, and `git diff --check` passed locally.

Approval needed: no for the kill-switch fix; yes before enabling or validating live political AI responses with provider calls.

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

### Guarded: Legacy Main Stripe Checkout Uses One-Time Payment For Monthly Pricing Path

What was unclear: `/api/stripe/checkout` resolves a monthly bundle price and calls the one-time Checkout session path, while a subscription helper exists but is not wired into that route.

Clarification: repo search found no current caller for `/api/stripe/checkout`. The active homepage/get-started spot checkout posts to `/api/spots/checkout`, which creates Stripe Checkout with `mode: "subscription"` and monthly recurring line items.

Why it matters: the legacy route is still risky if reactivated or linked later because it can collect a one-time payment for a monthly-priced bundle.

Files:

- `apps/web/app/(funnel)/get-started/[citySlug]/[categorySlug]/checkout/checkout-form.tsx`
- `apps/web/app/api/spots/checkout/route.ts`
- `apps/web/app/api/stripe/checkout/route.ts`
- `apps/web/lib/stripe/legacy-checkout.ts`
- `apps/web/lib/stripe/__tests__/legacy-checkout.test.ts`
- `apps/web/lib/env.ts`
- `packages/services/src/stripe/index.ts`
- `.env.example`
- `apps/web/.env.production.template`
- `turbo.json`

Fix applied: left active `/api/spots/checkout` untouched as the subscription path and added a default-disabled `ENABLE_LEGACY_STRIPE_CHECKOUT` guard to `/api/stripe/checkout`. When the flag is absent or not exactly `true`, the route returns `410` before Supabase auth, Drizzle writes, or Stripe API calls.

Validation: focused legacy checkout guard test, full unit suite with 141 tests, typecheck, web lint, and web build with placeholder env passed locally.

Safest remaining fix: keep the flag unset/false in production. If the legacy route is ever needed again, revalidate the business model and Stripe mode in test mode before enabling it.

Risk of fix: low for the default-disabled guard; high if changing payment behavior without Stripe test-mode validation.

Approval needed: yes before live payment behavior changes or enabling the legacy flag; no for the default-disabled guard on the PR branch.

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
