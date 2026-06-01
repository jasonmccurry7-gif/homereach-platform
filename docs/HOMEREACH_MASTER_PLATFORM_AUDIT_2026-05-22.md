# HomeReach Master Platform Audit + Hardening

Date: 2026-05-22
Scope: current working tree plus production smoke checks for `https://www.home-reach.com`
Mode: audit-first, additive fixes only

## Executive Summary

HomeReach is no longer a single-product site. It is a broad AI-assisted operating platform with public marketing pages, shared postcard funnels, targeted campaigns, political mail, procurement/operations copilot, SAM.gov/government contracts, admin command center, AI assets, AI workforce, email/SMS observability, SEO authority pages, Stripe payments, and Supabase-backed operational data.

Current readiness score: **82 / 100**

The platform builds and the major public/protected routes behave correctly at a smoke-test level. Supabase has 266 public tables and all 266 have RLS enabled. Stripe webhook verification is implemented. Admin surfaces are protected by middleware and layout-level role checks. However, the system is not yet at 100 percent because several high-risk areas still need hardening before scale: broad cron-secret bypass, Facebook webhook fail-open behavior, UUID/token-only customer flows, fragmented outbound approval/logging, route/API guard drift, heavy route bundles, and release-control risk from a large dirty/untracked working tree.

## Verification Performed

| Area | Result |
|---|---|
| App route inventory | 189 page routes, 194 API route files |
| App files under `apps/web/app` | 511 files |
| Supabase migrations checked | 17 production migrations listed, including control tower, gov contracts, operations copilot, AI assets, AI workforce, emotional positioning |
| Supabase table count | 266 public tables, 266 RLS enabled |
| Web type-check | Passed |
| Web lint quiet | Passed |
| Services type-check | Passed |
| Services tests | Passed, 34 tests |
| Web production build | Passed |
| Live route smoke checks | Public routes returned 200; protected admin/dashboard routes redirected to login; admin APIs returned 401 |
| Known build warning | `ALERT_PHONE_NUMBER` not set, hot lead SMS alerts disabled |

Production smoke results:

| Route | Result |
|---|---|
| `/`, `/shared-postcards`, `/targeted`, `/political`, `/inventory-purchasing`, `/services` | 200 |
| `/ohio/columbus/roofing-marketing`, `/political-mail/ohio`, `/tools/postcard-roi-calculator` | 200 |
| `/inventory` | 307 to `/inventory-purchasing` |
| `/find-my-savings`, `/operations-copilot`, `/dashboard`, `/admin` | 307 to login |
| `/api/admin/ai-assets/actions`, `/api/admin/ai-workforce/actions`, `/api/admin/sales/at-risk` | 401 unauthenticated |
| `/api/webhooks/postmark`, `/api/webhooks/twilio/status` | 200 health probe |

Local note: `http://localhost:3001` was not running during smoke checks.

## Safe Hardening Applied

| Fix | Files | Impact |
|---|---|---|
| Legacy shared spot route redirected into canonical shared postcard funnel | `apps/web/app/spots/[citySlug]/[categorySlug]/page.tsx` | Prevents broken legacy checkout requests missing required fields |
| Targeted checkout summary endpoint added | `apps/web/app/api/stripe/targeted-checkout/route.ts` | Checkout UI can read actual campaign homes and price before payment |
| Targeted checkout UI reads stored campaign summary | `apps/web/app/(funnel)/targeted/checkout/page.tsx` | Reduces price-display mismatch risk |
| APEX SMS command endpoint now validates Twilio signature and logs audit events | `apps/web/app/api/command/route.ts` | Blocks spoofed SMS command POSTs and removes sender exposure |
| Global security headers added | `apps/web/next.config.ts` | Adds `nosniff`, referrer policy, `SAMEORIGIN`, and browser permissions policy |

Rollback: revert only the five files above.

## Ecosystem Map

