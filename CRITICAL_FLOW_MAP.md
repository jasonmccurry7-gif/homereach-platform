# Critical Flow Map

Generated: 2026-05-09

Scope: static flow map. No live calls or mutations were made.

## 1. Homepage CTA To Intake

Steps:
1. User visits /.
2. CTA sends user to /get-started.
3. User selects city, category, and spot/bundle.
4. User logs in or signs up.
5. Checkout creates pending business/order and Stripe session.
6. Stripe webhook should activate order/business and create campaign.
7. Intake token flow collects campaign details.

Relevant files:
- apps/web/app/page.tsx
- apps/web/app/(funnel)/get-started/page.tsx
- apps/web/app/(funnel)/get-started/[citySlug]/page.tsx
- apps/web/app/(funnel)/get-started/[citySlug]/[categorySlug]/page.tsx
- apps/web/app/(funnel)/get-started/[citySlug]/[categorySlug]/checkout/page.tsx
- apps/web/app/intake/[token]/page.tsx
- apps/web/app/api/intake/[token]/route.ts

APIs/routes: /get-started, /api/stripe/checkout, /api/spots/checkout, /api/webhooks/stripe, /intake/[token], /api/intake/[token].

Tables: cities, categories, bundles, businesses, orders, marketing_campaigns, intake_submissions, spot_assignments.

Env: Supabase vars, DATABASE_URL_POOLED, Stripe vars, NEXT_PUBLIC_APP_URL, email/admin notification vars.

Risk: HIGH. Schema exports are incomplete, signup loses redirect, and automatic intake creation after payment was not confirmed in current webhook.

Test safely: use test DB and Stripe test mode; walk full funnel; verify business/order/campaign/intake rows.

## 2. City Selection

Steps:
1. /get-started loads active cities.
2. User selects city slug.
3. /get-started/[citySlug] loads city and categories.

Files: apps/web/app/(funnel)/get-started/page.tsx, apps/web/app/(funnel)/get-started/[citySlug]/page.tsx, apps/web/lib/funnel/queries.ts.

Tables: cities, categories, businesses/orders for availability.

Env: DATABASE_URL_POOLED.

Risk: MEDIUM-HIGH. Empty/missing seed data breaks funnel; OneDrive/build issues may mask real DB behavior.

Test safely: seed/read test cities and categories; verify empty state and happy path.

## 3. Category Exclusivity

Steps:
1. Category page loads available bundles/spots.
2. Availability is based on existing businesses/orders.
3. User is blocked if max spots are taken.

Files: apps/web/lib/funnel/queries.ts, apps/web/lib/engine/availability.ts, apps/web/app/api/spots/availability/route.ts, apps/web/app/api/spots/resolve/route.ts.

Tables: cities, categories, bundles, businesses, orders, spot_assignments.

Env: DATABASE_URL_POOLED, SUPABASE_SERVICE_ROLE_KEY for some APIs.

Risk: HIGH. Availability checks need DB-level/transactional protection to avoid overselling category-exclusive inventory.

Test safely: simulate two test users claiming same city/category/bundle; verify second is blocked and stale pending orders are handled.

## 4. Spot Selection

Steps:
1. User selects bundle/spot.
2. Checkout collects business info.
3. API creates pending business/order.
4. Stripe Checkout session is created.

Files: apps/web/app/(funnel)/get-started/[citySlug]/[categorySlug]/checkout/checkout-form.tsx, apps/web/app/api/stripe/checkout/route.ts, apps/web/app/api/spots/checkout/route.ts.

Tables: businesses, orders, bundles, cities, categories.

Env: Supabase vars, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL_POOLED, STRIPE_SECRET_KEY, NEXT_PUBLIC_APP_URL.

Risk: HIGH. Two checkout implementations coexist; reservation and webhook behavior differ.

Test safely: Stripe test mode only; confirm pending rows, cancel behavior, and no double reservation.

## 5. Contract / Proposal Flow

Steps:
1. Admin/political module creates proposal.
2. Public proposal token page is shared.
3. Recipient approves or proceeds to order/contract.
4. Contract token captures signature/evidence.

