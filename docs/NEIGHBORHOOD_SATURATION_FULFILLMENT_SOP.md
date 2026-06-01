# Neighborhood Saturation Fulfillment SOP

Neighborhood Saturation is a Market Capture variant that helps a local business stay visible in the areas where it wants more awareness, repeat exposure, and demand.

This is not surveillance. This is not individual-level targeting. This is geography-level market visibility.

## Fulfillment Entry Point

Use the existing Market Capture flow:

1. Prospect submits `/market-capture/intake`.
2. Prospect selects Neighborhood Saturation or supplies neighborhood details.
3. Market Capture lead is created.
4. Stripe subscription checkout is created for the management fee.
5. Fulfillment begins only after payment, budget, target geography, and approval gates are satisfied.

## System Records

Structured saturation details are stored on:

```text
market_capture_leads.metadata.neighborhood_saturation
```

When fulfillment initializes, each structured area creates a row in:

```text
market_capture_campaign_locations
```

Stored as:

- `location_type = target_geography`
- `name = area name`
- `notes = geography, area type, priority, budget notes, planning notes`

No migration is required for Phase 1 production hardening.

## Checklist

1. Review intake.
2. Confirm Neighborhood Saturation targeting type.
3. Review structured area list.
4. Review score and missing items.
5. Confirm budget per area.
6. Confirm campaign offer.
7. Confirm whether postcards are requested.
8. If postcards are requested, verify route counts before quoting.
9. Prepare campaign plan.
10. Prepare creative direction.
11. Prepare UTM or QR tracking labels.
12. Route campaign plan for client approval.
13. Launch manually only after payment and approval.
14. Schedule the first monthly report.

## Budget Guidance

Starter:

- 1 to 3 areas.
- Recommended ad spend: $1,000/month or more.
- Best for first test and founder-rate clients.

Expansion:

- 4 to 6 areas.
- Recommend increasing ad spend before launch.
- Use only when the client already knows the areas are valuable.

Heavy saturation:

- 7+ areas or large direct mail quantity.
- Quote custom scope and review capacity before accepting.

## Direct Mail Add-On

Direct mail can be added when:

- Target geography is stable.
- Route counts are verified.
- Postcard proof is approved.
- Quote is approved.
- Payment path is clear.

If route counts are unavailable, do not quote final direct mail pricing.

## Tracking

Use area-level labels where practical:

```text
utm_campaign=neighborhood_saturation_[client_slug]_[yyyymm]
utm_content=[area_slug]
qr_label=[area_slug]
```

If the platform cannot report by area, report campaign-level results and clearly label area-level metrics as unavailable.

## Compliance Language

Use:

- Local visibility
- Neighborhood awareness
- Repeated exposure
- Stay visible in the areas that matter

Avoid:

- Track people
- Follow homeowners
- Spy on customers
- Guaranteed leads
- Guaranteed ROI

