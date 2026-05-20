# New Laptop Health Check

Generated: 2026-05-09

Scope: local/static inspection. No installs, builds, dependency downloads, DB connections, or provider calls were run.

## Overall Status

Not ready to run in the current folder. Move or copy the repo out of OneDrive and hydrate all files before installing dependencies or building.

## Missing Tools

Found on PATH:

- node.exe from Codex bundled runtime.
- git.exe from system Git.

Not found on PATH:

- pnpm
- npm
- corepack
- supabase
- vercel

Needed:

- System Node.js LTS 20 or 22.
- pnpm 9.15.0.
- Supabase CLI for migration/status validation.
- Vercel CLI later for deployment checks.

## Missing Packages / Install State

node_modules exists, but should not be trusted after a laptop move and OneDrive sync. pnpm is not available to verify the install.

Recommended later after approval and after moving out of OneDrive:

1. Remove node_modules and caches in the copied local dev folder.
2. Run pnpm install --frozen-lockfile.
3. Typecheck before dev/build.

## OS / Path Issues

Current path:

```text
C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach
```

The spaces are manageable, but OneDrive is not recommended for active Node/Next development.

## OneDrive Sync Risks

Confirmed issue: file reads encountered cloud operation failures earlier in inspection. That means some files may be cloud-only, locked, partially hydrated, or sync-broken.

Risk impact:

- False install/build failures.
- Corrupt or missing generated files.
- Slow or broken file watching.
- EPERM/lock/cloud errors during Next/Turbo.

Recommendation: use C:\Dev\homereach or another non-synced folder.

## node_modules Risks

Existing node_modules may contain stale machine-specific binaries and pnpm store links from the old laptop. It may also be affected by OneDrive sync/link behavior.

Do not delete yet in this folder. Clean it only after approval, preferably in the moved/copied local dev folder.

## Build Cache Risks

Generated/cache directories observed:

- apps/web/.next
- apps/web/.codex-next
- apps/web/.codex-next-smoke
- .turbo
- _codex_runtime
- _codex_checkpoints
- node_modules

These should not be treated as evidence that the app builds. Clean later after approval.

## File Watcher Risks

Next.js and Turbo can behave poorly under OneDrive due to file locks, cloud hydration, sync/indexer churn, and large dependency trees. Active development should happen outside OneDrive.

## Git Status

Branch:

- main tracking origin/main.

Worktree:

- Very dirty.
- Hundreds of modified tracked files.
- Many untracked files/directories including docs, supabase, political/QA/content-intel additions, generated caches, runtime folders, and schema additions.

No changes were reverted or deleted.

## Uncommitted Changes

Treat all existing changes as user or migration work. Before repair work, create a checkpoint branch or backup copy and decide what should be committed, ignored, or archived.

## Lockfile / Package Manager Mismatch

- pnpm-lock.yaml exists.
- package-lock.json not found.
- yarn.lock not found.
- packageManager is pnpm@9.15.0.

Use pnpm only.

## Known TypeScript Errors

_existing _codex_runtime/web-typecheck-errors.txt shows errors including:

- Undefined rows in admin bundles/businesses/orders/products pages.
- Missing memberships/slots in admin founding page.
- Duplicate React identifier in admin migration client.
- agentProfiles possibly null in admin war-room page.
- standardPrice/foundingPrice used before declaration in intelligence checkout.
- app/waitlist/page.tsx imports non-existent orderBy from drizzle-orm.

More errors may appear after clean install.

## Schema / Package Health Risks

- packages/db/src/schema/index.ts omits many schema exports used by app code.
- packages/db/package.json does not export @homereach/db/schema, but code imports it.
- This likely blocks typecheck/build.

## Recommended Cleanup Sequence Later

After approval:

1. Copy/move repo out of OneDrive.
2. Confirm files are hydrated.
3. Create backup/checkpoint branch or archive.
4. Remove generated caches and node_modules in local copy.
5. Install Node/pnpm.
6. pnpm install --frozen-lockfile.
7. Run typecheck.
8. Fix errors in small batches.
9. Run build/dev validation.