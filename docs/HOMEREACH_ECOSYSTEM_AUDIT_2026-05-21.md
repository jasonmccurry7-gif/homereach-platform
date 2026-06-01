# HomeReach Ecosystem Audit

Date: 2026-05-21
Scope: audit-first review of the public website, admin dashboard, shared postcard funnel, targeted campaign system, political platform, operations/procurement, government contracts, payments, auth, database, messaging, AI/automation, SEO, deployment, and route behavior.

## Executive Summary

Production readiness score: 62 / 100.

HomeReach is a large, active Next.js/Supabase/Stripe platform with many real modules implemented. The monorepo type-checks and builds, sampled public/admin pages load, protected admin/client routes redirect correctly when unauthenticated, and recent Control Tower, Government Contracts, Email Infrastructure, Political Outreach, SEO, and Operations Copilot modules are present.

The platform is not yet production-ready for scale. The biggest blockers are security posture in Supabase, a currently broken shared-postcard purchase route on the local runtime, incomplete test harness coverage, placeholder/staged systems inside revenue-critical flows, and several advanced public political screens that expose complexity the user explicitly wants hidden from public/customer experiences.

## Audit Method

Verified:
- Repository, package, route, API, middleware, env, Vercel, and cron structure.
- `pnpm turbo type-check`: passed.
- `pnpm turbo build`: passed during audit.
- `pnpm turbo lint`: passed with warnings only.
- Browser smoke pass on localhost port 3005 for representative public, dashboard, admin, political, procurement, SEO, and operations routes.
- Unauthenticated access checks for `/admin`, `/dashboard`, `/operations-copilot`, `/api/admin/health`, and `/api/operations-copilot/supplier-prices`.
- Supabase schema, RLS/policy posture, advisor findings, and key table counts.
- Static inspection of Stripe webhook/checkout, Postmark webhook, email verification panel, middleware, route protection, and known placeholder systems.

Not executed:
- Live Stripe checkout session creation or card payment.
- Live email verification sends.
- Live SMS/Twilio sends.
- Mutating lead/intake/order forms where they would create real records.
- Government bid submission/export actions.
- Autonomous outreach, AI sends, or campaign-scale actions.

Reason: those actions can create external side effects or real operational records. They should be verified in a sandbox/test-mode run after the blockers below are addressed.

## Ecosystem Map

| Area | Current organization | Health |
| --- | --- | --- |
| Public website | `apps/web/app/(site)`, root `app/page.tsx`, service pages, Ohio SEO routes | Mostly working in sampled pages |
| Shared postcard funnel | `/get-started`, `/get-started/[citySlug]`, `/get-started/[citySlug]/[categorySlug]`, `/checkout`, `/api/spots/*` | Broken on current local runtime for city/category routes |
| Targeted campaigns | `/targeted`, `/targeted/start`, `/targeted/intake`, `/targeted/checkout`, `/api/targeted/*` | Partially working, some static/staged route logic |
| Political public platform | `/political/*`, `/political-mail`, `/campaign-mail` | Loads, but public surface exposes command-center complexity |
| Political admin | `/admin/political/*`, `/admin/political/outreach-strategy` | Loads in browser sample |
| Client dashboard | `/dashboard`, `/campaign`, `/replies`, `/billing`, `/settings` | Protected, but replies are placeholder-only |
| Admin dashboard | `/admin`, `/admin/procurement`, `/admin/gov-contracts`, `/admin/control-center`, `/admin/email-infrastructure`, etc. | Loads in browser sample |
| Operations Copilot | `/operations-copilot/*`, `/api/operations-copilot/*`, `opcopilot_*` tables | Protected and mostly implemented; new savings OS tables have policies |
| Government contracts | `/admin/gov-contracts`, bid room components, `gov_contract_*` tables | Substantial implementation; SAM sync still env-gated/sample fallback paths exist |
| Payments | Stripe checkout routes and `/api/webhooks/stripe` | Signature verification exists; full E2E not safely executed |
| Messaging | Postmark, Twilio webhook placeholders, revenue messaging libs, email infrastructure admin panel | Email-first foundation exists; Twilio/live scaling not ready |
| AI/automation | Admin agents, sales agents, political agents, SEO/content intelligence, crons | Broadly present; must keep approval gates and logs hardened |
| Database | Supabase public schema with many feature tables | Functional but security/performance advisories are significant |
| Deployment | Vercel config, crons, Next 15 app | Build passes; local runtime artifact collision currently breaks purchase funnel route |

