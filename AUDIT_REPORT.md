# AUDIT_REPORT.md

Generated: 2026-05-10

Scope: Food Service Growth OS MVP pre-coding audit only. No product code, migrations, or runtime behavior were changed.

## 1. Framework + Version

Repository shape:
- Monorepo using pnpm workspaces and Turbo.
- Root workspace: `apps/*`, `packages/*`.
- Web app: `apps/web`.
- Database package: `packages/db`.
- Services package: `packages/services`.

Declared versions:
- Node engine: `>=20.0.0`
- pnpm engine: `>=9.0.0`
- package manager: `pnpm@9.15.0`
- Next.js: `^15.2.0`
- React: `^19.0.0`
- TypeScript: `^5.7.0`
- Tailwind CSS: `^3.4.0`
- Drizzle ORM: `^0.38.0`
- Drizzle Kit: `^0.30.0`
- Supabase JS: `^2.47.0`
- Supabase SSR: `^0.5.0`
- Stripe: `^17.0.0`

Lockfile resolved versions observed:
- Next.js: `15.5.14`
- React / React DOM: `19.2.4`
- TypeScript: `5.9.3`
- Drizzle ORM: `0.38.4`
- Drizzle Kit: `0.30.6`
- Supabase JS: `2.102.1`
- Supabase SSR: `0.5.2`
- Stripe: `17.7.0`

Framework conventions:
- Next.js App Router is used under `apps/web/app`.
- Route handlers are used under `apps/web/app/api/**/route.ts`.
- Server Components are the default for pages.
- Client Components are marked with `"use client"`.
- Server actions exist, for example `apps/web/app/(dashboard)/settings/actions.ts`.
- Tailwind utility classes are the primary styling system.
- Shared class merging uses `apps/web/lib/utils.ts` with `cn()`.

## 2. Auth Provider + Session Pattern

Auth provider:
- Supabase Auth.
- Session cookies are managed with `@supabase/ssr`.

Important files:
- `apps/web/lib/supabase/server.ts`
- `apps/web/lib/supabase/client.ts`
- `apps/web/lib/supabase/service.ts`
- `apps/web/middleware.ts`
- `apps/web/app/(auth)/login/login-form.tsx`
- `apps/web/app/(auth)/signup/signup-form.tsx`
- `packages/db/supabase/migrations/00_create_profile_trigger.sql`
- `packages/db/src/schema/users.ts`

Session pattern:
- Server code calls `createClient()` from `apps/web/lib/supabase/server.ts`, then `supabase.auth.getUser()`.
- Client auth forms call `createClient()` from `apps/web/lib/supabase/client.ts`.
- Login uses `supabase.auth.signInWithPassword()`.
- Signup uses `supabase.auth.signUp()` and sends `full_name` in user metadata.
- Auth callback uses `supabase.auth.exchangeCodeForSession()`.
- Signout uses a server action plus `supabase.auth.signOut()`.

Role/session pattern:
- `profiles` table mirrors `auth.users.id`.
- `profiles.role` enum values currently include `admin`, `client`, `nonprofit`, `sponsor`.
- New users default to `client`.
- A Supabase trigger sets `raw_app_meta_data.user_role`.
- Middleware and layouts read `user.app_metadata?.user_role`.
- Existing RLS is mixed: older policies often query `profiles.role`; newer policies often read `auth.jwt()->'app_metadata'->>'user_role'`.

Route protection:
- `apps/web/middleware.ts` protects `/admin/*` and `/dashboard/*`.
- `apps/web/app/(dashboard)/layout.tsx` repeats auth protection for dashboard pages.
- `apps/web/app/(admin)/layout.tsx` repeats auth and admin-role protection.

Growth OS implication:
- Do not modify existing auth flows.
- Add a dedicated `apps/web/app/growth-os/layout.tsx` that checks the feature flag and authenticated user.
- Add internal auth checks to every `/api/growth-os/*` route handler.
- Do not add Growth OS to the global middleware in Phase 1 unless explicitly approved, because the protected-core instruction says do not modify auth.

## 3. Database: Existing Tables, Columns, RLS Policies

Database access:
- Runtime app queries use Drizzle with `DATABASE_URL_POOLED` in `packages/db/src/index.ts`.
- Migration config uses `DATABASE_URL` in `packages/db/drizzle.config.ts`.
- Drizzle schema entrypoint is `packages/db/src/schema/index.ts`.

Important schema caveat:
- `packages/db/src/schema/index.ts` currently exports only a subset of schema files: users, cities, products, businesses, orders, outreach, misc, and marketing.
- Many schema files exist but are not currently exported from the schema index, including pricing, sales, spots, targeted, conversations, growth, political, QA, Twilio observability, and email observability.
- New FSGOS Drizzle tables should be added in a separate `fsgos.ts` schema file and exported deliberately from `index.ts` only after approval.