Files: apps/web/app/p/*, apps/web/app/c/*, apps/web/app/(admin)/admin/political/*, apps/web/lib/political/*.

Tables: political_proposals, political_orders, political_contracts, political_approvals_log.

Env: ENABLE_POLITICAL, NEXT_PUBLIC_APP_URL, SUPABASE_SERVICE_ROLE_KEY, Stripe vars if payment attached.

Risk: MEDIUM-HIGH. Public token and legal/payment flows need careful validation.

Test safely: use dummy political records in test DB; do not send real outreach or process real payment.

## 6. Stripe Payment / Subscription Flow

Steps:
1. Checkout API creates session.
2. User pays in Stripe Checkout.
3. Stripe sends webhook.
4. Webhook updates internal status.

Files: apps/web/app/api/stripe/checkout/route.ts, apps/web/app/api/spots/checkout/route.ts, apps/web/app/api/stripe/targeted-checkout/route.ts, apps/web/app/api/webhooks/stripe/route.ts, packages/services/src/stripe/index.ts.

Tables: orders, businesses, marketing_campaigns, targeted_route_campaigns.

Env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, NEXT_PUBLIC_APP_URL, DATABASE_URL_POOLED, SUPABASE_SERVICE_ROLE_KEY.

Risk: CRITICAL. Current webhook handles orderId path, but targeted_route_campaign and subscription lifecycle handling are not complete/confirmed.

Test safely: Stripe test mode and stripe listen only; trigger checkout.session.completed for each checkout path and verify idempotent DB updates.

## 7. Login / Auth Flow

Steps:
1. User signs up/logs in via Supabase.
2. Middleware protects dashboard/admin.
3. Callback exchanges code and routes user.
4. Admin role is checked through app_metadata.user_role.

Files: apps/web/middleware.ts, apps/web/app/(auth)/login/login-form.tsx, apps/web/app/(auth)/signup/signup-form.tsx, apps/web/app/api/auth/callback/route.ts, apps/web/lib/supabase/*.

Tables/auth: auth.users, profiles.

Env: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.

Risk: HIGH. Signup ignores redirect, breaking checkout continuation for new users; admin role claim must be aligned.

Test safely: test login redirect, signup during checkout, profile trigger, and admin/non-admin access in test Supabase.

## 8. Admin Dashboard Flow

Steps:
1. Admin signs in.
2. Middleware/layout validate admin role.
3. Admin pages query DB or service-role APIs.
4. Some pages can send/mutate operational data.

Files: apps/web/app/(admin)/layout.tsx, apps/web/app/(admin)/admin-nav.tsx, apps/web/app/(admin)/admin/page.tsx, apps/web/app/api/admin/*.

Tables: core business/order/catalog tables plus sales, political, QA, content-intel tables by module.

Env: Supabase vars, DATABASE_URL_POOLED, SUPABASE_SERVICE_ROLE_KEY, module feature flags/provider vars.

Risk: HIGH. Known TypeScript errors exist; several pages can trigger live sends/mutations.

Test safely: fix typecheck first; use test admin; load read-only pages before send/mutate pages.

## 9. Client Dashboard Flow

Steps:
1. Authenticated client visits /dashboard.
2. Dashboard loads profile and owned businesses/campaigns.
3. Metrics/scarcity/billing render.

Files: apps/web/app/(dashboard)/dashboard/page.tsx, apps/web/lib/dashboard/queries.ts, apps/web/app/(dashboard)/billing/page.tsx.

Tables: profiles, businesses, marketing_campaigns, campaign_metrics, orders, bundles, cities, categories.

Env: Supabase vars, DATABASE_URL_POOLED.

Risk: MEDIUM-HIGH. Query helpers only use the first owned business in multiple places.

Test safely: test users with zero, one, and multiple businesses/campaigns.

## 10. Twilio / SMS Flow

Steps:
1. Sales/admin route initiates SMS.
2. Twilio sends message.
3. Status webhook receives callback.
4. Callback inserts twilio_message_status.

Files: packages/services/src/outreach/index.ts, apps/web/app/api/admin/sales/event/route.ts, apps/web/app/api/webhooks/twilio/status/route.ts, apps/web/app/api/webhooks/outreach/sms/route.ts.

Tables: sales_leads, sales_events, agent_message_hashes, twilio_message_status, outreach tables depending path.

Env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, TWILIO_MESSAGING_SERVICE_SID, ENABLE_TWILIO_STATUS_WEBHOOK, SUPABASE_SERVICE_ROLE_KEY.

Risk: HIGH. Live-send/compliance risk.

Test safely: one approved test phone only; verify pause controls, opt-out checks, STOP language, and status logging.

## 11. Email Flow

Steps:
1. App sends through Resend, Mailgun, or Postmark path.
2. Provider sends/rejects.
3. Postmark webhook logs delivery/bounce/open/click/subscription events.
4. Terminal events can update sales_leads.email_status.

Files: packages/services/src/outreach/index.ts, packages/services/src/outreach/postmark.ts, apps/web/app/api/admin/sales/event/route.ts, apps/web/app/api/webhooks/postmark/route.ts, packages/db/scripts/import-mailgun-bounces.ts.

Tables: sales_leads, sales_events, email_events.

Env: RESEND_*, MAILGUN_*, POSTMARK_*, EMAIL_PROVIDER.

Risk: HIGH. Provider routing is fragmented and can contact real leads.

Test safely: one approved internal address only; sandbox domains where possible; no mass sends.

## 12. Political Mail Planning Flow

Steps:
1. User opens /political.
2. Feature flag allows module.
3. User submits planning intent.
4. App stores political outreach lead.
5. Admin builds plan/routes/quote/proposal/contract.

Files: apps/web/app/political/*, apps/web/app/(admin)/admin/political/*, apps/web/lib/political/*, supabase/migrations/061-072.

Tables: political_outreach_leads, political_plans, political_scenarios, political_routes, political_route_selections, political_proposals, political_orders, political_contracts, political_data_sources.

Env: ENABLE_POLITICAL, DISABLE_POLITICAL_AI, POLITICAL_ASSISTANT_MODEL, POLITICAL_CRON_SECRET, FEC_API_KEY, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_APP_URL.

Risk: MEDIUM-HIGH. Political data/payment/legal flows need isolated test validation.

Test safely: enable locally/test only; use dummy data; avoid real outreach/payments.

## 13. Route Mapping / EDDM Flow

Steps:
1. Targeted user starts campaign or admin imports routes.
2. Static route engine calculates household count and pricing.
3. Campaign/intake/checkout stores selected route/campaign data.
4. Admin prepares execution/export.

Files: apps/web/app/(funnel)/targeted/*, apps/web/app/targeted/campaign-builder.tsx, apps/web/lib/engine/targeted-routes.ts, apps/web/app/api/targeted/*, apps/web/app/api/stripe/targeted-checkout/route.ts, apps/web/app/api/targeted-campaign/route.ts, docs/political-csv-formats.md.

Tables: targeted_route_campaigns, waitlist_entries for older builder path, political_routes, political_route_selections.

Env: SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL_POOLED, STRIPE_SECRET_KEY, NEXT_PUBLIC_APP_URL, Twilio vars for older SMS alert path.

Risk: HIGH. There are two targeted flows, static/mock pricing in the route engine, and targeted checkout webhook completion is not clearly handled.

Test safely: choose one canonical flow for validation; use test routes and payments; disable live SMS alerts.