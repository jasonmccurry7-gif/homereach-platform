# Deployment Map

Audit date: 2026-05-10

## Platform

- Hosting target: Vercel
- Framework: Next.js
- Build command from root `vercel.json`: `pnpm turbo run build --filter=@homereach/web...`
- Output directory: `apps/web/.next`
- Install command: `pnpm install`
- Dev command: `pnpm turbo run dev --filter=@homereach/web...`

## App-Level Vercel Config

`apps/web/vercel.json` defines 11 crons:

| Path | Schedule |
| --- | --- |
| `/api/admin/automation/send-due` | `0 9,12,15 * * *` |
| `/api/admin/agents/echo` | `0 8,11,14 * * 1-5` |
| `/api/admin/agents/closer` | `0 10,16 * * 1-5` |
| `/api/admin/agents/anchor` | `0 9 * * 1` |
| `/api/admin/system/agents/kaizen` | `0 6 * * *` |
| `/api/admin/system/agents/pulse` | `*/30 * * * *` |
| `/api/admin/system/agents/ledger` | `0 7 * * *` |
| `/api/admin/system/agents/prospector` | `0 5 * * *` |
| `/api/admin/agents/scraper` | `0 */3 * * *` |
| `/api/admin/sales/power-mode/end-of-day` | `30 17 * * 1-5` |
| `/api/facebook/followup` | `0 9,13,17 * * *` |

## Next Config

Git-backed repo currently has:

- `transpilePackages`: `@homereach/db`, `@homereach/services`, `@homereach/types`
- Supabase storage image remote pattern
- deprecated `experimental.serverComponentsExternalPackages`

Validated copy required:

- `serverExternalPackages: ["postgres"]`
- webpack extension aliases for workspace TS packages with NodeNext-style `.js` imports

## Deployment Blockers

1. Git-backed repo is inside OneDrive.
2. Git-backed repo is dirty with 473 changed/untracked entries.
3. Git-backed repo does not currently include all validated fixes.
4. `apps/web/package.json` still uses `next lint`, which is removed/deprecated in modern Next; validated copy changed to `eslint .`.
5. DB schema exports are incomplete.
6. Admin API auth is inconsistent.
7. Env templates are incomplete relative to source references.

## Validated Local State

In `C:\Dev\homereach-validation-src-20260509`:

- install passed
- web typecheck passed
- web lint passed with warnings
- web build passed
- dev server ran at `http://127.0.0.1:3000`
- smoke tests passed for homepage, funnel, targeted, intelligence, login, protected redirects, city/category, spots resolver

## Safe Deployment Sequence

1. Create a clean git-backed local working copy outside OneDrive.
2. Promote validated fixes into that copy.
3. Run clean install.
4. Run typecheck/lint/build.
5. Run non-destructive browser smoke tests.
6. Validate env completeness without printing values.
7. Validate Supabase schema remotely with read-only introspection.
8. Validate Stripe in test mode only.
9. Validate Twilio/Postmark test callbacks.
10. Deploy preview.
11. Smoke-test preview.
12. Promote production only after rollback plan exists.