Migration roots observed:
- `packages/db/supabase/migrations`
- `supabase/migrations`

Risk:
- There are two migration roots. Recent work appears heavily represented in top-level `supabase/migrations`, while the Drizzle package also has its own Supabase migrations. Before Phase 1, choose the canonical migration root for FSGOS and do not duplicate migrations across both roots.

Existing Drizzle-modeled tables and columns:

| Table | Source | Columns audited |
| --- | --- | --- |
| `profiles` | `packages/db/src/schema/users.ts` | `id`, `role`, `fullName`, `email`, `phone`, `avatarUrl`, `createdAt`, `updatedAt` |
| `businesses` | `packages/db/src/schema/businesses.ts` | `id`, `ownerId`, `name`, `categoryId`, `cityId`, `address`, `phone`, `email`, `website`, `status`, `isNonprofit`, `nonprofitVerifiedAt`, `notes`, `createdAt`, `updatedAt` |
| `cities` | `packages/db/src/schema/cities.ts` | `id`, `name`, `state`, `slug`, `isActive`, `launchedAt`, `createdAt` |
| `categories` | `packages/db/src/schema/cities.ts` | `id`, `name`, `slug`, `description`, `icon`, `isActive`, `createdAt` |
| `products` | `packages/db/src/schema/products.ts` | `id`, `name`, `slug`, `type`, `description`, `basePrice`, `isActive`, `metadata`, `createdAt`, `updatedAt` |
| `bundles` | `packages/db/src/schema/products.ts` | `id`, `name`, `slug`, `description`, `price`, `isActive`, `cityId`, `config`, `metadata`, `createdAt`, `updatedAt` |
| `bundle_products` | `packages/db/src/schema/products.ts` | `id`, `bundleId`, `productId`, `quantity` |
| `orders` | `packages/db/src/schema/orders.ts` | `id`, `businessId`, `bundleId`, `status`, `stripePaymentIntentId`, `stripeCustomerId`, `stripeCheckoutSessionId`, `subtotal`, `total`, `paidAt`, `createdAt`, `updatedAt` |
| `order_items` | `packages/db/src/schema/orders.ts` | `id`, `orderId`, `productId`, `quantity`, `unitPrice`, `totalPrice` |
| `outreach_contacts` | `packages/db/src/schema/outreach.ts` | `id`, `businessId`, `name`, `email`, `phone`, `optedOut`, `optedOutAt`, `source`, `createdAt` |
| `campaigns` | `packages/db/src/schema/outreach.ts` | `id`, `businessId`, `name`, `type`, `status`, `subject`, `messageBody`, `scheduledAt`, `sentAt`, `createdAt`, `updatedAt` |
| `outreach_messages` | `packages/db/src/schema/outreach.ts` | `id`, `campaignId`, `contactId`, `channel`, `status`, `externalId`, `sentAt`, `deliveredAt`, `createdAt` |
| `outreach_replies` | `packages/db/src/schema/outreach.ts` | `id`, `messageId`, `contactId`, `businessId`, `channel`, `body`, `receivedAt`, `isRead` |
| `waitlist_entries` | `packages/db/src/schema/misc.ts` | `id`, `email`, `phone`, `name`, `cityId`, `categoryId`, `businessName`, `convertedToBusinessId`, `convertedAt`, `createdAt` |
| `nonprofit_applications` | `packages/db/src/schema/misc.ts` | `id`, `businessId`, `status`, `ein`, `orgName`, `documentUrl`, `reviewedBy`, `reviewedAt`, `createdAt` |
| `sponsorships` | `packages/db/src/schema/misc.ts` | `id`, `sponsorBusinessId`, `tier`, `status`, `amount`, `startsAt`, `endsAt`, `createdAt` |
| `marketing_campaigns` | `packages/db/src/schema/marketing.ts` | `id`, `businessId`, `orderId`, `cityId`, `categoryId`, `bundleId`, `status`, `startDate`, `endDate`, `renewalDate`, `nextDropDate`, `totalDrops`, `dropsCompleted`, `homesPerDrop`, `notes`, `createdAt`, `updatedAt` |
| `campaign_metrics` | `packages/db/src/schema/marketing.ts` | `id`, `campaignId`, `periodStart`, `periodEnd`, `impressions`, `mailpieces`, `qrScans`, `phoneLeads`, `formLeads`, `totalLeads`, `estimatedRevenue`, `createdAt`, `updatedAt` |
| `pricing_profiles` | `packages/db/src/schema/pricing.ts` | `id`, `name`, `productType`, `spotType`, `billingInterval`, `basePriceCents`, `compareAtPriceCents`, `foundingPriceCents`, `perUnitPriceCentsMin`, `perUnitPriceCentsMax`, `minQuantity`, `maxQuantity`, `minCommitmentMonths`, `homesPerDrop`, `setupFeeProfileId`, `isActive`, `effectiveFrom`, `effectiveUntil`, `metadata`, `createdAt`, `updatedAt` |
| `discount_rules` | `packages/db/src/schema/pricing.ts` | `id`, `name`, `ruleType`, `description`, `discountPct`, `discountCents`, `conditions`, `effect`, `priority`, `stackable`, `isActive`, `createdAt`, `updatedAt` |
| `spot_assignments` | `packages/db/src/schema/spots.ts` | `id`, `businessId`, `cityId`, `categoryId`, `spotType`, `status`, `stripeSubscriptionId`, `stripeCustomerId`, `commitmentEndsAt`, `activatedAt`, `releasedAt`, `monthlyValueCents`, `createdAt`, `updatedAt` |
| `intake_submissions` | `packages/db/src/schema/intake.ts` | `id`, `spotAssignmentId`, `businessId`, `accessToken`, `status`, `serviceArea`, `targetCustomer`, `keyOffer`, `differentiators`, `additionalNotes`, `submittedAt`, `createdAt`, `updatedAt` |
| `leads` | `packages/db/src/schema/leads.ts` | `id`, `name`, `businessName`, `phone`, `email`, `source`, `status`, `city`, `notes`, `intakeToken`, `intakeSentAt`, `intakeSubmittedAt`, `paidAt`, `mailedAt`, `reviewRequestedAt`, `reviewRequested`, `createdAt`, `updatedAt` |
| `conversations` | `packages/db/src/schema/conversations.ts` | `id`, `leadId`, `contactPhone`, `contactEmail`, `leadName`, `businessName`, `city`, `category`, `channel`, `direction`, `message`, `externalId`, `intent`, `aiGenerated`, `automationMode`, `isRead`, `sentAt`, `createdAt` |
| `growth_activity_logs` | `packages/db/src/schema/growth.ts` | `id`, `date`, `channel`, `volumeSent`, `adSpendCents`, `responses`, `conversationsStarted`, `dealsClosed`, `notes`, `createdAt`, `updatedAt` |
| `sales_leads` | `packages/db/src/schema/sales.ts` | `id`, `externalId`, `businessName`, `contactName`, `email`, `phone`, `website`, `facebookUrl`, `address`, `city`, `state`, `category`, `cityId`, `categoryId`, `score`, `priority`, `rating`, `reviewsCount`, `buyingSignal`, `doNotContact`, `smsOptOut`, `status`, `notes`, `lastContactedAt`, `lastReplyAt`, `assignedAgentId`, `totalMessagesSent`, `totalReplies`, `createdAt`, `updatedAt` |
| `sales_events` | `packages/db/src/schema/sales.ts` | `id`, `agentId`, `leadId`, `actionType`, `channel`, `city`, `category`, `message`, `revenueCents`, `metadata`, `createdAt` |
| `targeted_route_campaigns` | `packages/db/src/schema/targeted.ts` | `id`, `leadId`, `businessName`, `contactName`, `email`, `phone`, `businessAddress`, `targetCity`, `targetAreaNotes`, `homesCount`, `priceCents`, `status`, `designStatus`, `mailingStatus`, `reviewRequested`, `reviewRequestedAt`, `stripeCheckoutSessionId`, `stripePaymentIntentId`, `notes`, `createdAt`, `updatedAt` |
| `email_events` | `packages/db/src/schema/emailObservability.ts` | `id`, `provider`, `eventType`, `messageId`, `recipient`, `subject`, `bounceType`, `errorCode`, `errorMessage`, `clickUrl`, `ip`, `userAgent`, `geoCountry`, `geoRegion`, `geoCity`, `tags`, `rawPayload`, `receivedAt` |
| `twilio_a2p_status` | `packages/db/src/schema/twilioObservability.ts` | `id`, `brandId`, `campaignId`, `useCase`, `accountTier`, `verizonStatus`, `attStatus`, `tmobileStatus`, `uscellularStatus`, `complianceChecklist`, `lastAuditAt`, `notes`, `createdAt`, `updatedAt` |
| `twilio_message_status` | `packages/db/src/schema/twilioObservability.ts` | `id`, `messageSid`, `messageStatus`, `errorCode`, `errorMessage`, `toNumber`, `fromNumber`, `messagingServiceSid`, `smsSid`, `accountSid`, `apiVersion`, `rawPayload`, `receivedAt`, `createdAt`, `updatedAt` |
| `qa_questions` | `packages/db/src/schema/qa/questions.ts` | `id`, `askedByAgentId`, `questionText`, `categoryTags`, `visibility`, `leadId`, `cityId`, `categoryId`, `lastInteractionId`, `status`, `isPinned`, `upvoteCount`, `createdAt`, `updatedAt` |
| `qa_answers` | `packages/db/src/schema/qa/answers.ts` | `id`, `questionId`, `source`, `authorAgentId`, `directAnswer`, `whatToSay`, `whatToDoNext`, `whyThisWorks`, `relatedQuestionIds`, `isOfficial`, `isBest`, `isLocked`, `modelName`, `modelTokensInput`, `modelTokensOutput`, `generationLatencyMs`, `createdAt`, `updatedAt` |
| `qa_thread_replies` | `packages/db/src/schema/qa/replies.ts` | `id`, `questionId`, `parentReplyId`, `authorAgentId`, `authorRole`, `body`, `upvoteCount`, `isAdminOverride`, `createdAt` |
| `qa_reply_votes` | `packages/db/src/schema/qa/votes.ts` | `id`, `replyId`, `answerId`, `voterAgentId`, `vote`, `createdAt` |
| `qa_scripts_generated` | `packages/db/src/schema/qa/scripts.ts` | `id`, `answerId`, `channel`, `content`, `copiedByAgentId`, `attachedToLeadId`, `usedInSendId`, `createdAt` |
| `qa_lead_attachments` | `packages/db/src/schema/qa/attachments.ts` | `id`, `leadId`, `questionId`, `answerId`, `scriptId`, `attachedByAgentId`, `note`, `createdAt` |
| `qa_knowledge_entries` | `packages/db/src/schema/qa/knowledge.ts` | `id`, `sourceQuestionId`, `sourceAnswerId`, `title`, `body`, `categoryTags`, `cityScope`, `promotedByAdminId`, `usageCount`, `createdAt`, `updatedAt` |
| `qa_usage_logs` | `packages/db/src/schema/qa/usage.ts` | `id`, `eventType`, `questionId`, `answerId`, `replyId`, `scriptId`, `agentId`, `leadId`, `metadata`, `createdAt` |

