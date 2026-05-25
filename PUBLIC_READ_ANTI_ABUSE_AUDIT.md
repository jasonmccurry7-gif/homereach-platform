# Public Read Anti-Abuse Audit

Updated: 2026-05-25

Scope: public read-oriented routes that use privileged Supabase access to support revenue funnel and political planning lookups.

Safety posture: this pass added first-layer request-rate guards only. It did not change spot availability, city/category lookup fields, political route coverage query semantics, checkout behavior, pricing, auth, inventory, or database writes.

## Summary

The `/api/spots/resolve` route resolves public city/category slugs to internal IDs for spot selection and checkout preparation. The `/api/spots/availability` route checks whether a city/category slot is available before checkout. The `/api/political/routes/coverage` route loads public political route coverage planning data from `political_routes`. These are read routes, but they ultimately use Supabase service-role access so public funnel and planning screens can resolve catalog, availability, and aggregate route coverage data even when public RLS policies are not shaped for anonymous reads.

Because these endpoints are public and run service-role-backed reads, they should not be callable at unbounded volume. The patches apply the existing in-process public limiter before any Supabase service client is created, canonical availability helper work begins, or political route coverage lookup can run.

## Patched Routes

Files:

- `apps/web/app/api/spots/resolve/route.ts`
- `apps/web/app/api/spots/availability/route.ts`
- `apps/web/app/api/political/routes/coverage/route.ts`

Controls added:

- Added `spots:resolve` public rate-limit scope.
- Added `spots:availability` public rate-limit scope.
- Added `political:routes-coverage` public rate-limit scope.
- Allows 120 lookups/checks per IP per minute per scope.
- Returns `429` with `Retry-After` and `RateLimit-*` metadata when exceeded.
- Adds `RateLimit-*` metadata to normal success and validation/error responses.
- Runs the limiter before service-role client creation, canonical availability checks, and database reads.
- Explicitly marks these routes dynamic so rate-limit and lookup responses are not treated as static artifacts.

Behavior intentionally preserved:

- The route still requires both `citySlug` and `categorySlug`.
- City lookup still selects `id`, `name`, and `is_active`.
- Category lookup still selects `id` and `name`.
- Inactive or missing cities still return 404.
- Missing categories still return 404.
- Availability checks still use `checkCanonicalAvailability()` and keep fail-closed behavior.
- Political route coverage still uses `loadPoliticalRouteCoverage()`, normalized geography filters, and existing fail-soft `200` fallback on loader errors.
- No availability source ordering, checkout, payment, inventory, or slug semantics changed.
- No political compliance, route ranking, geography filtering, or proposal/checkout behavior changed.

## Validation

- Focused public-read and shared public rate-limit helper tests passed with 7 tests.
- Focused route/helper/test ESLint passed with 0 warnings/errors.
- Focused `@homereach/web` typecheck passed.
- Full `pnpm test` passed with 192 tests across 26 files after the political route coverage patch.
- Full `pnpm exec turbo type-check --ui=stream` passed across 5 packages.
- Full `pnpm --filter @homereach/web lint` passed with 494 existing warnings and 0 errors.
- Placeholder-env `pnpm --filter @homereach/web build` passed and generated 247 static pages.
- Hosted Vercel preview probe returned 400 for spot-resolution missing parameters with `RateLimit-Limit: 120`, `RateLimit-Remaining: 119`, and `RateLimit-Reset: 60`.
- Hosted availability preview probes returned 400 for missing/invalid parameters with `RateLimit-Limit: 120`, `RateLimit-Remaining` decrementing, and `RateLimit-Reset: 60`.
- Hosted political route coverage validation is pending until the patch deploys.

## Remaining Risk

- This is an in-process limiter. It is useful as a first layer, but high-traffic production protection should move to Vercel Firewall, Edge Middleware, Redis, or another distributed control.
- This pass covers `/api/spots/resolve`, `/api/spots/availability`, and `/api/political/routes/coverage`; other public read/quote/planning endpoints should continue through the same audit pattern.
