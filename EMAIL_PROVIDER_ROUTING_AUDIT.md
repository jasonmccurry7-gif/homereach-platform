# Email Provider Routing Audit

Updated: 2026-05-25

Scope: outbound email provider selection, warmup sender identity handling, Mailgun/Postmark/Resend env dependencies, and send-capable route posture.

Safety posture: this pass made one local code hardening change and documentation updates only. No live email was sent, no provider API was called, no production data was read or mutated, and no provider env values were printed.

## Executive Summary

HomeReach now has a central outreach email sender in `packages/services/src/outreach/index.ts` that can route through Resend, Mailgun, or Postmark based on `EMAIL_PROVIDER` and available credentials. Most current send-capable routes import `sendEmail()` from that central service.

Two routing risks were found:

1. The email warmup job attempted to switch sender identity by temporarily mutating `process.env.MAILGUN_FROM_EMAIL` and `process.env.MAILGUN_FROM_NAME`. That is unsafe in a shared serverless runtime and can be ineffective because the central identity resolver prefers explicit options and `DEFAULT_FROM_EMAIL` before `MAILGUN_FROM_EMAIL`.
2. `/api/admin/sales/close-deal` still has a direct Mailgun email helper. If production is configured for `EMAIL_PROVIDER=resend` or `EMAIL_PROVIDER=postmark`, this route can fail email sends unless Mailgun credentials are also present.

## Central Email Provider Flow

Primary file:

- `packages/services/src/outreach/index.ts`

Observed behavior:

1. `sendEmail()` reads `options.provider` first.
2. If no provider override exists, it infers from `EMAIL_PROVIDER` when set to `resend`, `mailgun`, or `postmark`.
3. If `EMAIL_PROVIDER` is absent or invalid, it falls back by available credentials in this order: `RESEND_API_KEY`, `MAILGUN_API_KEY` plus `MAILGUN_DOMAIN`, `POSTMARK_API_TOKEN`, then `resend`.
4. Sender identity comes from explicit `fromEmail` / `fromName` / `replyTo` options first, then env defaults.
5. `OUTREACH_TEST_MODE=true` makes `sendEmail()` return a synthetic success without calling providers.

Relevant env names:

- `EMAIL_PROVIDER`
- `RESEND_API_KEY`
- `MAILGUN_API_KEY`
- `MAILGUN_DOMAIN`
- `POSTMARK_API_TOKEN`
- `POSTMARK_FROM_EMAIL`
- `DEFAULT_FROM_EMAIL`
- `DEFAULT_REPLY_TO_EMAIL`
- `OUTREACH_TEST_MODE`

## Warmup Sender Identity Fix

Primary file:

- `apps/web/app/api/admin/email/warmup/send/route.ts`

What was wrong:

- The route changed `process.env.MAILGUN_FROM_EMAIL` and `process.env.MAILGUN_FROM_NAME` around each warmup send.
- That could leak sender identity between overlapping requests in a shared runtime.
- It also did not reliably override the active sender because the central identity resolver can prefer `DEFAULT_FROM_EMAIL` ahead of `MAILGUN_FROM_EMAIL`.

Fix applied:

- Removed temporary `process.env` mutation.
- Passed `fromEmail: identity.from_email` and `fromName: identity.from_name ?? "HomeReach"` directly into `sendEmail()` for seed and real-prospect warmup sends.
- Added a focused route test proving agent identity is passed directly and the provider env variables stay unchanged.

Validation:

- `pnpm exec vitest run apps/web/app/api/admin/email/warmup/__tests__/send-route.test.ts` passed with 1 test.
- Focused ESLint on the warmup route and new test passed with 0 warnings/errors after removing a touched-file unused local.
- `pnpm test` passed with 197 tests across 28 files.
- `pnpm exec turbo type-check --ui=stream` passed across 5 packages.
- `pnpm --filter @homereach/web lint` passed with 492 existing warnings and 0 errors.
- Placeholder-env `pnpm --filter @homereach/web build` passed and generated 247 static pages.
- `git diff --check` passed.

Risk of fix:

- Low. This preserves the existing central provider routing and warmup cadence while making the intended sender identity explicit and request-local.

## Mailgun-Only Close-Deal Risk

Primary file:

- `apps/web/app/api/admin/sales/close-deal/route.ts`

Observed behavior:

- SMS close-deal sends use a direct Twilio helper.
- Email close-deal sends use a direct Mailgun helper and do not route through `sendEmail()`.
- The route is access-gated, but provider selection is not aligned with the central `EMAIL_PROVIDER` router.

Why it matters:

- If production uses Resend or Postmark as the active provider, close-deal email sends can fail with `Mailgun credentials not configured`.
- Close-deal is revenue-sensitive, so provider routing should be unified only in a dedicated patch with focused tests and no live sends.

Safest next fix:

- Replace the direct Mailgun email helper with central `sendEmail()` while preserving the existing subject, HTML, text, sender identity, lead logging, and error behavior.
- Consider whether the direct Twilio helper should also move to `sendSms()` in a separate explicit pass because that could introduce approval/test-mode gates that may intentionally block live sends.

Approval needed:

- No for documentation and local branch tests.
- Yes before any live close-deal provider validation, live email/SMS send, or production automation run.

## Remaining Email Provider Questions

- Confirm the intended production value of `EMAIL_PROVIDER` without exposing the value in reports.
- Confirm whether Mailgun is still intentionally supported for close-deal only, or whether all sends should use the central provider router.
- Confirm `POSTMARK_WEBHOOK_USER` and `POSTMARK_WEBHOOK_PASSWORD` are configured when `ENABLE_POSTMARK_WEBHOOK` is not explicitly `false`.
- Confirm whether `RESEND_API_KEY` is present if `EMAIL_PROVIDER=resend`.
- Confirm whether `POSTMARK_FROM_EMAIL` is present if `EMAIL_PROVIDER=postmark`.