## Confirmed Working

- Monorepo type-check passed across web, mobile, db, services, and types packages.
- Monorepo build passed with `pnpm turbo build`.
- Lint completed with 0 errors, 482 warnings.
- Public sampled pages returned 200: `/`, `/shared-postcards`, `/targeted`, `/targeted/start`, `/political`, `/political-mail`, `/ohio/columbus/roofing-marketing`, `/inventory-purchasing`.
- Auth protection works for no-cookie requests: `/admin`, `/dashboard`, and `/operations-copilot` redirect to login; `/api/admin/health` and `/api/operations-copilot/supplier-prices` return 401.
- Admin sampled pages loaded while signed in: `/admin`, `/admin/procurement`, `/admin/gov-contracts`, `/admin/political/outreach-strategy`, `/admin/email-infrastructure`.
- Stripe webhook route verifies the Stripe signature before processing.
- Postmark webhook route validates Basic Auth in production and logs events to `email_events`.
- Email infrastructure admin send-test route requires admin and logs platform audit events.
- Supabase key operational tables exist and contain data: `sales_leads` 4122 rows, `political_campaigns` 246, `gov_contract_opportunities` 112, `businesses` 25, `orders` 9.
- Local secret env files are not tracked by Git. A scan did not find committed OpenAI/Stripe/Postmark/Supabase service secrets beyond placeholder strings.

## Partially Working / Staged

- Client reply tracking exists as UI only: `apps/web/app/(dashboard)/replies/page.tsx:29-36`.
- Shared postcard reservation repository returns stub records because no reservations table exists: `apps/web/lib/engine/db/supabase/reservation-repository.ts:4-16`.
- Targeted route pricing/filtering is static and not fully DB-backed: `apps/web/lib/engine/targeted-routes.ts:15` and `apps/web/lib/engine/targeted-routes.ts:182`.
- SAM.gov sync is guarded by `SAM_GOV_API_KEY`; sample/manual fallback remains: `apps/web/lib/gov-contracts/sample-data.ts`, `apps/web/app/api/admin/gov-contracts/sync/route.ts`.
- Political route/map data still labels demo/sample/estimated data in places.
- Email/Postmark observability exists, but live sender verification emails were not sent during this audit.
- Twilio is structurally present but not safe to treat as operational until account, sender, webhook, suppression, and throttling are verified.
- Pricing tests exist in `packages/services/src/pricing/__tests__/pricing.test.ts`, but Vitest is not installed/configured.

## Broken / Critical Findings

### P0 - Shared Postcard Purchase Funnel 500s On Current Runtime

- Severity: P0
- Business impact: blocks the primary revenue funnel for selecting a city/category and reaching checkout.
- Affected routes: `/get-started/columbus`, `/get-started/columbus/roofing`, `/get-started/columbus/roofing/checkout`.
- Affected files: runtime artifact under `apps/web/.next/server/webpack-runtime.js`; source pages under `apps/web/app/(funnel)/get-started/[citySlug]`.
- Reproduction: `curl http://localhost:3005/get-started/columbus` returns 500.
- Observed error: missing `.next/server/vendor-chunks/drizzle-orm...js` and earlier missing `next@15.5.14...js`.
- Root cause: current local `.next` artifact appears corrupted by multiple simultaneous Next dev/start processes and build output collisions. This may not be source-code logic, but it blocks current local verification.
- Recommended fix: stop duplicate dev servers, remove only generated `.next`, run one clean `pnpm --dir apps/web build`, then `pnpm --dir apps/web exec next start -p <clean-port>` and re-test the funnel.
- Risk of fixing: low if limited to generated build artifacts; do not change source until clean artifact test confirms a source defect.
- Implementation order: first.

### P0 - Supabase Sensitive Tables Have Weak RLS Posture

- Severity: P0
- Business impact: potential data exposure or broken client access paths as platform scales.
- Affected tables with RLS enabled but no policy: `conversations`, `discount_rules`, `growth_activity_logs`, `intake_submissions`, `pricing_profiles`, `public_nonprofit_applications`, `qa_integrity_unresolved_legacy`, `stripe_webhook_events`.
- Sensitive tables with RLS disabled: `campaigns`, `email_warmup_log`, `email_warmup_state`, `leads`, `nonprofit_applications`, `order_items`, `outreach_contacts`, `outreach_messages`, `spot_assignments`, `targeted_route_campaigns`, `waitlist_entries`.
- Reproduction: Supabase SQL audit and security advisor.
- Root cause: feature migrations have accumulated without a unified RLS policy standard.
- Recommended fix: define table-by-table intended access, enable RLS on sensitive tables, add owner/admin/service policies, and test anon/auth/service access.
- Risk of fixing: medium; too-tight policies can break funnels/webhooks. Use migrations with rollback and endpoint tests.
- Implementation order: second.

