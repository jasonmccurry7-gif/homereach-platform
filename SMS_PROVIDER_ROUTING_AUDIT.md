# SMS Provider Routing Audit

Updated: 2026-05-25

Scope: shared SMS provider routing, Twilio sender identity selection, outbound status callback telemetry, close-deal SMS posture, and outbound SMS safety gates.

Safety posture: this audit is based on local code inspection only. No live SMS was sent, no Twilio API was called, no production data was mutated, and no secret values were printed.

## Executive Summary

HomeReach has a central SMS sender in `packages/services/src/outreach/index.ts` that wraps Twilio and supports test mode, prospecting approval gates, messaging-service sends, explicit sender numbers, and status callback URLs.

Most newer SMS send paths use `sendSms()`. Close-deal email now uses the central email provider router, and close-deal SMS now uses the central SMS provider router with the assigned agent sender number, follow-up intent, and Twilio status callback telemetry. A follow-up telemetry pass added the same `/api/webhooks/twilio/status` callback URL to the remaining web-app customer/outreach SMS paths that already call the central SMS provider.

The main shared SMS routing risk found and fixed in this pass is sender identity precedence:

1. `sendSms()` accepts an explicit `fromNumber`.
2. `sendSms()` also reads `OUTREACH_TWILIO_MESSAGING_SERVICE_SID` or `TWILIO_MESSAGING_SERVICE_SID`.
3. Before this fix, when both existed, the send path preferred the messaging service over the explicit sender number.
4. Several customer-facing sales flows pass an agent-specific phone number from `agent_identities.twilio_phone`, so the shared service could unintentionally send from the environment messaging service instead of the assigned agent number.
5. The shared service now preserves an explicit sender number unless the caller also explicitly supplies a messaging-service SID.

## Shared SMS Provider Flow

Primary files:

- `packages/services/src/outreach/index.ts`
- `packages/services/src/outreach/identity.ts`

Observed behavior:

1. `sendSms()` reads `OUTREACH_TEST_MODE`; when true, it returns a synthetic success without creating a Twilio client.
2. Prospecting SMS is blocked when `OUTREACH_MANUAL_APPROVAL_MODE=true`.
3. Prospecting SMS is blocked unless `OUTREACH_SMS_PROSPECTING_LIVE_ENABLED=true`.
4. Twilio credentials come from `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN`.
5. Sender identity comes from explicit `fromNumber`, `OUTREACH_SMS_FROM_NUMBER`, or `TWILIO_PHONE_NUMBER`.
6. Messaging service identity comes from explicit `messagingServiceSid`, `OUTREACH_TWILIO_MESSAGING_SERVICE_SID`, or `TWILIO_MESSAGING_SERVICE_SID`.
7. Send payload now prefers an explicit `fromNumber` over an environment-derived messaging-service SID, while preserving explicit `messagingServiceSid` when a caller intentionally supplies one.
8. Customer/outreach SMS paths in the web app now pass the shared Twilio status callback URL when the call site is intended to track outbound delivery state.

