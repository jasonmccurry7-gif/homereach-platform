# System Understanding Report

Generated: 2026-05-09

Scope: static repo audit only. I did not call live Supabase, Stripe, Twilio, Vercel, email providers, Facebook, FEC, or production webhooks. Secret values were not exposed.

## 1. What This Application Is

HomeReach is a local direct-mail and lead-generation platform. It sells category-exclusive local advertising spots, manages intake/onboarding, supports client/admin dashboards, runs campaign planning and sales workflows, and includes targeted route/EDDM and political mail execution modules. It also contains CRM, sales automation, AI agents, QA, content intelligence, SEO, observability, and operational tooling.

The repo appears live or near-live, but it is also mid-migration. Many modules exist, while build health, migration source of truth, and production integration behavior still need validation before repair work.

## 2. Main Tech Stack

- Monorepo: pnpm workspaces, Turbo.
- Web: Next.js 15 App Router, React 19, TypeScript, Tailwind.
- Mobile: Expo / React Native app in apps/mobile.
- Database/auth/storage: Supabase plus Drizzle ORM.
- Payments: Stripe Checkout and webhooks.
- Messaging: Twilio SMS, Mailgun, Resend, Postmark.
- Deployment: Vercel, including scheduled cron routes.
- AI/data: OpenAI, Anthropic, Facebook, FEC, Hunter, SerpAPI, YouTube/transcript, USPS EDDM-style imports.

## 3. Folder Structure

- apps/web: primary Next.js platform, public site, funnel, auth, dashboards, admin, APIs, webhooks, targeted, political, engines, feature modules.
- apps/mobile: Expo mobile app shell.
- packages/db: Drizzle client, schemas, seeds, validation scripts, one Supabase migration tree.
- packages/services: shared auth, Stripe, outreach, pricing, targeted, Postmark service code.
- packages/types: shared TypeScript types.
- supabase: second migration tree plus inspection/seeds.
- docs: political/operator/data docs.
- _migration_lock: prior investigation notes.
- _codex_runtime, _codex_checkpoints, .next, .turbo, node_modules, .codex-next*: generated/cache/runtime outputs, not source of truth.

## 4. Major Modules / Features

- Marketing homepage and informational pages.
- Shared postcard funnel: city -> category -> bundle/spot -> checkout.
- Supabase auth: login, signup, callback, protected admin/client routes.
- Client dashboard: campaign status, metrics, renewal/scarcity, billing/settings.
- Admin dashboard: core entities, pricing, spots, intake, CRM, sales, agents, reviews, targeted, political, QA, content intel, operator tools.
- Payments: shared checkout, spot subscription checkout, targeted checkout, Stripe webhook.
- Intake/design: public token intake form and admin review path.
- Targeted route/EDDM: campaign start/intake/checkout and an older route-builder lead path.
- Political mail: public planning, admin planning/imports/routes/proposals/contracts/orders/scripts/reporting.
- Automation/AI: sales agents, system agents, content intel, QA, SEO, lead intel, cron endpoints.
- Observability: Twilio and Postmark webhook event logging.

## 5. Critical User Flows

1. Visitor clicks homepage CTA to /get-started.
2. User chooses city and category.
3. User selects an available category-exclusive bundle/spot.
4. User logs in or signs up.
5. Checkout creates pending business/order and Stripe session.
6. Stripe webhook should mark paid, activate business, and create campaign.
7. Client views dashboard.
8. Intake token collects campaign details.
9. Admin reviews and operates campaign.

## 6. Admin Flows

Admin is protected through Supabase session and user.app_metadata.user_role === "admin" in middleware, with another check in the admin layout. Admin areas include businesses, orders, products, bundles, cities, campaigns, intake, waitlist, nonprofits, users, CRM/sales, agents, traffic/intelligence, political, QA, content intel, and operator tools.

Known risk: several admin pages currently have TypeScript errors, and many newer admin modules are untracked or not clearly included in the primary nav.

## 7. Client Flows

Dashboard routes require an authenticated Supabase user. Client pages join profiles, businesses, campaigns, metrics, orders, bundles, cities, and categories.

Known risk: apps/web/lib/dashboard/queries.ts uses only businessIds[0] in campaign/order queries, so multi-business clients may see incomplete data.