Political Drizzle-modeled tables:
- `campaign_candidates`: candidate identity, geography, contact, source, scoring, status, contact timing, notes, suppression flags, timestamps.
- `political_campaigns`: candidate/campaign relationship, office/geography, pipeline state, estimated value, owner, election date, timestamps.
- `political_campaign_contacts`: candidate/campaign contact details, preference flags, timestamps.
- `political_proposals`: campaign/proposal status, token, pricing snapshot, household/drop counts, investment/cost/margin, delivery, resend, timestamps.
- `political_orders`: proposal/campaign payment and fulfillment status, Stripe IDs, amounts, lifecycle timestamps.
- `political_contracts`: proposal/order contract status, token, signer data, terms/version, lifecycle timestamps.
- `political_scripts`: reusable political script content by channel/category/state.
- `political_priority_runs`: priority run audit metadata.

Migration-only table groups observed:
- CRM: `crm_companies`, `crm_assignments`, `crm_outreach_events`, `crm_conversations`, `crm_notes`, `crm_tasks`, `crm_pipeline_history`, `crm_tags`, `crm_lead_tags`, `crm_suppression_list`, `crm_activity_metrics`, `crm_deals`, commission tables, dedupe tables.
- Automation/agents: `auto_sequences`, `auto_sequence_steps`, `auto_enrollments`, `auto_send_log`, `agent_identities`, `agent_daily_send_counts`, `agent_message_hashes`, `agent_registry`, `agent_run_log`, `agent_daily_stats`, `agent_territories`.
- Facebook engine: `facebook_activity_logs`, `facebook_performance_scores`, `facebook_alert_events`, `facebook_sales_opportunities`, `facebook_streak_tracking`.
- Content intelligence: `ci_category_topics`, `ci_trusted_channels`, `ci_ingestion_rules`, `ci_theme_performance_memory`, `ci_ingestion_queue`, `ci_insights`, `ci_actions`, `ci_scripts`, `ci_offers`, `ci_automations`, `ci_enhancements`, `ci_patterns`, `ci_outcome_events`, `ci_weight_deltas`, `ci_competitor_sources`, `ci_competitor_insights`, `ci_market_signals`.
- SEO: `seo_pages`, `seo_page_versions`.
- Political expansion: `political_organizations`, `political_plans`, `political_scenarios`, `political_routes`, `political_route_selections`, `political_reservations`, `political_outreach_leads`, `political_follow_ups`, `political_approvals_log`, `political_imports`, `political_data_sources`, `political_offices`, `political_jurisdictions`, `political_elections`, staging/crawl tables.
- Observability: `twilio_a2p_status`, `twilio_message_status`, `email_events`.
- Drift repair also references `public_nonprofit_applications`.

