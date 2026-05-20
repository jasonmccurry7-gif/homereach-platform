# Database And Supabase Audit

Generated: 2026-05-09

Scope: static file inspection only. No remote database queries, migrations, auth calls, or service-role scripts were run.

## Architecture Overview

Database access is split across:

- packages/db/src/index.ts: Drizzle runtime client using DATABASE_URL_POOLED.
- packages/db/drizzle.config.ts: Drizzle migration config using DATABASE_URL.
- packages/db/src/schema: TypeScript schema files.
- apps/web/lib/supabase/client.ts: browser anon Supabase client.
- apps/web/lib/supabase/server.ts: cookie/session server client.
- apps/web/lib/supabase/service.ts: service-role client that bypasses RLS.
- Supabase SQL migrations in two roots.

## Schema Files Present

packages/db/src/schema contains users, cities, products, businesses, orders, outreach, misc, marketing, sales, growth, intake, leads, pricing, spots, targeted, conversations, emailObservability, twilioObservability, political, and qa/* files.

## Current Schema Export Risk

packages/db/src/schema/index.ts currently exports only:

- users
- cities
- products
- businesses
- orders
- outreach
- misc
- marketing

It does not export several tables that app code imports from @homereach/db, including intakeSubmissions, spotAssignments, sales/CRM tables, targeted tables, conversations, political tables, QA tables, and observability tables.

packages/db/package.json exports only "." and does not export "./schema", but code imports @homereach/db/schema in at least packages/services/src/pricing/index.ts and apps/web/app/(admin)/admin/traffic-engine/page.tsx.

This is likely build-breaking.

## Table / Schema Overview

Core/auth:

- profiles
- user_role enum

Geography/catalog:

- cities
- categories
- products
- bundles
- bundle_products

Business/order/campaign:

- businesses
- orders
- order_items
- marketing_campaigns
- campaign_metrics

Outreach/sales/CRM:

- outreach_contacts
- campaigns
- outreach_messages
- outreach_replies
- sales_leads
- sales_events
- conversations
- growth_activity_logs
- waitlist_entries
- nonprofit_applications
- sponsorships

Pricing/spot/intake/targeted:

- pricing profile/rule tables
- spot_assignments
- intake_submissions
- leads
- targeted_route_campaigns

Observability:

- email_events
- twilio_a2p_status
- twilio_message_status

Political:

- campaign_candidates
- political_campaigns
- political_campaign_contacts
- political_proposals
- political_orders
- political_contracts
- political_scripts
- political_priority_runs
- political_organizations
- political_plans
- political_scenarios
- political_routes
- political_route_selections
- political_reservations
- political_outreach_leads
- political_follow_ups
- political_approvals_log
- political_imports
- political_data_sources
- political_offices
- political_jurisdictions
- political_elections
- staging/crawl tables

QA/content/SEO/lead-intel:

- qa_questions, qa_answers, qa_thread_replies, qa_reply_votes, qa_scripts_generated, qa_lead_attachments, qa_knowledge_entries, qa_usage_logs
- ci_* content intelligence tables
- seo_pages and seo_page_versions, with later drop_seo_engine migration
- lead intel signal tables/columns

## Migration Status

Two migration roots exist:

1. packages/db/supabase/migrations
   - 00 through 32-era migrations.
   - Core profile trigger, marketing RLS, pricing, targeted leads/campaigns, spots, intake, conversations, nonprofit, growth, sales/CRM, automation, agents/RPC.

2. supabase/migrations
   - 045 through 077-era migrations.
   - Facebook, QA, content intel, lead intel, SEO, political core/proposals/contracts/scripts/imports, Twilio/email observability, schema drift repairs.

This is a major source-of-truth risk. Remote Supabase migration history must be compared to both folders before any DB action.

## Auth Dependencies

- Middleware protects /admin using Supabase session and user.app_metadata.user_role === "admin".
- Dashboard routes require authenticated user.
- Signup expects a Supabase trigger to create a profiles row from auth.users.
- Admin layout repeats admin role validation.
- Many admin/API routes use service-role Supabase client.

Risk: if app_metadata user_role is not populated correctly, admin access can fail even when profiles.role is correct.

## RLS / Security Concerns

RLS migrations exist for core/marketing, QA, political, Twilio/email observability, and other areas. Because migrations are split, RLS cannot be assumed correct in the remote DB until migration history is checked.

High-risk areas:

- SUPABASE_SERVICE_ROLE_KEY usage in admin/server routes.
- Public token intake routes.
- Public proposal/contract token routes.
- Public targeted lead/intake routes.
- Webhooks writing status/observability rows.
- Sales/admin routes that can send SMS/email and mutate leads.

## Storage Buckets

No definitive storage bucket creation migration was confirmed. next.config.ts allows Supabase storage image hosts, which implies storage may be used for public assets, but bucket names and policies still need verification.

## Local Vs Remote Setup Requirements

Local validation needs:

- Repo outside OneDrive.
- Node/pnpm installed.
- Dependencies installed cleanly.
- Test/local env values.
- Schema exports fixed enough for typecheck/build.

Remote validation needs approval:

- Supabase CLI installed.
- Project link confirmed.
- Read-only migration/table checks first.
- No service-role mutation scripts until scoped.

## Safe Supabase Validation Commands

After approval:

```powershell
supabase --version
supabase migration list
```

If not linked, approval required:

```powershell
supabase link --project-ref <project-ref>
```

Do not run without explicit approval:

```powershell
supabase db reset
supabase db push
supabase migration repair
pnpm --filter @homereach/db db:migrate
```

## Immediate Database Risks

- Incomplete schema exports likely break app imports.
- @homereach/db/schema import path is not exported.
- Two migration roots may hide schema drift.
- Several newer schema/migration files are untracked in git.
- OneDrive cloud errors mean local files may not all be hydrated.
- Storage bucket/policy source of truth is unclear.