| Layer | Current organization |
|---|---|
| Public website | Homepage, services, shared postcards, targeted, political, inventory/purchasing, property intelligence, SEO city/category/county pages, tools, visuals, insights, case studies |
| Shared postcard funnel | `/get-started`, city/category selection, canonical availability, checkout, Stripe, intake records, spot assignments |
| Targeted campaign funnel | `/targeted/start`, `/targeted/intake`, `/targeted/checkout`, `/targeted/confirmed`, targeted campaign API, Stripe targeted checkout |
| Political platform | Public `/political`, political planning/pricing/maps/presentation pages, admin political command center and data acquisition routes |
| Procurement/operations | Public inventory pages, protected `/operations-copilot`, supplier prices, delivery, receiving, approvals, admin procurement |
| Government contracts | Admin `/admin/gov-contracts`, opportunity sync, bid rooms, subcontractors, pricing/compliance/post-award schema |
| Admin command center | `/admin` loads `AdminCommandCenter` from HomeReach OS and Foundation Control Tower data |
| AI systems | `/admin/ai-assets`, `/admin/agents`, AI workforce tasks/logs, SOPs, data sources, prompt chains, agent profiles |
| Communications | Postmark webhook, Twilio status and inbound SMS webhooks, admin inbox, sales event endpoints, automation send-due |
| Payments | Stripe checkout APIs, Stripe webhook with signature verification and event ledger |
| Database | Supabase/Postgres with service-role server access and RLS on all public tables |
| SEO | Programmatic Ohio/county/service/political/learn/tools/visuals pages, sitemap, image sitemap, robots blocking admin/API/private paths |

## What Is Working

- Public homepage and core marketing routes load live.
- Admin, dashboard, operations copilot, and admin APIs are protected from unauthenticated access at smoke-test level.
- Supabase production migrations for recent platform layers are applied.
- All public tables currently report RLS enabled.
- Stripe webhook validates raw-body signature and records an idempotency ledger.
- Postmark and Twilio status webhooks fail closed in production when credentials/signatures are missing.
- `/admin` is a consolidated Command Center route and is protected by middleware and layout auth checks.
- AI Assets and AI Workforce command centers exist and are wired to Supabase-backed tables.
- Government contract opportunity storage/sync and bid execution schema exist.
- Operations Copilot procurement/savings schema exists.
- SEO robots and sitemap are present.
- Web and services static checks pass.

## Partially Working Or Staged

| System | Status |
|---|---|
| Political operations | Many admin/public surfaces exist, but some routes are phase-gated or partial; persistence and approval workflows need deeper end-to-end validation |
| Government contracts | Opportunity discovery and schema are present; bid rooms, docs, pricing, subcontractor, post-award rows are mostly empty, so workflow is structurally ready but not operationally proven |
| Procurement OS | Customer/admin surfaces and data model exist; many savings/delivery/receiving tables are empty and some demo/hardcoded context remains |
| AI Assets / AI Workforce | Real tables and screens exist, but fallback/seed data can make the system look healthier than live activity proves |
| SEO flywheel | Programmatic pages exist, but `seo_pages` table has zero rows; some conversion blocks are display-only |
| Messaging automation | Multiple send paths exist; approval, audit, opt-out, throttling, and observability are not yet universal |

## Broken Or High-Risk Findings

