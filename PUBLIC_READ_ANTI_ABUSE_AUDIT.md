# Public Read Anti-Abuse Audit

Updated: 2026-05-25

Scope: public read-oriented routes that use privileged Supabase access to support revenue funnel lookups.

Safety posture: this pass added a first-layer request-rate guard only. It did not change spot availability, city/category lookup fields, checkout behavior, pricing, auth, inventory, or database writes.

## Summary

The `/api/spots/resolve` route resolves public city/category slugs to internal IDs for spot selection and checkout preparation. It is a read route, but it uses the Supabase service-role client so the funnel can resolve catalog data even when public RLS policies are not shaped for anonymous reads.

Because the endpoint is public and runs service-role reads, it should not be callable at unbounded volume. The patch applies the existing in-process public limiter before any Supabase service client is created.

## Patched Route

File:

- `apps/web/app/api/spots/resolve/route.ts`

Controls added:

- Added `spots:resolve` public rate-limit scope.
- Allows 120 lookups per IP per minute.
- Returns `429` with `Retry-After` and `RateLimit-*` metadata when exceeded.
- Adds `RateLimit-*` metadata to normal success and validation/error responses.
- Runs the limiter before service-role client creation and before database reads.
- Explicitly marks the route dynamic so rate-limit and lookup responses are not treated as static artifacts.

Behavior intentionally preserved:

- The route still requires both `citySlug` and `categorySlug`.
- City lookup still selects `id`, `name`, and `is_active`.
- Category lookup still selects `id` and `name`.
- Inactive or missing cities still return 404.
- Missing categories still return 404.
- No availability, checkout, payment, inventory, or slug semantics changed.

## Validation

- Focused public-read and shared public rate-limit helper tests passed with 4 tests.
- Focused route/helper/test ESLint passed with 0 warnings/errors.
- Focused `@homereach/web` typecheck passed.
- Full `pnpm test` passed with 189 tests across 26 files.
- Full `pnpm exec turbo type-check --ui=stream` passed across 5 packages.
- Full `pnpm --filter @homereach/web lint` passed with 494 existing warnings and 0 errors.
- Placeholder-env `pnpm --filter @homereach/web build` passed and generated 247 static pages.

## Remaining Risk

- This is an in-process limiter. It is useful as a first layer, but high-traffic production protection should move to Vercel Firewall, Edge Middleware, Redis, or another distributed control.
- This pass only covers `/api/spots/resolve`; other public read/quote/planning endpoints should continue through the same audit pattern.
