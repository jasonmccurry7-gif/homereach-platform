# HomeReach Architecture

Audit date: 2026-05-10

## High-Level Shape

HomeReach is a pnpm/turbo monorepo. The production platform is a Next.js App Router app with Supabase/Postgres as the system of record, Stripe for payment flows, Twilio for SMS, email providers for notification/outreach, and Vercel for hosting and cron execution.

```text
Browser / Client
  -> Next.js App Router pages and client components
  -> Next.js route handlers and server actions
  -> Supabase Auth / Supabase Postgres / Drizzle
  -> Stripe, Twilio, Postmark/Mailgun/Resend, Facebook, FEC/OpenFEC, AI providers
  -> Vercel deployment and scheduled cron calls
```

## Monorepo Boundaries

| Boundary | Source path | Role |
| --- | --- | --- |
| Web app | `apps/web` | Main product, dashboards, funnels, APIs, webhooks. |
| Mobile app | `apps/mobile` | Expo shell, deferred. |
| DB package | `packages/db` | Postgres connection, Drizzle schema, migrations, validation scripts. |
| Services package | `packages/services` | Stripe, outreach, auth, pricing, targeted helpers. |
| Types package | `packages/types` | Shared contract types. |

## Runtime Boundaries

| Runtime | Used by | Notes |
| --- | --- | --- |
| Browser/client | Client components, form UIs, dashboards | Must never import service role, `postgres`, Twilio, Stripe secret, or server-only env. |
| Server Components | Dashboard/funnel pages, protected layouts | Can read Supabase session and query server data. |
| Route handlers | `/api/*` endpoints | Must enforce auth/role/provider signatures explicitly. |
| Server actions | Political/admin actions, auth signout | Must validate role and feature flags. |
| Vercel cron | configured in `apps/web/vercel.json` | Must require shared secrets and fail closed. |

## Data Architecture

There are two DB access patterns:

- Drizzle via `@homereach/db` using `DATABASE_URL_POOLED` for app queries and `DATABASE_URL` for migrations.
- Supabase JS clients:
  - browser anon client
  - server cookie/session client
  - service role client for admin, webhooks, and cron

This split is workable, but it raises consistency risk: Drizzle source schema, Supabase migration SQL, and actual remote DB can drift.

## Auth Architecture

- Supabase Auth manages user identity and cookies.
- `profiles.role` stores role.
- Middleware reads `user.app_metadata.user_role`.
- Protected page routes:
  - `/admin/*` requires role `admin`
  - `/dashboard/*` requires authenticated user
- `ADMIN_EMAILS` is also used by helper code to classify admins.

Critical gap: middleware does not protect `/api/admin/*`. Admin API handlers must enforce role themselves.

## Revenue Architecture

Revenue flows are split:

- Spot/funnel checkout:
  - city/category/bundle chosen
  - pending business/order/spot reservation created
  - Stripe Checkout session created
  - Stripe webhook marks paid/active and creates marketing campaign
- Targeted route checkout:
  - targeted campaign created
  - Stripe Checkout session created
  - targeted campaign session id saved
- Political proposal checkout:
  - proposal approves to order/contract
  - Stripe Checkout launched from public proposal page
  - return page reconciles payment

Political payment reconciliation currently depends on success redirect, not a dedicated webhook.

## Integration Architecture

| Integration | Usage |
| --- | --- |
| Supabase | Auth, Postgres, RLS, service-role admin operations. |
| Stripe | Spot checkout, targeted checkout, intelligence checkout, political checkout, webhooks. |
| Twilio | SMS sends, inbound SMS webhook, status callback observability. |
| Mailgun | Existing sales/admin email sends and bounce import. |
| Postmark | Webhook observability and optional future sending. |
| Resend | `packages/services/outreach` email abstraction currently sends via Resend. |
| Facebook/Meta | Webhooks, Messenger/reply automation, sales alerts. |
| FEC/OpenFEC | Political candidate/committee ingestion. |
| Anthropic/OpenAI | QA, content intel, SEO drafting, political assistant, conversation intent fallback. |
| Vercel | App hosting and cron. |

## Critical Architectural Risks

1. Git-backed repo and validated copy diverge. The validated copy passes typecheck/lint/build; the OneDrive repo still shows old package exports/config.
2. OneDrive is corrupting dependency traversal and file watcher reliability.
3. DB schema is split across `packages/db/supabase/migrations` and root `supabase/migrations`.
4. API auth is not uniformly centralized.
5. Multiple email providers exist with incomplete routing policy.
6. Political payment flow lacks webhook-backed reconciliation.

