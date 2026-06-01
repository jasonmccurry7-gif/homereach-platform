# Changeset Inventory And Stabilization Plan

Generated: 2026-05-20

Branch: `codex/launch-control-20260511`

Scope: current dirty workspace after re-baseline. No secrets are included in this report.

## Current Validation Baseline

Latest known local validation:

- `.\_codex_runtime\bin\pnpm.cmd type-check` passed.
- `.\_codex_runtime\bin\pnpm.cmd lint` passed with warnings only.
- `.\_codex_runtime\bin\pnpm.cmd build` passed using ignored local placeholder env values.
- Dev smoke routes `/`, `/login`, and `/get-started` returned HTTP 200.
- `/api/admin/health` returned HTTP 401, consistent with protected admin access.

See `CURRENT_REBASELINE_REPORT.md` for details.

## Workspace Shape

The workspace contains broad product work, not a single focused patch.

Observed tracked diff:

- 185 tracked files changed.
- Approximately 6,001 insertions and 4,957 deletions in tracked files.
- Largest tracked diffs touch political candidate chat/recommendations, homepage, Stripe webhook, funnel queries, checkout, admin dashboard, outreach services, and package/database exports.

Untracked work is dominated by:

- web API routes
- web libraries
- web app routes
- web components
- audit/report docs
- Supabase migrations
- DB package schema additions

Generated/local artifact directories were added to `.gitignore`:

- `apps/web/.codex-next*/`
- `_codex_runtime/`
- `_codex_checkpoints/`
- `.hotfix-tree/`
- `.tools/`
- `output`

Nothing was deleted.

## Production-Critical Touchpoints

These areas need careful review before deployment:

- Stripe checkout and webhook handling:
  - `apps/web/app/api/stripe/checkout/route.ts`
  - `apps/web/app/api/stripe/targeted-checkout/route.ts`
  - `apps/web/app/api/webhooks/stripe/route.ts`
  - `packages/services/src/stripe/index.ts`

- Auth and session handling:
  - `apps/web/app/(auth)/login/*`
  - `apps/web/app/(auth)/signup/*`
  - `apps/web/app/api/auth/*`
  - `packages/services/src/auth/index.ts`
  - `apps/web/lib/supabase/server.ts`

- Supabase/database schema and migrations:
  - `packages/db/src/schema/*`
  - `packages/db/src/index.ts`
  - `supabase/migrations/*`
  - `packages/db/supabase/migrations/*`

- Webhooks and outbound messaging:
  - Facebook webhook routes
  - Postmark webhook routes
  - Twilio status webhook routes
  - `packages/services/src/outreach/*`

- Environment and deployment:
  - `.env.example`
  - `apps/web/lib/env.ts`
  - `apps/web/vercel.json`
  - `vercel.json`
  - package and lockfile changes

## Recommended Commit / Review Slices

Do not commit everything as one bundle. Use intentional slices so failures can be isolated.

### 0. Stabilization Metadata

Purpose: preserve the current re-baseline and hide local generated noise.

Candidate files:

- `.gitignore`
- `CURRENT_REBASELINE_REPORT.md`
- `CHANGESET_INVENTORY_AND_STABILIZATION_PLAN.md`

Validation after commit:

- `git status --short`

Risk: low.

### 1. Audit And Operational Reports

Purpose: preserve the completed audit/report phase outputs.

Candidate files:

- root `*_REPORT.md`, `*_AUDIT.md`, `*_MAP.md`, `*_PLAN.md`
- `docs/*`
- `OUTREACH_OWNER_ACTION_ITEMS.md`
- `PRODUCTION_DEPLOYMENT_CHECKLIST.md`

Validation:

- docs-only review.

Risk: low.

### 2. Workspace Tooling And Package Baseline

Purpose: isolate package manager, TypeScript, ESLint, Next, Vercel, and workspace config updates.

Candidate files:

- `package.json` files
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `tsconfig.json`
- `apps/*/tsconfig*`
- `apps/*/eslint.config.mjs`
- `apps/web/next.config.ts`
- `apps/web/vercel.json`
- `vercel.json`

Validation:

- `.\_codex_runtime\bin\pnpm.cmd type-check`
- `.\_codex_runtime\bin\pnpm.cmd lint`
- `.\_codex_runtime\bin\pnpm.cmd build`

Risk: medium.

### 3. Database Schema And Migration Baseline

Purpose: isolate DB package exports, schema additions, SQL migrations, and seed files.

Candidate files:

