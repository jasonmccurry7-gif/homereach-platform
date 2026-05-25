# Daily Executive Report

Date: 2026-05-25

## Completed Work

- Confirmed the current stabilization PR branch is clean except for two intentionally untracked local reference patch files.
- Confirmed GitHub CLI is still not authenticated in this shell; the GitHub connector remains usable.
- Created `PROVIDER_FLOW_AUDIT.md` covering Stripe, Supabase, Twilio, email providers, webhooks, and deployment validation posture.
- Promoted provider risks into `PRIORITIZED_FIX_PLAN.md`.
- Hardened `apps/web/lib/supabase/service.ts` so missing service env fails clearly before creating a Supabase service-role client.
- Repaired Stripe webhook idempotency so fresh in-flight `received` duplicates return retryable 409 instead of false-success 200.
- Added focused Stripe idempotency unit tests.
- Hardened targeted route checkout so public payment links no longer trust a bare campaign UUID.
- Added signed targeted checkout tokens, a legacy customer-email confirmation fallback, add-on allowlisting, and the production env requirement/template entries for `TARGETED_CHECKOUT_SIGNING_SECRET`.
- Hardened Twilio status webhook persistence by switching the post-signature append-only insert to the Supabase service-role client and returning retryable 503 on telemetry insert or handler failure.
- Hardened Postmark webhook handling so email event insert failures return retryable 503 and delivery events cannot clear suppression states.
- Added provider telemetry freshness warnings to the admin outreach health endpoint.
- Added the targeted checkout signing secret placeholder to GitHub Actions build env so CI validates the production env gate intentionally.
- Confirmed `TARGETED_CHECKOUT_SIGNING_SECRET` is now configured in Vercel production and in the branch preview environment for `codex/current-main-audit-20260524`; values were not printed.
- Added synthetic Stripe webhook signature verification tests using Stripe SDK test headers; no Stripe API calls, charges, or provider events were created.
- Added provider-shaped Twilio status and Postmark webhook sample-payload tests without live sends, live provider calls, charges, or production data mutation.
- Installed Stripe CLI through Scoop and verified `stripe version 1.41.2`; CLI auth is not configured yet and no Stripe account commands were run.
- Created `PROVIDER_TEST_MODE_RUNBOOK.md` with the safe provider-tool validation sequence and stop conditions.
- Pushed provider audit documentation to the draft PR.
- Created `ENVIRONMENT_VARIABLES_AUDIT.md` from local templates, code references, and Vercel name-only metadata without exposing secret values.
- Confirmed Vercel production/preview/development contain all static startup-required env names from `apps/web/lib/env.ts`.
- Added safe env-alias compatibility readers for internal agent base URLs, Apex approved senders, SerpAPI/Hunter provider names, and Twilio messaging-service naming.
- Clarified targeted checkout billing copy so first-month add-on charges no longer imply Stripe starts automatic monthly billing.
- Confirmed the active get-started spot checkout uses `/api/spots/checkout` with Stripe `subscription` mode; the older `/api/stripe/checkout` route has no current callers found in repo search.
- Standardized public URL resolution for payment-adjacent checkout redirects and Stripe post-payment links so deployed aliases do not fall back to stale/hardcoded domains.
- Hardened inbound SMS reply handling so unmatched replies return retryable TwiML when the revenue messaging bridge fails or misses the event ledger, while known legacy contacts still write to `outreach_replies` without duplicate retry pressure; moved inbound SMS signature validation into the tested helper layer.
- Removed remaining runtime `localhost` fallbacks from admin/agent self-calls; local-only `curl` examples remain documented separately.
- Moved APEX command agent routing off the hardcoded production domain and onto the internal app URL resolver.
- Expanded shared URL resolver coverage across SEO metadata, sitemap/robots, auth reset redirects, admin self-calls, intake/nonprofit notifications, political proposal handoffs, internal alert deep links, and generated outreach/Facebook links.
- Added Vercel deployment URL fallbacks (`VERCEL_BRANCH_URL`, `VERCEL_PROJECT_PRODUCTION_URL`, `VERCEL_URL`) to the shared app URL resolver so preview/prod links do not degrade to localhost or a stale production fallback when canonical app URL aliases drift.
- Added a package-local Stripe app URL resolver with tests so future shared subscription Checkout sessions use canonical aliases and Vercel deployment fallbacks instead of reading only `NEXT_PUBLIC_APP_URL`.
- Guarded the inactive legacy `/api/stripe/checkout` route behind `ENABLE_LEGACY_STRIPE_CHECKOUT`; it now returns `410` before auth, database writes, or Stripe session creation unless deliberately re-enabled.
- Hardened Facebook/APEX admin automation POST access so service-role alert sending, daily Facebook scoring, and the APEX orchestration sweep require a valid cron secret or an authenticated admin/sales session, depending on route.
- Hardened Meta/Facebook webhook verification and POST signature handling so production webhooks fail closed when verify tokens or app secrets are missing, and unsigned payloads cannot reach service-role Facebook work.
- Hardened the remaining high-risk admin service-role route cluster: AI agent scans, internal alert sending, founding slot updates, pricing updates, and Facebook mission logging now require admin/sales session or cron access before privileged work.
- Expanded the admin service-role access sweep to sensitive admin reads and send-capable routes: sales lead/reply/funnel/leaderboard/insight APIs, close-deal sending, sales nudges, email warmup, internal alert logs, founding member data, intelligence pricing, operator summary, Facebook scorecards/leaderboards, and admin health now require admin/sales-agent or cron access as appropriate.
- Hardened public property-intelligence checkout so founding memberships and slot counts are no longer activated before Stripe confirms payment; signed Stripe webhook handling now finalizes founding membership activation after `checkout.session.completed`.
- Fixed a preview-discovered property-intelligence checkout validation edge case so malformed JSON returns `400 Invalid checkout payload` before Supabase or Stripe work can begin.
- Hardened explicit sales `agent_id` scoping so sales-agent sessions cannot query or act as another rep on funnel, lead queue, next-lead, replies, insights, Facebook scorecard, Facebook mission, Facebook alert, or close-deal routes.
- Completed the second sales dashboard ownership pass for at-risk deals, priority actions, call lists, call logs, call stats, follow-up sequence logging, and power-mode checks; sales-agent sessions now resolve to their own agent id, and admin sessions must intentionally scope rep-specific call/power routes.
- Hardened AI workforce/admin agent surfaces so agent runner, agent status endpoints, scraper, anchor, closer, echo, scout, atlas, beacon, horizon, sentinel, sales call-script writes, and sales lead alert logging require admin, sales-agent, or cron access before service-role reads or mutations.
- Hardened the remaining scanned admin CRM, automation, Facebook, migration, alert-preference, and system-agent surfaces so lead lists/details, CRM notes/tasks/dedup/quarantine/metrics/leaderboards, automation sequence/enrollment controls, Facebook revenue engine updates, migration helpers, alert preferences, and system-agent endpoints require admin, sales-agent, or cron access before privileged reads or mutations. Political candidate-intelligence sync/webhook routes were inspected and left unchanged because they already fail closed behind explicit secrets.
- Hardened admin-adjacent routes outside `/api/admin`: admin inbox conversation reads/read-marking/replies now require admin access before service-role reads, reply persistence, or optional SMS sending; targeted campaign admin status, intake-link send, mark-mailed/review-request actions, and growth activity logs now require admin access before Drizzle updates or communication sends.
- Hardened the SMS APEX command endpoint so `/api/command` POSTs must carry a valid Twilio signature before any approved-sender check or internal admin/agent cron self-call can run.
- Redacted `/api/command` liveness output so it no longer returns approved sender phone numbers or the configured APEX phone number to public callers.
- Hardened `/api/facebook/followup` so the cron/send-capable Facebook follow-up job fails closed through `requireCron()` when `CRON_SECRET` is missing or invalid.
- Hardened the public political candidate chat helper so `DISABLE_POLITICAL_AI=true` now forces static fallback replies instead of allowing OpenAI calls.
- Hardened public nonprofit and intake notification emails so user-submitted form values are HTML-escaped before rendering into admin/applicant email bodies and control characters are stripped from dynamic subject fragments.
- Hardened public political map-plan persistence so empty public selections stay local-only instead of creating service-role-backed map sessions/plans, and oversized map-plan payloads are rejected before persistence work begins.
- Hardened public political candidate search so service-role-backed autocomplete responses no longer expose direct campaign email/phone fields and public query/state/limit inputs are clamped before lookup.
- Added a reusable in-process public rate-limit helper and applied it to political candidate search and public map-plan saves before service-role lookup or request-body processing.
- Expanded the public rate-limit guard to lead-capture form routes: nonprofit applications, waitlist, targeted campaign leads, targeted lead creation, targeted intake, and tokenized shared-postcard intake.
- Added the public political candidate-agent chat route to the rate-limit layer before request-body parsing or AI provider work can begin.
- Audited active checkout creation routes and added first-layer checkout rate limits to `/api/spots/checkout`, `/api/stripe/targeted-checkout`, and `/api/intelligence/checkout` before body parsing, service-role work, pending-order work, or Stripe session creation where applicable.
- Created `CHECKOUT_ANTI_ABUSE_AUDIT.md` to document the protected-flow audit, controls added, validation status, and remaining payment-flow risks.
- Audited non-admin service-role usage and hardened `/api/agent/*` service-role routes so only admin or sales-agent sessions can access agent dashboard, lead queue, lead detail, action queue, and replies APIs.
- Created `NON_ADMIN_SERVICE_ROLE_AUDIT.md` to document non-admin service-role buckets, patched agent routes, retained provider/checkout exceptions, and remaining public read-route risk.
- Added first-layer public read rate limiting to `/api/spots/resolve`, `/api/spots/availability`, and `/api/political/routes/coverage` before service-role-backed catalog, availability, and route coverage lookups and updated `PUBLIC_READ_ANTI_ABUSE_AUDIT.md`.
- Hardened authenticated agent proxy wrappers so `/api/agent/log-action` and `/api/agent/preferences` require admin or sales-agent roles before proxying to downstream admin APIs; created `AGENT_PROXY_GUARD_AUDIT.md`.
- Completed a read-only Supabase metadata audit for property-intelligence founding tables. Live `property_intelligence_tiers`, `founding_slots`, and `founding_memberships` exist, but they are not represented in committed migrations, and live `founding_memberships` is missing the `stripe_checkout_session_id` column used by the Stripe webhook finalizer. Created `PROPERTY_INTELLIGENCE_SCHEMA_AUDIT.md`.

