# Market Capture First-Client SOP

Date: 2026-05-30

## Purpose

This SOP is the operating path for the first real Market Capture client, from approved prospect to paid customer to campaign launch to first report.

Market Capture is sold as a managed growth execution service:

- Starter management fee: $499/month.
- Recommended starter ad spend: $1,000/month, client-funded separately.
- Recommended starter commitment: 3 months.
- Direct mail, landing pages, creative packages, and political work are quote/add-on paths.
- Manual ad launch mode remains the default.
- No paid ads launch without explicit human approval.

## Service Promise

HomeReach helps the client stay visible in the neighborhoods, jobsites, service areas, competitor areas, events, or political geographies that matter most.

Approved language:

```text
HomeReach builds the Market Capture plan, prepares the targeting and creative workflow, helps track performance, and can pair digital visibility with postcards to the same neighborhoods.
```

Avoid:

- Guaranteed leads, sales, ROI, visits, or platform approval.
- Individual-level tracking language.
- "Spy on competitors" language.
- Any claim that ads launch automatically.

## Required Systems

Before selling or onboarding the first real customer, these must pass:

```bash
pnpm smoke:market-capture-stripe
pnpm monitor:market-capture
pnpm monitor:market-capture:first-customer
```

Expected current first-customer monitor state before the first sale:

```text
waiting_for_first_customer
```

## Phase 1: Prospect Selection

Use the Phase G activation report:

```bash
pnpm activate:market-capture
```

Select 5-10 first prospects using these filters:

- Clear local business category.
- Clear geography.
- Phone, email, or safe manual contact path.
- No opt-out, suppression, or do-not-contact state.
- Best-fit categories first: roofing, HVAC, plumbing, lawn care, landscaping, concrete, pest control, real estate, med spas, dentists, restaurants, and political campaigns.

Owner:

- Josh for local SMBs.
- Jason for political, premium, or strategic accounts.
- Chelsi for nurture/onboarding follow-up.

Approval gate:

- Human review required before any email, SMS, DM, call script, or payment link is used.

## Phase 2: Sales Conversation

Goal:

Confirm whether the client has a real local growth problem Market Capture can solve.

Discovery questions:

- What neighborhoods or service areas produce your best customers?
- Do you want more leads, more calls, website visits, event awareness, political awareness, or general neighborhood visibility?
- Do you have recent jobsites or customer clusters we should build around?
- Are there competitors, events, or neighborhoods you want to be visible near?
- What monthly ad budget are you comfortable funding separately?
- Do you want postcards paired with the digital campaign?
- Do you have logo, photos, offer copy, and a landing page?

Qualification rules:

- Minimum viable fit: clear target area plus willingness to fund ad spend.
- Strong fit: high-value service category plus jobsite/neighborhood focus plus 90-day interest.
- Poor fit: no budget, no target area, expects guaranteed leads, or wants prohibited targeting.

## Phase 3: Intake

Route the client to:

```text
https://www.home-reach.com/market-capture/intake
```

The intake should collect:

- Business name.
- Contact name.
- Email.
- Phone.
- Website.
- Industry.
- Monthly ad budget.
- Targeting objective.
- Targeting type.
- Target area.
- Preferred start date.
- Campaign offer.
- Logo/images/postcard assets where available.
- Direct mail add-on interest.
- Landing page need.
- Creative package need.
- Management fee consent.
- Compliance acknowledgement.

After intake, verify:

```bash
pnpm monitor:market-capture:first-customer
```

Expected:

- Real lead exists.
- Pipeline record exists.
- Sales tasks exist.
- Payment status is `payment_required` or `checkout_created`.
- No paid subscription exists unless the client completed checkout.

## Phase 4: Payment

Approved payment path:

- Stripe Checkout subscription for Market Capture Starter.
- $499/month recurring management fee.
- Ad spend remains separate and client-funded.

Before payment follow-up:

- Confirm the client understands ad spend is not included.
- Confirm no guaranteed results are promised.
- Confirm direct mail, landing page, or creative add-ons are separate quotes unless explicitly bundled.

After payment:

Run:

```bash
pnpm monitor:market-capture:first-customer
```

Expected paid state:

- Lead payment status is paid.
- Stripe subscription ID exists.
- Pipeline moves toward fulfillment.
- Fulfillment campaign record exists.
- No ads auto-launch.

Escalate immediately if:

- Payment succeeded but webhook did not mark the lead paid.
- Paid lead has no subscription ID.
- Paid lead has no fulfillment campaign record.
- Client paid the wrong amount.

## Phase 5: Fulfillment Kickoff

Initial owner assignments:

- Jason: campaign strategy, target area, budget, launch approval.
- Josh: sales handoff and direct mail discussion.
- Chelsi: client communication, asset collection, approval follow-up.
- Heather: asset/creative review, landing page/direct mail draft support.

