# Bugs And Failure Points

Audit date: 2026-05-10

## Critical

### Git-Backed Repo Does Not Match Validated Copy

The validation copy builds after fixes. The git-backed OneDrive repo still contains old package exports/config and must not be deployed as-is.

Files implicated:

- `packages/db/src/schema/index.ts`
- `packages/db/package.json`
- `packages/services/package.json`
- `packages/types/src/index.ts`
- `apps/web/package.json`
- `apps/web/next.config.ts`

### Admin APIs Need Route-Level Auth

Middleware protects `/admin`, not `/api/admin`. This can expose protected admin mutations if handlers do not check auth themselves.

### DB Schema Export Drift

Newer schema files exist but are not exported by `packages/db/src/schema/index.ts`.

Symptoms:

- imports from `@homereach/db` fail
- build/typecheck fails
- route handlers using newer tables break

### Duplicate Drizzle Enum Symbols

Duplicate exports:

- `campaignStatusEnum`
- `spotTypeEnum`

This can break barrel exports and TypeScript compile.

### Nonprofit Endpoint Mismatch

`/api/nonprofit` imports `publicNonprofitApplications`, but source schema exposes `nonprofitApplications` with a business-linked table shape. Public application payload does not align with that schema.

Impact: public nonprofit applications can fail to persist while user receives apparent success.

## High

### Spot Availability Source-Of-Truth Split

Funnel availability uses paid/active `orders`; availability API uses `spot_assignments`; checkout creates `orders`. This can oversell or misreport scarcity if not reconciled.

### Political Payment Reconciliation Gap

Political payment success depends on success redirect. If user pays and closes tab before redirect, order can remain pending.

### Email Provider Fragmentation

Code references Mailgun, Resend, and Postmark. A clear production send provider and webhook observability plan is missing.

### Cron Endpoints Inconsistent

Different auth headers and fail-open behavior exist across scheduled routes.

### Next/Lint Config Drift

`apps/web/package.json` uses `next lint`; validated copy had to switch to ESLint flat config.

### Next Config Deprecated Field

`experimental.serverComponentsExternalPackages` is deprecated/replaced by `serverExternalPackages`.

## Medium

### Generated Artifacts In Worktree

`.hotfix-tree`, `_codex_runtime`, `_codex_checkpoints`, `.codex-next*`, caches and empty marker files are present.

### Mobile App Deferred

Mobile app is present but explicitly deferred.

### TODO/Placeholder Modules

Known incomplete systems:

- political crawler execution
- political approved staging promotion
- political refresh payment status admin button
- content/SEO block placeholders
- Postmark send router not fully wired
- pricing city profile TODOs

### Lint Warnings Remain In Validated Copy

Lint passes only after relaxing several legacy rules. Warnings remain and should be reduced after stabilization.

## Immediate Fix Order

1. Establish clean git-backed local copy outside OneDrive.
2. Promote validated build/type fixes.
3. Add admin API auth guards.
4. Reconcile db schema exports/migrations.
5. Reconcile spot availability source of truth.
6. Add payment/webhook idempotency and political payment webhook reconciliation.