## 8. Payment Flows

Payment paths found:

- /api/stripe/checkout: Drizzle-based one-time shared postcard checkout.
- /api/spots/checkout: Supabase service-role subscription checkout for ad spots.
- /api/stripe/targeted-checkout: Supabase service-role targeted route checkout.
- /api/webhooks/stripe: verifies signature and handles checkout.session.completed, payment_intent.payment_failed, charge.refunded for the order/business/campaign path.

Critical concern: the webhook expects metadata.orderId and does not clearly update targeted_route_campaigns when metadata.type is targeted_route_campaign. It also does not fully handle subscription lifecycle events from /api/spots/checkout.

## 9. Intake Flows

Token intake exists:

- apps/web/app/intake/[token]/page.tsx loads intakeSubmissions by accessToken.
- apps/web/app/intake/[token]/intake-form.tsx posts the form.
- apps/web/app/api/intake/[token]/route.ts validates, updates, and sends admin notification.

Known risk: intakeSubmissions and spotAssignments are not exported by packages/db/src/schema/index.ts, but app code imports them from @homereach/db.

## 10. Political Mail Flows

Political mail is feature-gated by ENABLE_POLITICAL. Public /political routes capture planning intent. Admin political routes cover planning, routes, imports, proposals, payments, reporting, data sources, and contracts. Quote logic is isolated in apps/web/lib/political.

Relevant migration range: supabase/migrations/061 through 072 plus later drift repair migrations.

## 11. Route Mapping / EDDM Flows

Two targeted paths coexist:

- Newer funnel: /targeted/start -> /targeted/intake -> /targeted/checkout -> /targeted/confirmed.
- Older builder: apps/web/app/targeted/campaign-builder.tsx -> /api/targeted-campaign, which saves a waitlist entry and sends an SMS alert.

Route pricing is currently static/pure in apps/web/lib/engine/targeted-routes.ts with a TODO to pull from DB. Political docs/migrations reference USPS EDDM/manual CSV import workflows; no confirmed live USPS API integration was found.

## 12. AI / Automation Components

Found components include Echo, Closer, Anchor, system agents, sales automation, CRM tasks, power mode, Facebook follow-up, QA, content intel, SEO/lead-intel modules, and Vercel cron schedules. Several can send messages or mutate sales data, so validation must use flags, test data, or shadow mode.

## 13. External Integrations

Supabase, Stripe, Twilio, Mailgun, Resend, Postmark, Vercel, Facebook, FEC, USPS EDDM/manual route imports, Hunter, SerpAPI, YouTube/transcript, Anthropic, OpenAI, and Google review URLs are referenced.

## 14. Database Architecture

Drizzle runtime uses DATABASE_URL_POOLED. Drizzle migration config uses DATABASE_URL. The configured schema index currently exports only core tables, while many schema files exist but are not exported. There are two migration roots: packages/db/supabase/migrations and top-level supabase/migrations. This must be reconciled against remote Supabase migration history.

## 15. Environment Dependencies

See ENVIRONMENT_AUDIT.md. High-level categories: Supabase, DB URLs, Stripe, Twilio, Resend/Mailgun/Postmark, admin/cron/operator flags, AI providers, political/content/QA/SEO/lead-intel flags, Facebook/FEC/Hunter/SerpAPI/YouTube.

## 16. Deployment Architecture

Root vercel.json builds @homereach/web with pnpm/Turbo. apps/web/vercel.json defines cron jobs hitting automation/agent endpoints. Next config transpiles workspace packages and allows Supabase storage image hosts.

## 17. Risks / Unclear Areas

- Repo is inside OneDrive; file reads hit cloud operation failures.
- Local pnpm/npm/corepack/supabase/vercel were not found on PATH.
- Known TypeScript errors exist.
- DB package exports are incomplete.
- @homereach/db/schema is imported but not exported by package.json.
- Two Supabase migration roots need source-of-truth validation.
- Stripe webhook coverage is incomplete for targeted/subscription paths.
- Signup loses checkout redirect.
- Email provider behavior is fragmented.
- Generated caches and node_modules exist and may be stale.
- Some files display mojibake/encoding corruption in terminal output.