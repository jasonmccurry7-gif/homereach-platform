# Jobsite Halo Fulfillment SOP

## Purpose

This SOP converts a paid Market Capture lead into a Jobsite Halo campaign that can be manually launched and reported without spreadsheet tracking.

## Production Position

Jobsite Halo is a Market Capture variant.

Base offer:

- $499/month management fee.
- Client-funded ad spend.
- Manual launch only.
- Up to 5 jobsite clusters per month in the starter package.

## Fulfillment Flow

1. Review intake.
2. Confirm the targeting type includes Jobsite Halo.
3. Confirm jobsite address list exists.
4. Confirm payment or owner-approved exception.
5. Confirm client-funded ad spend.
6. Review radius preference against industry defaults.
7. Review proof/photo assets.
8. Validate every jobsite can be used safely.
9. Create or confirm campaign locations in fulfillment.
10. Prepare manual launch package.
11. Route creative/geography/budget for approval.
12. Launch manually after explicit approval.
13. Report by jobsite or neighborhood where available.

## Data Storage

Structured jobsite data is stored on:

```text
market_capture_leads.metadata.jobsite_halo
```

When fulfillment initializes, each submitted jobsite should create a row in:

```text
market_capture_campaign_locations
```

with:

- `location_type = jobsite`
- `name`
- `address`
- `radius_miles`
- `notes`

## Radius Review

Use the defaults in `docs/JOBSITE_HALO_CAMPAIGN_WORKSHEET.md`.

Admin may adjust radius if:

- The client's budget is too small for the requested radius.
- The jobsite is in a rural area.
- The jobsite is in a dense urban area.
- Platform availability limits targeting.
- The campaign objective is awareness instead of leads/calls.

Document any override in the campaign notes before launch.

## Proof Review

Proof assets are useful only if they are safe and approved.

Check:

- No visible private information.
- No unapproved faces.
- No customer names without approval.
- No unsupported before/after claim.
- No claim that implies a guaranteed result.
- No property detail that could create privacy concerns.

If assets fail review:

- Mark creative status as needs review or rejected.
- Request alternate assets.
- Use general brand creative if needed.

## Location-Level Reporting

Use `docs/JOBSITE_HALO_LOCATION_REPORT_TEMPLATE.md`.

Report at the most reliable level available:

- Jobsite cluster if platform data supports it.
- Neighborhood if the jobsite cannot be separated cleanly.
- Campaign-level summary if platform reporting is not granular enough.

Never imply exact person-level attribution.

## Manual Launch Guardrails

Never:

- Auto-launch ads.
- Launch before payment or approved exception.
- Launch before geography/creative/budget approval.
- Claim that HomeReach tracks individual homeowners.
- Use customer proof without approval.
- Use prohibited targeting categories.

## Smoke Test

Run:

```bash
pnpm smoke:market-capture-live-funnel
pnpm monitor:market-capture
pnpm monitor:market-capture:first-customer
```

The live funnel smoke submits a QA Jobsite Halo address list, confirms metadata is stored, creates and expires a Stripe Checkout Session, and verifies the sales pipeline, tasks, and drafts.
