# Non-Admin Service-Role Audit

Updated: 2026-05-25

Scope: service-role Supabase usage outside `apps/web/app/api/admin/**`, plus public render paths that create service clients.

Safety posture: this pass made local access-control hardening only. It did not change sales assignment logic, outreach sending, provider webhooks, checkout pricing, dashboard UI, or production data.

## Summary

The highest-risk non-admin service-role gap found in this pass was the `/api/agent/*` route family. The agent UI layout already redirects non-admin/non-sales-agent users away from agent pages, but the API routes themselves accepted any authenticated Supabase user before creating a service-role client. That left a direct API path where authenticated client users could call agent endpoints, even though returned records were mostly scoped by `assigned_agent_id = user.id`.

The patch moves the API boundary itself onto the shared admin/sales-agent guard layer and uses the existing agent-scope helper for admin preview behavior. A follow-up proxy review also moved the authenticated `/api/agent/log-action` and `/api/agent/preferences` wrappers onto the same role gate before they parse request bodies or proxy into downstream admin APIs.

## Patched Routes

Files:

- `apps/web/app/api/agent/dashboard/route.ts`
- `apps/web/app/api/agent/leads/route.ts`
- `apps/web/app/api/agent/leads/[leadId]/route.ts`
- `apps/web/app/api/agent/actions/route.ts`
- `apps/web/app/api/agent/replies/route.ts`
- `apps/web/app/api/agent/log-action/route.ts`
- `apps/web/app/api/agent/preferences/route.ts`

Controls added:

- `requireAdminOrSalesAgent()` now runs before any service-role client is created.
- `resolveAgentScope()` now enforces that sales agents cannot request another rep through `preview_agent_id`.
- Admin preview with `?preview_agent_id=` remains available.
- Admins without preview keep the prior default behavior of using their own user id as the effective agent id.
- Lead detail now filters `sales_leads` by `assigned_agent_id` for sales-agent users before fetching the row, rather than reading an arbitrary lead first and rejecting afterward.
- Agent proxy wrappers now require `requireAdminOrSalesAgent()` before log-action body parsing or alert-preference proxy forwarding.
- Downstream admin routes remain guarded and still receive the forwarded authenticated cookie.

Behavior intentionally preserved:

- Sales agents can still read their assigned dashboard, lead queue, action queue, replies, and lead details.
- Admins can still preview a specific agent by passing `preview_agent_id`.
- Sales agents can still log their own mobile actions and read their own alert preferences through the existing proxy routes.
- No send, payment, lead-status, assignment, or campaign business logic was changed.

## Other Non-Admin Service-Role Buckets Reviewed

Provider webhooks:

- `apps/web/app/api/webhooks/stripe/route.ts`
- `apps/web/app/api/webhooks/twilio/status/route.ts`
- `apps/web/app/api/webhooks/outreach/sms/route.ts`
- `apps/web/app/api/webhooks/postmark/route.ts`
- `apps/web/app/api/webhooks/facebook/route.ts`
- `apps/web/app/api/facebook/webhook/route.ts`

Status: retained. These are intentionally service-role-backed provider ingress routes and already have signature/basic-auth/fail-closed controls from earlier stabilization passes.

Checkout/public payment-adjacent routes:

- `apps/web/app/api/spots/checkout/route.ts`
- `apps/web/app/api/stripe/targeted-checkout/route.ts`
- `apps/web/app/api/intelligence/checkout/route.ts`

Status: retained. These now have first-layer rate limits plus their existing auth/token/payment-webhook controls. Stripe success-path QA still must happen in test mode only.

Public/read-oriented routes and render paths:

- `apps/web/app/api/spots/resolve/route.ts`
- `apps/web/app/sitemap.ts`
- `apps/web/app/(funnel)/intelligence/page.tsx`

Status: retained. These are read-oriented service-role users.

Follow-up completed: `/api/spots/resolve` now has a first-layer `spots:resolve` public rate limit before service-role client creation. See `PUBLIC_READ_ANTI_ABUSE_AUDIT.md`.

## Validation

- Focused agent-route ESLint passed with 0 warnings/errors after the patch.
- Focused `apps/web/lib/auth/__tests__/api-guards.test.ts` passed with 4 tests.
- Focused web typecheck passed for `@homereach/web`.
- Full `pnpm test` passed with 187 tests across 25 files.
- Full `pnpm exec turbo type-check --ui=stream` passed across 5 packages.
- Full `pnpm --filter @homereach/web lint` passed with 494 existing warnings and 0 errors.
- Placeholder-env `pnpm --filter @homereach/web build` generated 248 routes successfully.
- Follow-up proxy guard tests passed with 4 tests, focused auth guard tests passed with 4 tests, focused proxy/auth ESLint passed with 0 warnings/errors, focused web typecheck passed, full `pnpm test` passed with 196 tests across 27 files, full workspace typecheck passed across 5 packages, full web lint passed with 493 existing warnings and 0 errors, placeholder-env web build generated 247 static pages, and `git diff --check` passed.
- GitHub Actions `Validate` run #56 passed, Vercel deployment `dpl_7yeeUfDqkGMXsnZEpuLnRzGoCr5L` reached `READY`, and hosted unauthenticated probes confirmed `/api/agent/preferences` and invalid-body `/api/agent/log-action` both return 401.

## Remaining Risk

- Service-role usage still exists outside `/api/admin` by design for provider webhooks, checkout creation, public page data reads, and public slug resolution.
- `/api/spots/resolve` now has a lightweight in-process rate limit, but this should become a distributed edge/provider-backed control before traffic scaling.
- This pass did not validate authenticated browser agent workflows end to end; it validates compile-time and guard-helper behavior only.
