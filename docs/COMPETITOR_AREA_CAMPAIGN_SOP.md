# Competitor Area Campaign SOP

Date: 2026-05-30

## Purpose

Competitor Area Campaigns are a Market Capture variant for local visibility around competitor-heavy areas where platform rules allow.

This is not surveillance. The service helps a business stay visible in local markets where buyers are already comparing options.

## Public Positioning

Approved language:

```text
HomeReach can build local visibility campaigns around competitor-heavy areas, service corridors, and nearby neighborhoods where platform rules allow.
```

Avoid:

- "Spy on competitors."
- "Track their customers."
- "Follow people after they visit a competitor."
- "Steal customers."
- Guaranteed leads, sales, visits, ROI, or conquest results.

## Pricing

- Market Capture management: $499/month.
- Client-funded ad spend is separate.
- Includes review of up to 10 competitor-area locations.
- Additional competitor-area validation can be quoted at $49/location.

Do not charge additional validation without owner approval.

## Intake Requirements

Collect:

- Competitor name.
- Competitor address or local area.
- Industry/category if known.
- Priority: primary or secondary.
- Preferred radius, if the client has one.
- Campaign goal.
- Compliance acknowledgement.

Preferred format:

```text
Competitor Name | Address | Category | Priority | Notes
```

Example:

```text
ABC Roofing | 123 Main St, Akron OH | roofing | primary | local visibility area
```

## Validation Workflow

1. Confirm the client selected `Competitor Area`.
2. Review each competitor name and address.
3. Remove duplicates.
4. Confirm the address or geography is usable.
5. Confirm the requested radius is reasonable.
6. Rewrite any surveillance-style language.
7. Review ad platform policy risk.
8. Build the launch package only after payment, target area, creative, tracking, and approval are ready.

## Fulfillment Handoff

The intake stores competitor data in:

```text
market_capture_leads.metadata.competitor_area
```

Fulfillment creates `market_capture_campaign_locations` rows with:

```text
location_type = competitor
```

Each location should be treated as an area for geography-based visibility, not individual-level identity targeting.

## Approval Gates

Required before launch:

- Payment confirmed.
- Ad spend confirmed.
- Competitor areas reviewed.
- Platform policy reviewed.
- Creative approved.
- Tracking destination approved.
- Client approval recorded.
- Admin approval recorded.

Never auto-launch paid ads.

## Client Reporting

Report only available campaign metrics:

- Competitor areas reviewed.
- Locations approved.
- Campaign status.
- Impressions.
- Clicks.
- Spend.
- Landing page visits if available.
- Leads or calls if available.
- Notes and next action.

Do not claim:

- HomeReach knows which individuals visited a competitor.
- HomeReach tracked competitor customers.
- A sale was caused by a specific competitor-area impression unless the client has verified attribution.

## Issue Handling

If the address cannot be validated:

- Remove it from the launch package or convert to broader geography.

If copy implies surveillance:

- Rewrite before client approval.

If platform targeting is unavailable:

- Switch to city, ZIP, radius, or service-area targeting where allowed.

If the client requests prohibited targeting:

- Decline that request and offer a compliant geography-based alternative.
