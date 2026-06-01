# API Flow Map

Audit date: 2026-05-10

148 API route handlers were discovered in `apps/web/app/api`.

## Critical API Groups

| Group | Examples | Role |
| --- | --- | --- |
| Admin agents | `/api/admin/agents/*`, `/api/admin/system/agents/*` | Automated operators and sales agents. |
| Admin automation | `/api/admin/automation/send-due`, `/api/admin/automation/enroll` | Follow-up sequencing and scheduled sends. |
| Sales/CRM | `/api/admin/sales/*`, `/api/admin/crm/*` | Lead management, call logs, alerts, close-deal flow. |
| Pricing/spots | `/api/admin/pricing/*`, `/api/admin/spots/*`, `/api/spots/*` | Inventory, pricing, availability, checkout prep. |
| Public revenue | `/api/spots/checkout`, `/api/stripe/checkout`, `/api/stripe/targeted-checkout`, `/api/intelligence/checkout` | Stripe session creation. |
| Targeted route | `/api/targeted/*` | Route-campaign lead/intake/admin state. |
| Auth | `/api/auth/callback`, `/api/auth/me`, `/api/auth/signout` | Supabase auth bridge. |
| Webhooks | `/api/webhooks/*`, `/api/facebook/webhook`, `/api/facebook/followup` | Provider callbacks. |
| QA/content/SEO | `/api/admin/qa/*`, `/api/admin/content-intel/*`, `/api/admin/seo-engine/*` | Internal knowledge and content systems. |
| Political | server actions plus route-backed public pages | Proposals/contracts/payments mostly use actions/helpers rather than `/api/admin/political/*`. |

## Protected API Risk

Middleware protects `/admin/*` pages and `/dashboard/*`, but not `/api/admin/*`. Therefore:

- Every `/api/admin/*` endpoint needs explicit user and role validation.
- Every cron endpoint needs explicit bearer/secret validation.
- Every webhook endpoint needs provider signature validation.

This is a critical stabilization task before production.

## Revenue APIs

| Route | Method | Tables/integrations | Risk |
| --- | --- | --- | --- |
| `/api/spots/checkout` | POST | Supabase service client, `businesses`, `orders`, Stripe | Protected. Creates pending business/order and Stripe subscription checkout. |
| `/api/stripe/checkout` | POST | Drizzle `businesses`, `orders`, Stripe service | Legacy/general checkout; build currently blocked in git-backed repo by exports/types. |
| `/api/stripe/targeted-checkout` | POST | `targeted_route_campaigns`, Stripe | Creates one-time targeted checkout. |
| `/api/intelligence/checkout` | POST | Stripe | Product checkout path. |
| `/api/webhooks/stripe` | POST | Stripe signature, `orders`, `businesses`, `marketing_campaigns` | Needs idempotency ledger and API version cleanup. |

## Intake APIs

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/intake/:token` | POST | Client campaign intake submission. |
| `/api/admin/intake/:id/review` | POST | Admin intake review. |
| `/api/targeted/intake` | POST | Targeted route intake. |
| `/api/targeted/leads` | POST | Targeted lead capture. |
| `/api/waitlist` | POST | Waitlist capture. |
| `/api/nonprofit` | POST | Public nonprofit application. |

Known issue: nonprofit API imports `publicNonprofitApplications`, but Drizzle schema source exports `nonprofitApplications` for a different table/shape. This is a critical compile/runtime mismatch.

## Automation APIs

Configured cron endpoints:

- `/api/admin/automation/send-due`
- `/api/admin/agents/echo`
- `/api/admin/agents/closer`
- `/api/admin/agents/anchor`
- `/api/admin/system/agents/kaizen`
- `/api/admin/system/agents/pulse`
- `/api/admin/system/agents/ledger`
- `/api/admin/system/agents/prospector`
- `/api/admin/agents/scraper`
- `/api/admin/sales/power-mode/end-of-day`
- `/api/facebook/followup`

Risk: cron auth conventions differ (`Authorization: Bearer`, `x-cron-secret`, warnings instead of hard denies). Standardize before production.

