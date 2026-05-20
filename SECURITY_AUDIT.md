# Security Audit

Audit date: 2026-05-10

## Critical Findings

### CRITICAL: Admin API Auth Is Not Centralized

`apps/web/middleware.ts` protects:

- `/admin/*`
- `/dashboard/*`

It does not protect:

- `/api/admin/*`
- `/api/agent/*`
- cron endpoints

Some route handlers enforce their own auth, but this is inconsistent. Every admin API must require authenticated admin or a valid cron secret as appropriate.

### CRITICAL: Service Role Usage Requires Strong Route Guards

`apps/web/lib/supabase/service.ts` creates a service role client. This bypasses RLS. Many admin, webhook, cron, and migration-like operations use service-role access.

Rule: any route using service role must be guarded by one of:

- authenticated admin role
- provider signature verification
- valid cron secret
- public token with narrow scoped capability

### HIGH: OneDrive Workspace Risk

Dependency traversal produced errors under `node_modules/.pnpm`. OneDrive can race file watchers and package symlinks. Active development and builds should not run from OneDrive.

### HIGH: Cron Auth Inconsistency

Cron routes use different mechanisms:

- `Authorization: Bearer <CRON_SECRET>`
- `x-cron-secret`
- subsystem secrets
- warnings without hard denial in some routes

Production cron endpoints must fail closed.

### HIGH: Webhook Verification Gaps

- Stripe webhook verifies signatures.
- Twilio status webhook verifies signatures when configured.
- Twilio inbound SMS route does not visibly verify signature.
- Postmark webhook uses Basic Auth.
- Facebook routes verify signatures when secrets are configured.

Twilio inbound needs signature validation before live usage.

### HIGH: Production-Unsafe Feature Flags

These values are dangerous if enabled in production:

- `ADMIN_DEV_BYPASS=true`
- `USE_MOCK_DB=true`
- missing `CRON_SECRET` while cron endpoints accept manual/internal paths

## Data Security

RLS exists across many migrations, but service-role route handlers bypass it. The security model therefore depends on correct route auth.

Public token routes:

- `/p/:token`
- `/c/:token`
- `/intake/:token`

These must keep token entropy high, avoid enumeration, and never expose internal cost/margin fields.

## Provider Secret Rules

- Never expose `SUPABASE_SERVICE_ROLE_KEY`.
- Never expose `STRIPE_SECRET_KEY` or `STRIPE_WEBHOOK_SECRET`.
- Never expose Twilio auth token.
- Never expose Mailgun/Postmark/Resend API tokens.
- Public variables must only use `NEXT_PUBLIC_` when safe for browser exposure.

## Security Stabilization Plan

1. Add shared `requireAdminApi()` helper.
2. Add shared `requireCronSecret()` helper.
3. Add shared `requireServiceRouteGuard()` pattern for service-role routes.
4. Add Twilio inbound signature validation.
5. Add Stripe processed event ledger.
6. Add API auth tests for representative admin routes.
7. Add production env safety check to fail if `ADMIN_DEV_BYPASS=true` or `USE_MOCK_DB=true`.