## Validation

- Local focused Stripe idempotency test: passed, 7 tests.
- Local focused Stripe webhook signature test: passed, 3 tests.
- Local focused targeted checkout token test: passed, 7 tests.
- Local focused targeted checkout/app URL regression run: passed, 10 tests.
- Local focused payment URL resolver regression run: passed, 6 tests.
- Local focused Postmark webhook helper test: passed, 7 tests.
- Local focused Twilio status webhook helper test: passed, 6 tests.
- Local focused inbound SMS webhook signature/retry decision test: passed, 9 tests.
- Local focused provider telemetry health test: passed, 5 tests.
- Local focused app URL helper test: passed, 5 tests.
- Local focused Stripe app URL resolver test: passed, 4 tests.
- Local focused legacy Stripe checkout guard test: passed, 2 tests.
- Local focused request secret helper test: passed, 4 tests.
- Local focused agent scope helper test: passed, 4 tests.
- Local focused sales dashboard scope lint: passed with only pre-existing warnings in the touched route files.
- Local focused admin agent/access route TypeScript check: passed.
- Local focused admin agent/access route ESLint: passed with only pre-existing warnings in touched route files.
- Local focused CRM/automation/migration/Facebook/admin guard ESLint: passed with only pre-existing warnings in touched route files.
- Local focused admin-adjacent route ESLint: passed with only pre-existing `status as any` warnings in `apps/web/app/api/targeted/admin/update-status/route.ts`.
- Latest admin-adjacent guard patch: full workspace typecheck, full unit suite, full web lint, placeholder-env web build, admin-like route scanner, and `git diff --check` passed locally.
- Latest APEX command/Facebook cron hardening sweep: focused inbound SMS signature helper tests, request-secret helper tests, agent-scope helper tests, focused ESLint on `/api/command` and `/api/facebook/followup`, full `pnpm test` with 174 tests, full workspace typecheck, full web lint with 495 existing warnings and 0 errors, placeholder-env web build with 248 routes, and `git diff --check` passed locally.
- Latest political candidate chat kill-switch sweep: focused political tests passed, full `pnpm test` passed with 175 tests, full workspace typecheck passed across 5 packages, full web lint passed with 495 existing warnings and 0 errors, placeholder-env web build generated 248 routes, and `git diff --check` passed locally.
- Latest public-form email rendering hardening sweep: focused HTML escaping and email subject tests passed, focused ESLint on the helpers and touched public form routes passed, full `pnpm test` passed with 179 tests, full workspace typecheck passed across 5 packages, full web lint passed with 495 existing warnings and 0 errors, placeholder-env web build generated 248 routes, and `git diff --check` passed locally.
- Latest public political map-plan persistence sweep: focused map-plan persistence tests passed, focused ESLint on the route/helper/test files passed, full `pnpm test` passed with 181 tests, full workspace typecheck passed across 5 packages, full web lint passed with 495 existing warnings and 0 errors, and placeholder-env web build generated 248 routes locally.
- Latest public political candidate-search minimization sweep: focused public candidate suggestion tests passed and focused ESLint on the route/helper/test files passed locally.
- Latest public endpoint rate-limit sweep: focused public rate-limit helper tests, focused ESLint on the helper plus touched political public routes, full `pnpm test` with 185 tests, full workspace typecheck across 5 packages, full web lint with 495 existing warnings and 0 errors, placeholder-env web build with 248 routes, and `git diff --check` passed locally.
- Latest lead-capture rate-limit sweep: focused public rate-limit helper tests, focused ESLint on touched public lead-capture routes, full `pnpm test` with 185 tests, full workspace typecheck across 5 packages, full web lint with 495 existing warnings and 0 errors, placeholder-env web build with 248 routes, and `git diff --check` passed locally.
- Latest political chat rate-limit sweep: focused political candidate chat test, focused ESLint on the chat route/helper/test, full `pnpm test` with 185 tests, full workspace typecheck across 5 packages, full web lint with 495 existing warnings and 0 errors, placeholder-env web build with 248 routes, and `git diff --check` passed locally.
- Latest checkout anti-abuse sweep: focused checkout/security helper tests passed with 18 tests; full `pnpm test` passed with 187 tests across 25 files; full workspace typecheck passed across 5 packages; full web lint passed with 495 existing warnings and 0 errors; placeholder-env web build generated 248 routes; and `git diff --check` passed. Focused checkout-route ESLint had 0 errors and one pre-existing `maxSpots` warning in `/api/spots/checkout`.
- Latest non-admin service-role sweep: focused agent-route ESLint passed with 0 warnings/errors, focused auth guard tests passed with 4 tests, focused `@homereach/web` typecheck passed, full `pnpm test` passed with 187 tests across 25 files, full workspace typecheck passed across 5 packages, full web lint passed with 494 existing warnings and 0 errors, and placeholder-env web build generated 248 routes.
- Latest public-read anti-abuse sweep: `/api/spots/resolve`, `/api/spots/availability`, and `/api/political/routes/coverage` now have first-layer limiters. Focused public-read/shared rate-limit tests passed with 7 tests, focused route/helper/test ESLint passed with 0 warnings/errors, focused `@homereach/web` typecheck passed, full `pnpm test` passed with 192 tests across 26 files, full workspace typecheck passed across 5 packages, full web lint passed with 494 existing warnings and 0 errors, placeholder-env web build generated 247 static pages, and `git diff --check` passed. GitHub Actions `Validate` run #54 passed, Vercel deployment `dpl_45dw7h9yCUfi9Mb9pokUkPzp25Pq` reached `READY`, and a hosted route coverage probe returned 200 with empty read-only coverage plus rate-limit metadata.
- Latest agent proxy guard sweep: focused agent proxy guard tests passed with 4 tests, focused auth guard tests passed with 4 tests, focused agent proxy/auth ESLint passed with 0 warnings/errors, focused `@homereach/web` typecheck passed, full `pnpm test` passed with 196 tests across 27 files, full workspace typecheck passed across 5 packages, full web lint passed with 493 existing warnings and 0 errors, placeholder-env web build generated 247 static pages, and `git diff --check` passed. GitHub Actions `Validate` run #56 passed, Vercel deployment `dpl_7yeeUfDqkGMXsnZEpuLnRzGoCr5L` reached `READY`, and hosted unauthenticated probes confirmed `/api/agent/preferences` and invalid-body `/api/agent/log-action` both return 401.
- Property-intelligence schema audit: used Supabase read-only catalog metadata only; no data rows, DDL, provider calls, webhook replays, sends, or charges were performed.
- Local focused Facebook webhook auth helper test: passed, 6 tests.
- Local focused property-intelligence checkout helper test: passed, 7 tests.
- Local workspace typecheck after property-intelligence checkout hardening: passed, 5 packages.
- Latest provider/admin durability sweep: focused inbound SMS helper test, focused request secret helper test, focused Facebook webhook auth helper test, admin service-role access sweep, full unit suite, typecheck, web lint, and web build all passed locally; a second admin service-role scan now finds no unguarded `apps/web/app/api/admin` service-client routes outside custom authorized routes.
- Local `pnpm test`: passed, 172 tests.
- Local `pnpm exec turbo type-check --ui=stream`: passed, 5 packages.
- Local `pnpm --filter @homereach/web lint`: passed with existing warning debt, 495 warnings and 0 errors.
- Local `pnpm --filter @homereach/web build`: passed with non-secret test-shaped env after confirming the env validator rejects unsafe placeholders.
- Latest CRM/automation/migration/Facebook/admin guard sweep: `pnpm exec turbo type-check --ui=stream`, `pnpm test`, `pnpm --filter @homereach/web lint`, placeholder-env `pnpm --filter @homereach/web build`, `git diff --check`, and the admin route guard scanner all passed locally.
- Local browser smoke on targeted checkout: passed. No-token checkout links show email confirmation and disable Pay; token-bearing links skip the email prompt and enable Pay.
- Remote GitHub Actions `Validate` run #10 for commit `7ab5d0c`: passed.
- Remote Vercel deployment for commit `7ab5d0c`: failed before the Vercel project env repair because `TARGETED_CHECKOUT_SIGNING_SECRET` was missing at build time. A fresh deployment is needed after the env repair.
- Remote GitHub Actions `Validate` run #11 for commit `2d525aa`: passed.
- Remote Vercel deployment for commit `2d525aa`: passed after the Vercel project env repair.
- Remote GitHub Actions `Validate` run #12 for commit `e3adc7a`: passed.
- Remote Vercel deployment for commit `e3adc7a`: passed after the provider sample-payload test layer.
- Remote GitHub Actions `Validate` run #21 for commit `0f6ff91`: passed after the generated-link URL resolver sweep.
- Remote Vercel deployment for commit `0f6ff91`: passed after the generated-link URL resolver sweep.
- Remote GitHub Actions `Validate` run #22 for commit `ffae794`: passed after adding Vercel deployment URL fallbacks.
- Remote Vercel deployment for commit `ffae794`: passed at `https://homereach-platform-d5rm7sfy3-jason-mccurrys-projects.vercel.app`.
- Stripe CLI: installed but unauthenticated; provider-tool validation still needs test/sandbox auth and isolated DB setup.

