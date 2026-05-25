# Public Read Anti-Abuse Audit

Updated: 2026-05-25

Scope: public read-oriented routes that use privileged Supabase access to support revenue funnel lookups.

Safety posture: this pass added a first-layer request-rate guard only. It did not change spot availability, city/category lookup fields, checkout behavior, pricing, auth, inventory, or database writes.

## Summary

The `/api/spots/resolve` route resolves public city/category slugs to internal IDs for spot selection and checkout preparation. The `/api/spots/availability` route checks whether a city/category slot is available before checkout. Both are read routes, but they ultimately use Supabase service-role access so the funnel can resolve catalog and availability data even when public RLS policies are not shaped for anonymous reads.

Because these endpoints are public and run service-role-backed reads, they should not be callable at unbounded volume. The patches apply the existing in-process public limiter before any Supabase service client is created or canonical availability helper work begins.

## Patched Routes

Files:

- `apps/web/app/api/spots/resolve/route.ts`
- `apps/web/app/api/spots/availability/route.ts`

Controls added:

- Added `spots:resolve` public rate-limit scope.
- Added `spots:availability` public rate-limit scope.
- Allows 120 lookups/checks per IP per minute per scope.
- Returns `429` with `Retry-After` and `RateLimit-*` metadata when exceeded.
- Adds `RateLimit-*` metadata to normal success and validation/error responses.
- Runs the limiter before service-role client creation, canonical availability checks, and database reads.
- Explicitly marks both routes dynamic so rate-limit and lookup responses are not treated as static artifacts.

Behavior intentionally preserved:

- The route still requires both `citySlug` and `categorySlug`.
- City lookup still selects `id`, `name`, and `is_active`.
- Category lookup still selects `id` and `name`.
- Inactive or missing cities still return 404.
- Missing categories still return 404.
- Availability checks still use `checkCanonicalAvailability()` and keep fail-closed behavior.
- No availability source ordering, checkout, payment, inventory, or slug semantics changed.

## Validation

- Focused public-read and shared public rate-limit helper tests passed with 5 tests.
- Focused route/helper/test ESLint passed with 0 warnings/errors.
- Focused `@homereach/web` typecheck passed.
- Full `pnpm test` passed with 190 tests across 26 files.
- Full `pnpm exec turbo type-check --ui=stream` passed across 5 packages.
- Full `pnpm --filter @homereach/web lint` passed with 494 existing warnings and 0 errors.
- Placeholder-env `pnpm --filter @homereach/web build` passed and generated 247 static pages.
- Hosted Vercel preview probe returned 400 for missing parameters with `RateLimit-Limit: 120`, `RateLimit-Remaining: 119`, and `RateLimit-Reset: 60`.
- Hosted availability preview probing will run after the next branch-preview deployment.

## Remaining Risk

- This is an in-process limiter. It is useful as a first layer, but high-traffic production protection should move to Vercel Firewall, Edge Middleware, Redis, or another distributed control.
- This pass covers `/api/spots/resolve` and `/api/spots/availability`; other public read/quote/planning endpoints should continue through the same audit pattern.
