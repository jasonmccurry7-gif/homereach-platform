# Prioritized Fix Plan

Generated: 2026-05-09

Scope: audit-derived plan only. No code fixes have been applied.

## CRITICAL

### 1. Move/Hydrate Repo Out Of OneDrive

What is wrong: repo is in OneDrive and reads hit cloud operation failures.

Why it matters: installs/builds/watchers can fail falsely or corrupt generated output.

Files/areas: entire repo path under C:\Users\jason\OneDrive\...

Safest fix: copy to C:\Dev\homereach or similar after hydrating files; exclude generated caches.

Risk of fix: low if copied, medium if moved without backup.

Approval needed: yes.

### 2. Fix DB Schema Exports And Package Export Paths

What is wrong: packages/db/src/schema/index.ts exports only core schemas, while app code imports many newer tables from @homereach/db. package.json does not export @homereach/db/schema, but code imports it.

Why it matters: likely typecheck/build blocker and DB drift risk.

Files: packages/db/src/schema/index.ts, packages/db/package.json, packages/services/src/pricing/index.ts, apps/web/app/(admin)/admin/traffic-engine/page.tsx, affected @homereach/db imports.

Safest fix: export all intended schema modules and add an explicit ./schema package export if the codebase keeps that import path.

Risk of fix: medium; may reveal more type errors.

Approval needed: yes, DB architecture is production-critical.

### 3. Resolve Known TypeScript Errors

What is wrong: known errors exist in admin pages, migration client, war-room, intelligence checkout, and waitlist page.

Why it matters: build/deploy cannot be trusted.

Files: apps/web/app/(admin)/admin/bundles/page.tsx, businesses/page.tsx, orders/page.tsx, products/page.tsx, founding/page.tsx, migration/migration-client.tsx, war-room/page.tsx, apps/web/app/(funnel)/intelligence/checkout/intelligence-checkout-client.tsx, apps/web/app/waitlist/page.tsx.

Safest fix: repair in small batches and rerun typecheck after each batch.

Risk of fix: medium.

Approval needed: yes.

### 4. Reconcile Supabase Migration Source Of Truth

What is wrong: migrations are split between packages/db/supabase/migrations and supabase/migrations.

Why it matters: wrong migration action can damage or drift production schema/RLS.

Files: both migration folders, packages/db/drizzle.config.ts.

Safest fix: read remote migration list first, compare to both folders, document canonical root before any migration.

Risk of fix: high if mutating blindly; low for read-only audit.

Approval needed: yes before remote Supabase commands.

### 5. Fix Stripe Webhook Coverage

What is wrong: webhook handles orderId metadata path, but targeted_route_campaign metadata and subscription lifecycle are not clearly handled.

Why it matters: successful payments may not update internal campaign/order state.

Files: apps/web/app/api/webhooks/stripe/route.ts, apps/web/app/api/stripe/targeted-checkout/route.ts, apps/web/app/api/spots/checkout/route.ts, apps/web/app/api/stripe/checkout/route.ts.

Safest fix: test each checkout path in Stripe test mode, then add idempotent handlers for targeted and subscription events.

Risk of fix: high; revenue-critical.

Approval needed: yes.

### 6. Reconcile Env Templates And Turbo Env

What is wrong: .env.example and production template omit many code-required vars; turbo names mismatch code.

Why it matters: local/Vercel builds and features can fail despite files existing.

Files: .env.example, apps/web/.env.production.template, turbo.json, apps/web/lib/env.ts.

Safest fix: update templates with names/placeholders only, align turbo globalEnv, then verify Vercel env separately.

Risk of fix: medium.

Approval needed: yes for edits; separate approval for Vercel checks.

## HIGH

### 7. Preserve Checkout Redirect Through Signup

What is wrong: login honors redirect, signup always routes to /dashboard.

Why it matters: new customers can lose checkout flow.

Files: apps/web/app/(auth)/signup/page.tsx, apps/web/app/(auth)/signup/signup-form.tsx, checkout pages.

Safest fix: pass/consume sanitized redirect searchParam after signup.

Risk of fix: medium; auth flow.

Approval needed: yes.

### 8. Strengthen Category/Spot Reservation Race Protection

What is wrong: availability checks may not be enough to prevent simultaneous claims.

Why it matters: category-exclusive inventory can oversell.

Files: apps/web/app/api/stripe/checkout/route.ts, apps/web/app/api/spots/checkout/route.ts, apps/web/lib/funnel/queries.ts, apps/web/lib/engine/availability.ts, DB constraints/migrations.

Safest fix: verify/add DB-level uniqueness or transactional reservation plus stale pending cleanup.

Risk of fix: high; revenue inventory.

Approval needed: yes.

### 9. Choose Canonical Targeted Campaign Flow

What is wrong: newer /targeted/start/intake/checkout flow and older builder -> /api/targeted-campaign coexist.

Why it matters: leads/payments may land in different tables and dashboards.

