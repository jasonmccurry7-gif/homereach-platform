# Jobsite Halo Campaign Worksheet

## Offer

Jobsite Halo Campaigns turn completed or active jobs into neighborhood visibility campaigns.

The client provides recent jobsites, proof assets, offer details, and the target radius. HomeReach reviews the addresses, prepares the campaign plan, and launches manually only after payment, geography, creative, tracking, and approval gates are complete.

## Price Basis

- Uses Market Capture as the base offer.
- Starter: $499/month management fee + client-funded ad spend.
- Includes up to 5 jobsite clusters per month.
- Additional jobsite clusters: $49 each when owner-approved.
- Direct mail, landing pages, creative packages, and larger geographies are quoted separately.

## Required Intake Fields

Capture these in `/market-capture/intake`:

- Business name.
- Contact name.
- Industry.
- Monthly ad spend.
- Targeting type: Jobsite Halo.
- Target area summary.
- Jobsite address list.
- Preferred radius.
- Jobsite proof notes.
- Logo.
- Jobsite photos or proof assets.
- Campaign offer.
- Postcard add-on interest.
- Landing page need.
- Compliance acknowledgement.

## Jobsite Address Format

Preferred format:

```text
Job name | Street address, city, state | Notes
```

Examples:

```text
Smith roof replacement | 123 Main St, Akron OH | completed May 2026, exterior photos approved
Oak Avenue HVAC install | 456 Oak Ave, Canton OH | use neighborhood only, no customer name
```

If the client only knows the address, enter one address per line.

## Radius Defaults

HomeReach may adjust radius based on geography, platform rules, and client budget.

| Industry | Starter Radius | Notes |
| --- | ---: | --- |
| Roofing, solar, siding, windows | 1 mile | Best fit for high-ticket exterior proof |
| HVAC, plumbing, electrical, pest, concrete, landscaping, lawn, tree service | 1.5 miles | Wider local service halo |
| Real estate, med spa, dentist, restaurant, fitness, chiropractic | 2 miles | Wider local demand radius |
| Political campaigns | 3 miles/geography-based | Must stay geography-safe |
| Unknown/general local business | 1 mile | Conservative default |

Safe operating range:

- Minimum: 0.25 miles.
- Maximum: 10 miles.

If the client asks for a radius outside this range, document the request and constrain it before launch.

## Proof/Photo Workflow

Allowed:

- Client-provided jobsite photos.
- Client-approved project photos.
- Business-owned before/after images with approval.
- General crew, vehicle, yard sign, or service proof photos.

Review before use:

- House numbers.
- License plates.
- Children or private individuals.
- Customer names.
- Private interiors.
- Claims about customer results or savings.
- Political or regulated claims.

If proof is weak or not approved, use general brand creative and describe the campaign as targeting the surrounding neighborhood rather than showcasing a specific customer's property.

## Approval Gates

Do not launch until:

- Payment is confirmed.
- Ad spend is confirmed.
- Every jobsite address is client-approved.
- Radius settings are reviewed.
- Proof assets are approved.
- Campaign offer is approved.
- Destination/tracking URL is tested.
- Compliance review is complete.
- Admin explicitly approves manual launch.

## Tracking Setup

Use one campaign name and track jobsite clusters where possible.

Recommended UTM pattern:

```text
utm_campaign=jobsite_halo_[client_slug]_[yyyymm]
utm_content=[jobsite_or_cluster_slug]
```

If direct mail is included, use a QR/landing label that matches the jobsite cluster or neighborhood.

## Client Language

Use:

```text
We can keep your business visible around the neighborhoods where you are already doing good work.
```

Avoid:

- "We target your customer's neighbors individually."
- "We track everyone who drives by."
- "Guaranteed leads."
- "Guaranteed sales."
- "We follow homeowners."

## Admin Next Action

After intake:

1. Open `/admin/market-capture-sales`.
2. Review Jobsite Halo metadata.
3. Confirm payment path.
4. Move the lead to fulfillment after payment/scope approval.
5. Open `/admin/market-capture-fulfillment`.
6. Confirm campaign locations were created for each jobsite.
7. Use `docs/JOBSITE_HALO_LOCATION_REPORT_TEMPLATE.md` for reporting.
