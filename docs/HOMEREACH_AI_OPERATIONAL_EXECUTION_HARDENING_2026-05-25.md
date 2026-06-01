# HomeReach AI Operational Execution Hardening Report

Date: 2026-05-25
Status: Local hardening pass complete, not deployed

## Executive Summary

HomeReach already has several strong platform foundations: protected admin routing, a valued executive admin dashboard, a Foundation Control Tower, AI Assets, AI Workforce tables, revenue messaging governance, webhook verification patterns, and payment lifecycle protections. This pass preserved those strengths and focused on production-safe hardening rather than redesigning working systems.

The safest strategic direction is additive: keep the existing admin command center as the executive home, strengthen the control tower underneath it, route all AI work through approval and logging layers, and close high-risk gaps in checkout validation, outbound communication governance, suppression handling, and customer visibility.

## Guardrails Used

- No protected intake, Stripe, auth, exclusivity, webhook, or dashboard flow was replaced.
- No destructive database changes were made.
- No outbound email, SMS, Facebook message, payment, vendor action, or campaign setting was executed.
- Admin dashboards were preserved because the current implementation is operationally valuable.
- Fixes were limited to modular code changes with straightforward rollback paths.

## Pass 1: Discovery And Audit

### Security And Reliability

Findings:

- Legacy profile RLS may allow role self-escalation if old policies still trust mutable `profiles.role`.
- Public property-intelligence checkout accepted loosely validated payloads and initialized Stripe at module scope.
- Shared postcard spot checkout has a secondary availability check that can fail open on database errors.
- SEO attribution accepts public identifiers and upserts connector state; this should be reviewed before scaling.
- Several webhooks verify identity but lack durable dead-letter capture for downstream database failures.
- Migration drift exists across multiple migration roots and should be reconciled before major schema work.

Strengths:

- Middleware has explicit route protection for admin, dashboard, API, and cron-style paths.
- Stripe webhook uses raw body verification and idempotency patterns.
- Recent RLS/security migrations show the right direction for table lockdown.

### Control Tower And Admin

Findings:

- `/admin` is the correct executive command center and should be preserved.
- `/admin/control-center` and the Foundation Control Tower are the right place for system readiness signals.
- `/admin/agents` correctly serves as the AI Workforce Command Center.
- Some AI Assets and control tower cards need clearer live-data vs fallback-data labeling.
- Legacy admin components can be modularized later, but a full redesign is not justified.

### Revenue Operations

Findings:

- Customer dashboard queries only showed the first business for a user, hiding campaigns and billing records for multi-business owners.
- Shared postcard checkout and signup handoff can lose intent before a lead or pending checkout record exists.
- Targeted campaign one-time vs recurring checkout language needs reconciliation.
- Procurement has a strong product concept but needs a lower-friction savings intake path.
- Operations Copilot supplier checkout should require approval for unknown vendors or untrusted domains.

### Communications And Deliverability

Findings:

- Persona differentiation exists for Jason, Josh, Chelsi, and Heather and should remain.
- Manual sales sends were incrementing send counts before all governance checks had passed.
- Unsubscribe handling updated sales lead status but did not consistently write to central suppression and consent ledgers.
- Facebook webhook updates could reset suppression flags on existing leads.
- A signed inbound SMS webhook is still needed for STOP, HELP, START, and reply ledger sync.
- Suppression lookup failures should fail safer as volume scales.

## Pass 2: Implemented Hardening

### Runtime And Dependency Safety

- Aligned the web app manifest with the patched runtime already present in the lockfile:
  - `next` 15.5.14
  - `react` 19.2.4
  - `react-dom` 19.2.4
  - `eslint-config-next` 15.5.14
- Refreshed the lockfile to match workspace package manifests.

### Checkout Validation

- Hardened the property-intelligence checkout route with:
  - Zod request validation.
  - Email normalization.
  - Payload length and enum constraints.
  - IP-based rate limiting.
  - Lazy Stripe initialization.
  - Removal of public `userId` trust from Stripe metadata.
  - Safer optional founding-slot lookup.

