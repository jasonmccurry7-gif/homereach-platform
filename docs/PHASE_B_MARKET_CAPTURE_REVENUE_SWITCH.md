# Phase B: Market Capture Revenue Switch

Date: 2026-05-29

## Decision

HomeReach public positioning now leads with Market Capture as the fastest revenue path.

## Production Pricing

- Market Capture Starter: $499/month management fee
- Recommended starter ad spend: $1,000/month, client-funded separately
- Recommended starter commitment: 3 months
- Growth tier: $749/month management fee
- Dominance tier: $999/month management fee

Ad spend remains separate from the HomeReach management fee. Direct mail, landing pages, creative packages, and political work remain quote/add-on paths.

## Launch Mode

- `ENABLE_MANUAL_AD_LAUNCH_MODE=true`
- `ENABLE_AD_API_LAUNCH=false`

Paid campaigns remain manual-first and approval-gated. The platform may prepare plans, drafts, tracking notes, and launch packages, but it must not auto-launch paid ads.

## Stripe

Market Capture checkout uses Stripe Checkout in subscription mode.

Optional production catalog variable:

```env
STRIPE_MARKET_CAPTURE_PRICE_ID=
```

When `STRIPE_MARKET_CAPTURE_PRICE_ID` is set and the selected plan is the $499 Starter plan, checkout uses that fixed recurring Stripe Price. When it is missing, checkout safely falls back to dynamic Stripe `price_data` so sales are not blocked.

## Go-Live Notes

- Create a live Stripe Product named `HomeReach Market Capture Management`.
- Create a live recurring monthly Price for `$499`.
- Add the Price ID to `STRIPE_MARKET_CAPTURE_PRICE_ID`.
- Keep Growth and Dominance available through dynamic checkout until dedicated Stripe Prices are created.
- Confirm Stripe webhook handling is live before selling in production.
- Keep ad spend outside this checkout flow unless HomeReach later adds a controlled ad-spend billing policy.
