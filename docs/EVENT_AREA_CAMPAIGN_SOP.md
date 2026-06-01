# Event Area Campaign SOP

Date: 2026-05-31

## Purpose

Event Area Campaigns are a short-run Market Capture variant for local visibility around a known event, venue, seasonal moment, fundraiser, rally, open house, grand opening, or community gathering.

This is a timing-sensitive campaign. The first decision is whether the event deadline is realistic.

## Public Positioning

Approved language:

```text
HomeReach can help your business stay visible around local events, venues, and time-sensitive community moments where platform rules allow.
```

Avoid:

- Guaranteed attendance.
- Guaranteed event sales.
- Guaranteed leads or conversions.
- Tracking or following event attendees.
- Implying individual surveillance.

## Pricing

- Market Capture management: $499/month.
- Client-funded ad spend is separate.
- Short-run creative rush review starts at $250 when launch is under 7 business days.
- Direct mail, landing pages, and creative packages remain separate quote paths unless already approved.

Do not charge a rush review without owner approval.

## Intake Requirements

Collect:

- Event name.
- Event location or venue address.
- Event start date.
- Event end date if applicable.
- Promotion window.
- Campaign goal.
- Preferred radius or fallback geography.
- Event source/details confirmation.
- Compliance acknowledgement.

Preferred format for event locations:

```text
Event Name | Address | Event Date | Promotion Window | Priority | Notes
```

Example:

```text
Summer Home Expo | 123 Event Center Dr, Akron OH | 2026-07-15 | 2 weeks before event | primary | source confirmed by client
```

## Deadline Rules

Event Area Campaigns use launch cutoff discipline:

- 7+ business days before the event: standard review path.
- 3-6 business days before the event: rush review may be required.
- Under 3 business days: escalate before accepting; consider declining or shifting to post-event follow-up.
- Past event date: propose post-event follow-up, retargeting-style visibility where allowed, or a future event plan.

No campaign should launch unless the deadline is feasible and approvals are complete.

## Fulfillment Handoff

The intake stores event data in:

```text
market_capture_leads.metadata.event_area
```

Fulfillment creates `market_capture_campaign_locations` rows with:

```text
location_type = event
```

Each event location should include:

- Event date.
- Promotion window.
- Deadline status.
- Launch cutoff.
- Campaign goal.
- Notes.

## Approval Gates

Required before launch:

- Payment confirmed.
- Ad spend confirmed.
- Event location confirmed.
- Event date/source confirmed.
- Launch cutoff approved.
- Offer and creative approved.
- Landing/tracking destination approved.
- Client approval recorded.
- Admin approval recorded.

Never auto-launch paid ads.

## Client Reporting

Report only available campaign metrics:

- Event dates.
- Launch date.
- Target area or venue summary.
- Impressions.
- Clicks.
- Spend.
- Landing page visits.
- Leads or calls if available.
- QR scans if direct mail is included.
- Post-event notes and next action.

Do not claim event attendance or revenue was caused by HomeReach unless the client provides verified attribution.

## Issue Handling

If the deadline is too close:

- Escalate to owner.
- Offer post-event follow-up or next-event planning.
- Do not promise launch.

If the event location is unclear:

- Require a verified venue/address or client source confirmation.

If source/details are not confirmed:

- Keep the campaign in review until confirmed.

If creative is not approved in time:

- Do not launch.