### Manual Sales Send Governance

- Moved daily send-count incrementing until after approval, suppression, deliverability, and reputation gates pass.
- Normalized outbound channel checks so email suppressions are not bypassed by inconsistent channel labels.
- Normalized email status before bounce, complaint, and unsubscribe checks.
- Added send-limit metadata to revenue communication events.

### Webhook And Suppression Hardening

- Changed Postmark webhook Basic Auth comparison to timing-safe hash comparison.
- Updated unsubscribe flow to write additive suppression and consent events when those tables exist.
- Preserved prior `do_not_contact` and `sms_opt_out` flags when Facebook webhook sync updates existing leads.
- Added route-local admin-or-cron authorization to the Facebook daily score route.

### Customer Revenue Visibility

- Updated customer campaign and billing dashboard queries to include all businesses owned by the user, not only the first business.

## Pass 3: Executive Enhancement Review

### What Should Be Preserved

- Preserve `/admin` as the executive HomeReach OS.
- Preserve `/admin/control-center` as the modular system readiness lane.
- Preserve `/admin/agents` as the AI Workforce Command Center.
- Preserve existing approval gates for AI outputs, outreach, political work, procurement actions, and SAM.gov workflows.
- Preserve Stripe webhook and payment architecture until a dedicated payment regression suite is in place.

### What Is Truly Superior To Add

- A "Needs Jason Today" owner queue that aggregates approvals, high-value leads, failed jobs, deliverability warnings, and stalled revenue workflows.
- Live-vs-fallback indicators on every Control Tower data tile.
- Durable webhook failure ledger for Stripe, Twilio, Postmark, Facebook, and automation jobs.
- Centralized `canSendOutbound` service reused by email, SMS, Facebook, automation, and manual sales send routes.
- Signed inbound SMS webhook for consent, STOP/HELP/START, replies, and revenue ledger sync.
- Procurement savings intake that can create a review-ready opportunity before asking for heavy onboarding.

## Security Findings

High priority:

- Confirm production RLS for `profiles.role`; admin or service role should be the only path to role changes.
- Run Supabase advisor and compare results with migrations 101 through 107.
- Add route-level guards to all cron/internal API endpoints, not only middleware guards.

Medium priority:

- Make shared postcard spot availability fail closed or enforce inventory with a database-level atomic claim.
- Add dead-letter logging to webhook handlers for post-verification downstream failures.
- Review public SEO attribution write scope.
- Replace in-memory rate limits with durable or edge-compatible limits for production scale.

## System Health Report

Current strengths:

- Explicit middleware protection is in place.
- Admin, dashboard, payment, and webhook surfaces are organized and discoverable.
- Control Tower and AI Workforce tables already exist.
- TypeScript validation passes after the hardening changes.

Current gaps:

- Some health surfaces can report fallback data without enough visual distinction.
- Cron and webhook failures need a durable failure queue.
- Production environment and Supabase RLS state were not directly verified in this local pass.
- Route-level authorization should continue being added to internal automation endpoints.

## Revenue Bottleneck Report

Highest-impact bottlenecks:

- Shared postcard intent can be lost before checkout/signup completes.
- Multi-business customer dashboards previously hid some billing and campaign records.
- Targeted campaign recurring language and checkout behavior need tighter alignment.
- Procurement needs a lightweight savings capture path to accelerate demos.
- High-value leads, approvals, and stalled workflows need an executive queue.

## AI Agent Architecture

Recommended operating model:

- Orchestrator Agent: creates tasks, enforces approvals, logs handoffs.
- QA/System Health Agent: watches routes, webhooks, automations, auth, and payments.
- Revenue Integrity Agent: flags stuck leads, failed payments, abandoned checkout, and stalled proposals.
- Outreach Governance Agent: checks sender health, suppression, cadence, opt-out state, and personalization quality.
- Procurement Agent: analyzes savings and drafts owner-facing recommendations without placing orders.
- Political Campaign Agent: supports geography, timing, pricing, and mail execution without prohibited voter profiling.
- Technical SEO Agent: audits crawlability, metadata, internal links, and public page risk.

