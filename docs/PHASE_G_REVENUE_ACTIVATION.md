# Phase G: Market Capture Revenue Activation

Date: 2026-05-29

## Objective

Phase G helps HomeReach find the first real Market Capture buyers from existing sales, outreach, and revenue records.

This phase does not send outreach, change pricing, charge customers, alter campaigns, launch ads, or write to production data. It creates a read-only candidate list, scores likely buyers, and drafts approval-ready one-to-one outreach.

## Command

Run the read-only activation generator:

```bash
pnpm activate:market-capture
```

Useful options:

```bash
pnpm activate:market-capture -- --limit 50
pnpm activate:market-capture -- --json
pnpm activate:market-capture -- --no-write-report
```

The command reads from existing structures when available:

- `revenue_pipeline_items`
- `sales_leads`
- `outreach_prospects`
- `leads`
- `political_outreach_leads`
- `market_capture_leads` for duplicate exclusion

If an optional table is missing, the command records a warning and continues.

## Output

Reports are written locally to:

```text
ai-workforce/reports/
```

Each report includes:

- Inputs used
- Sources referenced
- Approval status
- Related source entity
- Recommended sender
- Recommended first action
- Market Capture angle
- Reasons for score
- Email draft
- SMS draft
- DM draft
- Call opening

## Human Approval Gates

Human approval is required before:

- Sending email, SMS, DMs, social messages, or call scripts.
- Using SMS drafts without a valid opt-in/compliance basis.
- Sending payment links.
- Changing pricing or subscriptions.
- Creating or launching campaigns.
- Making customer-facing claims beyond the approved copy.

## Sender Rules

- Jason: political campaigns, high-value strategic opportunities, premium executive conversations.
- Josh: local SMB Market Capture, jobsite halo, neighborhood saturation, direct mail plus digital.
- Chelsi: warm nurture, onboarding-style follow-up, Supplyfy-to-growth cross-sell.
- Heather: procurement savings and operational-efficiency conversations.

Outbound copy must be varied by sender and context. Do not send identical subject lines, openings, body structure, CTAs, or sign-offs across prospects.

## First-Customer Sprint

1. Run `pnpm activate:market-capture`.
2. Pick the top 5 candidates with the cleanest fit and contact path.
3. Review the draft for accuracy, opt-in/compliance, and sender fit.
4. Send approved one-to-one outreach manually.
5. Route interested prospects to `/market-capture` or `/market-capture/intake`.
6. After the first real intake, run `pnpm monitor:market-capture:first-customer`.

## Recommended Offer Discipline

Lead with Market Capture:

- $499/month HomeReach management fee.
- Client-funded ad spend is separate.
- Optional direct mail add-on.
- Optional landing page or creative add-on.

Avoid:

- Guaranteed leads.
- Guaranteed ROI.
- Individual-level tracking language.
- Competitor spying language.
- Any suggestion that ads launch without human approval.

## Next Phase Gate

Before moving past Phase G:

- At least one candidate list has been generated.
- Top candidates have been reviewed by a human.
- Outreach drafts are approved before use.
- The first real intake is monitored with the Phase F command.
