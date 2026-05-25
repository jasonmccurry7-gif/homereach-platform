# SMS Provider Routing Audit

Updated: 2026-05-25

Scope: shared SMS provider routing, Twilio sender identity selection, close-deal SMS posture, and outbound SMS safety gates.

Safety posture: this audit is based on local code inspection only. No live SMS was sent, no Twilio API was called, no production data was mutated, and no secret values were printed.

## Executive Summary

HomeReach has a central SMS sender in `packages/services/src/outreach/index.ts` that wraps Twilio and supports test mode, prospecting approval gates, messaging-service sends, explicit sender numbers, and status callback URLs.

Most newer SMS send paths use `sendSms()`. The close-deal SMS route still uses a direct route-local Twilio helper, while close-deal email now uses the central email provider router.

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
- Yes before live Twilio validation, SMS sends, production messaging-service changes, or close-deal SMS behavior changes.

## Close-Deal SMS Posture

Primary file:

- `apps/web/app/api/admin/sales/close-deal/route.ts`

Observed behavior:

- Close-deal SMS currently uses a direct Twilio REST helper with `To`, `From`, and `Body`.
- The route is admin/sales-agent gated and validates lead ownership for sales agents.
- The SMS body includes a STOP opt-out line.
- The helper does not use central `sendSms()` test mode, prospecting approval gates, messaging-service handling, or status callback support.

Risk:

- Changing close-deal SMS to `sendSms()` could be beneficial, but it may intentionally change live behavior through test-mode, approval, messaging-service, or callback semantics.

Safest next step:

- First harden and test shared `sendSms()` sender identity precedence.
- Then separately decide whether close-deal SMS should move to central `sendSms()` with `intent: "follow_up"` or another explicit intent, status callback URL, and preserved agent sender identity.