All agents should write to:

- `ai_workforce_tasks`
- `ai_workforce_activity_logs`
- `ai_outputs`
- `ai_output_reviews`

## Deliverability Governance System

Current foundation:

- Sender personas exist.
- Approval gates exist.
- Postmark unsubscribe headers exist.
- Suppression tables and reputation control logic exist.

Next required layer:

- One centralized send decision service for every outbound channel.
- Signed inbound SMS consent and reply webhook.
- Shared suppression service across email, SMS, Facebook, and manual outreach.
- Deliverability risk score surfaced in the Control Tower.
- Distinct cadence, subject, structure, CTA, and sender behavior by persona.

Compliance position:

- Optimize personalization, consent, quality, and pacing.
- Do not bypass spam systems, carrier protections, or platform trust systems.

## Operational Visibility Improvements

Implemented:

- Better dashboard revenue visibility for multi-business customers.
- Better communication audit metadata on sales send events.
- Safer suppression preservation for Facebook lead updates.
- Broader suppression and consent write-through on unsubscribe.

Recommended:

- Add Control Tower cards for webhook failure count, send suppression blocks, approval queue age, Stripe webhook health, Twilio delivery health, and AI agent failure rate.
- Add an owner queue to `/admin` instead of replacing the existing dashboard.
- Label every card as live data, fallback data, or no data.

## Rollback Documentation

No migrations were applied in this pass.

Rollback can be done by reverting these touched files:

- `apps/web/app/api/admin/sales/event/route.ts`
- `apps/web/app/api/admin/sales/facebook/daily-score/route.ts`
- `apps/web/app/api/facebook/webhook/route.ts`
- `apps/web/app/api/intelligence/checkout/route.ts`
- `apps/web/app/api/webhooks/postmark/route.ts`
- `apps/web/app/unsubscribe/route.ts`
- `apps/web/lib/dashboard/queries.ts`
- `apps/web/package.json`
- `pnpm-lock.yaml`
- `docs/HOMEREACH_AI_OPERATIONAL_EXECUTION_HARDENING_2026-05-25.md`

Because all behavioral fixes are additive or stricter validations, rollback risk is low. The only customer-facing behavior to monitor is whether property-intelligence checkout receives malformed legacy payloads that validation now rejects.

## Risk Analysis

Low risk changes:

- Dashboard query widening.
- Timing-safe webhook auth comparison.
- Preserving suppression flags on Facebook updates.
- Additive suppression and consent writes.

Moderate risk changes:

- Property-intelligence checkout validation may reject malformed payloads that previously slipped through.
- Dependency manifest alignment should be verified in CI because the workspace includes mobile peer warnings.

High risk items intentionally not changed locally:

- Shared postcard atomic inventory enforcement.
- Profile role RLS migration.
- Stripe shared postcard subscription semantics.
- Supplier checkout vendor/domain approval enforcement.
- Public SEO attribution model.

## Next-Phase Roadmap

Phase 1: Production verification

- Run Supabase advisor.
- Verify all deployed environment variables.
- Validate RLS on profiles, campaign tables, revenue tables, AI tables, and procurement tables.
- Run protected-flow smoke tests in staging.

Phase 2: Control Tower hardening

- Add live/fallback/no-data labels.
- Add webhook failure ledger.
- Add owner priority queue.
- Add deliverability health cards.
- Add AI agent failure and escalation cards.

Phase 3: Revenue acceleration

- Capture shared postcard lead intent before signup.
- Reconcile one-time vs subscription checkout behavior.
- Add procurement savings intake.
- Add proposal speed metrics.
- Add abandoned checkout recovery drafts requiring approval.

Phase 4: Communications governance

- Build centralized `canSendOutbound`.
- Add signed inbound SMS webhook.
- Add durable suppression service.
- Add persona-level cadence controls.
- Add sender health trend reporting.

Phase 5: Payment and inventory integrity

- Add atomic spot claim enforcement.
- Add payment regression tests.
- Add Stripe webhook dead-letter replay tooling.
- Add admin review for inventory exceptions.