Files: apps/web/app/(funnel)/targeted/*, apps/web/app/targeted/campaign-builder.tsx, apps/web/app/api/targeted-campaign/route.ts, apps/web/app/api/targeted/*.

Safest fix: document canonical path, redirect or label legacy path, align admin dashboard.

Risk of fix: medium-high.

Approval needed: yes.

### 10. Fix Client Dashboard Multi-Business Queries

What is wrong: getCampaignsForUser/getOrdersForUser query only first owned business.

Why it matters: clients with multiple businesses see incomplete data.

Files: apps/web/lib/dashboard/queries.ts, apps/web/app/(dashboard)/dashboard/page.tsx, apps/web/app/(dashboard)/billing/page.tsx.

Safest fix: use inArray for all owned business IDs and adjust UI behavior.

Risk of fix: medium.

Approval needed: yes.

### 11. Consolidate Email Provider Behavior

What is wrong: Resend, Mailgun, and Postmark paths are fragmented; Postmark router is described as future work.

Why it matters: sending, bounce handling, and compliance may diverge.

Files: packages/services/src/outreach/index.ts, packages/services/src/outreach/postmark.ts, apps/web/app/api/admin/sales/event/route.ts, apps/web/app/api/webhooks/postmark/route.ts.

Safest fix: decide provider policy, add a single router if needed, test only with internal addresses.

Risk of fix: high if live sending changes.

Approval needed: yes.

### 12. Guard Live SMS/Email Automation Paths

What is wrong: admin/agent/cron routes can send outbound messages or mutate live sales data.

Why it matters: accidental lead contact/compliance risk.

Files: apps/web/app/api/admin/sales/event/route.ts, apps/web/app/api/admin/automation/*, apps/web/app/api/admin/agents/*, apps/web/vercel.json.

Safest fix: confirm global pause/shadow flags and test recipient allowlists before any send tests.

Risk of fix: high operational risk.

Approval needed: yes.

## MEDIUM

### 13. Encoding / Mojibake Cleanup

What is wrong: terminal output shows mojibake in many files.

Why it matters: UI copy, email text, metadata, and source readability may be degraded.

Files: many app/package TSX/TS/MD files.

Safest fix: after build stabilizes, identify encodings and normalize in scoped batches.

Risk of fix: medium due broad text churn.

Approval needed: yes.

### 14. Confirm Storage Buckets And Policies

What is wrong: Supabase storage hosts are allowed, but bucket creation/policies were not confirmed.

Why it matters: assets/uploads may fail or have wrong public/private access.

Files: apps/web/next.config.ts, Supabase migrations/policies once identified.

Safest fix: read-only storage/policy audit after Supabase approval.

Risk of fix: low for audit, high for policy changes.

Approval needed: yes for Supabase access.

### 15. Complete Paid Order -> Intake/Design Linkage

What is wrong: intake form exists, but automatic intake creation from paid order was not confirmed in current webhook.

Why it matters: customer can pay without clean onboarding/design workflow.

Files: apps/web/app/api/webhooks/stripe/route.ts, apps/web/app/intake/[token]/*, apps/web/app/api/intake/[token]/route.ts, apps/web/app/(admin)/admin/intake/*, apps/web/lib/ad-engine/*.

Safest fix: map paid order -> intake row -> notification -> admin review in test mode; add missing idempotent link if needed.

Risk of fix: medium-high.

Approval needed: yes.

### 16. Admin Navigation / Feature Exposure Audit

What is wrong: many admin modules exist but may not be in nav or may be experimental.

Why it matters: operators may miss queues or hit broken pages.

Files: apps/web/app/(admin)/admin-nav.tsx, apps/web/app/(admin)/admin/*.

Safest fix: after typecheck, compare routes to nav and label/guard experimental modules.

Risk of fix: low-medium.

Approval needed: yes.

### 17. Review Vercel Cron Safety

What is wrong: apps/web/vercel.json schedules many automation/agent endpoints.

Why it matters: deploy can trigger live automation.

Files: apps/web/vercel.json, automation/agent/Facebook cron routes.

Safest fix: verify cron secrets, feature flags, dry-run/shadow modes, and idempotency.

Risk of fix: high if wrong; low for review.

Approval needed: yes.

## LOW

### 18. Clarify Mobile App Scope

What is wrong: apps/mobile exists but may be secondary/stale.

Why it matters: unclear launch responsibility.

Files: apps/mobile/*.

Safest fix: decide whether mobile participates in validation/deploy.

Risk of fix: low.

Approval needed: no for documentation, yes for code.

### 19. Refresh Documentation After Truth Is Established

What is wrong: docs and migration notes may not match current code.

Why it matters: stale operator runbooks create mistakes.

Files: AGENT_SYSTEM_SUMMARY.txt, TERRITORY_SYSTEM_DEPLOYMENT.md, docs/*, _migration_lock/*.

Safest fix: update docs only after build/schema/payment truth is established.

Risk of fix: low.

Approval needed: yes for edits.

### 20. Clean Generated Artifacts

What is wrong: generated/cache/runtime dirs exist in workspace.

Why it matters: noisy audits and stale state.

Files/dirs: node_modules, .turbo, apps/web/.next, apps/web/.codex-next*, _codex_runtime, _codex_checkpoints.

Safest fix: clean only in copied local dev folder after approval.

Risk of fix: low if copied/backed up.

Approval needed: yes.