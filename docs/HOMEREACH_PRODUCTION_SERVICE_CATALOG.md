# HomeReach Production Service Catalog

This document is the operating companion to `apps/web/lib/service-catalog/production-service-catalog.json`.

The JSON catalog is the source of truth for what HomeReach can sell, fulfill, report, and support. The admin view is available at `/admin/service-catalog`.

## Production Rule

No offer should be scaled until it has:

- A clear public offer name.
- A public price or quote basis.
- A primary internal owner.
- Defined deliverables.
- Defined fulfillment steps.
- Defined reporting metrics.
- Defined approval gates.
- Defined issue-handling path.
- Defined renewal or upsell motion.
- Read-only smoke tests or QA steps.

## Approval Gates

Human approval is required before HomeReach:

- Charges, discounts, refunds, or changes subscriptions.
- Sends email, SMS, DMs, or social posts.
- Publishes SEO pages, proposal copy, political copy, or compliance-sensitive copy.
- Launches paid ads or changes live campaign budgets.
- Submits SAM.gov bids, certifications, representations, or pricing.
- Commits to vendor switches, purchases, or procurement decisions.

## Service Readiness Levels

`sellable_now`: Ready to sell and operate with current checkout or fulfillment systems.

`sellable_manual`: Ready to sell with manual fulfillment or invoice support.

`manual_sellable_with_publish_gate`: Ready to sell when publication remains approval-gated.

`sellable_with_political_compliance`: Ready to sell only with political compliance review.

`sellable_needs_fresh_smoke`: Built, but needs fresh QA before active selling.

`sellable_needs_inventory_audit`: Built, but requires live inventory/capacity confirmation.

`pilot_only`: Use only with controlled pilot clients.

`pilot_sellable_with_activation_gate`: Ready to sell to controlled founder pilots, but live activation remains manual and approval-gated.

`internal_first`, `internal_foundation`, `internal_then_client`, `internal_only`: Internal operating layers, not standalone public services unless a future approval changes that.

## Cataloged Offers

| Offer                           | Category                 | Status                             | Public Price Basis                                                                                                             |
| ------------------------------- | ------------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Market Capture                  | Revenue Engine           | sellable_now                       | $499/month management fee + client-funded ad spend                                                                             |
| Jobsite Halo Campaigns          | Revenue Engine           | sellable_manual                    | Market Capture base + approved add-ons                                                                                         |
| Neighborhood Saturation         | Revenue Engine           | sellable_manual                    | Market Capture base or quoted direct mail                                                                                      |
| Digital + Direct Mail Campaigns | Revenue Engine           | sellable_manual                    | $499/month management + quoted mail + ad spend                                                                                 |
| Competitor Area Campaigns       | Revenue Engine           | sellable_manual_compliance_review  | Market Capture base + client-funded ad spend                                                                                   |
| Event Area Campaigns            | Revenue Engine           | sellable_manual                    | Market Capture base + optional mail                                                                                            |
| Political District Saturation   | Political Revenue Engine | sellable_with_political_compliance | $1,500 minimum planning package + verified geography/count quote                                                               |
| Targeted Direct Mail            | Direct Mail              | sellable_now                       | Quantity-based direct mail pricing                                                                                             |
| Shared Postcards                | Direct Mail              | sellable_now                       | Active city/category bundle pricing; standard back feature pricing starts around $300/month with founder rates where available |
| Cost Savings Review             | Cost Control Engine      | manual_sellable                    | Free initial scan; paid review starts at $499 one-time or $299/month monitoring                                                |
| Reputation Follow-Up            | Reputation Engine        | manual_sellable                    | $299/month reputation follow-up management; testimonial capture package starts at $499 one-time                                |
| Local Growth Review             | Growth Intelligence      | sales_wedge_ready                  | Free 1-page opportunity review; paid audit $499 one-time                                                                       |
| Local SEO/Landing Pages         | Marketing                | manual_sellable_with_publish_gate  | $499 setup + $299/month monitoring for one local landing page package; additional page clusters quoted                         |
| Social Content Drafting         | Marketing                | manual_sellable                    | $399/month for 8 draft posts; $699/month for 16 draft posts; publishing remains manual/approval-led                           |
| AI Website Assistant            | AI Services              | pilot_sellable_with_activation_gate | $299/month + $499 setup founder pilot; live widget activation requires approval                                                |
| ContractOS                      | Gov Contracts            | sellable_now                       | Founder rates configured in Stripe                                                                                             |
| AI COO                          | Operating System         | internal_first                     | Included with platform/service delivery; advisory-only and approval-gated                                                      |
| Business Memory                 | Operating System         | internal_foundation                | Included with platform/service delivery                                                                                        |
| Growth Intelligence             | Operating System         | internal_then_client               | Included internally; client visibility is controlled                                                                           |
| Ad-Tech Integration Layer       | Operations               | manual_launch_only                 | Internal scaling layer, not a standalone automated launch product                                                              |
| AI Workforce / AI Assets        | Operations               | internal_only                      | Internal operating layer                                                                                                       |

## Operating Requirements

Every service owner must maintain four artifacts before scaling:

- Sell sheet: client-facing value, price, deliverables, expected outcome, and disclaimer.
- SOP: fulfillment steps, owner, dependencies, approval gates, and escalation path.
- Report template: metrics, interpretation, next action, and renewal/upsell section.
- Smoke test: route, form, payment, dashboard, report, and client-view checks where applicable.

## Monthly Review

During the monthly operating review:

- Confirm each sellable service still has working intake, payment, admin, and reporting paths.
- Archive or downgrade services that fail smoke tests.
- Confirm pricing still protects margin.
- Confirm disclaimers do not promise guaranteed leads, savings, rankings, approvals, or outcomes.
- Confirm every client-facing workflow has a next action and support path.