Fulfillment checklist:

- Review intake.
- Validate contact information.
- Validate target area.
- Confirm campaign goal.
- Confirm budget.
- Collect logo.
- Collect images.
- Collect offer.
- Review assets.
- Generate ad drafts.
- Generate landing page draft if needed.
- Generate direct mail draft if requested.
- Client review.
- Client approval.
- Campaign ready.
- Launch complete.
- Reporting scheduled.
- Renewal reminder scheduled.

## Phase 6: Launch Package

Create a launch package before any ad platform work.

Launch package must include:

- Client and business information.
- Campaign objective.
- Targeting type.
- Target geography.
- Target addresses or areas.
- Monthly management fee.
- Monthly ad spend budget.
- Creative assets.
- Offer/message.
- Landing page or destination URL.
- Tracking URL or QR path.
- Direct mail add-on status.
- Client approval status.
- Admin approval status.
- Compliance check.

Required approval gates:

- Payment confirmed.
- Ad spend confirmed.
- Target area confirmed.
- Creative approved.
- Landing/tracking URL approved.
- Compliance reviewed.
- Admin explicitly approves manual launch.

## Phase 7: Manual Launch

Default launch mode:

```env
ENABLE_MANUAL_AD_LAUNCH_MODE=true
ENABLE_AD_API_LAUNCH=false
```

Use the dedicated launch SOP:

```text
docs/MARKET_CAPTURE_MANUAL_LAUNCH_SOP.md
```

Manual launch steps:

- Build campaign manually in the selected ad platform or DSP.
- Use the approved target geography.
- Use the approved budget.
- Use approved creative only.
- Add tracking parameters where available.
- Confirm campaign is active only after admin approval.
- Record launch date, platform, budget, URLs, and notes in the campaign detail record.

Never:

- Auto-launch paid ads.
- Auto-charge ad spend.
- Publish unapproved creative.
- Use prohibited targeting categories.
- Make individual-level tracking claims.

## Phase 8: Client Launch Confirmation

Send a client launch confirmation only after launch is complete.

Required content:

- Campaign is live.
- Target area summary.
- Budget summary.
- What HomeReach will monitor.
- When the first report will be sent.
- Reminder that results vary and platform policies apply.

Template:

```text
Subject: Your Market Capture campaign is live

Hi [Contact],

Your HomeReach Market Capture campaign for [Business] is now live.

The campaign is focused on [Target Area] with a client-funded monthly ad budget of [Ad Spend]. HomeReach is managing the campaign workflow, tracking the available metrics, and preparing the first report once enough data is available.

We will watch impressions, clicks, spend, leads or calls where available, landing page activity, and any direct mail or QR response connected to the campaign.

Results vary, and ad platform approval and availability can change, but the campaign is now set up for repeated local visibility.

Next report target: [Date]

Best,
HomeReach
```

## Phase 9: First Monthly Report

Send the first report after enough campaign data exists, usually 30 days after launch.

Use:

```text
docs/MARKET_CAPTURE_MONTHLY_REPORT_TEMPLATE.md
```

Report approval gates:

- Metrics are entered from the ad platform, landing page, call tracking, form tracking, and direct mail/QR sources where available.
- Unavailable metrics are marked unavailable, not estimated.
- Any recommendation is written in business-owner language.
- No guaranteed lead, sales, visit, ranking, ROI, or attribution claim is included.
- Internal notes are removed before client delivery.
- Owner approves the first report before it is sent.

Minimum report fields:

- Campaign status.
- Target area.
- Monthly management fee.
- Client-funded ad spend budget.
- Actual spend.
- Impressions.
- Clicks.
- CTR.
- CPC.
- Leads/forms.
- Calls.
- Landing page visits.
- QR scans if direct mail is included.
- Direct mail quantity and status if included.
- What worked.
- What needs review.
- Recommended next action.

Do not claim attribution certainty if tracking is incomplete.

## Renewal And Upsell Review

At day 21:

- Review early campaign activity.
- Identify missing assets or weak creative.
- Decide whether to recommend direct mail.
- Decide whether to recommend a landing page.
- Decide whether to expand the geography.

At day 30:

- Send report.
- Recommend continue, adjust, expand, or pause.

Upsell options:

- Direct mail to the same target area.
- Landing page.
- Creative package.
- Expanded geography.
- Growth tier.
- Dominance tier.

## First-Client Success Criteria

The first real client is considered successfully onboarded when:

- Intake is complete.
- Payment is complete.
- Fulfillment campaign exists.
- Tasks/checklist exist.
- Launch package is approved.
- Manual launch is recorded.
- Client launch confirmation is sent.
- First report is scheduled.
- No paid ads launched without approval.
