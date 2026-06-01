# Phase D: Live Funnel Verification

Date: 2026-05-29

## Objective

Phase D verifies the live Market Capture revenue funnel without charging a customer, sending outreach, launching ads, or changing active campaign settings.

The goal is to prove:

- Public Market Capture intake accepts a qualified prospect.
- Intake creates the lead, pipeline, task, and draft handoff records.
- Checkout summary shows the correct `$499/month` management fee.
- Stripe Checkout opens against the configured live Market Capture Price.
- The test Checkout Session can be expired immediately without creating a paid subscription.
- The client status page loads after intake.

## Verification Command

```bash
pnpm smoke:market-capture-live-funnel
```

The command defaults to:

```env
LIVE_FUNNEL_BASE_URL=https://www.home-reach.com
```

Override the target when needed:

```bash
LIVE_FUNNEL_BASE_URL=https://your-preview-url.vercel.app pnpm smoke:market-capture-live-funnel
```

## What The Smoke Creates

The smoke creates one clearly labeled QA lead:

- Business name starts with `HomeReach QA Market Capture`.
- Email starts with `qa+market-capture-`.
- Campaign notes state that the record is an internal Phase D smoke test.

It also creates one Stripe Checkout Session and immediately expires it.

## What The Smoke Does Not Do

- It does not enter card details.
- It does not create a paid subscription.
- It does not charge a customer.
- It does not send outbound email, SMS, DMs, or social posts.
- It does not launch or modify ads.
- It does not delete production records.

## Database Checks

If local Supabase service-role env vars are available, the smoke verifies:

- `market_capture_leads` contains the QA lead.
- `market_capture_pipeline` moved to `payment_pending`.
- `market_capture_tasks` were generated.
- `market_capture_drafts` were generated.
- The lead references the created Stripe Checkout Session.

Phase D also confirmed production was missing the Market Capture 1A/1B tables on the first live run. The additive migrations below were applied to production Supabase so the deployed app can write intake, pipeline, tasks, drafts, and fulfillment handoff records:

```text
supabase/migrations/20260528231323_market_capture_sales_engine.sql
supabase/migrations/20260529004906_market_capture_fulfillment_engine.sql
```

Supabase migration history was repaired for these two versions after the direct production apply so future migration checks show them as applied.

To run API/page checks without database verification:

```bash
pnpm smoke:market-capture-live-funnel -- --skip-db-checks
```

## Human Approval Boundaries

Human approval is still required before:

- Charging a real customer.
- Sending a payment link manually.
- Changing pricing.
- Sending outbound messages.
- Launching paid ads.
- Publishing customer-facing claims or campaign creative.

## Security Note

Any Stripe secret key pasted into chat, screenshots, tickets, docs, or logs must be rotated in Stripe and replaced in Vercel before paid production traffic.

## Stripe Webhook Status

The live Stripe webhook is enabled for:

- `checkout.session.completed`
- `checkout.session.expired`

This covers the critical paid-checkout event and the abandoned/expired Checkout cleanup path.
