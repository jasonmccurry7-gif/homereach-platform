# HomeReach System Master Map

Audit date: 2026-05-10

This is the current operational map of the HomeReach repository as inspected on disk. No secret values are included.

## Repository Identity

- Root: `C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach`
- Branch: `main`
- Git state at inspection: 473 changed or untracked entries
- Active validation copy: `C:\Dev\homereach-validation-src-20260509`
- Package manager: `pnpm@9.15.0`
- Runtime requirement: Node `>=20.0.0`
- Monorepo runner: Turbo
- App count: 2 (`apps/web`, `apps/mobile`)
- Shared package count: 3 (`packages/db`, `packages/services`, `packages/types`)
- App Router page routes discovered: 107
- API route handlers discovered: 148
- Drizzle schema tables exported in source: 50
- Vercel cron entries discovered: 11

## Top-Level Directory Map

| Path | Purpose | Risk notes |
| --- | --- | --- |
| `.git` | Git history | Repo is dirty and inside OneDrive. Do not deploy from this state. |
| `.hotfix-tree` | Prior repair/checkpoint tree | Generated/support artifact. Review before keeping. |
| `.turbo` | Turbo cache | Build cache. Can be stale; cleanup requires explicit backup/approval. |
| `apps/web` | Primary Next.js revenue platform | Main production surface. |
| `apps/mobile` | Expo/mobile placeholder | Marked as not ready until web is stable. |
| `packages/db` | Drizzle schemas, db client, old Supabase migrations, validation scripts | Schema index is incomplete in the git-backed repo. |
| `packages/services` | Stripe, outreach, auth, pricing, targeted services | Exports and provider wiring need stabilization. |
| `packages/types` | Shared business/type contracts | Missing pricing export in git-backed repo. |
| `supabase` | Newer Supabase migrations, seeds, inspection SQL | Separate migration stream from `packages/db/supabase`; needs reconciliation. |
| `docs` | Political operator docs and CSV/import guides | Useful and partially current. |
| `_codex_checkpoints`, `_codex_runtime`, `_migration_lock` | Generated validation/runtime artifacts | Should not be production inputs. |
| `node_modules` | Installed dependencies | OneDrive traversal errors observed. Active development should move out of OneDrive. |

## Applications

| App | Stack | Status |
| --- | --- | --- |
| `apps/web` | Next.js App Router, React, TypeScript, Tailwind, Supabase, Stripe, Twilio/email integrations | Primary platform. Local validation copy builds and runs after repairs. Git-backed repo still has unresolved breakpoints. |
| `apps/mobile` | Expo Router, React Native | Placeholder. `apps/mobile/app/index.tsx` says Phase 7 and not build until web is stable. |

## Shared Packages

| Package | Responsibility | Current issue |
| --- | --- | --- |
| `@homereach/db` | Drizzle db client, schema exports, migrations, seed/validation scripts | `src/schema/index.ts` exports only an older subset. Many live modules import newer symbols not exported. |
| `@homereach/services` | Stripe checkout/webhook helpers, Twilio/Resend outreach, auth helpers, pricing, targeted | Package exports omit `./targeted` in git-backed repo. Email provider story is split across Resend, Mailgun, and Postmark. |
| `@homereach/types` | Shared application types | Pricing types are present but not exported from `src/index.ts` in the git-backed repo. |

## Primary Feature Surfaces

- Public marketing: `/`, `/:slug`, `/advertise/*`, SEO pages, sitemap/robots.
- Funnel/revenue: `/get-started`, `/get-started/:citySlug`, `/get-started/:citySlug/:categorySlug`, checkout pages, `/spots/:citySlug/:categorySlug`.
- Targeted route campaign: `/targeted`, `/targeted/start`, `/targeted/intake`, `/targeted/checkout`, `/targeted/confirmed`, `/targeted/:citySlug`.
- Intelligence product: `/intelligence`, `/intelligence/checkout`.
- Auth: `/login`, `/signup`, `/forgot-password`, `/reset-password`, Supabase callback/signout APIs.
- Client dashboard: `/dashboard`, `/billing`, `/campaign`, `/replies`, `/settings`.
- Admin dashboard: `/admin` plus CRM, leads, intake, spots, pricing, sales, political, QA, content intel, agents, operator, migration.
- Agent portal: `/agent` plus leads, replies, hot leads, activity, QA, account.
- Political: `/political`, `/political/plan`, `/political/thanks`, `/admin/political/*`, `/p/:token`, `/c/:token`.
- Webhooks: Stripe, Twilio inbound/status, Postmark, Facebook.
- Automation: Vercel crons, admin automation send-due, content/lead intel crons, sales/agent crons.

## Route Inventory Summary

Public/customer routes include:

- `/`
- `/:slug`
- `/get-started`
- `/get-started/:citySlug`
- `/get-started/:citySlug/:categorySlug`
- `/get-started/:citySlug/:categorySlug/checkout`
- `/spots/:citySlug/:categorySlug`
- `/targeted`, `/targeted/start`, `/targeted/intake`, `/targeted/checkout`, `/targeted/confirmed`, `/targeted/:citySlug`
- `/intelligence`, `/intelligence/checkout`
- `/political`, `/political/plan`, `/political/thanks`
- `/p/:token`, `/c/:token`
- `/nonprofit`, `/waitlist`, `/refer`, `/privacy`, `/terms`, `/how-it-works`

Protected page groups include:

- `/dashboard`, `/billing`, `/campaign`, `/replies`, `/settings`
- `/admin/*`
- `/agent/*`

Important note: middleware currently protects `/admin` and `/dashboard` page routes, but not `/api/admin/*` by path. Every admin API must enforce auth/role internally.

## API Inventory Summary

148 `route.ts` handlers were discovered under `apps/web/app/api`.

Major API groups:

- `/api/admin/agents/*`
- `/api/admin/alerts/*`
- `/api/admin/automation/*`
- `/api/admin/content-intel/*`
- `/api/admin/crm/*`
- `/api/admin/email/warmup/*`
- `/api/admin/facebook`
- `/api/admin/founding/*`
- `/api/admin/intake/*`
- `/api/admin/lead-intel/*`
- `/api/admin/operator/*`
- `/api/admin/pricing/*`
- `/api/admin/qa/*`
- `/api/admin/sales/*`
- `/api/admin/seo-engine/*`
- `/api/admin/spots/*`
- `/api/admin/system/*`
- `/api/agent/*`
- `/api/auth/*`
- `/api/conversations/*`
- `/api/facebook/*`
- `/api/intake/:token`
- `/api/intelligence/checkout`
- `/api/nonprofit`
- `/api/spots/*`
- `/api/stripe/*`
- `/api/targeted*`
- `/api/waitlist`
- `/api/webhooks/*`

## Known Generated/Artifact Files

- `60`
- `output`
- `.hotfix-tree/*`
- `_codex_runtime/*`
- `_codex_checkpoints/*`
- `apps/web/.codex-next*`
- `apps/web/.next`
- `.turbo`

These should not be treated as source of truth for production.

## Current Operational Position

The local validation copy is proven runnable after targeted repairs. The git-backed OneDrive repo still needs the validated fixes promoted into a clean local git worktree before code stabilization continues.

