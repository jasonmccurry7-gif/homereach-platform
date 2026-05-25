# Property Intelligence Schema Audit

Updated: 2026-05-25

Scope: read-only validation of the property-intelligence and founding-member tables used by `/intelligence`, `/api/intelligence/checkout`, `/admin/founding`, and the Stripe `checkout.session.completed` handler.

Safety posture: this audit used repo search and Supabase catalog metadata only. It did not read customer rows, change data, apply migrations, replay Stripe events, create checkout sessions, or mutate Supabase.

## Summary

The live HomeReach Supabase project does contain the three property-intelligence tables that repo search could not find in committed migrations:

- `property_intelligence_tiers`
- `founding_slots`
- `founding_memberships`

That means the tables are real in production, but they are currently out-of-band from committed Drizzle/Supabase migration history in this repository.

The critical drift is narrower and more urgent: live `founding_memberships` does not include `stripe_checkout_session_id`, but the Stripe webhook code uses that column to detect whether a property-intelligence founding checkout has already created a membership and then inserts the same column for idempotency.

Branch mitigation now in place: `/api/intelligence/checkout` performs a lightweight founding-schema readiness probe before creating a founding Stripe Checkout session. If `founding_memberships.stripe_checkout_session_id` is missing, the route returns `503` before creating a Stripe session. The Stripe webhook finalizer also runs the same probe before membership finalization so already-created sessions fail with a clear schema-drift error and continue retrying instead of producing unclear Supabase errors.

## Evidence

Repo references:

- `apps/web/app/api/intelligence/checkout/route.ts` reads `property_intelligence_tiers` and `founding_slots`.
- `apps/web/app/api/webhooks/stripe/route.ts` reads/inserts `founding_memberships.stripe_checkout_session_id`.
- `apps/web/app/(funnel)/intelligence/page.tsx` reads `property_intelligence_tiers` and `founding_slots`.
- `apps/web/app/(admin)/admin/founding/page.tsx` reads `founding_slots` and `founding_memberships`.

Committed schema status:

- Repo search found no committed table definitions or migrations for `property_intelligence_tiers`, `founding_slots`, or `founding_memberships`.
- Existing references in `PROVIDER_FLOW_AUDIT.md` and `PRIORITIZED_FIX_PLAN.md` correctly flagged these tables as schema drift before the live metadata check.

Live Supabase metadata check:

- Project: `HomeReach`, project id/ref `vbjwtdknfrjmpmxmzjpz`, active/healthy.
- All three tables exist in `public`.
- RLS is enabled on all three tables.
- Policies exist for authenticated reads and service-role full access.
- `founding_memberships` columns include `id`, `user_id`, `business_name`, `city`, `category`, `product`, `tier`, `locked_price_cents`, `standard_price_cents`, `founding_flag`, `stripe_subscription_id`, `stripe_customer_id`, `status`, `created_at`, and `updated_at`.
- `founding_memberships` does not include `stripe_checkout_session_id`.

## Impact

Risk level: critical for property-intelligence founding checkout finalization.

Likely failure path:

1. Customer completes a property-intelligence founding checkout in Stripe.
2. Signed Stripe webhook receives `checkout.session.completed`.
3. `handlePropertyIntelligenceCheckoutCompleted()` runs for `metadata.type = "property_intelligence"`.
4. The handler queries `founding_memberships` using `.eq("stripe_checkout_session_id", session.id)`.
5. Because the live table does not have that column, Supabase/PostgREST is expected to return a schema-cache/query error.
6. The membership insert and slot-count sync cannot complete.

Business risk:

- A paid founding customer could fail to activate in `founding_memberships`.
- Founding slot usage could remain stale after payment.
- Stripe webhook retries may keep failing until schema drift is repaired.
- Admin founding dashboards may not reflect paid property-intelligence commitments.
- New founding checkout creation should now fail closed before Stripe session creation when the idempotency column is missing, reducing the chance of collecting new payments into a known-unfinalizable path.

## Safe Fix Path

Do not apply a live DB mutation casually. This touches payment completion state.

Recommended sequence:

1. Preserve the current remote schema snapshot through a controlled Supabase schema pull or catalog export.
2. Create an additive migration that adds `founding_memberships.stripe_checkout_session_id text`.
3. Add a unique index on `stripe_checkout_session_id` so webhook idempotency has a database-backed guard. Multiple `NULL` values remain allowed.
4. Consider storing `stripe_customer_id` during webhook finalization because the live table already has that column and Stripe sessions can expose the customer id.
5. Add a migration or schema-capture path for the three existing property-intelligence tables so future laptops and CI environments know the schema.
6. Validate against a Supabase branch or isolated test database before applying to production.
7. Replay only test-mode Stripe events against isolated data before any production webhook replay.

Local migration proposal:

- Created `supabase/migrations/20260525175220_property_intelligence_schema_alignment.sql` with `supabase migration new property_intelligence_schema_alignment`.
- The migration captures the three out-of-band tables for fresh environments, enables RLS, recreates the observed read/service policies when missing, adds `founding_memberships.stripe_checkout_session_id text`, and adds a unique partial index for non-null checkout session ids.
- This migration has not been applied to the live Supabase project.
- `git diff --check` passed after creating the migration.
- `supabase migration list --local` could not run because the local Supabase Postgres service is not running on `127.0.0.1:54322`. This is an environment limitation, not a remote validation attempt.

Branch fail-closed mitigation:

- Added `apps/web/lib/intelligence/schema-readiness.ts` to detect missing `founding_memberships.stripe_checkout_session_id` schema-cache/column errors.
- `/api/intelligence/checkout` now checks the founding membership schema before creating founding Stripe Checkout sessions.
- `/api/webhooks/stripe` now checks the same schema before finalizing property-intelligence founding memberships.
- Focused schema-readiness, checkout-route, and checkout-helper tests passed with 11 tests.
- Focused ESLint on the checkout route/test, Stripe webhook route, schema-readiness helper/test passed with 0 warnings/errors.
- Focused `@homereach/web` typecheck passed.

Approval gate:

- No approval needed for this audit documentation.
- Approval and backup/snapshot are required before applying live Supabase DDL or replaying Stripe webhooks.

## Open Questions

- Was `stripe_checkout_session_id` intentionally omitted from the original production table, or was the table created before the webhook idempotency patch existed?
- Should property-intelligence memberships be linked to a Supabase `user_id` during checkout, or is email/business identity enough until onboarding?
- Should the active admin/funnel pages use service-role reads for these tables long term, or should public/intake reads move behind narrower read models?
