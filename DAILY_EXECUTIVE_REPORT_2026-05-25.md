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
- Medium: authenticated team-wide sales/CRM reports remain visible to admin/sales-agent sessions where product behavior appeared intentional; a later product review should decide whether to narrow those dashboards further.
- Tooling: Stripe CLI is installed, but Stripe provider-tool validation is still blocked on test/sandbox authentication and isolated env setup.
- Deployment gate: Vercel production and the branch preview now have `TARGETED_CHECKOUT_SIGNING_SECRET`; recent branch-preview builds have passed after the URL resolver hardening.

## Production Readiness Status

Current status: stabilization branch is local-build, GitHub-Actions, and Vercel-preview ready, but provider-live promotion is not ready.

Reason: payment webhook retry behavior, targeted checkout authorization, property-intelligence checkout finalization, legacy checkout fail-closed behavior, Twilio status persistence, inbound SMS reply capture, Postmark callback durability, provider telemetry freshness, Meta webhook fail-closed behavior, and high-risk admin/service-role access gates now have tested branch fixes. Stripe has synthetic signature coverage, and Twilio/Postmark/Facebook have local provider-shaped or signature-helper coverage, but Stripe/Twilio/email/Facebook test-mode validation against isolated provider tooling still needs completion.

## Recommended Next Actions

1. Use `PROVIDER_TEST_MODE_RUNBOOK.md` to run Stripe/Twilio/Postmark validation against test/sandbox tooling and an isolated database.
2. Decide whether targeted checkout monthly add-ons should remain onboarding-activated services or become true Stripe subscriptions.
3. Validate Stripe webhook behavior with Stripe CLI/test-mode against isolated data.
4. Validate Twilio status, inbound SMS, Postmark, and Facebook webhook endpoints with local tunnel or provider test tools, still with no mass sends and no production data mutation.
5. Review monthly-billing intent before changing any Stripe mode or subscription behavior.
6. Resolve env-name drift by adding/verifying canonical Vercel names first, then adding compatibility readers only after a focused route audit.