RLS policy patterns observed:
- `profiles`: own read/update; admin read all.
- `businesses`: owner full access; admin full access.
- `orders`: business owner read; admin full access.
- `outreach_replies`: business owner read; admin full access.
- `marketing_campaigns`: owner read; admin full; system/admin insert policy.
- `campaign_metrics`: campaign owner read; admin full.
- `conversations` and some public intake/application tables: service role full access only.
- `growth_activity_logs`: RLS enabled, intended admin/service only; no user-facing policies in the migration.
- Sales/CRM/agent tables: service role full access plus admin policies and sales-agent read/write policies.
- QA tables: owner/agent/admin patterns, with public team read in some tables.
- Content intel/SEO/political tables: admin-all policies plus agent read/write where relevant.
- Newer policies often prefer `auth.jwt()->'app_metadata'->>'user_role'`; older policies often query `profiles.role`.

FSGOS RLS recommendation:
- Every `fsgos_*` table should enable RLS.
- Every `fsgos_*` table should include `user_id uuid not null`.
- Users can select/insert/update/delete only rows where `auth.uid() = user_id`, with table-specific limits where needed.
- Admin access should use `auth.jwt()->'app_metadata'->>'user_role' = 'admin'` to avoid recursive profile reads.
- Service role should be used only from server-side routes and scheduled jobs.

