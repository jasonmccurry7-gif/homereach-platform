# Checkout Anti-Abuse Audit

Updated: 2026-05-25

Scope: active checkout creation endpoints that can reach Supabase service-role work, reservation/order updates, or Stripe Checkout session creation.

Safety posture: this pass added first-layer request throttles only. It did not change pricing, billing mode, checkout metadata, auth requirements, inventory rules, token verification, webhook behavior, or customer-facing payment copy. No Stripe sessions, charges, sends, or production data mutations were created during validation.

## Routes Audited

### `/api/spots/checkout`

Files:

- `apps/web/app/api/spots/checkout/route.ts`
- callers: `apps/web/app/spots/[citySlug]/[categorySlug]/page.tsx`, `apps/web/app/(funnel)/get-started/[citySlug]/[categorySlug]/checkout/checkout-form.tsx`

Observed flow:

1. Requires a Supabase-authenticated user.
2. Parses selected bundle/city/category/business/add-on data.
3. Uses the service-role client to read bundle/city data.
4. Checks canonical city/category spot availability.
5. Creates or reuses a pending business.
6. Creates a pending order reservation.
7. Creates or reuses a Stripe customer.
8. Creates a Stripe subscription-mode Checkout session.

Risk before this pass: repeated authenticated attempts from the same client could trigger availability reads, pending order inserts, customer/session creation attempts, and Stripe work without a first-layer request throttle.

Control added: `checkout:spots`, 12 attempts per 10 minutes per hashed client IP, checked before Supabase auth, request-body parsing, service-role work, order reservation, or Stripe work. Responses include `RateLimit-Limit`, `RateLimit-Remaining`, and `RateLimit-Reset`; blocked requests return `429` and `Retry-After`.

Residual risk: the limiter is in-process and per server instance. It is useful as a local guard but is not a distributed quota system. This route still needs Stripe test-mode success-path validation before production promotion.

### `/api/stripe/targeted-checkout`

Files:

- `apps/web/app/api/stripe/targeted-checkout/route.ts`
- caller: `apps/web/app/(funnel)/targeted/checkout/page.tsx`

Observed flow:

1. Parses campaign id, checkout token or customer email proof, and optional add-ons.
2. Uses service-role Supabase to load `targeted_route_campaigns`.
3. Requires a valid signed checkout token or matching campaign email.
4. Filters add-ons to the known catalog.
5. Creates a Stripe payment-mode Checkout session.
6. Stores the Stripe Checkout session id on the campaign.

Risk before this pass: the route had token/email proof, but repeated public attempts could still consume validation/database/Stripe-session capacity once proof succeeded.

Control added: `checkout:targeted`, 12 attempts per 10 minutes per hashed client IP, checked before JSON parsing, service-role lookup, token/email verification work, or Stripe session creation.

Residual risk: true targeted add-on recurring billing still requires a separate business decision and Stripe test-mode implementation if wanted.

### `/api/intelligence/checkout`

Files:

- `apps/web/app/api/intelligence/checkout/route.ts`
- caller: `apps/web/app/(funnel)/intelligence/checkout/intelligence-checkout-client.tsx`

Observed flow:

1. Normalizes tier, city, category, market size, business name, email, and phone.
2. Uses service-role Supabase to read `property_intelligence_tiers` and `founding_slots`.
3. Selects founding or standard pricing.
4. For founding slots, checks that the founding membership idempotency column exists before creating a Stripe session.
5. Creates a Stripe payment or subscription Checkout session only after the founding finalization schema is ready, or returns `503` before Stripe work when the schema is missing.
6. Defers founding membership activation to signed Stripe webhook finalization.

Risk before this pass: malformed payloads were already stopped before service-role work, and founding activation was already moved behind the webhook, but repeated valid public requests could still create Stripe Checkout sessions without a first-layer throttle.

Controls added: `checkout:intelligence`, 12 attempts per 10 minutes per hashed client IP, checked before payload parsing, service-role lookup, founding-slot reads, or Stripe session creation. A follow-up founding-schema readiness guard now blocks new founding Stripe sessions if `founding_memberships.stripe_checkout_session_id` is missing.

Residual risk: property-intelligence table definitions still appear out-of-band from committed Drizzle/Supabase migrations. Live `founding_memberships` still needs the controlled additive `stripe_checkout_session_id` migration before founding checkout can be trusted end to end.

## Validation

- Focused checkout/security helper regression tests passed: 18 tests across checkout rate-limit, public rate-limit, property-intelligence checkout helper, and targeted checkout token files.
- Focused ESLint on the three checkout routes and shared limiter passed with 0 errors and one pre-existing warning in `apps/web/app/api/spots/checkout/route.ts`.
- Full `pnpm test` passed with 187 tests across 25 files.
- Full `pnpm exec turbo type-check --ui=stream` passed across 5 packages.
- Full `pnpm --filter @homereach/web lint` passed with 495 existing warnings and 0 errors.
- Follow-up schema-guard validation: focused schema-readiness, checkout-route, and checkout-helper tests passed with 11 tests; focused checkout/webhook/schema ESLint passed with 0 warnings/errors; focused `@homereach/web` typecheck passed.
- Placeholder-env `pnpm --filter @homereach/web build` passed and generated 248 routes.
- `git diff --check` passed.

## Recommended Next Controls

1. Promote first-layer checkout throttles to a distributed control before paid traffic scaling: Vercel Firewall/WAF, edge middleware, Redis, or another centralized rate-limit store.
2. Add provider test-mode checkout success-path validation for spot subscriptions, targeted campaign payments, and property-intelligence checkout.
3. Keep payment-flow probes limited to invalid payloads or Stripe test mode until isolated database and webhook replay validation are ready.
4. Review idempotency on `/api/spots/checkout` pending order creation; current business flow inserts a pending order after availability passes, so duplicate/retry semantics need Stripe test-mode QA before any logic change.