## Revenue And Reliability Risks

- Medium: targeted checkout now avoids misleading recurring-billing copy, but a true targeted add-on subscription path still needs business approval and Stripe test-mode validation if wanted.
- Medium: legacy `/api/stripe/checkout` still contains the old one-time checkout implementation, but it is now default-disabled by `ENABLE_LEGACY_STRIPE_CHECKOUT`; active spot checkout uses `/api/spots/checkout` subscription mode.
- Medium: `NEXTAUTH_URL` is referenced by agent orchestration routes but is not listed in production Vercel; runtime self-calls and generated public links now use shared resolvers with Vercel deployment URL fallbacks, but Vercel should still get the canonical name.
- Medium: provider aliases drift in Vercel/code for `SERP_API` vs `SERPAPI_KEY`, `HUNTER` vs `HUNTER_API_KEY`, and `APEX_APPROVED_SENDER` vs `APEX_APPROVED_SENDERS`; compatibility readers are now in place, but canonical Vercel names still need cleanup.
- High conditional: `RESEND_API_KEY` is not listed in Vercel; safe only if the hidden `EMAIL_PROVIDER` value is not `resend`.
- Medium: send-capable AI workforce routes are now access-gated, but live-sending behavior still needs explicit approval/test-mode validation before automation expansion.
- Medium: public nonprofit, waitlist, targeted lead/campaign, targeted intake, shared intake, political map-plan, political candidate-search, and political chat routes now have basic in-process rate limits, but traffic scaling still needs a distributed Vercel Firewall/Edge/Redis-grade strategy before broader public launch.
- Medium: payment-adjacent checkout creation surfaces now have basic in-process rate limits, but traffic scaling still needs a distributed Vercel Firewall/Edge/Redis-grade control and Stripe test-mode success-path validation; no live sends or charges were tested in this pass.
- Medium: `/api/agent/*` service-role routes and authenticated agent proxy wrappers now enforce admin/sales-agent role gates at the API boundary, and `/api/spots/resolve`, `/api/spots/availability`, plus `/api/political/routes/coverage` now have first-layer in-process read limiters; public-read and quote/planning routes still need continued distributed anti-abuse planning before traffic scaling.
- Medium: authenticated team-wide sales/CRM reports remain visible to admin/sales-agent sessions where product behavior appeared intentional; a later product review should decide whether to narrow those dashboards further.
- Tooling: Stripe CLI is installed, but Stripe provider-tool validation is still blocked on test/sandbox authentication and isolated env setup.
- Deployment gate: Vercel production and the branch preview now have `TARGETED_CHECKOUT_SIGNING_SECRET`; recent branch-preview builds have passed after the URL resolver hardening.

