# Current Main Stabilization Report

Updated: 2026-05-24 21:55 ET

## Scope

This report covers the fresh `origin/main` worktree:

```text
C:\Dev\homereach-current-main-20260524
```

Branch:

```text
codex/current-main-audit-20260524
```

Remote base:

```text
origin/main @ 1c8eaa7
```

## Executive Status

Current `origin/main` has been brought back to a validated local candidate state.

Passing gates:

- `pnpm install --frozen-lockfile`
- `pnpm test`
- `pnpm exec turbo type-check --ui=stream`
- `pnpm --filter @homereach/web lint`
- `pnpm --filter @homereach/web build` with placeholder, non-secret env values
- Read-only dev smoke checks for primary revenue, intake, targeted, procurement, and political routes

Known advisory debt:

- `pnpm --filter @homereach/web lint` now runs through ESLint CLI and exits successfully, but reports pre-existing warning debt.

GitHub status:

- GitHub CLI is installed.
- `gh auth status` still reports no authenticated GitHub host in this shell.
- The branch has been pushed with Git credentials.
- Draft PR opened through the GitHub connector: https://github.com/jasonmccurry7-gif/homereach-platform/pull/7

## What Changed

The current-main stabilization work ports the previously validated repair set onto the latest remote system:

- Added package-level typecheck stability for React 19 type packages.
- Added a scoped mobile `tsconfig.json` so Expo/mobile does not typecheck unrelated workspace files.
- Fixed DB package TypeScript configuration so `drizzle.config.ts` is within the package program.
- Switched DB and services packages to bundler-compatible module resolution for workspace source imports.
- Made the shared Drizzle DB client lazy so importing `@homereach/db` does not require DB env at build/import time.
- Made the shared Stripe client lazy so importing services does not require `STRIPE_SECRET_KEY` at build/import time.
- Added `csv-parse` and fixed ingestion parser import/type issues.
- Fixed duplicate Drizzle enum export naming for spot assignment `spot_type`.
- Fixed the pricing profile partial-index schema expression.
- Ported validated TypeScript repairs across admin pages, Supabase route handlers, Facebook/Postgrest calls, Stripe API versions, engine types, legacy import types, and ad-engine export typing.
- Replaced deprecated interactive `next lint` usage with a committed ESLint CLI config.
- Renamed the DB factory mock selector helper so React hook linting no longer misclassifies it as a hook.
- Added a root Vitest unit-test gate and wired the existing pricing/political test suites into `pnpm test`.
- Fixed the pricing unit-test harness so it mocks `@homereach/db/schema` instead of loading the live Drizzle schema graph.
- Added `.github/workflows/validate.yml` so PRs run the same install, test, typecheck, lint, and build gates in GitHub Actions.
- Hardened middleware protection for `/api/admin/*`:
  - unauthenticated admin API requests return `401`
  - non-admin disallowed API requests return `403`
  - cron APIs can pass with an allowed cron secret
  - sales agent API access is limited to explicit prefixes

## Validation Results

Install:

```powershell
pnpm install --frozen-lockfile
```

Result: passed.

Unit tests:

```powershell
pnpm test
```

Result: passed, 4 test files and 96 tests successful.

Typecheck:

```powershell
pnpm exec turbo type-check --ui=stream
```

Result: passed, 5 packages successful.

Build:

```powershell
pnpm --filter @homereach/web build
```

Result: passed with placeholder env injected into the process. Next.js generated 248 routes.

Important caveat: `apps/web/next.config.ts` still skips type validation and lint during build. Type safety is therefore enforced by the explicit Turbo typecheck gate above.

CI workflow:

```text
.github/workflows/validate.yml
```

Result: committed. First GitHub-hosted run must be observed after push.

Lint:

```powershell
pnpm --filter @homereach/web lint
```

Result: passed. ESLint reported 0 errors and 506 warnings.

Important caveat: lint is now usable as a gate, but the warning backlog should be reduced in focused passes before tightening warning policy.

## Read-Only Smoke Results

Server with local env, political disabled:

```text
http://127.0.0.1:3003
```

Passed:

- `/`
- `/inventory-purchasing`
- `/shared-postcards`
- `/get-started`
- `/get-started/cuyahoga-falls`
- `/get-started/cuyahoga-falls/hvac`
- `/spots/cuyahoga-falls/hvac`
- `/targeted/start`
- `/targeted/intake`
- `/intelligence`
- `/nonprofit`
- `/login`
- `/api/spots/resolve?citySlug=cuyahoga-falls&categorySlug=hvac`
- `/api/spots/availability?...`

Expected protected responses:

- `/dashboard` -> `307`
- `/admin` -> `307`
- `/admin/political` -> `307`
- `/api/admin/health` -> `401`

Feature-flag behavior:

- `/political`, `/political/pricing`, and `/political/maps` returned `404` when `ENABLE_POLITICAL` was disabled.

Server with `ENABLE_POLITICAL=true` and `DISABLE_POLITICAL_AI=true`:

```text
http://127.0.0.1:3004
```

Passed:

- `/political`
- `/political/pricing`
- `/political/maps`
- `/political/candidate-agent`

Expected protected responses:

- `/admin/political` -> `307`
- `/api/admin/political/intelligence/sync` -> `401`

## Current Risks

Risk level: MEDIUM until PR/CI validation and deeper workflow QA are complete.

1. Lint is now usable, but warning debt remains across admin, AI, political, and content-intelligence modules.
2. Build skips type and lint validation in Next config; explicit typecheck covers TypeScript, but the build gate itself is permissive.
3. Current local env did not enable political by default, so political production rollout depends on a deliberate `ENABLE_POLITICAL=true` environment decision.
4. The project still contains large newly added AI/political/procurement systems that have only been smoke-tested at route level, not deeply QA-tested.
5. First GitHub-hosted CI run for the new workflow must be observed and fixed if GitHub runner behavior differs from local Windows validation.
6. GitHub CLI is not authenticated, but the GitHub connector can create/manage PRs.

## Recommended Next Actions

1. Observe the first GitHub Actions run for PR #7 and repair any runner-only issues.
2. Run focused smoke/QA on the new AI workforce, procurement, political, and gov-contracts modules.
3. Validate Vercel environment variables against `apps/web/lib/env.ts`, `apps/web/lib/political/env.ts`, and integration docs.
4. Reduce lint warning debt in focused, low-risk passes.
5. Do not deploy until the PR branch has passed CI-equivalent typecheck/build and a deployment environment variable audit.
