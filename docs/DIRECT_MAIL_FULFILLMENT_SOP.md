# HomeReach Direct Mail Fulfillment SOP

Status: Production operating guide  
Owner: Operations  
Applies to: Targeted Direct Mail, Shared Postcards, Political Mail  
Last updated: 2026-05-30

## Purpose

This SOP gives HomeReach a single, approval-safe workflow for fulfilling direct mail services without rebuilding the existing product flows.

HomeReach sells direct mail as an outcome: local visibility, campaign execution, and repeated exposure in the areas that matter. The operator's job is to protect quality, margin, compliance, client expectations, and delivery timing.

## Service Lines Covered

### Targeted Direct Mail

Use for a dedicated mail campaign around selected routes, ZIP codes, neighborhoods, service areas, or jobsite areas.

Primary routes and surfaces:

- Public sales path: `/targeted`
- Start path: `/targeted/start`
- Intake path: `/targeted/intake`
- Checkout path: `/targeted/checkout`
- Confirmation path: `/targeted/confirmed`
- Admin path: `/admin/targeted-campaigns`

Current package anchors:

- 500 homes: Neighborhood Launch
- 1,000 homes: Local Awareness Expansion
- 2,500 homes: High-Value Homeowner Reach
- 5,000 homes: Territory Domination

### Shared Postcards

Use when multiple local businesses buy protected placement on a shared 9 x 12 postcard.

Primary routes and surfaces:

- Public sales path: `/shared-postcards`
- AI intake path: `/shared-postcards/ai-intake`
- City/category path: `/spots/[citySlug]/[categorySlug]`
- Admin spot path: `/admin/spots`
- Admin AI intake path: `/admin/ai-intake`

Current operating constraints:

- 12 total spots per shared postcard
- Each slot is 4 x 3.5 inches
- City/category availability is checked through the canonical availability logic
- Category and city conflicts must not be overridden without owner approval

### Political Mail

Use for campaign, candidate, committee, or political organization mail planning and fulfillment.

Primary routes and surfaces:

- Public sales path: `/political`
- Political mail page: `/political-mail`
- Plan path: `/political/plan`
- Public proposal path: `/p/[token]`
- Admin hub: `/admin/political`
- Admin proposals: `/admin/political/proposals`
- Admin delivery: `/admin/political/delivery`

Political guardrails:

- Use geography, public race context, campaign-provided data, route density, timing, cost, and logistics only
- Do not infer individual voter beliefs
- Do not score individuals politically
- Do not create persuasion targeting from inferred ideology
- Political creative, public messaging, proposal claims, and delivery commitments require human approval

## Universal Approval Gates

No campaign can move to production until all required approvals are complete.

Required before print/vendor handoff:

- Client scope approved
- Payment, deposit, or approved invoice state confirmed
- Mailing geography verified
- Quantity and route/list counts confirmed
- Final creative proof approved by client or authorized campaign representative
- Internal compliance review complete
- Political compliance review complete when applicable
- Print/vendor quote approved
- Mail/drop date approved
- Admin production approval recorded

Required before any customer-facing send, public copy, political creative, price change, refund, credit, or payment action:

- Human approval

## Fulfillment Workflow

### 1. Sale Accepted

Confirm:

- Service line: Targeted Direct Mail, Shared Postcards, or Political Mail
- Client or campaign name
- Contact name, email, and phone
- Billing status
- Desired geography
- Desired quantity
- Desired timing
- Offer, message, or campaign goal
- Required assets
- Approval contact

Record the source record in the appropriate existing admin surface. Do not create a parallel spreadsheet as the source of truth.

### 2. Availability and Geography Validation

Targeted Direct Mail:

- Confirm package tier and estimated homes
- Confirm target city, ZIP, route, radius, or neighborhood
- Check for duplicate or stale intake records
- Confirm that the geography matches the client's business service area

Shared Postcards:

- Confirm city/category availability before accepting payment
- Confirm there are open spots
- Confirm no protected category conflict exists
- If availability is uncertain, hold as Needs Review and escalate

Political Mail:

- Confirm geography source and campaign scope
- Confirm route or district source is verified
- Confirm the proposal is checkout eligible before payment handoff
- Confirm human approval exists before production handoff

### 3. Payment or Proposal Confirmation

Targeted Direct Mail:

- Confirm checkout completion, payment status, or approved manual invoice path
- If payment is missing, keep the campaign in Payment Pending

Shared Postcards:

- Confirm spot purchase, reservation, or admin-approved invoice path
- Do not mark a spot fulfilled until payment state and availability both make sense

Political Mail:

- Confirm proposal status and payment status
- Use the existing political proposal statuses:
  - draft
  - sent
  - viewed
  - approved
  - declined
  - expired
- Use the existing payment statuses:
  - pending
  - deposit_paid
  - paid
  - failed
  - refunded
  - canceled

### 4. Asset Collection

Collect:

