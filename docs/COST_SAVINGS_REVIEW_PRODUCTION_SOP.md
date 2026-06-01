# Cost Savings Review Production SOP

Status: Production-ready manual service  
Owner: Cost Control Operations  
Applies to: Cost Savings Review, Cost Control Engine, Procurement Agent handoff  
Last updated: 2026-05-31

## Sellable Offer

Public name:

```text
Cost Savings Review
```

Founder pricing:

```text
Free initial savings scan. Paid Cost Savings Review starts at $499 one-time or $299/month monitoring.
```

Client promise:

```text
HomeReach reviews supplier and recurring cost information, finds possible savings opportunities, prepares owner-ready next steps, and keeps every vendor or spend action approval-gated.
```

Do not promise guaranteed savings, vendor changes, purchase discounts, legal/accounting conclusions, or automated procurement.

## Production Surfaces

- Public page: `/inventory-purchasing`
- Request form: `/waitlist?product=procurement-savings-review`
- Admin queue: `/admin/cost-control`
- Client view: `/dashboard/cost-control`
- Supplier profile: `/admin/cost-control/suppliers/[supplierId]`
- Admin sync API: `/api/admin/cost-control/sync`
- Client/admin opportunity action API: `/api/cost-control/opportunities/[opportunityId]`
- Production smoke: `pnpm smoke:cost-savings-review`

## Intake Workflow

The public request form must collect:

- Name
- Business name
- Email
- Phone
- Business type
- Estimated monthly supply spend
- Main procurement pain point
- Optional supplier names
- Optional SMS consent

Phone is required for the savings review. SMS consent is optional and must not be required as a condition of purchase or request submission.

After intake, the system should:

- Save a `waitlist_entries` row tagged with `product_intent = procurement-savings-review`
- Preserve procurement context in `product_context`
- Preserve phone even when SMS consent is false
- Create an `ai_workforce_tasks` row assigned to `Procurement Agent`
- Mark `approval_required = true`
- Log the intake in `ai_workforce_activity_logs` when AI Workforce tables are available

## Operator Workflow

1. Open `/admin/cost-control`.
2. Review new Procurement Agent tasks and related waitlist entries.
3. Qualify the prospect based on spend range, business type, and urgency.
4. Request invoices, supplier lists, price sheets, or renewal notes when needed.
5. Normalize cost data by supplier, category, unit, frequency, and delivery/contract terms.
6. Create or sync savings opportunities.
7. QA estimated savings math before presenting it.
8. Draft supplier review, price inquiry, or owner action messages.
9. Keep all outbound drafts approval-gated.
10. Deliver the owner action summary or paid review proposal.

## Approval Gates

Human approval is required before:

- Sending vendor or client outreach
- Making savings claims to the client
- Marking estimated savings as actual
- Recommending a supplier switch
- Approving a purchase or vendor action
- Changing pricing, payment state, or subscription state

HomeReach must not place orders, switch vendors, commit spend, sign contracts, or represent guaranteed savings.

## Tracking Results

Track:

- Suppliers reviewed
- Categories reviewed
- Opportunities found
- Estimated monthly and annual savings
- Accepted savings
- Verified actual savings
- Rejected opportunities and reason
- Follow-up tasks
- Owner-approved actions

Actual savings may be marked only when supported by invoice, quote, client confirmation, or another reliable source.

## Smoke Test

Run before or after deployment:

```bash
pnpm smoke:cost-savings-review
```

The smoke test verifies:

- `/inventory-purchasing` loads the public offer
- `/waitlist?product=procurement-savings-review` loads the product-specific request form
- Admin and client routes gate or load cleanly
- Admin sync API requires authorization
- Opportunity action API requires authorization
- A QA intake saves successfully
- Phone is stored even when SMS consent is false
- A Procurement Agent task is generated with approval required
- QA rows are marked as archived instead of treated as real leads

Use `--skip-intake-write` when route-only testing is required. Use `--keep-qa-record` only when debugging the generated QA handoff.

## Rollback

If the Cost Savings Review funnel fails:

1. Set `ENABLE_COST_CONTROL_ENGINE=false` or `ENABLE_COST_CONTROL_QUEUE=false` to disable the operational queue.
2. Remove or hide the `/inventory-purchasing` CTA if the public funnel is not accepting requests.
3. Keep existing waitlist entries intact.
4. Do not delete client or QA records unless a separate cleanup has been reviewed.
5. Revert only the Cost Savings Review form/script/SOP changes from the latest deployment.