### P0 - SECURITY DEFINER Functions Executable By Anonymous/Signed-In Roles

- Severity: P0
- Business impact: privileged database functions can be invoked through Supabase RPC if grants remain open.
- Affected examples: `advance_email_ramp`, `auto_assign_lead_to_agent`, `check_and_increment_send_count`, `enroll_lead_in_sequence`, `increment_lead_messages`, `merge_duplicate_lead`, `reassign_lead_to_agent`, `reset_daily_power_mode`, `restore_from_quarantine`, SEO RPCs, and others.
- Reproduction: SQL showed multiple `prosecdef=true` functions with `anon_can_execute=true` and `authenticated_can_execute=true`.
- Root cause: default execute grants were not revoked after creating privileged functions.
- Recommended fix: revoke execute from `public`, `anon`, and `authenticated` for privileged functions; grant only to `service_role` or replace with API-gated server actions. Set fixed `search_path`.
- Risk of fixing: medium; admin/sales API routes may rely on some functions. Map function callers before revoking.
- Implementation order: third.

### P0 - Security Definer Views Reported By Supabase Advisor

- Severity: P0/P1 depending on view data.
- Business impact: views may bypass caller RLS expectations.
- Affected examples: `v_launch_readiness`, `v_agent_lead_counts`, `political_scenario_route_totals`, `v_agent_performance`, `candidate_intel_suggestions`, `v_sender_health`, `political_review_queue`.
- Reproduction: Supabase security advisor.
- Recommended fix: convert to security invoker views where possible, or restrict view privileges and ensure underlying policies are correct.
- Risk of fixing: medium.
- Implementation order: after function grants.

## P1 Revenue / Workflow Findings

### Political Command Pages Are Public

- Severity: P1
- Business impact: contradicts the public-vs-admin strategy and exposes an advanced command-center experience publicly.
- Affected routes: `/political/analytics`, `/political/candidate-agent`, `/political/maps`, `/political/routes`.
- Affected file: `apps/web/app/political/layout.tsx:26-31` reads auth state but does not require auth.
- Reproduction: no-cookie `curl -I` returns 200 for those routes.
- Root cause: public political portal and command workflow share the same route group.
- Recommended fix: keep a simple premium public political page, move advanced planner/agent/map/analytics screens behind `/admin/political` or an authenticated client campaign portal.
- Risk of fixing: medium; links and SEO pages must be preserved/redirected carefully.
- Implementation order: after P0 security and funnel stabilization.

### Stripe Webhook Observability Is Incomplete

- Severity: P1
- Business impact: payments may process without durable event audit/idempotency records.
- Affected file: `apps/web/app/api/webhooks/stripe/route.ts`.
- Affected table: `stripe_webhook_events` exists but has zero rows and no policies.
- Reproduction: code inspection; route handles events but does not persist each Stripe event id before/after processing.
- Root cause: processing logic and event ledger are disconnected.
- Recommended fix: insert a verified Stripe event record keyed by `event.id`, process idempotently, store result/error.
- Risk of fixing: medium; must not double-process live events.
- Implementation order: before payment scale.

### Targeted Checkout Is Public By Campaign ID

- Severity: P1
- Business impact: anyone with a campaign id can create/update a checkout session for that campaign.
- Affected file: `apps/web/app/api/stripe/targeted-checkout/route.ts`.
- Reproduction: route requires only `campaignId`; no session/user/token validation.
- Root cause: public quote checkout uses campaign id as bearer authority.
- Recommended fix: add a signed checkout token or intake token verification tied to campaign/email, plus rate limiting.
- Risk of fixing: medium; preserve public no-login checkout UX.
- Implementation order: before targeted campaign launch.

### Reservation System Is Stubbed

