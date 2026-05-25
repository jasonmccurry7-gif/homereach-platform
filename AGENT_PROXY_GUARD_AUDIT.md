# Agent Proxy Guard Audit

Updated: 2026-05-25

Scope: authenticated `/api/agent/*` proxy routes that forward agent UI requests into admin/sales APIs.

Safety posture: this pass added API-boundary role checks only. It did not change sales event business logic, send behavior, message templates, lead ownership checks, alert preference schema, provider calls, or downstream admin route behavior.

## Summary

The `/api/agent/log-action` and `/api/agent/preferences` routes were thin authenticated proxies. They verified that a Supabase session existed, then forwarded to downstream admin APIs. The downstream admin APIs already required `admin` or `sales_agent` access before service-role work, but the proxy wrappers accepted any authenticated user until the downstream proxy target rejected them.

That meant non-agent authenticated users could still reach proxy routing and, for log-action, request body parsing before receiving the downstream authorization failure. This was not a direct service-role bypass, but it was an avoidable boundary inconsistency around sales activity and preference routes.

## Patched Routes

Files:

- `apps/web/app/api/agent/log-action/route.ts`
- `apps/web/app/api/agent/preferences/route.ts`

Controls added:

- Replaced generic session-only checks with `requireAdminOrSalesAgent()`.
- Non-agent authenticated users now receive 403 before proxy forwarding.
- Unauthenticated users still receive 401.
- Log-action failures now happen before body parsing, so rejected users cannot force JSON parsing or downstream proxy work.
- Valid admin/sales-agent requests still forward the authenticated user id as the agent id.
- Cookies are still forwarded to the downstream admin endpoint so the existing downstream guard remains active.

Behavior intentionally preserved:

- `/api/admin/sales/event` remains the source of truth for sales event persistence, lead ownership checks, pause controls, and optional send handling.
- `/api/admin/alerts/preferences` remains the source of truth for alert preference reads/writes.
- Sales agents still cannot submit another `agent_id`; the wrapper strips the body field and uses the authenticated user id.
- No sends, charges, provider calls, database writes, or production data mutations were performed during validation.

## Validation

- Focused agent proxy guard tests passed with 4 tests.
- Focused auth guard tests passed with 4 tests.
- Focused agent proxy/auth ESLint passed with 0 warnings/errors.
- Focused `@homereach/web` typecheck passed.
- Full `pnpm test` passed with 196 tests across 27 files.
- Full `pnpm exec turbo type-check --ui=stream` passed across 5 packages.
- Full `pnpm --filter @homereach/web lint` passed with 493 existing warnings and 0 errors.
- Placeholder-env `pnpm --filter @homereach/web build` generated 247 static pages successfully.
- `git diff --check` passed locally.

## Remaining Risk

- These routes still proxy through same-origin HTTP instead of calling shared service functions directly. That preserves existing behavior but is less simple than a future service-layer extraction.
- Send-capable behavior still lives in `/api/admin/sales/event` and must remain governed by approval/test-mode controls before live automation expansion.
