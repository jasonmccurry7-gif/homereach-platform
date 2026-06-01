# HomeReach Cost Control Engine Manual Service Kit

Status: Production manual service kit  
Owner: Revenue and Operations  
Applies to: Cost Control opportunities, supplier reviews, savings tracking  
Last updated: 2026-05-30

## Purpose

This kit makes Cost Control Engine sellable as a manual service before deeper procurement integrations are added.

The client-facing promise is simple:

```text
HomeReach helps you find where money may be leaking, review supplier costs, and turn savings opportunities into clear owner decisions.
```

This is not procurement automation. It is a cost-savings advisory and execution workflow.

## Current System Surfaces

Use existing HomeReach surfaces:

- Client view: `/dashboard/cost-control`
- Admin queue: `/admin/cost-control`
- Supplier profile: `/admin/cost-control/suppliers/[supplierId]`
- Public savings entry path: `/inventory-purchasing`
- Public request form: `/waitlist?product=procurement-savings-review`
- Operations supplier price path: `/operations-copilot/supplier-prices`
- Sync API: `/api/admin/cost-control/sync`
- Opportunity action API: `/api/cost-control/opportunities/[opportunityId]`

Primary data structures already supported by Cost Control Engine:

- `cost_control_opportunities`
- `cost_control_drafts`
- `supplier_directory`
- `supplier_categories`
- `supplier_reviews`
- `savings_tracker`
- `cost_control_scores`
- `cost_control_reports`
- Existing Operations Copilot sources where present
- Business Memory supplier and savings records where present

## Sellable Offer

Recommended public name:

- Cost Savings Review

Simple description:

```text
We review your supplier and recurring cost information, identify savings opportunities, prepare vendor review drafts, and give you a clear action list before you commit to any change.
```

Core deliverables:

- Supplier list review
- Cost category review
- Savings opportunity list
- Vendor comparison checklist
- Supplier review email drafts
- Owner action summary
- Monthly or one-time savings report

Optional add-ons:

- Invoice review session
- Vendor quote comparison
- Recurring expense audit
- Market Capture cross-sell for savings-funded growth
- Supplier negotiation script

## Best-Fit Clients

Strong fit:

- Has regular supplier spend
- Buys repeat materials, food, print, equipment, software, fuel, or services
- Has invoices or price sheets available
- Suspects costs have increased
- Wants margin protection without hiring a CFO

Weak fit:

- No supplier or expense data available
- Wants HomeReach to place orders directly
- Wants automatic vendor switching
- Expects guaranteed savings
- Has contract/legal constraints that require professional review before action

## Standard Categories

Use the existing Cost Control categories:

- Ingredients
- Printing
- Marketing
- Office Supplies
- Equipment
- Fuel
- Fleet
- Utilities
- Software
- Labor Services
- Other

Custom categories can be added when needed, but keep owner-facing reports simple.

## Intake Checklist

Collect:

- Business name
- Contact name
- Industry
- Supplier names
- Spend categories
- Recent invoices or price sheets
- Delivery fees, minimums, contract terms, or renewal dates if available
- Current pain points
- Known price increases
- Preferred suppliers that should not be changed
- Vendor restrictions
- Approval owner
- Optional SMS consent state

Do not ask for bank credentials, card credentials, accounting logins, or payment authority.
Phone can be required for the review workflow, but SMS consent must remain optional and must not block form submission.

## Manual Workflow

### 1. Sync Or Create Opportunities

Open:

```text
/admin/cost-control
```

Run sync when appropriate, then review:

- Savings opportunities
- Supplier directory
- Supplier reviews
- Savings tracker
- Cost Control score
- Drafts

If no system records exist, manually build the service from invoices, supplier lists, or owner-provided cost notes.

### 2. Categorize Supplier Spend

For each supplier or invoice:

- Assign category
- Add pricing notes
- Add review date
- Identify recurring or one-time cost
- Note contract, delivery, reliability, or quality concerns
- Estimate monthly and annual spend where possible

Use conservative savings estimates. Show assumptions.

### 3. Identify Opportunities

Opportunity types:

- Supplier comparison opportunity
- Price increase alert
- Recurring overspend alert
- Bulk purchase opportunity
- Contract review opportunity
- Category review opportunity
- Vendor consolidation opportunity
- Alternative supplier opportunity
- Seasonal purchasing opportunity