- Severity: P1
- Business impact: spot hold/expiry/extension logic can give false confidence and does not persist.
- Affected file: `apps/web/lib/engine/db/supabase/reservation-repository.ts`.
- Reproduction: `create()` returns `res-${Date.now()}` and never writes DB.
- Recommended fix: add real `reservations` table or consolidate reservation behavior into `spot_assignments` with explicit TTL/status.
- Risk of fixing: medium due category exclusivity.
- Implementation order: before shared postcard funnel scale.

### Client Replies Are Placeholder-Only

- Severity: P1
- Business impact: customers cannot see inbound campaign response value in their dashboard.
- Affected file: `apps/web/app/(dashboard)/replies/page.tsx`.
- Reproduction: route renders "Reply tracking coming soon."
- Recommended fix: wire `outreach_replies`, QR/form/call events, and campaign attribution into the client dashboard.
- Risk of fixing: low/medium.

## P2 Operational / UX Findings

- `next.config.ts:5-7` sets `typescript.ignoreBuildErrors=true`. The build script currently runs `tsc` first, but this can mask errors if Vercel/build commands drift.
- `pnpm turbo lint` reports 482 warnings, mostly unused vars, `any`, raw anchors, hook deps, and unescaped entities.
- `packages/services` has pricing tests but no test script or Vitest dependency. `pnpm exec vitest ...` fails with `Command "vitest" not found`.
- Multiple procurement/inventory public route names exist (`/inventory`, `/inventory-intelligence`, `/inventory-purchasing`, `/price-intelligence`, `/pricing-intelligence`, `/purchasing`, `/purchasing-intelligence`, `/find-my-savings`). This may be useful for SEO but needs canonical routing and product clarity.
- Several admin pages still use local/sample state or clearly labeled mock fallback data.
- Supabase performance advisor reports many unindexed foreign keys, multiple permissive policies, and duplicate indexes. This is not an immediate blocker, but it will matter as sales/agent volume grows.
- Multiple local Next dev servers were running on ports 3001-3005. This likely contributed to `.next` artifact corruption and should be cleaned up before future verification.

## Database Audit Table

| Table / group | Purpose | Health | Issues |
| --- | --- | --- | --- |
| `businesses` | Customer/business records | Present, 25 rows | Requires RLS review through connected tables |
| `orders` | Shared postcard/payment orders | Present, 9 rows | Multiple permissive policies; webhook event ledger disconnected |
| `campaigns` | Legacy/client campaign records | Present, 0 rows | RLS disabled |
| `marketing_campaigns` | Active postcard campaigns | Present, 0 rows | Multiple policies/advisor warnings |
| `leads` | Lead records | Present, 5 rows | RLS disabled |
| `sales_leads` | Sales engine leads | Present, 4122 rows | Heavily used; function grants need hardening |
| `targeted_route_campaigns` | Targeted campaign records | Present, 3 rows | RLS disabled; public checkout by campaign id |
| `political_campaigns` | Political campaign records | Present, 246 rows | Public/admin boundary needs review |
| `gov_contract_opportunities` | SAM/gov opportunities | Present, 112 rows | Sync env-gated; sample fallback remains |
| `email_events` | Postmark/outbound events | Present, 4 rows | Good foundation; sender verification not executed |
| `stripe_webhook_events` | Intended Stripe ledger | Present, 0 rows | RLS no policy; not wired into webhook route |
| `opcopilot_*` | Operations/procurement OS | Present | New savings tables have policies; older opcopilot tables still have multiple policy warnings |

## Feature-Specific Audit

### Shared Postcards

Status: partially implemented but currently blocked by runtime 500 in city/category funnel.

Working/staged:
- `/get-started` city selection loads.
- Stripe checkout route requires authenticated user.
- Availability endpoint exists and validates UUIDs.
- Category exclusivity has canonical availability logic.

Issues:
- City/category/checkout routes 500 on current runtime.
- Reservation repository is stub-only.
- Payment E2E not executed due live side effects.

### Targeted Campaigns

Status: partially working.

Working/staged:
- Public pages load.
- Intake route validates pricing floor.
- Checkout route creates Stripe sessions from campaign records.

Issues:
- Targeting filters are no-op.
- Pricing tiers are static in code.
- Checkout route trusts campaign id.
- Confirmation/admin notification uses placeholder/fallback messaging in services.

### Political Mail

Status: broad implementation with public/admin boundary concerns.

Working/staged:
- Public political routes load.
- Admin outreach strategy command center loads.
- Candidate/campaign records exist in Supabase.
- Campaign maps/route pages disclose sample/estimated data where applicable.