## 4. Existing Dashboard Component Patterns

Client dashboard files:
- `apps/web/app/(dashboard)/layout.tsx`
- `apps/web/app/(dashboard)/dashboard/page.tsx`
- `apps/web/app/(dashboard)/dashboard-nav.tsx`
- `apps/web/app/(dashboard)/campaign/page.tsx`
- `apps/web/app/(dashboard)/billing/page.tsx`
- `apps/web/app/(dashboard)/replies/page.tsx`
- `apps/web/app/(dashboard)/settings/page.tsx`
- `apps/web/app/(dashboard)/settings/actions.ts`

Admin dashboard files:
- `apps/web/app/(admin)/layout.tsx`
- `apps/web/app/(admin)/admin/page.tsx`
- `apps/web/app/(admin)/admin-nav.tsx`

Shared dashboard components:
- `apps/web/components/dashboard/metric-card.tsx`
- `apps/web/components/dashboard/campaign-detail-card.tsx`
- `apps/web/components/dashboard/status-badge.tsx`
- `apps/web/components/dashboard/impressions-chart.tsx`
- `apps/web/components/dashboard/engagement-breakdown.tsx`
- `apps/web/components/ui/badge.tsx`

Patterns:
- Pages are usually async Server Components.
- Pages fetch the Supabase user, redirect anonymous users, then query Drizzle.
- Layouts use `flex min-h-screen bg-gray-50`, sidebar navigation, and a scrollable `main`.
- UI surfaces use Tailwind with white panels, gray borders, rounded corners, small shadows, compact labels, and numeric metric strips.
- Existing cards often use `rounded-2xl`; FSGOS can use the same visual language for consistency, even though new components should stay under `components/growth-os`.
- Status/label chips are small and color-coded.
- Form patterns use labels, focused border/ring classes, server actions or route handlers, and inline error states.

Growth OS implication:
- Build a separate Growth OS dashboard rather than modifying `apps/web/app/(dashboard)/dashboard/page.tsx`.
- Reuse the visual vocabulary, not the existing dashboard files.
- Keep all new components under `apps/web/components/growth-os/*`.

## 5. Route Structure

Router:
- App Router only for the web app.
- No `pages` router was observed for the web app.

Current major route groups:
- `(auth)`: `/login`, `/signup`, `/forgot-password`, `/reset-password`.
- `(dashboard)`: `/dashboard`, `/dashboard/campaign`, `/dashboard/replies`, `/dashboard/billing`, `/dashboard/settings`.
- `(admin)`: `/admin/*`.
- `(agent)`: `/agent/*`.
- `(funnel)`: `/get-started/*`, `/targeted/*`, `/intelligence/*`.
- Public routes: `/`, `/how-it-works`, `/waitlist`, `/refer`, `/privacy`, `/terms`, `/targeted`, `/political`, `/advertise/*`, `/spots/*`, `/intake/[token]`, `/p/[token]`, `/c/[token]`, `/os`, `/[slug]`.
- API routes: `apps/web/app/api/**/route.ts`.

Naming conventions:
- Route folder names are lowercase and usually kebab-case.
- Dynamic route segments use `[token]`, `[slug]`, `[citySlug]`, `[categorySlug]`, `[id]`.
- Route groups use parentheses for protected/app sections.

