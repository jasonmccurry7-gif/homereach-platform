# HomeReach Procurement Delivery Intelligence

## Scope

The Best Price + Delivery Intelligence Layer extends the existing Operations
Copilot inventory and procurement dashboard. It does not create live supplier
orders, store supplier credentials, send external messages, or bypass the
existing approval queue.

## Current integration points

- Dashboard route: `/operations-copilot/delivery`
- Existing auth: Operations Copilot layout session guard
- Existing data:
  - `opcopilot_business_contexts`
  - `opcopilot_inventory_items`
  - `opcopilot_suppliers`
  - `opcopilot_supplier_quotes`
  - `opcopilot_price_snapshots`
  - `opcopilot_action_requests`
- Existing actions API: `/api/operations-copilot/actions`

## Data model

No migration is required for this pass.

Delivery profile support is typed inside the existing
`opcopilot_business_contexts.preference_memory` JSONB field:

- business address
- delivery instructions
- preferred delivery windows
- receiving location
- receiving contact
- tax-exempt status
- preferred suppliers
- restricted suppliers
- local pickup radius
- delivery preference

Supplier connector readiness is code-configured until official supplier APIs,
CSV imports, or account exports are connected.

## Savings calculation

Current Vendor Total Cost =
`current item price x order quantity + current delivery/shipping + estimated fees`

Recommended Total Delivered Cost =
`recommended item price x order quantity + recommended delivery/shipping + estimated fees`

Savings =
`current vendor total cost - recommended total delivered cost`

Monthly Estimated Savings =
`savings per order x estimated monthly usage`

All dashboard savings remain estimated unless the recommendation is backed by
captured supplier quote, invoice, CSV, or approved API data.

## Safe action workflow

The action buttons create internal action requests only:

- Approve Order
- Request Quote
- Send to Owner
- Add to Shopping List
- Mark Purchased
- Ignore

Live ordering is disabled. Supplier orders require explicit owner/admin
approval and a verified external supplier workflow.

## Future integrations

Recommended next integrations:

- Supplier CSV/import pipeline
- Invoice upload parser
- Amazon Business API
- Walmart Business API
- Grainger account export/API
- Home Depot Pro and Lowe's Pro account exports
- Restaurant/foodservice account quote import
- Email/SMS weekly savings notifications after notification policy approval
- Secure credential vault if supplier account authentication is ever required
