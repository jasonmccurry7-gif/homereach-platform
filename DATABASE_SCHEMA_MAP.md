# Database Schema Map

Audit date: 2026-05-10

## Current DB Access

- Drizzle client: `packages/db/src/index.ts`
- Drizzle schema entry: `packages/db/src/schema/index.ts`
- Drizzle config: `packages/db/drizzle.config.ts`
- Legacy/older migrations: `packages/db/supabase/migrations`
- Newer migrations: `supabase/migrations`
- Supabase service client: `apps/web/lib/supabase/service.ts`

## Drizzle Source Tables

50 `pgTable` exports were discovered:

| Domain | Tables |
| --- | --- |
| Users/auth | `profiles` |
| Geography/catalog | `cities`, `categories`, `products`, `bundles`, `bundle_products` |
| Businesses/orders | `businesses`, `orders`, `order_items` |
| Pricing/spots | `pricing_profiles`, `discount_rules`, `spot_assignments` |
| Funnel/intake | `leads`, `intake_submissions`, `waitlist_entries`, `nonprofit_applications`, `sponsorships` |
| Outreach/conversations | `campaigns`, `outreach_contacts`, `outreach_messages`, `outreach_replies`, `conversations` |
| Marketing/growth | `marketing_campaigns`, `campaign_metrics`, `growth_activity_logs` |
| Sales/CRM | `sales_leads`, `sales_events` |
| Targeted | `targeted_route_campaigns` |
| Political | `campaign_candidates`, `political_campaigns`, `political_campaign_contacts`, `political_proposals`, `political_orders`, `political_contracts`, `political_scripts`, `political_priority_runs` |
| QA | `qa_questions`, `qa_answers`, `qa_thread_replies`, `qa_reply_votes`, `qa_scripts_generated`, `qa_lead_attachments`, `qa_knowledge_entries`, `qa_usage_logs` |
| Observability | `twilio_a2p_status`, `twilio_message_status`, `email_events` |
| Food Service Growth OS | `fsgos_business_profiles`, `fsgos_weekly_inputs`, `fsgos_user_state` |

## Migration-Only Tables

Root `supabase/migrations` and package migrations define many tables not fully represented in the Drizzle schema index/export path, including:

- CRM: `crm_companies`, `crm_assignments`, `crm_outreach_events`, `crm_conversations`, `crm_notes`, `crm_tasks`, `crm_pipeline_history`, `crm_tags`, `crm_lead_tags`, `crm_suppression_list`, `crm_activity_metrics`, `crm_deals`, commissions.
- Automation: `auto_sequences`, `auto_sequence_steps`, `auto_enrollments`, `auto_send_log`.
- Agents: `agent_registry`, `agent_run_log`, `agent_identities`, `agent_daily_send_counts`, `agent_message_hashes`, `agent_territories`, `agent_daily_stats`.
- Facebook performance: `facebook_activity_logs`, `facebook_performance_scores`, `facebook_alert_events`, `facebook_sales_opportunities`, `facebook_streak_tracking`.
- Content intel: `ci_*` tables.
- SEO: `seo_pages`, `seo_page_versions`.
- Political planning/imports/acquisition: `political_organizations`, `political_plans`, `political_scenarios`, `political_routes`, `political_route_selections`, `political_reservations`, `political_outreach_leads`, `political_follow_ups`, `political_approvals_log`, `political_imports`, `political_data_sources`, `political_offices`, `political_jurisdictions`, `political_elections`, `staging_candidates`, `staging_organizations`, `staging_campaigns`, `crawl_sources`, `crawl_jobs`.

## Critical Drift Findings

1. `packages/db/src/schema/index.ts` exports only older modules: users, cities, products, businesses, orders, outreach, misc, marketing, fsgos.
2. Many app files import newer schema symbols from `@homereach/db`, so the git-backed repo cannot typecheck/build until exports are repaired.
3. Duplicate exported enum symbols exist in source:
   - `campaignStatusEnum` in `marketing.ts` and `outreach.ts`
   - `spotTypeEnum` in `pricing.ts` and `spots.ts`
4. Public nonprofit endpoint expects `publicNonprofitApplications`; source schema exposes `nonprofitApplications` with a different table shape.
5. There are two migration streams. A single canonical migration ledger is needed.

## RLS/Security Coverage

RLS policies exist for many systems:

- profiles/businesses/orders/replies
- marketing campaigns/metrics
- conversations
- public nonprofit applications
- sales leads/events
- CRM tables
- automation tables
- agent identities/territories/stats
- QA tables
- content intel tables
- SEO pages
- political tables
- Facebook performance tables

Risk: code frequently uses service role clients, so RLS is bypassed by design in admin/webhook/cron routes. Route-level auth becomes mandatory.

## Validation Commands

Safe read-only/local validation:

```powershell
$env:Path = 'C:\Dev\tools;C:\Program Files\nodejs;' + $env:Path
pnpm --filter @homereach/db type-check
pnpm --filter @homereach/web type-check
```

Production DB validation must be staged:

- Confirm remote migration history.
- Compare table list against Drizzle source.
- Compare required indexes and RLS policies.
- Do not run migrations against production until a rollback script exists.

