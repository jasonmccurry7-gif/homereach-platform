# Targeted Direct Mail Production SOP

Status: Production-ready operating guide  
Owner: Direct Mail Fulfillment  
Primary admin surface: `/admin/targeted-campaigns`  
Primary public funnel: `/targeted`

## Offer

Targeted Direct Mail gives a local business a dedicated postcard campaign around an approved geography.

Current founder-rate packages:

| Package | Homes | Price |
| --- | ---: | ---: |
| Neighborhood Launch | 500 | $400 |
| Local Awareness Expansion | 1,000 | $770 |
| High-Value Homeowner Reach | 2,500 | $1,825 |
| Territory Domination | 5,000 | $3,500 |

The price includes campaign planning, design direction, print, postage, and standard delivery coordination for the selected package. Custom route counts, specialty formats, rushed production, or bundled services require owner-approved quoting.

## Sales Promise

Use outcome-first language:

- Local visibility in selected neighborhoods.
- A simple route plan instead of print-shop complexity.
- Proof approval before anything mails.
- Payment through Stripe before vendor handoff.
- Reporting on mail quantity, status, QR scans, landing page visits, calls, forms, and notes where available.

Do not promise guaranteed leads, sales, calls, ROI, delivery dates, or USPS outcomes.

## Required Flow

1. Prospect visits `/targeted`.
2. Prospect starts at `/targeted/start`.
3. Lead record is created.
4. Prospect completes `/targeted/intake`.
5. Campaign record is created with authoritative server-side pricing.
6. Checkout token is generated.
7. Prospect reviews route/proof expectations on `/targeted/checkout`.
8. Prospect confirms the acknowledgement checkbox.
9. Stripe Checkout session is created.
10. Stripe webhook marks payment complete.
11. Admin moves the campaign through design and proof statuses.
12. Admin marks mailed only after payment, proof approval, route count, and vendor handoff are verified.

## Admin Lifecycle

Use `/admin/targeted-campaigns` as the source of truth.

Allowed manual lifecycle actions:

- Queue design after payment.
- Start design when a designer begins proof work.
- Mark proof ready when the proof is ready for review.
- Approve proof only after final proof, route, and quote review.
- Mark mailed and notify only after proof approval and mail entry confirmation.

Payment, mailed, and completion states must not be faked through generic status edits.

## Approval Gates

Required before Stripe payment:

- Package and price visible to the client.
- Route/proof/no-guarantee acknowledgement accepted.

Required before print/vendor handoff:

- Payment confirmed.
- Route or household count verified.
- Final proof approved.
- QR/URL destination checked.
- No unsupported claims.
- No prohibited targeting, surveillance, or guaranteed outcome language.

Required before customer notifications:

- Admin explicitly confirms send or mailed notification action.

## Smoke Test

Run:

```bash
pnpm smoke:targeted-direct-mail
```

The smoke test verifies:

- `/targeted`, `/targeted/start`, `/targeted/intake`, `/targeted/checkout`, and `/targeted/confirmed` load.
- Lead creation works.
- Intake creates a campaign.
- Server pricing overrides spoofed client pricing.
- Signed checkout token works.
- Stripe Checkout creates a payment session.
- The test session is expired without payment.
- Supabase campaign and lead records are verified and marked as QA archived.

## Reporting

Use `docs/DIRECT_MAIL_CAMPAIGN_REPORT_TEMPLATE.md`.

Track:

- Mail quantity.
- Target geography.
- Drop or in-home window.
- Proof approval timing.
- QR scans.
- Landing page visits.
- Calls, forms, and offer mentions when available.
- Delivery or vendor notes.
- Recommended next drop, bundle, or follow-up.

## Rollback

If targeted checkout or fulfillment becomes unstable:

1. Change the service catalog status to `sellable_needs_fresh_smoke`.
2. Keep `/targeted` public but route new prospects to manual review.
3. Disable heavy promotion until `pnpm smoke:targeted-direct-mail` passes.
4. Use admin-visible payment-required tasks or owner-approved invoices for active prospects.