- `packages/db/src/**`
- `packages/db/scripts/**`
- `supabase/migrations/**`
- `supabase/seeds/**`
- `supabase/inspection/**`
- `packages/db/supabase/migrations/**`

Required before production:

- Confirm canonical migration root.
- Compare local migration list against remote Supabase migration history.
- Do not run remote migration commands blindly.

Validation:

- `.\_codex_runtime\bin\pnpm.cmd type-check`
- SQL review for idempotency, rollback safety, and RLS behavior.

Risk: high.

### 4. Core Platform, Env, Auth, And Supabase Runtime

Purpose: isolate runtime safety, env validation, auth callbacks, Supabase server utilities, and shared service exports.

Candidate files:

- `.env.example`
- `apps/web/lib/env.ts`
- `apps/web/lib/supabase/server.ts`
- `apps/web/app/api/auth/**`
- `apps/web/app/(auth)/**`
- `packages/services/src/auth/**`
- `packages/services/src/index.ts`
- `packages/types/src/index.ts`

Validation:

- typecheck, lint, build
- login/signup manual smoke
- Supabase auth callback smoke in a non-production environment

Risk: high.

### 5. Revenue, Checkout, Stripe, And Funnel

Purpose: isolate money-flow and lead/intake flow changes.

Candidate files:

- `apps/web/app/(funnel)/**`
- `apps/web/lib/funnel/**`
- `apps/web/app/api/stripe/**`
- `apps/web/app/api/webhooks/stripe/**`
- `apps/web/app/api/spots/**`
- `apps/web/app/api/targeted*/**`
- `packages/services/src/stripe/**`
- `packages/services/src/targeted/**`

Required before production:

- Stripe test-mode checkout for each checkout path.
- Stripe webhook replay tests.
- Verify idempotency and internal order/campaign state transitions.

Validation:

- typecheck, lint, build
- Stripe test mode only

Risk: very high.

### 6. Admin, CRM, Agent, And Sales Operations

Purpose: isolate internal operations dashboard and admin APIs.

Candidate files:

- `apps/web/app/(admin)/**`
- `apps/web/app/(agent)/**`
- `apps/web/app/api/admin/**`
- `apps/web/app/api/agent/**`
- `apps/web/lib/sales-engine/**`
- `apps/web/lib/admin/**`

Validation:

- typecheck, lint, build
- manual protected-route smoke after login
- role/access review

Risk: medium to high.

### 7. Public Marketing, HomeReach OS, Advertise, And Targeted Pages

Purpose: isolate public page/UI work.

Candidate files:

- `apps/web/app/page.tsx`
- `apps/web/app/advertise/**`
- `apps/web/app/targeted/**`
- `apps/web/app/os/**`
- `apps/web/app/how-it-works/**`
- `apps/web/app/nonprofit/**`
- `apps/web/components/marketing/**`
- `apps/web/components/homereach-os/**`
- `apps/web/public/icons/**`
- `apps/web/public/favicon.svg`

Validation:

- typecheck, lint, build
- responsive/manual browser smoke on primary public routes

Risk: medium.

### 8. Political Mail And Candidate Intelligence

Purpose: isolate political command center, maps, candidate agent, import/data acquisition, and presentation work.

Candidate files:

- `apps/web/app/political/**`
- `apps/web/app/(admin)/admin/political/**`
- `apps/web/app/api/political/**`
- `apps/web/lib/political/**`
- `apps/web/public/political/**`
- political docs and SQL migrations

Validation:

- typecheck, lint, build
- public political route smoke
- admin political route smoke after login
- data acquisition providers reviewed for rate limits and keys

Risk: high.

### 9. Growth OS, Operations Copilot, Procurement, And Intelligence Modules

Purpose: isolate major additive product modules.

Candidate files:

- `apps/web/app/growth-os/**`
- `apps/web/components/growth-os/**`
- `apps/web/lib/growth-os/**`
- `apps/web/app/operations-copilot/**`
- `apps/web/components/operations-copilot/**`
- `apps/web/lib/operations-copilot/**`
- procurement, inventory, price intelligence, content-intel, lead-intel, QA, Canva, gov-contracts, AI intake, SEO modules

Validation:

- typecheck, lint, build
- feature-flag review
- DB migration review
- manual route smoke by module

Risk: medium to high.

## Immediate Next Safe Action

The safest next step is to create the low-risk stabilization commit first, containing only:

- `.gitignore`
- `CURRENT_REBASELINE_REPORT.md`
- `CHANGESET_INVENTORY_AND_STABILIZATION_PLAN.md`

After that, proceed through the review slices above, running validation after each slice.