Every opportunity should include:

- Estimated savings
- Reason
- Recommended action
- Confidence score
- Owner
- Status
- Notes

### 4. Prepare Drafts

Use or adapt existing draft types:

- Supplier review email
- Price inquiry email
- Vendor comparison request
- Savings proposal
- Internal review memo
- Owner action summary

Every vendor-facing or owner-facing draft requires human approval before use.

### 5. Approval

Before any vendor or spend action:

- Confirm savings basis
- Confirm invoice/source data
- Confirm client approval
- Confirm no contract restriction exists
- Confirm switching risk is understood
- Confirm HomeReach is not committing spend

Approval statuses:

- New Opportunity
- Under Review
- Pending Decision
- Approved
- Implemented
- Rejected
- Completed
- Dismissed

### 6. Execute Manually

Allowed manual actions after approval:

- Send vendor question or quote request
- Ask client to upload invoice
- Compare two approved quotes
- Prepare supplier review summary
- Recommend owner decision
- Track accepted or rejected savings

Not allowed:

- Place orders
- Switch vendors
- Approve purchases
- Commit spend
- Sign contracts
- Make legal or tax conclusions

### 7. Track Savings

Track:

- Estimated monthly savings
- Estimated annual savings
- Actual savings when verified
- Savings source
- Date found
- Date approved
- Date implemented
- Status
- Notes

Mark savings as actual only when supported by invoice, quote, client confirmation, or other reliable evidence.

## Client Report Template

Client:

Report period:

Prepared by:

Cost Control score:

### Savings Snapshot

| Metric | Result | Notes |
| --- | ---: | --- |
| Potential monthly savings |  |  |
| Potential annual savings |  |  |
| Accepted monthly savings |  |  |
| Verified actual savings |  |  |
| Suppliers reviewed |  |  |
| Categories reviewed |  |  |
| Open opportunities |  |  |
| Implemented opportunities |  |  |

### Top Opportunities

| Opportunity | Category | Estimated Savings | Status | Next Action |
| --- | --- | ---: | --- | --- |
|  |  |  |  |  |

### What Happened

Plain-language summary:

```text
This period, HomeReach reviewed supplier and cost information for [Business]. We found [number] possible savings opportunities and organized the next owner decisions before any vendor or spend changes are made.
```

### Why It Matters

Use the relevant points:

- Small recurring costs can quietly reduce margin.
- Supplier price increases deserve regular review.
- Quote comparisons can reveal better options without committing to a switch.
- Clear owner decisions help prevent savings from staying stuck in notes.

### Recommended Next Action

Choose one:

- Approve vendor comparison
- Request updated supplier pricing
- Upload recent invoice
- Review contract or renewal date
- Reject low-confidence opportunity
- Implement approved savings action
- Revisit category next month

Recommendation:

Owner:

Due date:

## Compliance And Safety Rules

Do not:

- Guarantee savings
- Place orders
- Switch vendors
- Approve purchases
- Commit spend
- Sign contracts
- Claim actual savings without evidence
- Make legal, accounting, or tax conclusions
- Pressure clients to change trusted suppliers without understanding operational risk

Use:

- Estimated savings
- Possible savings
- Savings opportunity
- Owner decision
- Vendor review
- Quote comparison
- Verified actual savings when documented

## Tracking Results

Track the service with:

- Suppliers reviewed
- Categories reviewed
- Opportunities found
- Opportunities approved
- Opportunities implemented
- Estimated savings
- Actual verified savings
- Rejected opportunities
- Reason for rejection
- Supplier review completion
- Cost Control score movement

Expected outcome for a small business:

- Better cost visibility
- Fewer ignored price increases
- Clearer supplier decisions
- Better margin protection
- Savings opportunities that can fund growth

Do not promise a specific dollar savings amount unless it is a documented quote or invoice-backed result.

## Manual Service Readiness

Ready to sell now:

- Supplier list review
- Invoice/category review
- Savings opportunity cards
- Vendor inquiry draft support
- Owner action summaries
- Manual savings reporting

Requires operator work:

- Invoice review
- Vendor quote collection
- Savings assumption review
- Manual approval tracking
- Actual savings confirmation
- Client communication

Not ready for autonomous use:

- Auto purchasing
- Vendor switching
- Supplier payments
- Contract approval
- Accounting-system automation
- Guaranteed savings reporting