## Production Readiness Status

Current status: stabilization branch is local-build, GitHub-Actions, and Vercel-preview ready, but provider-live promotion is not ready.

Reason: payment webhook retry behavior, targeted checkout authorization, property-intelligence checkout finalization, legacy checkout fail-closed behavior, checkout creation rate limiting, non-admin agent API role gates, Twilio status persistence, inbound SMS reply capture, APEX SMS command signature validation, Facebook cron fail-closed behavior, Postmark callback durability, provider telemetry freshness, Meta webhook fail-closed behavior, public political map-plan persistence guards, public political candidate-search data minimization, public political/lead-capture endpoint rate limiting, and high-risk admin/service-role access gates now have tested branch fixes. Stripe has synthetic signature coverage, and Twilio/Postmark/Facebook have local provider-shaped or signature-helper coverage, but Stripe/Twilio/email/Facebook test-mode validation against isolated provider tooling still needs completion.

## Recommended Next Actions

1. Use `PROVIDER_TEST_MODE_RUNBOOK.md` to run Stripe/Twilio/Postmark validation against test/sandbox tooling and an isolated database.
2. Decide whether targeted checkout monthly add-ons should remain onboarding-activated services or become true Stripe subscriptions.
3. Validate Stripe webhook behavior with Stripe CLI/test-mode against isolated data.
4. Validate Twilio status, inbound SMS, Postmark, and Facebook webhook endpoints with local tunnel or provider test tools, still with no mass sends and no production data mutation.
5. Review monthly-billing intent before changing any Stripe mode or subscription behavior.
6. Resolve env-name drift by adding/verifying canonical Vercel names first, then adding compatibility readers only after a focused route audit.
7. Continue the anti-abuse pass across remaining public read/mutation and quote/planning routes before traffic scaling; then promote current in-process controls to a distributed edge/provider-backed strategy.
