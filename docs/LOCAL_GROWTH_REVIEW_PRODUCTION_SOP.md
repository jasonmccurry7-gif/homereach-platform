# Local Growth Review Production SOP

Status: Production-ready manual sales wedge  
Owner: Growth Strategy  
Applies to: Local Growth Review, Growth Intelligence, Content Strategy Agent handoff  
Last updated: 2026-05-31

## Sellable Offer

Public name:

```text
Local Growth Review
```

Founder pricing:

```text
Free 1-page opportunity review as sales wedge. Paid local growth audit is $499 one-time when deeper review is needed.
```

Client promise:

```text
HomeReach reviews a business, market, current marketing, and goals, then recommends the next practical local growth opportunity to review.
```

Do not promise revenue, leads, rankings, market dominance, competitor conquest, or campaign outcomes.

## Production Surfaces

- Public page: `/local-growth-os`
- Request form: `/waitlist?product=local-growth-review`
- Admin queue: `/admin/growth-intelligence`
- Client view: `/dashboard/growth-intelligence`
- Admin sync API: `/api/admin/growth-intelligence/sync`
- Opportunity action API: `/api/growth-intelligence/opportunities/[opportunityId]`
- Production smoke: `pnpm smoke:local-growth-review`

## Intake Workflow

The public request form must collect:

- Name
- Business name
- Email
- Optional phone
- Optional website
- Industry
- Primary city or service area
- Main growth goal
- Current main marketing channel
- Optional monthly growth budget
- Optional growth notes
- Optional SMS consent

After intake, the system should:

- Save a `waitlist_entries` row tagged with `product_intent = local-growth-review`
- Preserve local growth context in `product_context`
- Preserve phone separately from SMS consent
- Create an `ai_workforce_tasks` row assigned to `Content Strategy Agent`
- Mark `approval_required = true`
- Log the intake in `ai_workforce_activity_logs` when AI Workforce tables are available

## Operator Workflow

1. Open `/admin/growth-intelligence`.
2. Review new Content Strategy Agent tasks and related waitlist entries.
3. Check available HomeReach context, Growth Intelligence notes, prior campaigns, Business Memory, and public-facing website basics.
4. Prepare a 1-page local growth review with:
   - Business snapshot
   - Primary market and goal
   - Top opportunity
   - Why it matters
   - Missing proof or data
   - Recommended next action
   - Safe follow-up draft
5. Label any assumption clearly.
6. Require approval before customer-facing claims, proposals, pricing changes, outreach, or campaign creation.
7. Offer the next paid service only when the recommendation is specific and operationally feasible.

## Approval Gates

Human approval is required before:

- Sending email, SMS, DMs, proposals, or campaign recommendations to the prospect
- Creating a paid campaign or fulfillment task
- Changing pricing or discount language
- Making revenue, lead, ranking, savings, or market dominance claims
- Referencing competitors in customer-facing material
- Publishing or submitting any public content

## Tracking Results

Track:

- Reviews requested
- Reviews completed
- Top opportunity category
- Estimated value when supportable
- Follow-up sent after approval
- Paid services proposed
- Paid services accepted
- Opportunities dismissed
- Campaigns or tasks created from the review

## Smoke Test

Run before or after deployment:

```bash
pnpm smoke:local-growth-review
```

The smoke test verifies:

- `/local-growth-os` loads the public offer and review CTA
- `/waitlist?product=local-growth-review` loads the product-specific request form
- Admin and client Growth Intelligence routes gate or load cleanly
- Admin sync API requires authorization
- Opportunity action API requires authorization
- A QA intake saves successfully
- Product context and SMS consent state are preserved
- A Content Strategy Agent task is generated with approval required
- QA rows are marked as archived instead of treated as real leads

Use `--skip-intake-write` when route-only testing is required. Use `--keep-qa-record` only when debugging the generated QA handoff.

## Rollback

If the Local Growth Review funnel fails:

1. Hide or replace the `/local-growth-os` CTA if the public request path is not accepting requests.
2. Keep existing waitlist entries intact.
3. Disable Growth Intelligence surfaces with `ENABLE_GROWTH_INTELLIGENCE_ENGINE=false` if the advisory dashboard is unstable.
4. Do not delete lead, task, activity, campaign, or QA records unless a separate cleanup has been reviewed.
5. Revert only the Local Growth Review form/script/SOP changes from the latest deployment.
