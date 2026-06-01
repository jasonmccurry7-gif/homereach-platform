# Shared Postcards Production SOP

## Production Status

Shared Postcards is a sellable direct mail subscription offer when live inventory, payment, and proof approval gates pass.

Client-facing promise: a local business can reserve a shared postcard placement in an available city/category, approve the proof, and appear in the approved shared mail window.

Do not promise guaranteed leads, calls, sales, delivery dates beyond vendor or USPS estimates, or category exclusivity unless the live inventory check confirms the spot is available.

## Offer

- Public name: Shared Postcards
- Primary route: `/shared-postcards`
- Start route: `/get-started`
- AI-assisted intake route: `/shared-postcards/ai-intake`
- Admin route: `/admin/spots`
- Customer route: `/dashboard`
- Billing model: monthly Stripe subscription
- Term: 3-month minimum unless owner approves a different term
- Price basis: active city/category bundle pricing; current standard/founder pricing is read from `bundles`

## Approval Gates

Human review is required before:

- Proofs are sent to production.
- Mail windows are committed to a client.
- A category-protection or exclusivity claim is made.
- A paid subscription is changed, discounted, cancelled, or refunded.
- Any outbound client message is sent.

## Sales Flow

1. Client lands on `/shared-postcards`.
2. Client chooses a city at `/get-started`.
3. Client chooses a category at `/get-started/[citySlug]`.
4. Client chooses an available package at `/get-started/[citySlug]/[categorySlug]`.
5. Client reviews terms and starts Stripe Checkout at `/get-started/[citySlug]/[categorySlug]/checkout`.
6. Stripe confirms payment through `/api/webhooks/stripe`.
7. Admin verifies payment, inventory, proof requirements, and next mail window.

## AI Intake Flow

The AI-assisted intake is optional. If enabled, it helps the client select cities, categories, and placements before checkout.

Required controls:

- Recheck availability before checkout.
- Require account creation before payment.
- Create pending fulfillment records only when checkout is generated.
- Release or cancel pending fulfillment records when Stripe Checkout expires.

## Fulfillment Checklist

1. Confirm payment status.
2. Confirm city/category availability and spot assignment status.
3. Confirm business name, contact, phone, email, website, offer, logo, and image assets.
4. Create or update the postcard proof.
5. Send proof for client approval.
6. Record proof approval and timestamp.
7. Confirm print/mail vendor window.
8. Move campaign to upcoming or in production.
9. Log QR links, landing page links, call tracking, or response paths where available.
10. Report results and renewal recommendation.

## Reporting

Track the following when available:

- City and category.
- Spot type.
- Monthly subscription value.
- Mail window.
- Proof approval date.
- Estimated in-home window.
- QR scans.
- Landing page visits.
- Calls or form fills when tracked.
- Renewal status.
- Client notes and next recommended action.

Avoid attribution certainty claims. Use language such as "response signals we can track" instead of "this campaign caused every lead."

## Issue Handling

- If inventory is unavailable: pause checkout, recommend nearby cities or alternate categories, and log the client interest.
- If Stripe Checkout expires: confirm pending orders and spot assignments were cancelled or released.
- If proof is rejected: return to proof revision and do not send to print.
- If payment fails: do not commit print/mail spend until owner approval.
- If vendor timing changes: notify the client with a revised estimate and log the update.

## Smoke Test

Run:

```bash
pnpm smoke:shared-postcards
```

The smoke verifies:

- Public Shared Postcards routes load.
- A live available city/category/bundle exists.
- Resolve and availability APIs work.
- Unauthenticated checkout remains auth-gated.
- Success copy does not over-confirm unpaid orders.
- Admin spots route is gated or loads cleanly.
- AI intake route/API are either enabled cleanly or disabled cleanly.
- Stripe webhook is subscribed to `checkout.session.completed` and `checkout.session.expired` when local Stripe credentials are available.
- No stale pending inventory locks older than 24 hours are present.

## Rollback

If production checks fail:

1. Change the service catalog status back to `sellable_needs_inventory_audit`.
2. Route clients to manual quote or waitlist.
3. Pause active shared checkout links if inventory or Stripe reconciliation is uncertain.
4. Review `/admin/spots`, `orders`, `spot_assignments`, and AI intake sessions for stale pending records.
5. Redeploy after the failing gate is fixed.