Mandatory Growth OS namespace:
- Page routes: `apps/web/app/growth-os/*`, mapping to `/growth-os/*`.
- API routes: `apps/web/app/api/growth-os/*`.
- Components: `apps/web/components/growth-os/*`.
- Library code: `apps/web/lib/growth-os/*`.
- Database: `fsgos_*` tables only.
- New env vars: `FSGOS_*`, except the explicitly required feature flag `ENABLE_FOOD_SERVICE_GROWTH_OS=true`.

## 6. Proposed NEW Tables

All proposed tables are additive and prefixed with `fsgos_`. No existing tables should be altered or dropped.

Phase 1 tables:

### `fsgos_business_profiles`

Purpose: Module 1 business profile, independent from existing HomeReach `businesses` records.

Columns:
- `id uuid primary key default gen_random_uuid()`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `company_name text not null`
- `location_zip text not null`
- `business_type text not null`
- `weekly_revenue_cents integer not null default 0`
- `avg_order_value_cents integer not null default 0`
- `daily_customers integer not null default 0`
- `labor_cost_weekly_cents integer not null default 0`
- `ingredient_cost_weekly_cents integer not null default 0`
- `overhead_monthly_cents integer not null default 0`
- `owner_goal text not null`
- `timezone text not null default 'America/New_York'`

Indexes and constraints:
- Unique profile per user in MVP: unique index on `user_id`.
- Index on `business_type`.

### `fsgos_weekly_inputs`

Purpose: Module 2 weekly input plus Module 12 context flags.

Columns:
- `id uuid primary key default gen_random_uuid()`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `week_start_date date not null`
- `weekly_revenue_cents integer not null default 0`
- `weekly_orders integer not null default 0`
- `weekly_labor_cost_cents integer not null default 0`
- `weekly_ingredient_cost_cents integer not null default 0`
- `weekly_waste_estimate_cents integer not null default 0`
- `avg_order_value_cents integer not null default 0`
- `notes text`
- `context_flags jsonb not null default '{}'::jsonb`
- `same_as_previous boolean not null default false`

Indexes and constraints:
- Unique index on `(user_id, week_start_date)`.
- Index on `(user_id, week_start_date desc)`.
- Check constraints for non-negative numeric inputs.

### `fsgos_user_state`

Purpose: Phase 1 dashboard state, streak counter, onboarding status, and last input references without mixing this state into existing profiles.

Columns:
- `id uuid primary key default gen_random_uuid()`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `current_streak_weeks integer not null default 0`
- `longest_streak_weeks integer not null default 0`
- `last_input_week_start date`
- `onboarding_completed_at timestamptz`
- `first_win_achieved_at timestamptz`

Indexes and constraints:
- Unique index on `user_id`.

Phase 2 tables:

### `fsgos_recommendations`

Purpose: Module 4 recommendations and Module 11 First Win Accelerator.

Columns:
- `id`, `created_at`, `updated_at`, `user_id`
- `source text not null`
- `lever_category text not null`
- `title text not null`
- `problem text not null`
- `why_it_matters text not null`
- `action_text text not null`
- `estimated_monthly_impact_cents integer not null default 0`
- `confidence text not null`
- `confidence_reasoning text not null`
- `ranking_score numeric`
- `fast_win boolean not null default false`
- `status text not null default 'recommended'`
- `data_snapshot jsonb not null default '{}'::jsonb`

Phase 3 table:

### `fsgos_applied_recommendations`

Purpose: Module 5 apply plus baseline capture; one active lever at a time.

Columns:
- `id`, `created_at`, `updated_at`, `user_id`
- `recommendation_id uuid references fsgos_recommendations(id) on delete set null`
- `lever_category text not null`
- `fast_win boolean not null default false`
- `baseline_metrics jsonb not null`
- `date_applied timestamptz not null default now()`
- `status text not null default 'active'`
- `completion_date timestamptz`
- `final_impact integer`
- `confidence text`

Constraints:
- Partial unique index on `(user_id)` where `status = 'active'`.

Phase 4 tables:

### `fsgos_impact_tracking`

Purpose: Module 6 and Module 7 impact calculations and storage.

Columns:
- `id`, `created_at`, `updated_at`, `user_id`
- `applied_recommendation_id uuid not null references fsgos_applied_recommendations(id) on delete cascade`
- `baseline_value integer not null default 0`
- `current_value integer not null default 0`
- `estimated_monthly_impact integer not null default 0`
- `aov_driven_revenue_delta integer not null default 0`
- `volume_driven_revenue_delta integer not null default 0`
- `cost_savings_delta integer not null default 0`
- `confidence text not null`
- `confidence_reasoning text not null`
- `last_updated timestamptz not null default now()`

