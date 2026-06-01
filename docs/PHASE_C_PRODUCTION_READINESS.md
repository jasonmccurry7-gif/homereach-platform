# Phase C: Production Checkout Readiness

Date: 2026-05-29

## Objective

Phase C prepares the Market Capture revenue path for production launch.

This phase does not add new product modules, launch ads, send outreach, or charge customers. It verifies that the sales page, intake flow, protected routes, and Stripe subscription checkout can operate safely before deployment.

## Stripe Configuration

Market Capture Starter uses a fixed live Stripe Price:

```env
STRIPE_MARKET_CAPTURE_PRICE_ID=price_1TcXKaH2Y5gVxDOVDVEfyuUA
```

Verified Stripe catalog state:

- Product: `Market Capture Starter`
- Amount: `$499/month`
- Currency: `usd`
- Mode: live
- Product status: active
- Price status: active

## Required Production Environment

Set these in the production environment before go-live:

```env
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_MARKET_CAPTURE_PRICE_ID=price_1TcXKaH2Y5gVxDOVDVEfyuUA
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_APP_URL=https://www.home-reach.com
CHECKOUT_TOKEN_SECRET=...
ENABLE_MARKET_CAPTURE=true
ENABLE_MARKET_CAPTURE_INTAKE=true
ENABLE_MARKET_CAPTURE_PIPELINE=true
ENABLE_MARKET_CAPTURE_PAYMENT=true
ENABLE_MANUAL_AD_LAUNCH_MODE=true
ENABLE_AD_API_LAUNCH=false
```

Security note: rotate any Stripe secret key that has been pasted into chat, screenshots, tickets, docs, or logs before final production use.

## Verification Commands

Run local type-check:

```bash
pnpm --filter @homereach/web type-check
```

Verify Stripe account, key mode, and Market Capture Price:

```bash
pnpm smoke:market-capture-stripe
```

Create and immediately expire a live Checkout Session dry run:

```bash
pnpm smoke:market-capture-stripe:checkout
```

Run protected-core smoke:

```bash
pnpm smoke:phase-a
```

Build before deployment:

```bash
pnpm --filter @homereach/web build
```

## Go-Live Gate

Do not launch production traffic until all are true:

- Stripe live key authenticates.
- Stripe publishable key and secret key are both live mode.
- Market Capture Starter Price resolves to `$499/month`.
- Checkout dry run creates and expires successfully.
- Stripe webhook secret is production/live and set in the hosting environment.
- Homepage loads with Market Capture positioning.
- `/market-capture` loads.
- `/market-capture/intake` loads.
- Existing protected admin/client routes remain protected.
- Existing political and direct mail public routes still load.
- Manual launch mode remains enabled.
- Ad API launch remains disabled.

## Rollback Plan

If production checkout fails:

1. Set `ENABLE_MARKET_CAPTURE_PAYMENT=false`.
2. Keep intake active if lead capture still works.
3. Use manual payment follow-up from the admin pipeline.
4. Revert to the previous deployment if homepage, auth, Stripe, or dashboard protection regresses.
5. Keep `ENABLE_AD_API_LAUNCH=false`.

## Human Approval Boundaries

Human approval is still required before:

- Charging a customer.
- Changing pricing.
- Sending payment links manually.
- Launching paid ads.
- Changing active campaign settings.
- Sending outbound email, SMS, DMs, or social posts.