Relevant env names:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`
- `OUTREACH_SMS_FROM_NUMBER`
- `OUTREACH_TWILIO_MESSAGING_SERVICE_SID`
- `TWILIO_MESSAGING_SERVICE_SID`
- `OUTREACH_TEST_MODE`
- `OUTREACH_MANUAL_APPROVAL_MODE`
- `OUTREACH_SMS_PROSPECTING_LIVE_ENABLED`

## Sender Identity Risk

Primary files:

- `packages/services/src/outreach/index.ts`
- `packages/services/src/outreach/identity.ts`
- `apps/web/app/api/admin/sales/event/route.ts`
- `apps/web/app/api/admin/automation/send-due/route.ts`
- `apps/web/app/api/admin/agents/echo/route.ts`

What was wrong:

- Callers pass explicit agent phone numbers into `sendSms({ fromNumber })`.
- If a messaging-service SID exists in environment, the shared service used the messaging-service SID instead of the explicit agent number.

Why it mattered:

- Agent identity matters for coordinated outreach and reply continuity.
- Internal documentation already says customer-facing outbound SMS uses `agent_identities.twilio_phone`.
- This could make sender behavior environment-dependent and hard to reason about during Twilio/A2P rollout.

Fix applied:

- Preserve the messaging-service default when no explicit sender number is supplied.
- Preserve an explicitly supplied `messagingServiceSid` when a caller intentionally passes one.
- Prefer an explicit `fromNumber` over an environment-derived messaging-service SID.
- Add focused unit tests around test mode, explicit sender numbers, explicit messaging service, and environment fallback behavior.

Validation:

- `pnpm exec vitest run packages/services/src/outreach/__tests__/sms.test.ts` passed with 5 tests.
- `pnpm --filter @homereach/services type-check` passed.
- `pnpm test` passed with 203 tests across 30 files.
- `pnpm exec turbo type-check --ui=stream` passed across 5 packages.
- `pnpm --filter @homereach/web lint` passed with 492 existing warnings and 0 errors.
- Placeholder-env `pnpm --filter @homereach/web build` passed and generated 247 static pages.
- `git diff --check` passed.
- A standalone root `pnpm exec eslint packages/services/...` check is not available because the repository does not expose a root ESLint flat config for package-level linting.

Risk of fix:

- Low to medium. The change is centralized and testable, but it affects SMS sender selection for any route that passes an agent-specific `fromNumber`.

Approval needed:

- No for branch-local shared-service identity selection hardening and unit tests.
- Yes before live Twilio validation, SMS sends, or production messaging-service changes.

## Close-Deal SMS Posture

Primary file:

- `apps/web/app/api/admin/sales/close-deal/route.ts`

Observed behavior:

- Close-deal SMS now calls central `sendSms()` instead of a route-local direct Twilio helper.
- The route is admin/sales-agent gated and validates lead ownership for sales agents.
- The SMS body includes a STOP opt-out line.
- The route requires `agent_identities.twilio_phone` for SMS sends and passes it as `fromNumber`, preserving the assigned rep/sender identity.
- The route passes `intent: "follow_up"` so the existing prospecting-specific live-send gates do not block an already-active close-deal follow-up.
- The route passes `statusCallbackUrl` to `/api/webhooks/twilio/status` using the shared public app URL resolver.
- The route now benefits from central `sendSms()` test mode, explicit sender precedence, optional explicit messaging-service handling, and status callback support.

Fix applied:

- Imported `sendSms()` from `@homereach/services/outreach`.
- Removed the direct route-local Twilio helper from `/api/admin/sales/close-deal`.
- Added focused route coverage proving the SMS path calls `sendSms()` with the lead phone, assigned agent `fromNumber`, `follow_up` intent, status callback URL, and STOP-compliant body.

Validation:

- `pnpm exec vitest run apps/web/app/api/admin/sales/__tests__/close-deal.test.ts packages/services/src/outreach/__tests__/sms.test.ts` passed with 7 tests.
- `pnpm --filter @homereach/web exec eslint app/api/admin/sales/close-deal/route.ts app/api/admin/sales/__tests__/close-deal.test.ts` passed with 0 warnings/errors.
- `pnpm --filter @homereach/web type-check` passed.
- `pnpm test` passed with 204 tests across 30 files.
- `pnpm exec turbo type-check --ui=stream` passed across 5 packages.
- `pnpm --filter @homereach/web lint` passed with 492 existing warnings and 0 errors.
- Placeholder-env `pnpm --filter @homereach/web build` passed and generated 247 static pages.
- `git diff --check` passed.

Remaining risk:

- Live Twilio behavior still needs test-mode/sandbox validation before production SMS trust because no live SMS was sent and no hosted send-capable endpoint was invoked in this branch pass.

## Status Callback Coverage

Primary files:

- `apps/web/lib/outreach/twilio-status-callback.ts`
- `apps/web/lib/engine/automation.ts`
- `apps/web/app/api/admin/sales/event/route.ts`
- `apps/web/app/api/admin/sales/close-deal/route.ts`
- `apps/web/app/api/admin/automation/send-due/route.ts`
- `apps/web/app/api/admin/agents/echo/route.ts`

Observed gap:

- `/api/admin/sales/close-deal` already passed a Twilio status callback URL.
- Other customer/outreach SMS paths used central `sendSms()` but did not pass `statusCallbackUrl`, so delivery telemetry could depend on Twilio-side default configuration instead of route-level intent.

Fix applied:

- Added `getTwilioStatusCallbackUrl()` as the shared web-app callback helper.
- Passed the helper into sales-event sends, scheduled automation sends, Echo agent sends, close-deal sends, and `AutomationEngine.sendSms()`.
- Removed stale unused direct Twilio helper code from sales-event and Echo agent routes; active SMS sends now go through central `sendSms()`.
- Internal/operator alert SMS paths were left unchanged; they already log their own alert records and are not customer outreach sequences.

Validation:

- `pnpm exec vitest run apps/web/lib/outreach/__tests__/twilio-status-callback.test.ts apps/web/app/api/admin/sales/__tests__/close-deal.test.ts packages/services/src/outreach/__tests__/sms.test.ts` passed with 8 tests.
- Focused ESLint on the touched helper/routes passed with 0 errors and 14 pre-existing warnings in `apps/web/app/api/admin/agents/echo/route.ts` and `apps/web/app/api/admin/sales/event/route.ts`.
- Follow-up focused ESLint on `apps/web/app/api/admin/agents/echo/route.ts` and `apps/web/app/api/admin/sales/event/route.ts` passed with 0 warnings/errors after stale helper cleanup.
- `pnpm test` passed with 209 tests across 33 files.
- `pnpm exec turbo type-check --ui=stream` passed across 5 packages.
- `pnpm --filter @homereach/web lint` passed with 478 existing warnings and 0 errors after stale helper cleanup.
- Placeholder-env `pnpm --filter @homereach/web build` passed and generated 247 static pages.
- `git diff --check` passed with Windows line-ending warnings only.

Approval needed:

- No for additive callback metadata on existing central-provider SMS calls.
- Yes before live Twilio validation, SMS sends, or provider-side status callback configuration changes.