### `fsgos_win_log`

Purpose: Dashboard Win Log and first-win celebration source.

Columns:
- `id`, `created_at`, `updated_at`, `user_id`
- `applied_recommendation_id uuid references fsgos_applied_recommendations(id) on delete set null`
- `title text not null`
- `lever_category text not null`
- `estimated_monthly_impact_cents integer not null default 0`
- `confidence text not null`
- `share_token uuid not null default gen_random_uuid()`
- `completed_at timestamptz not null default now()`

Phase 5 tables:

### `fsgos_chat_messages`

Purpose: Module 9 AI chat history tied to user data context.

Columns:
- `id`, `created_at`, `updated_at`, `user_id`
- `role text not null`
- `content text not null`
- `model text`
- `data_context jsonb not null default '{}'::jsonb`
- `token_count integer`

### `fsgos_action_artifacts`

Purpose: Module 10 generated plans, scripts, templates, and copyable/downloadable artifacts.

Columns:
- `id`, `created_at`, `updated_at`, `user_id`
- `recommendation_id uuid references fsgos_recommendations(id) on delete set null`
- `applied_recommendation_id uuid references fsgos_applied_recommendations(id) on delete set null`
- `artifact_type text not null`
- `title text not null`
- `content text not null`
- `metadata jsonb not null default '{}'::jsonb`

Phase 6 table:

### `fsgos_benchmarks`

Purpose: Module 8 benchmark layer.

Columns:
- `id uuid primary key default gen_random_uuid()`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `user_id uuid`
- `business_type text not null`
- `revenue_tier text not null`
- `region text not null`
- `metric_type text not null`
- `p25 numeric not null`
- `p50 numeric not null`
- `p75 numeric not null`
- `sample_size integer not null default 0`
- `source text not null default 'internal_aggregate'`

Note:
- `user_id` is nullable here because benchmarks are aggregate/reference rows, but the project requirement says every new table includes `user_id`. This needs explicit approval before Phase 6. Conservative option: keep `user_id uuid` nullable and use admin/service policies only.

Post-MVP modules:
- No Lever Library UI in MVP.
- No A/B testing logic in MVP.
- No Risk Alert Engine logic in MVP.
- Do not create post-MVP UI or logic. If placeholder schema is still desired, create it only after a separate approval checkpoint.

## 7. Risks / Conflicts Identified

1. Dirty worktree.
   - `git status --short` shows many modified and untracked files.
   - Phase 1 must avoid unrelated edits and should touch only FSGOS files plus the smallest necessary schema export.

2. Two migration roots.
   - Both `packages/db/supabase/migrations` and `supabase/migrations` exist.
   - FSGOS should use one approved migration root.

3. Existing Growth naming collision.
   - There is already `growth_activity_logs` and `/admin/growth`.
   - FSGOS must stay under `fsgos_*` and `/growth-os/*`.

4. Schema export drift.
   - Many existing schema files are not exported from `packages/db/src/schema/index.ts`.
   - If FSGOS Drizzle tables are added, export only `./fsgos.js` and do not refactor existing schema exports.

5. Auth protection must be additive.
   - Global middleware currently protects `/admin` and `/dashboard`.
   - To avoid touching auth, protect Growth OS in its own layout and route handlers.

6. RLS style inconsistency.
   - Existing policies mix `profiles.role` subqueries and JWT app metadata.
   - FSGOS should standardize on `auth.uid() = user_id` for ownership and JWT role checks for admin.

7. Weekly reminders need a delivery decision.
   - Requirement says Monday 9am local reminders.
   - No approved FSGOS delivery channel exists yet.
   - Phase 1 can store timezone/state and create a protected reminder endpoint, but email/SMS sending should wait for explicit approval.

8. Claude API integration is Phase 2/5, not Phase 1.
   - Existing AI code uses direct REST calls and provider env vars.
   - All new FSGOS env vars should be prefixed `FSGOS_*`.
   - Phase 1 should not add AI calls.

9. One active lever rule is Phase 3.
   - Enforce with a partial unique index on `fsgos_applied_recommendations`.
   - Do not build multi-lever behavior.

10. Benchmark table user_id tension.
    - The requirement says every new table has `user_id`.
    - Benchmarks are naturally aggregate/reference records.
    - Phase 6 needs approval for nullable `user_id` or a service-owned pattern.

11. Existing design uses large rounded cards.
    - New UI should be visually consistent with the existing app, while staying focused and operational for food-service owners.

## 8. Phase 1 File-by-File Build Plan

No Phase 1 files should be created until this audit is approved.

