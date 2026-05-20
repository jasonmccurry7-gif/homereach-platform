# Current Workspace Re-Baseline Report

Generated: 2026-05-20

Scope: current OneDrive workspace at `C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach`.

No secrets are included in this report.

## Summary

The current workspace has been re-baselined after the prior phase reports. The audit reports exist through Phase 8, and the current codebase now passes typecheck, lint, and production build locally.

The repo remains very dirty, with hundreds of modified and untracked files. Treat all current changes as important until they are reviewed and intentionally committed or split.

## Validation Results

Passed:

```powershell
.\_codex_runtime\bin\pnpm.cmd type-check
```

Result: all five workspace packages typechecked successfully:

- `@homereach/db`
- `@homereach/mobile`
- `@homereach/services`
- `@homereach/types`
- `@homereach/web`

Passed with warnings:

```powershell
.\_codex_runtime\bin\pnpm.cmd lint
```

Result: lint completed with warnings only. The warning set is large and mostly consists of:

- unused variables
- explicit `any`
- unescaped JSX text
- a few Next.js `<a>` vs `<Link>` warnings
- a few React hook dependency warnings

Passed:

```powershell
.\_codex_runtime\bin\pnpm.cmd build
```

Result: the web production build completed successfully after local environment placeholders were added.

## Fixes Applied During Re-Baseline

Code fix:

- `apps/web/lib/gov-contracts/scoring.ts`
  - Fixed a strict TypeScript indexed-access error in `recommendedActionFor`.
  - The code now guards the first missing item before calling `.toLowerCase()`.

Local environment fix:

- `apps/web/.env.local`
  - Set `ADMIN_DEV_BYPASS=false` so production builds do not fail the safety gate.
  - Added local-only placeholder values for owner/outbound email settings required by the production build.
  - Set the Postmark webhook flag off locally so Postmark webhook credentials are not required for build validation.

These local env edits are ignored by Git and are not production credentials.

## Dev Server Smoke Test

Started the web dev server at:

```text
http://localhost:3000
```

Smoke routes:

- `/` returned HTTP 200
- `/login` returned HTTP 200
- `/get-started` returned HTTP 200
- `/api/admin/health` returned HTTP 401, consistent with protected admin access rather than a server crash

## Production Caveats

The successful local build used placeholder values in `apps/web/.env.local`. Before production deployment, real values must be confirmed in Vercel or the target runtime environment for:

- owner/outbound identity
- default from/reply-to emails
- selected email provider credentials
- webhook credentials if Postmark webhook handling is enabled
- Supabase, Stripe, Twilio, and database credentials

Do not treat local placeholder build success as proof that production environment variables are complete.

## Current Risk

The largest remaining risk is repository state, not the compiler:

- The workspace has hundreds of modified/untracked files.
- The project is still in OneDrive, which remains a risk for installs, watchers, caches, and generated output.
- Lint warnings are not currently blocking, but the volume makes real regressions harder to notice.

Recommended next step: review and group the current changes into intentional commit scopes before any production deployment.
