# Phase F: First Customer Readiness

Date: 2026-05-29

## Objective

Phase F prepares HomeReach to watch the first real Market Capture customer from intake through payment and fulfillment handoff.

This phase does not charge customers, send outreach, launch ads, change pricing, or alter active campaigns. It adds operational checks so the first real customer does not disappear into a blind spot.

## QA Record Cleanup

Archive QA smoke-test records without deleting audit history:

```bash
pnpm archive:market-capture-qa
```

Dry run:

```bash
pnpm archive:market-capture-qa -- --dry-run
```

The archive command:

- Marks QA Market Capture leads as `archived`.
- Marks QA pipelines as `archived`.
- Cancels open QA tasks.
- Adds an audit note to each archived lead.
- Does not delete records.
- Does not change real customer records.

## First Customer Monitor

Watch the latest non-QA Market Capture lead:

```bash
pnpm monitor:market-capture:first-customer
```

The monitor checks:

- Latest real Market Capture lead.
- Payment status.
- Stripe Checkout Session linkage.
- Stripe subscription linkage after payment.
- Pipeline stage.
- Generated sales tasks.
- Fulfillment campaign creation after payment.
- Recent notes and recommended next action.

If no real Market Capture lead exists yet, the monitor exits successfully with:

```text
waiting_for_first_customer
```

## Production Usage

Use a temporary Production env pull:

```powershell
vercel env pull .codex-previews\market-capture-production.env --environment=production --scope team_8PV46M8kFOxFVnq4Zfms7u2Q --yes

# Load env into the process, then run:
pnpm archive:market-capture-qa
pnpm monitor:market-capture:first-customer

Remove-Item .codex-previews\market-capture-production.env -Force
```

Do not commit or share the pulled env file.

## Critical Failures

The first-customer monitor exits non-zero when:

- A real lead has no pipeline record.
- A real lead has no generated sales tasks.
- A `checkout_created` lead has no Stripe Checkout Session id.
- A Stripe Checkout Session does not match the Market Capture lead.
- A paid lead has no Stripe subscription id.
- A paid lead has no fulfillment campaign record.

## Human Approval Boundaries

Human approval is still required before:

- Charging a customer.
- Sending payment links manually.
- Sending outbound email, SMS, DMs, or social posts.
- Launching paid ads.
- Changing campaign settings.
- Publishing customer-facing claims or creative.

## Go-Live Practice

When the first real customer submits:

1. Run `pnpm monitor:market-capture:first-customer`.
2. Confirm the lead, pipeline, and tasks exist.
3. If payment is pending, follow up manually.
4. If payment completes, verify Stripe webhook marks the lead paid.
5. Confirm fulfillment campaign setup is created.
6. Confirm no paid ads launch automatically.
