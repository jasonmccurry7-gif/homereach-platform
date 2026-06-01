# HomeReach Service Operations Playbook

This playbook defines the minimum operating standard for every HomeReach offer in the production service catalog.

## 1. Intake Standard

Every paid service must capture:

- Business name.
- Contact name.
- Email and phone.
- Website when applicable.
- Service requested.
- Budget or spend expectation when applicable.
- Target geography or audience when applicable.
- Requested start date.
- Assets needed from the client.
- Consent for the relevant fee, quote, or approval process.
- Compliance acknowledgement for ads, political, SEO, GovCon, procurement, or outreach-sensitive work.

## 2. Qualification Standard

Before fulfillment starts, the owner must confirm:

- Payment status or approved invoice path.
- Fit for the service.
- Required assets are present or assigned to an asset-collection task.
- The client understands what is included and what is separate.
- No unsupported guarantee has been made.
- Compliance-sensitive work has a human approval gate.

## 3. Fulfillment Standard

Every service must have a visible owner and next action. The default workflow is:

1. Review intake.
2. Confirm payment or quote path.
3. Confirm scope and success metric.
4. Collect assets or source material.
5. Draft the plan, copy, report, or campaign package.
6. Route client-facing output through approval when required.
7. Execute only the approved manual action.
8. Log results and next action.
9. Prepare the report.
10. Recommend renewal, expansion, or closeout.

## 4. Reporting Standard

Every client report should answer:

- What happened?
- Why does it matter?
- What should happen next?

Minimum report sections:

- Service summary.
- Work completed.
- Metrics available.
- Notes and interpretation.
- Issues or blockers.
- Recommended next action.
- Renewal or expansion recommendation when appropriate.

Reports must avoid guaranteed ROI, guaranteed leads, guaranteed rankings, guaranteed savings, guaranteed bid wins, or attribution certainty that the data does not support.

## 5. Issue Handling Standard

Use this order when a service hits a blocker:

1. Protect the client experience.
2. Protect revenue integrity.
3. Document the issue in the related task, campaign, or approval record.
4. Escalate payment, compliance, legal, customer complaint, or data exposure risks.
5. Offer a clear next action.
6. Do not invent results or hide uncertainty.

Common issue paths:

- Payment issue: create payment-required task and pause nonessential fulfillment.
- Missing assets: move to asset collection and send an approval-ready request draft.
- Client delay: update timeline and next action.
- Platform rejection: document reason and revise creative or targeting for approval.
- Data gap: mark metrics as unavailable and add manual note instead of guessing.
- Scope change: quote or approve before work expands.

## 6. Refund And Cancellation Standard

Refunds, credits, cancellations, discounts, or subscription changes require owner approval. Operators may prepare a recommendation, but must not change Stripe, invoices, or customer billing without approval.

Refund review should include:

- Client.
- Service.
- Payment amount and date.
- Work already completed.
- Reason for request.
- Recommended resolution.
- Revenue impact.
- Approval status.

## 7. Renewal Standard

Every recurring service should have a renewal action before the next billing cycle:

- Summarize results.
- Identify the next best action.
- Recommend continue, expand, pause, or revise.
- Confirm payment status.
- Capture client feedback.

## 8. Smoke Test Standard

Before a service is marked ready to scale, test:

- Public page loads.
- Intake or start path works.
- Payment path works or payment-required task is generated.
- Admin record appears.
- Owner and next action are visible.
- Client-facing status or report path loads where applicable.
- Copy buttons work for generated drafts.
- Mobile layout is usable.
- Feature flags degrade gracefully.
- No protected-core regression appears.

Run `pnpm smoke:service-catalog` after catalog updates.

## 9. Protected Core Standard

Never break:

- Homepage.
- Existing intake.
- Stripe.
- Authentication.
- Admin dashboards.
- Client dashboards.
- Webhooks.
- Political tools.
- Supplyfy/procurement tools.
- Direct mail tools.
- Campaign records.

If a change risks the protected core, stop and escalate before continuing.