- Logo
- Brand colors if available
- Phone number
- Website or landing page URL
- Offer details
- Photos or candidate images
- Required disclaimers
- QR or tracking destination
- Existing ad, postcard, or campaign examples

Mark missing assets as open tasks. Do not let missing assets become an invisible delay.

### 5. Creative Brief and Proof Creation

Create a simple creative brief:

- Audience
- Geography
- Offer or message
- Primary CTA
- Trust proof
- Required disclaimers
- Tracking method
- Print size and vendor requirements

The proof must be easy to inspect on mobile and desktop.

### 6. Internal Proof Review

Check:

- Business, candidate, or committee name is correct
- Contact information is correct
- URL and QR destination work
- Offer terms are accurate
- Pricing or claims are approved
- Postal size, bleed, safe margin, and vendor specs are met
- Shared postcard slot size is correct when applicable
- Political disclaimer is present when applicable
- No guarantee of leads, sales, ROI, votes, or outcomes is made
- No surveillance, individual tracking, or sensitive targeting language is used

If any item fails, return the proof to revision before client approval.

### 7. Client or Campaign Approval

Send the proof for approval only after internal review passes.

Record:

- Approver name
- Approval status
- Approval timestamp
- Revision notes
- Final approved proof location

Approval statuses:

- Awaiting Approval
- Approved
- Needs Revision
- Rejected

### 8. Vendor Handoff

Prepare the vendor packet:

- Approved print file
- Quantity
- Size
- Paper and finish if known
- Mail class or delivery method
- Mailing list, route file, EDDM route detail, or approved geography summary
- Drop date
- Delivery window
- Vendor quote
- Margin check
- Invoice/payment note
- Special handling instructions

Do not release production to a vendor until approval and payment gates are complete.

### 9. Production and Mail Drop

Track:

- Production status
- Vendor confirmation
- Print proof if provided
- USPS or vendor acceptance
- Mail/drop date
- Estimated in-home window
- Issue notes

Fulfillment statuses:

- Pending
- Production
- Mailed
- Delivered
- Completed
- Canceled

### 10. Reporting and Follow-Up

After the delivery window, prepare a simple client-facing report.

Track where available:

- Mailed quantity
- Target geography
- Drop date
- Estimated delivery window
- QR scans
- Landing page visits
- Calls
- Forms or leads
- Coupon or offer mentions
- Client feedback
- Internal recommendation

Do not imply exact attribution unless the tracking data supports it.

## Ready-To-Mail Definition

A campaign is Ready To Mail only when:

- Payment or approved billing path is confirmed
- Geography and quantity are confirmed
- Final proof is approved
- Compliance review is complete
- Vendor quote is accepted
- Print file is production ready
- Tracking destination is tested
- Mail date is confirmed
- Admin production approval is recorded

## Issue Handling

Payment mismatch:

- Hold fulfillment
- Escalate to owner/admin
- Do not send to production

Availability conflict:

- Hold the sale or fulfillment task
- Re-check source record
- Escalate if a category/city conflict or capacity conflict exists

Proof typo after approval:

- Stop if production has not started
- If production has started, escalate for client communication and cost decision

Vendor delay:

- Update internal status
- Notify client with factual timing only after owner/admin approval

Route/list count mismatch:

- Reconcile before production
- Confirm whether quote changes are required
- Do not absorb or pass through cost changes without approval

Political compliance concern:

- Stop production
- Escalate to owner/admin
- Do not publish or mail until approved

Refund, credit, reprint, or discount decision:

- Requires owner/admin approval

## Compliance Language

Use:

- Local visibility
- Neighborhood reach
- Direct mail campaign
- In-home delivery window
- QR scans
- Landing page visits
- Response tracking where available
- Geography-based political planning

Avoid:

- Guaranteed leads
- Guaranteed sales
- Guaranteed ROI
- Guaranteed votes
- We track every person
- We follow voters
- Spy on competitors
- Ideology targeting
- Individual-level political prediction

## Daily Operator Checklist

- Review new direct mail intakes
- Review payment pending items
- Review shared postcard spot conflicts
- Review political proposal readiness
- Review missing assets
- Review proofs awaiting client approval
- Review campaigns ready for vendor handoff
- Review production and mail date changes
- Review reports due

## Weekly Owner Review

Review:

- New direct mail revenue
- Campaigns stuck in Payment Pending
- Campaigns stuck in Awaiting Approval
- Campaigns in production
- Mail drops completed
- Reports due
- Refund/credit/reprint risks
- Vendor margin by service line
- Renewal or next-drop opportunities

## Success Criteria

Direct mail is sellable and fulfillable when HomeReach can:

- Accept intake
- Confirm payment or approved billing path
- Validate geography and availability
- Collect assets
- Create and approve proofs
- Send production-ready vendor packets
- Track production and delivery
- Report simple outcomes
- Recommend a next drop or follow-up campaign

