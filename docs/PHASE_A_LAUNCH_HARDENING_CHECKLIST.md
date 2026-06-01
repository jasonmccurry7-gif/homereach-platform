# Phase A Launch Hardening Checklist

Phase A protects the existing HomeReach platform before the next revenue rollout. It does not launch new paid automation, change active campaign settings, or modify database schema.

## Required Checks

- Homepage loads with expected content and compiled CSS assets.
- Market Capture sales page loads with expected content and compiled CSS assets.
- Market Capture intake loads with expected content and compiled CSS assets.
- Existing political and targeted public pages still load.
- Admin and client dashboard routes remain protected when unauthenticated.
- Ad-tech write APIs reject unauthenticated requests.
- Production environment variables include explicit OS-level and module-level feature flags.

## Commands

```bash
pnpm --filter @homereach/db type-check
pnpm --filter @homereach/web type-check
pnpm --filter @homereach/web build
pnpm smoke:phase-a
```

## Production Gate

Before Phase B, confirm:

- The production homepage CTA priority: keep supply-cost review as the front door, or switch the primary CTA to Market Capture.
- Supabase, Stripe, Postmark/email, Twilio, and app URL environment variables are set in production.
- `ENABLE_AD_API_LAUNCH=false` and `ENABLE_MANUAL_AD_LAUNCH_MODE=true` for the MVP.
- The `$499/month` Market Capture subscription path is approved for production.
- A rollback target is available before deployment.

## Rollback

- Disable new modules with their `ENABLE_*` flags.
- Keep `ENABLE_AD_API_LAUNCH=false`.
- Revert to the prior deployment if homepage, auth, payment, intake, or dashboard smoke checks fail.