Issues:
- Advanced command pages are public.
- Public complexity is much higher than the requested premium-simple public experience.
- Some map/route data is still sample/estimated until source imports are complete.

### Inventory / Procurement

Status: recently enhanced and mostly visible.

Working/staged:
- `/operations-copilot` protected.
- `/inventory-purchasing` public product page loads.
- Admin procurement route loads.
- Savings OS data model was added.

Issues:
- `opcopilot_savings_recommendations` row count is currently 0.
- Several older opcopilot policies show multiple permissive advisor warnings.
- End-to-end recommendation approval and receiving mutation flows were not executed during this audit.

### Government Contracts / SAM.gov

Status: substantial admin execution layer, not yet fully proven.

Working/staged:
- `/admin/gov-contracts` loads and shows key buttons including Start Bid.
- Bid room and subcontractor components exist.
- `gov_contract_opportunities` has 112 rows.

Issues:
- SAM.gov live sync requires `SAM_GOV_API_KEY`.
- Sample fallback remains and must stay clearly labeled.
- Bid submission/export was not executed.
- Compliance safeguards need security review before real bid operations.

### AI / Automation

Status: broad but needs hardening.

Working/staged:
- Multiple admin agents and automation routes exist.
- Vercel crons are configured.
- AI approval/control tower structures exist.

Issues:
- Privileged agent-related RPC functions are callable by anon/auth roles.
- Some automation TODOs remain.
- High-risk outbound actions should remain disabled until logging, approval, and suppression rules are proven.

### Messaging / Outreach

Status: email-first foundation exists.

Working/staged:
- Postmark webhook receiver exists.
- Email test admin panel exists.
- Postmark event logging and platform audit logging exist.
- SMS webhook/status routes exist.

Issues:
- Live emails were not sent during audit.
- Twilio is not treated as production-ready.
- Need sender identity verification, suppression checks, webhook replay tests, and deliverability monitoring before scale.

## Security / Access Risks

1. Sensitive tables need RLS/policy cleanup.
2. SECURITY DEFINER functions need revoked execute grants and fixed search paths.
3. Security-definer views need conversion or restricted grants.
4. Public political command pages need route strategy review.
5. Public checkout endpoints need signed tokens/rate limits where no login is required.
6. `next.config.ts` should not ignore TypeScript build errors in production.
7. Stripe webhook needs durable event logging/idempotency.
8. Postmark webhook allows missing auth only in development; verify production env has credentials.

## Revenue Flow Risks

1. Shared postcard funnel route currently returns 500 on local runtime.
2. Stripe checkout E2E not verified in sandbox during this audit.
3. Stripe webhook table is not wired.
4. Reservation/spot hold logic is not durable.
5. Targeted checkout trusts raw campaign id.
6. Client dashboard does not yet show replies/leads.
7. Twilio/SMS follow-up is not ready for live revenue automation.

## Customer Experience Risks

1. Public political section feels like an advanced command center, not a simple premium public offer.
2. Multiple procurement/inventory public routes may confuse positioning without canonical service hierarchy.
3. Client replies page is "coming soon."
4. Several public CTAs route to signup/login, which is acceptable only if the redirect returns users to the right flow after auth.
5. The current local funnel failure makes the primary purchase journey unusable until the artifact/runtime issue is fixed.

## Admin Visibility Risks

1. Stripe events are not in the intended audit table.
2. Some admin lead pages still use local state/TODO-backed updates.
3. Email event logging exists, but sender identity health needs live provider verification.
4. Government contract sample/live status must remain obvious to avoid treating sample records as pipeline.
5. Universal logging exists but is not yet verified across every action type.

## Priority Fix List

### P0

1. Clean and re-verify the shared postcard funnel runtime.
2. Harden Supabase RLS on sensitive tables.
3. Revoke unsafe SECURITY DEFINER function grants.
4. Review/replace SECURITY DEFINER views.
5. Add Stripe event ledger/idempotency before payment scale.

### P1

6. Move or gate advanced public political command pages.
7. Replace reservation stubs with durable holds or remove UI claims that depend on them.
8. Add signed checkout token validation to public no-login checkout flows.
9. Wire client reply tracking to real inbound events.
10. Configure and run sandbox Stripe payment E2E.
11. Run Postmark sender verification tests from the admin panel after confirming sender identities.

### P2

