# Phase E: Market Capture Go-Live Monitoring

Date: 2026-05-29

## Objective

Phase E gives HomeReach a read-only production monitor for the Market Capture sales funnel.

This phase does not charge customers, send outreach, change pricing, launch ads, change campaigns, or delete records. It answers one operational question:

```text
Are we safe to sell Market Capture today?
```

## Monitor Command

```bash
pnpm monitor:market-capture
```

The monitor checks:

- Public route health for `/`, `/market-capture`, `/market-capture/intake`, `/political`, and `/targeted`.
- Market Capture feature flags.
- Manual launch mode remains safe.
- Ad API launch remains disabled.
- Stripe live authentication.
- Market Capture Starter `$499/month` Price health.
- Live Stripe webhook coverage for `checkout.session.completed` and `checkout.session.expired`.
- Recent Market Capture leads.
- Recent pipeline stages.
- Generated sales tasks.
- Recent Market Capture Checkout Sessions.

## Production Usage

Use a temporary production env pull when running against live Vercel configuration:

```powershell
vercel env pull .codex-previews\market-capture-production.env --environment=production --scope team_8PV46M8kFOxFVnq4Zfms7u2Q --yes

# Load the env file into the current process, run:
pnpm monitor:market-capture

# Delete the temporary env file afterward.
Remove-Item .codex-previews\market-capture-production.env -Force
```

Do not commit or share the pulled env file.

## Critical Failures

The monitor exits non-zero when:

- A critical public route fails.
- Required Market Capture flags are disabled.
- `ENABLE_AD_API_LAUNCH=true`.
- Stripe authentication fails.
- The configured Market Capture Price is inactive, not monthly, or not `$499`.
- The live Stripe webhook is missing required checkout events.
- Recent Market Capture leads exist without pipeline or task records.

## Warnings

Warnings do not fail the monitor but should be reviewed:

- No non-QA Market Capture leads yet.
- Open overdue Market Capture tasks.
- High number of payment-pending opportunities.

## Human Approval Boundaries

Human approval is still required before:

- Charging a customer.
- Sending payment links manually.
- Sending outbound email, SMS, DMs, or social posts.
- Launching paid ads.
- Changing active campaign settings.
- Publishing customer-facing claims or campaign creative.

## Next Owner Actions

- Decide whether QA smoke-test leads should be archived or left as traceable production verification records.
- Watch the first real Market Capture checkout end to end.
- Confirm the first real paid lead moves from sales into fulfillment cleanly.
