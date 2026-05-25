# New Laptop Health Check

Updated: 2026-05-25

Scope: current active stabilization workspace at `C:\Dev\homereach-current-main-20260524`.

Safety posture: this check inspected local tools, repo state, caches, and validation readiness. It did not delete files, reset git state, mutate Supabase, call Stripe/Twilio/Postmark, or touch production data.

## Current Workspace

- Active working repo: `C:\Dev\homereach-current-main-20260524`
- Current branch: `codex/current-main-audit-20260524`
- Current pushed head: `abbb94a47d598a3151b8fff621154357d1996a2b`
- Draft PR: `https://github.com/jasonmccurry7-gif/homereach-platform/pull/7`
- The original OneDrive workspace should remain inactive for installs/builds. Active development should stay in `C:\Dev` or another local non-synced folder.

## Tooling

- Node: `v24.15.0`
- pnpm: `9.15.0`
- npm: `11.12.1`
- Git: `2.54.0.windows.1`
- Supabase CLI: `2.100.1`
- Docker: not available on PATH, and Supabase CLI cannot inspect local container health.

Repo expectations:

- `packageManager`: `pnpm@9.15.0`
- `engines.node`: `>=20.0.0`
- `engines.pnpm`: `>=9.0.0`
- GitHub Actions uses Node `20` and pnpm `9.15.0`.

Risk:

- Local Node 24 satisfies the declared engine range, but it is not CI parity. Prefer Node 20 LTS for day-to-day validation if using `nvm-windows`, Volta, fnm, or another version manager.
- Docker absence blocks local Supabase database start/reset/migration validation.

## Packages And Caches

Present:

- Root `node_modules`
- `apps/web/node_modules`
- `apps/web/.next`
- `apps/web/.turbo`

Observed validation:

- Full unit tests, typecheck, lint, and placeholder-env build have passed repeatedly in this `C:\Dev` workspace.
- GitHub Actions `Validate` has passed through run #59 on the current PR lane.
- Vercel previews have reached `READY` through deployment `dpl_2m2WgkQwPqj2cMFT8iQ4oTXXkB17`.

Risk:

- Existing `.next` and `.turbo` caches are safe to leave while validation remains green.
- If unexplained build or type artifacts appear, clear only local generated caches (`apps/web/.next`, `apps/web/.turbo`, Turbo cache) after confirming the worktree is clean. Do not delete source, migrations, reports, or untracked reference patches.

## Git State

Current expected state after the latest push:

- Branch tracks `origin/codex/current-main-audit-20260524`.
- Only two untracked local reference patch files remain:
  - `PORT_VALIDATED_TYPEFIXES_20260524.patch`
  - `REFERENCE_STABILIZATION_CANDIDATE_DIFF_20260524.patch`

Do not delete these patch artifacts without an explicit cleanup decision. They are intentionally preserved.

## Supabase Local Validation Blocker

Supabase CLI is installed, but local validation is blocked:

- `supabase migration list --local` attempted to connect to `127.0.0.1:54322` and failed because local Postgres is not running.
- `supabase status` failed because Docker is not installed/available/running.
- `docker version` failed because `docker` is not recognized on PATH.

Impact:

- The local migration proposal at `supabase/migrations/20260525175220_property_intelligence_schema_alignment.sql` has not been applied to a local Supabase database.
- The migration proposal is committed and CI/Vercel green, but SQL execution still needs isolated Supabase branch/local validation before any production DDL.

Recommended next step:

- Install and start Docker Desktop, then run Supabase local validation from `C:\Dev\homereach-current-main-20260524` only.
- Alternatively, create a Supabase development branch and validate the migration there before production.

## OneDrive Risk

The original project path provided by the user is inside OneDrive:

`C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach`

Risk:

- OneDrive can lock, sync, rewrite, or partially hydrate files while package managers, Next.js, TypeScript, and file watchers are active.
- Do not run dependency installs, Next builds, Supabase local services, or dev servers from the OneDrive copy.
- Keep OneDrive as archive/reference only unless intentionally copying files out.

## Safe Commands From This Workspace

Use:

```powershell
pnpm install --frozen-lockfile
pnpm test
pnpm exec turbo type-check --ui=stream
pnpm --filter @homereach/web lint
pnpm --filter @homereach/web build
```

For build commands, keep using non-secret placeholder env values unless intentionally validating a local `.env` profile. Never print or paste secret values into reports.

## Current Readiness

Ready:

- Node/pnpm install and app validation in the `C:\Dev` workspace.
- GitHub/Vercel PR validation.
- Read-only Supabase metadata inspection through the connector.

Blocked:

- Local Supabase migration execution and reset testing until Docker/local Supabase is available.
- Production provider validation until isolated test-mode flows and schema repair are complete.

Not allowed without controlled rollout:

- Applying live Supabase DDL.
- Replaying Stripe production webhooks.
- Creating live Stripe charges/sessions outside test mode.
- Sending Twilio/email/social messages.
- Promoting this PR to production.