12. Add Vitest and a real test script for pricing/services tests.
13. Reduce lint warnings in high-risk modules.
14. Consolidate/canonicalize procurement/inventory public routes.
15. Index high-traffic foreign keys and clean duplicate DB indexes.
16. Add route smoke tests for public/admin/customer paths.

### P3

17. Improve mobile visual QA coverage.
18. Expand SEO schema validation.
19. Add richer admin dashboards for gaps/unknown states.
20. Create a production launch checklist inside Control Tower.

## Recommended Repair Plan

### Phase 1: Stabilize Core Runtime

- Stop duplicate dev servers.
- Clean generated `.next`.
- Run a clean build and single production start.
- Re-test `/get-started`, city/category, checkout, admin, operations, and SEO pages.

### Phase 2: Harden Security

- Apply RLS policy cleanup.
- Revoke unsafe RPC execute grants.
- Convert or restrict security-definer views.
- Add regression tests for anon/auth/admin/service access.

### Phase 3: Fix Revenue Flows

- Add Stripe webhook event ledger.
- Sandbox test shared postcard checkout.
- Sandbox test targeted checkout.
- Add durable reservations/holds.

### Phase 4: Clean Public/Admin Boundaries

- Keep public pages premium and simple.
- Gate advanced political command features.
- Canonicalize procurement/inventory route structure.

### Phase 5: Communications Readiness

- Run Postmark sender verification.
- Verify DNS/SPF/DKIM/DMARC.
- Confirm webhook auth/events.
- Keep Twilio/SMS paused until approved and monitored.

### Phase 6: AI/Automation Hardening

- Confirm every high-risk AI action is draft/review/approve.
- Add audit events to all automations.
- Add kill switches and rate limits per channel.

### Phase 7: Launch QA

- Add route smoke tests.
- Add pricing/payment tests.
- Add DB policy tests.
- Verify mobile snapshots.

## Do-Not-Touch List

These areas appear useful and should be preserved unless a specific defect is proven:
- Middleware redirect safety and role logic, after adding missing route coverage if needed.
- Existing Stripe webhook signature verification.
- Existing Postmark webhook production Basic Auth behavior.
- Existing public SEO page architecture.
- Current admin shell/navigation foundation.
- Operations Copilot owner-facing simplicity direction.
- Political admin outreach strategy module, once public/admin separation is corrected.
- Government Contracts bid command direction, once compliance/security hardening is complete.
- Control Tower and audit-event direction.

## Exact Next Engineering Actions

1. Stop all extra local Next dev/start processes except one chosen server.
2. Remove generated `apps/web/.next` only after confirming no user work is inside it.
3. Run a clean build and single start; re-test `/get-started/columbus`, `/get-started/columbus/roofing`, and checkout.
4. Create a Supabase migration to add/fix policies for RLS-enabled/no-policy tables.
5. Create a Supabase migration to enable RLS and owner/admin/service policies on sensitive disabled-RLS tables.
6. Inventory every SECURITY DEFINER function caller, then revoke `EXECUTE` from `anon`/`authenticated` where not required.
7. Add fixed `search_path` to privileged functions.
8. Review security-definer views and convert to security invoker or restrict grants.
9. Wire `stripe_webhook_events` into `/api/webhooks/stripe` with event-id idempotency.
10. Add signed checkout tokens to targeted/intelligence public checkout flows.
11. Implement durable spot reservations or explicitly remove non-durable reservation claims.
12. Gate advanced `/political/*` command pages behind auth or move them under `/admin/political`.
13. Keep `/political` and `/political-mail` as simple public conversion pages.
14. Add Vitest to services and run existing pricing tests in CI.
15. Add route smoke tests for the top 25 public/admin/customer routes.
16. Run Postmark sender verification from admin with one safe email per sender.
17. Keep Twilio live sending disabled until account/webhook/status/suppression checks pass.
18. Wire client replies to inbound event tables.
19. Add dashboard badges for sample/staged/live data across gov contracts and political routes.
20. Re-run Supabase advisors and browser smoke audit after the P0/P1 fixes.

## Screenshots Captured

- Home page: `C:\Users\jason\AppData\Local\Temp\homereach-audit-home.png`
- Admin dashboard: `C:\Users\jason\AppData\Local\Temp\homereach-audit-admin.png`
- Operations Copilot: `C:\Users\jason\AppData\Local\Temp\homereach-audit-operations-copilot.png`