### Database

`supabase/migrations/078_fsgos_phase1.sql`
- Create `fsgos_business_profiles`, `fsgos_weekly_inputs`, and `fsgos_user_state`.
- Enable RLS on each table.
- Add owner policies using `auth.uid() = user_id`.
- Add admin policies using `auth.jwt()->'app_metadata'->>'user_role' = 'admin'`.
- Add indexes and non-negative checks.
- Include rollback SQL in comments: `drop table if exists fsgos_user_state; drop table if exists fsgos_weekly_inputs; drop table if exists fsgos_business_profiles;`.

`packages/db/src/schema/fsgos.ts`
- Add Drizzle definitions for Phase 1 `fsgos_*` tables.
- Keep namespaced enums/types in this file only.

`packages/db/src/schema/index.ts`
- Add `export * from "./fsgos.js";`.
- No other schema export refactor.

### Feature Flag / Shared Library

`apps/web/lib/growth-os/feature-flag.ts`
- Read `ENABLE_FOOD_SERVICE_GROWTH_OS`.
- Return disabled state for layout and API guards.

`apps/web/lib/growth-os/types.ts`
- Define Phase 1 form/data types only.
- Avoid recommendation/impact/chat types until later phases.

`apps/web/lib/growth-os/metrics.ts`
- Deterministic calculations: profit, food cost percent, labor percent, AOV, 4-week trend helper.
- No AI calls.

`apps/web/lib/growth-os/queries.ts`
- User-scoped Drizzle reads for profile, latest weekly input, weekly history, streak state.

`apps/web/lib/growth-os/validators.ts`
- Zod schemas for profile and weekly input.
- Enforce max seven numeric inputs in weekly entry.

### Routes

`apps/web/app/growth-os/layout.tsx`
- Check feature flag.
- Require authenticated Supabase user.
- Render lightweight Growth OS shell/nav.
- Do not modify global middleware.

`apps/web/app/growth-os/page.tsx`
- Redirect to `/growth-os/onboarding` if no profile exists.
- Redirect to `/growth-os/dashboard` after onboarding exists.

`apps/web/app/growth-os/onboarding/page.tsx`
- Module 1 profile screen.
- Target completion under 3 minutes.

`apps/web/app/growth-os/weekly/page.tsx`
- Module 2 weekly input screen.
- Single screen.
- Pre-fill from prior week.
- Include context flags.
- Include "Same as last week" action.

`apps/web/app/growth-os/dashboard/page.tsx`
- Module 3 basic dashboard only.
- Show revenue, profit, AOV, food cost percent, labor percent.
- Show 4-week trend only when enough data exists.
- Show streak counter.
- No recommendations UI in Phase 1.

### API Routes

`apps/web/app/api/growth-os/profile/route.ts`
- `GET` current user's FSGOS profile.
- `POST` create/update current user's FSGOS profile.
- Guard feature flag and authenticated user.

`apps/web/app/api/growth-os/weekly-input/route.ts`
- `GET` latest/history for current user.
- `POST` upsert current week input and update streak state.
- Guard feature flag and authenticated user.

`apps/web/app/api/growth-os/reminders/due/route.ts`
- Protected by `FSGOS_CRON_SECRET`.
- Return due reminder candidates only.
- No email/SMS sending in Phase 1 unless explicitly approved.

### Components

`apps/web/components/growth-os/growth-os-shell.tsx`
- Route shell/navigation specific to Growth OS.

`apps/web/components/growth-os/profile-form.tsx`
- Business Profile form.
- Uses existing form visual style.

`apps/web/components/growth-os/weekly-input-form.tsx`
- Single-screen weekly input form.
- Seven numeric fields max.
- Notes textarea.
- Context flags.

`apps/web/components/growth-os/context-flags.tsx`
- Checkboxes for bad weather, holiday spike, equipment issue, staffing issue, promotion running.

`apps/web/components/growth-os/same-as-last-week-button.tsx`
- Copies prior week values into the weekly input form.

`apps/web/components/growth-os/growth-metric-card.tsx`
- Local FSGOS metric card.
- Do not import or modify existing dashboard cards.

`apps/web/components/growth-os/streak-counter.tsx`
- Small streak display for dashboard and weekly input.

### Phase 1 Acceptance Targets

- Profile completes in under 3 minutes: planned.
- Weekly input completes in under 60 seconds: planned.
- Context flags included: planned.
- Dashboard basic metrics visible: planned.
- Streak counter visible: planned.
- Recommendations, apply/baseline, impact tracking, AI chat, action generator, benchmarks: not part of Phase 1.

### Stop Point

After Phase 1 implementation, produce `PHASE_1_REPORT.md` and stop for approval before Phase 2.