| Priority | Issue | Business impact | Affected area | Recommended additive fix |
|---|---|---|---|---|
| P0 | `CRON_SECRET` can bypass broad admin API middleware | Secret leak could authorize privileged admin/API actions | `apps/web/middleware.ts` | Remove global bypass, keep route-local cron guards only, split secrets by job class |
| P0 | Facebook webhooks can fail open if app secret/verify token are missing | Forged Meta payloads could create CRM/messages or trigger automations | `/api/webhooks/facebook`, `/api/facebook/webhook` | Require `FACEBOOK_APP_SECRET` and non-default verify token in production |
| P0 | Outbound sends are not all routed through one approval/audit model | High-risk SMS/email/DM sends can bypass unified approval and durable logging | Admin inbox, Facebook, targeted admin send routes | Force all sends through a shared communications send service |
| P0 | Public UUID/session flows protect sensitive actions only by opaque ID | Leaked IDs can read/mutate checkout, campaign, or AI intake state | Targeted checkout, shared-postcard AI intake | Add signed HttpOnly session tokens, owner binding, TTLs, and idempotency |
| P1 | Public write APIs use privileged DB access with limited abuse controls | Spam, cost, pipeline pollution | targeted intake/leads, political map plans, waitlist/nonprofit-style submissions | Add shared public-write guard: rate limit, honeypot/captcha, duplicate hashes, payload caps |
| P1 | Checkout/session endpoints need stronger idempotency and reservation TTL cleanup | Bots or retries can create pending orders/reservations or inventory locks | Stripe checkout routes, spots checkout, intelligence checkout | Add idempotency keys, signed checkout tokens, reservation expiry job |
| P1 | Sales agent conversation access appears broad | Sales users may see data beyond assignments | `/api/conversations` | Scope sales-agent queries to assigned leads/conversations |
| P1 | Stripe webhook idempotency fails open if ledger is unavailable | Duplicate webhooks could repeat fulfillment mutations | `/api/webhooks/stripe` | Fail closed in production when ledger is missing; add DB unique constraints on fulfillment side effects |
| P1 | Admin SVG uploads to public storage | Active-content/XSS risk if rendered inline | business design upload action | Disallow SVG or sanitize/rasterize server-side |
| P1 | Admin dashboard can show fallback/mock state as healthy | False sense of operational readiness | HomeReach OS, control tower, AI Assets, AI Workforce | Label seed/fallback data, surface source failures, require live data badges |
| P1 | Targeted checkout access uses raw campaign UUID | A leaked ID can create checkout session | `/targeted/checkout`, targeted checkout API | Use signed checkout token linked to campaign and email |
| P2 | Public CTAs often force signup before public funnels | Conversion friction | Homepage/header CTAs | Send acquisition CTAs directly to public funnels, require auth only at checkout/account steps |
| P2 | SEO inventory truth is partial | Pages may show availability inconsistent with canonical logic | SEO inventory, ScarcityLive, sitemap | Reuse canonical availability everywhere |
| P2 | Programmatic SEO conversion blocks are display-only | SEO traffic may not convert | SEO WaitlistBlock/PageBlocks | Link/embed waitlist with city/category/source params |
| P2 | `/political/maps` route is heavy | Mobile performance risk | Public political maps | Lazy load maps and split map dependencies |
| P2 | Many lint warnings remain in legacy admin/agent code | Warning noise hides new defects | Admin and agent surfaces | Burn down warnings by module after P0/P1 fixes |

## Security Hardening Report

Good controls:

- Supabase auth middleware protects admin/dashboard/operations routes.
- Admin layout rechecks user and role.
- Stripe webhook signature validation is correct.
- Postmark webhook uses Basic Auth and fails closed in production.
- Twilio status and inbound SMS webhooks validate signatures in production.
- RLS is enabled on all public tables at the table level.

Remaining hardening:

1. Remove the broad `CRON_SECRET` middleware bypass.
2. Require production Facebook webhook secrets and remove default verify-token behavior.
3. Add shared rate limiting/origin checks for public write and checkout routes.
4. Add CSRF/origin protection for cookie-authenticated mutating admin routes.
5. Bind unauthenticated campaign/checkout sessions to signed tokens and TTLs.
6. Move every outbound send through a single communications service with opt-out checks, approval state, audit events, and throttles.
7. Fail closed on Stripe webhook ledger unavailability in production.
8. Remove public SVG upload support or sanitize/rasterize.
9. Rotate any production-like secrets that have lived in OneDrive-synced `.env` files.
10. Add CI secret scanning and dependency audit.

## UX And Conversion Audit

What is strong:

- Homepage now communicates a premium, emotionally intelligent platform rather than just postcards.
- Product cards and sections establish the ecosystem clearly.
- Public SEO routes and tools support authority building.
- Protected operations/admin routes keep operational complexity out of public view.

Risks:

- Some primary CTAs send prospects to signup before the value flow, adding friction.
- Legacy funnel surfaces visually lag behind the newer premium homepage.
- SEO page CTAs are not all transactional.
- Procurement and political customer-facing surfaces need clearer live-vs-demo labeling.
- Admin navigation has many destinations and should be grouped around daily workflows, not just modules.

Recommended UX plan:

1. Route acquisition CTAs to public funnels first.
2. Apply the premium marketing shell to shared, targeted, inventory, and political funnel pages.
3. Add clear live/demo/source labels to dashboards with fallback data.
4. Make SEO conversion blocks action-ready.
5. Keep customer procurement UI limited to urgent issues, deliveries, recommendations, savings, and quick actions.

## Admin Command Center Audit

Working:

- `/admin` is the central command route.
- Admin nav includes Command Center, Growth Execution, Communications, AI Workforce, AI Assets, Control Center, CRM, Procurement, Gov Contracts, Campaign Ops, Political, SEO, and Catalog/Admin.
- System-health and OS concepts are represented.

Risks:

- There are still multiple command-style surfaces: Command Center, Control Center, OS, War Room, Operator, Sales Dashboard, Growth Execution, Revenue Operations.
- Some cards are backed by fallback/seed/sample data.
- Not all module actions land in `platform_audit_events`.
- Outbound approval and inbox visibility are fragmented across modules.

Recommended admin plan:

1. Make `/admin` the executive truth layer.
2. Mark every card as live, fallback, demo, or disconnected.
3. Route all quick actions through shared action/approval/audit services.
4. Move module dashboards under command-center drilldowns.
5. Add a daily "owner decision" queue that merges AI approvals, failed sends, payment issues, replies, and revenue actions.

## AI Workflow Audit

Working:

- `AGENTS.md`, skills, AI Assets, prompt SOPs, data sources, agent profiles, prompt chains, AI Workforce tasks/logs are present.
- Human-approval language exists across AI assets and government contract areas.
- AI outputs and reviews have database tables.

Risks:

- AI Assets and AI Workforce can use seed/fallback data.
- `mark_winning_output` can approve/verify too cheaply.
- Legacy agent systems still exist beside AI Workforce.
- Some outbound routes can send without centralized AI approval history.

Recommended AI plan:

1. Add source badges and seed/fallback warnings to AI dashboards.
2. Require verification checklist completion before "winning output" can become approved.
3. Map legacy agent routes into AI Workforce telemetry or hide behind legacy labels.
4. Require `platform_audit_events` for every AI draft, approval, rejection, send, publish, and failure.
5. Add quality scoring and regression samples for best posts, SMS, email, political content, and SAM.gov outputs.

## Revenue Opportunity Matrix

| Opportunity | Impact | Effort | Next move |
|---|---:|---:|---|
| Remove signup friction from public CTAs | High | Low | Direct CTAs to public funnels |
| Make SEO WaitlistBlock actionable | High | Low | Add existing waitlist link/form with params |
| Unified reply inbox plus send approval queue | Very high | Medium | Route all outbound through one communications service |
| Procurement savings onboarding with a 5-second dashboard | High | Medium | Remove demo ambiguity and show savings snapshot first |
| Targeted checkout token and exact quote summary | High | Medium | Extend current summary with signed token |
| Political proposal to payment clarity | High | Medium | Tie public plan, proposal, approval, payment, and admin tracking |
| Gov contract bid room activation | Medium-high | High | Start one real bid workflow end to end before scaling |
| Review/reputation offer as low-cost entry product | Medium | Low | Add service-page CTA into CRM/waitlist |

## Performance And Scalability

Findings:

- Production build passes.
- `/political/maps` is the largest public bundle observed, about 705 kB first-load JS in build output.
- Middleware bundle is about 87.8 kB.
- Many dynamic routes rely on service-role server calls and should be watched for query performance.
- Build emitted a webpack cache warning about serializing a 215 KiB string.

Recommendations:

1. Lazy-load public map libraries and move noncritical map controls behind dynamic imports.
2. Add route-level performance budgets to CI.
3. Add database indexes where high-volume dashboards query by status, created date, campaign, owner, and approval state.
4. Add background queues for expensive AI/SEO/SAM.gov/procurement jobs.
5. Add smoke tests for route status, headers, auth redirect, API 401, and key funnel pages.

## Data Model Audit

Confirmed:

- Supabase production reports 266 public tables and all have RLS enabled.
- Important recent tables exist for platform audit events, feature flags, daily briefs, gov contracts, operations copilot, AI assets, and AI workforce.

Risks:

- Many operational tables have zero rows, so schema exists but runtime workflows are not proven.
- Multiple CRM/sales/outreach/message systems coexist.
- Some workflows still use legacy Drizzle tables while newer systems use Supabase service-role tables.

Recommended data plan:

1. Define canonical entities for organization, contact, lead, campaign, message, task, approval, AI output, audit event, payment, and fulfillment.
2. Add a route-to-table ownership map.
3. Standardize event logging to `platform_audit_events`.
4. De-duplicate CRM/message entities after current revenue flows are stable.

## Do-Not-Touch List

Do not refactor these until P0/P1 risks are handled:

- Stripe webhook signature and fulfillment logic, except fail-closed/idempotency improvements.
- Canonical `/get-started` shared postcard funnel.
- Supabase RLS/security migrations already applied.
- Admin auth layout and middleware role checks, except narrowing cron bypass.
- Postmark/Twilio webhook fail-closed behavior.
- Existing customer/payment records and campaign records.

## Exact Next Actions

1. Remove global `CRON_SECRET` bypass from middleware and convert each cron route to route-local `requireCron`.
2. Harden Facebook webhooks to require app secret and non-default verify token in production.
3. Add a shared public-write protection helper for rate limits, honeypot/captcha, duplicate detection, and payload caps.
4. Add signed checkout tokens for targeted checkout, intelligence checkout, and shared AI intake.
5. Route every outbound message through one communications send service with approval, opt-out, throttle, and audit logging.
6. Add sales-agent scoping to `/api/conversations`.
7. Fail closed on Stripe webhook ledger unavailability in production.
8. Remove or sanitize SVG uploads.
9. Label all AI/admin fallback data as demo/fallback in the UI.
10. Require verification checks before AI Assets can mark outputs as winning/approved.
11. Make SEO waitlist/intake blocks actionable.
12. Reuse canonical availability logic in SEO scarcity and sitemap filters.
13. Direct public CTAs to public funnels before signup.
14. Lazy-load `/political/maps` dependencies.
15. Add route/API smoke tests for public pages, protected routes, checkout preflight, and admin API 401.
16. Add security header assertions to CI.
17. Create release branch, commit current production state, and tag a rollback point.
18. Rotate production-like secrets stored in OneDrive-synced env files.
19. Set `ALERT_PHONE_NUMBER` or keep hot-lead SMS alerts explicitly disabled.
20. Finish Twilio A2P approval before enabling any SMS scale.

## Items Requiring Owner Action

1. Complete Twilio A2P campaign revision and approval before scaling SMS.
2. Confirm `ALERT_PHONE_NUMBER` destination or intentionally leave hot-lead SMS alerts disabled.
3. Confirm production Facebook app secret and verify token, or keep Facebook webhooks disabled.
4. Rotate any production-like secrets that were stored in OneDrive-synced `.env` files.
5. Decide whether public CTAs should bypass signup until checkout.
6. Approve a source-control stabilization pass: create branch, stage, commit, and tag rollback point.
7. Choose whether to deploy these hardening fixes immediately to production.

## Final Readiness Gate

HomeReach can be sold and demonstrated cautiously today because the public site, protected admin routing, build, tests, Stripe webhook, and major dashboards exist. It should not scale autonomous outreach, broad SMS, Facebook webhook ingestion, high-volume public forms, or government contract execution until P0 and P1 items are closed.

The path to 100 percent readiness is not another redesign. It is control: route-local authorization, signed sessions, unified outbound approval, universal audit logging, rate limiting, fallback-data labeling, source-control stabilization, and one canonical daily command center.
