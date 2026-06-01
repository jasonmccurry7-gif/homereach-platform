# Market Capture Manual Launch SOP

Date: 2026-05-30

## Purpose

This SOP governs the manual launch workflow for Market Capture campaigns.

Market Capture is intentionally manual-launch first. HomeReach may prepare campaign plans, targeting instructions, draft copy, creative notes, tracking links, and report templates, but paid ads must not launch without explicit admin approval.

## Default Launch Mode

Required production posture:

```env
ENABLE_MANUAL_AD_LAUNCH_MODE=true
ENABLE_AD_API_LAUNCH=false
```

If ad API credentials exist later, they may support draft preparation or reporting imports only until a future approved phase changes the operating model. No automated ad spend is allowed.

## Launch Preconditions

Do not begin ad platform setup until all items below are true:

- Market Capture intake is complete.
- Management fee payment is confirmed or owner-approved exception is documented.
- Client-funded ad spend amount is confirmed.
- Target geography is approved.
- Targeting type is approved.
- Offer/message is approved.
- Creative assets are uploaded or approved as not needed.
- Landing page, destination URL, or tracking URL is approved.
- Direct mail add-on status is documented.
- Compliance review is complete.
- Admin has explicitly approved launch preparation.

## Launch Package

Every campaign must have a launch package before the ad platform is touched.

Required fields:

- Client name.
- Business name.
- Industry.
- Contact name and email.
- Campaign objective.
- Targeting type.
- Target geography.
- Target addresses, ZIPs, neighborhoods, service areas, competitor areas, event areas, or political geography.
- Radius or geography notes.
- Monthly management fee.
- Client-funded monthly ad spend.
- Platform to launch manually.
- Campaign offer.
- Approved ad copy.
- Approved creative asset notes.
- Destination URL.
- Tracking URL or UTM plan.
- Direct mail add-on status.
- Client approval status.
- Admin approval status.
- Compliance notes.
- Launch owner.
- Launch date target.

## Targeting Review

Allowed targeting posture:

- Geography-level visibility.
- Jobsites, neighborhoods, ZIPs, service areas, event areas, or competitor areas where platform rules allow.
- Political geography only at district, county, city, ZIP, route, or other geography-safe level.

Do not use:

- Individual private identity display.
- Sensitive-trait targeting.
- Ideology prediction.
- Voter persuasion scoring.
- Surveillance language.
- Claims that HomeReach tracks every person.
- Claims that HomeReach spies on competitor customers.

## Platform Setup Notes

Admin manually creates the campaign in the selected ad platform or DSP.

Minimum setup record:

- Platform.
- Campaign name.
- Objective.
- Target geography.
- Budget.
- Start date.
- Creative/ad copy used.
- Destination URL.
- Tracking URL.
- Notes on platform limitations or policy review.

Use approved copy only. If the platform rejects or limits targeting/creative, document the reason, revise the launch package, and route the revision through approval before launch.

## Tracking Rules

Use consistent tracking where available:

```text
utm_source=[platform]
utm_medium=paid_social|paid_display|paid_search|direct_mail
utm_campaign=market_capture_[client_slug]_[area_slug]_[yyyymm]
utm_content=[creative_or_offer_slug]
```

If direct mail is included, assign a QR or landing URL label that matches the same campaign and geography.

Do not claim exact attribution if tracking is partial. Use plain language such as "tracked responses where available."

## Manual Launch Completion

Mark launch complete only after:

- Campaign is live in the platform.
- Budget matches the approved amount.
- Geography matches the launch package.
- Creative matches the approved version.
- Tracking URL has been tested.
- Launch date/time is recorded.
- First report date is scheduled.
- Client launch confirmation is prepared for approval or sent after approval.

Record the following in the campaign detail:

- Launch status: manual launch complete or live.
- Platform.
- Campaign ID or internal reference where available.
- Budget.
- Target area.
- Landing/tracking URL.
- Launch owner.
- Launch notes.

## Client Launch Confirmation

Use this structure:

```text
Subject: Your Market Capture campaign is live

Hi [Contact],

Your HomeReach Market Capture campaign for [Business] is now live.

The campaign is focused on [Target Area] with a client-funded monthly ad budget of [Ad Spend]. HomeReach is managing the campaign workflow, tracking the available metrics, and preparing the first report once enough data is available.

We will watch impressions, clicks, spend, leads or calls where available, landing page activity, and any direct mail or QR response connected to the campaign.

Results vary, and ad platform approval and targeting availability can change, but the campaign is now set up for repeated local visibility.

Next report target: [Date]

Best,
HomeReach
```

## Escalation Rules

Escalate to owner before launch if:

- Payment is unclear.
- Client disputes scope.
- Client expects guaranteed leads, sales, visits, or ROI.
- Targeting appears compliance-sensitive.
- Political language or geography is involved.
- The platform rejects creative or targeting.
- Ad spend, budget, or card ownership is unclear.
- Tracking cannot be verified.

## Smoke Test

Before first real client launch, run:

```bash
pnpm smoke:market-capture-stripe
pnpm monitor:market-capture
pnpm monitor:market-capture:first-customer
```

After the first real client intake and payment, `pnpm monitor:market-capture:first-customer` should show the latest real lead, pipeline, tasks, payment state, and fulfillment campaign state.
