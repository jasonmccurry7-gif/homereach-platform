# HomeReach Reputation Engine Manual Service Kit

Status: Production manual service kit  
Owner: Revenue and Operations  
Applies to: Reputation opportunities, review requests, referral requests, testimonial capture  
Last updated: 2026-05-30

## Purpose

This kit makes Reputation Engine sellable as a manual service before advanced automation is added.

The client-facing promise is simple:

```text
HomeReach helps you turn happy customers into more trust, more reviews, more referrals, and better proof for future sales.
```

This is not review software. It is a trust-building operating service.

## Current System Surfaces

Use existing HomeReach surfaces:

- Client view: `/dashboard/reputation`
- Admin queue: `/admin/reputation`
- Public service page: `/services/reputation`
- Public request form: `/waitlist?product=reputation`
- Legacy review/admin surface: `/admin/reviews`
- Sync API: `/api/admin/reputation/sync`
- Opportunity action API: `/api/reputation/opportunities/[opportunityId]`

Primary data structures already supported by the Reputation Engine:

- `reputation_opportunities`
- `reputation_drafts`
- `review_campaigns`
- `referral_campaigns`
- `testimonial_library`
- `review_requests`
- `referral_requests`
- `reputation_scores`
- `reputation_reports`

The older review engine still contains mock/in-memory behavior. For production service delivery, use the newer Reputation Engine queues and manual operating workflow unless a specific integration has been verified.

## Sellable Offer

Recommended public name:

- Reputation Growth System

Simple description:

```text
We help identify the right customers to ask for reviews, referrals, and testimonials, prepare the messages, track the activity, and keep the follow-up organized.
```

Core deliverables:

- Reputation opportunity review
- Review request plan
- Referral request plan
- Testimonial capture plan
- Approved email/SMS/DM drafts
- Monthly reputation activity report
- Simple next-action recommendations

Optional add-ons:

- Landing page proof section update
- Google Business Profile review link setup support
- Testimonial page or case study draft
- Market Capture or direct mail proof integration

## Best-Fit Clients

Strong fit:

- Has completed jobs or recent happy customers
- Has Google Business Profile, Facebook page, or another review destination
- Has a service where trust matters before purchase
- Has repeat or referral-friendly customers
- Wants more proof for ads, landing pages, proposals, or postcards

Weak fit:

- No customer list or job completion history
- Wants fake reviews
- Wants to filter only happy customers through a public-review path
- Wants to incentivize reviews in ways that violate platform policy
- Wants outbound SMS without opt-in or legal basis

## Intake Checklist

Collect:

- Business name
- Main contact
- Website
- Review platform links
- Google Business Profile link if available
- Recent customer list or job list
- Permission/opt-in basis for outreach
- Preferred channels: email, SMS, phone, DM
- Completed job dates
- Customer names and contact details
- Any customer feedback already received
- Testimonials already approved for public use
- Referral offer, if any
- Brand tone preferences
- SMS consent state if the client wants HomeReach to text them about the request

Do not request or store unnecessary sensitive personal details.
Phone can be collected for follow-up, but SMS consent must remain optional and must not block form submission.

## Manual Workflow

### 1. Sync Or Create Opportunities

Open:

```text
/admin/reputation
```

Run sync when appropriate, then review:

- Review opportunities
- Referral opportunities
- Testimonial opportunities
- Follow-up opportunities
- Reputation score
- Drafts

If the queue has no records, create the service manually from client-provided data and track the work in the client notes/tasks until the system has enough data.

### 2. Prioritize

Prioritize:

- Recent happy customers
- Completed jobs with clear satisfaction signal
- Customers with high trust value
- Customers likely to refer neighbors or peers
- Testimonials that can support sales pages, proposals, or postcards

Do not prioritize by expected sentiment in a way that creates review gating.

### 3. Prepare Drafts

Use or adapt the approved draft types:

- Review request email
- Review request SMS
- Review request DM
- Referral request email
- Referral request SMS
- Referral request DM
- Customer appreciation message
- Testimonial request
- Follow-up message

Every outbound draft requires human approval before use.

### 4. Approval

Before any customer-facing message:

- Confirm the customer list and channel are approved
- Confirm opt-in or appropriate outreach basis
- Confirm links are correct
- Confirm the message is transparent and pressure-free
- Confirm no fake review, review gating, or prohibited incentive language exists
- Confirm SMS includes opt-out language where applicable

Approval statuses:

- Needs Review
- Approved
- Revision Needed
- Rejected

### 5. Send Manually Or Through Approved Channel

Default manual mode:

- Copy approved draft
- Send one-to-one through the approved channel
- Log sent status, date, owner, and next action

Do not mass-send from AI drafts without explicit approval and verified compliance.

### 6. Track Responses

Track:

- Review requests sent
- Reviews received
- Referral requests sent
- Referrals received
- Testimonials requested
- Testimonials approved
- Customer questions
- Negative or unresolved feedback
- Follow-up needed

Negative feedback should be routed to internal follow-up, not pushed toward a public review request.

### 7. Report Monthly

Use the report template below.

The report should explain:

- What happened
- Why it matters
- What should happen next

Avoid jargon and platform complexity.

## Client Report Template

Client:

Report period:

Prepared by:

Reputation score:

### Activity Summary

| Metric | Result | Notes |
| --- | ---: | --- |
| Review opportunities found |  |  |
| Review requests sent |  |  |
| Reviews received |  |  |
| Referral opportunities found |  |  |
| Referral requests sent |  |  |
| Referrals received |  |  |
| Testimonials requested |  |  |
| Testimonials approved |  |  |
| Follow-ups needed |  |  |

### What Happened

Plain-language summary:

```text
This month, HomeReach helped organize reputation follow-up for [Business]. We prepared review, referral, and testimonial opportunities from recent customer activity and tracked which actions still need approval or follow-up.
```

### Why It Matters

Use the relevant points:

- More approved reviews can improve trust before a customer calls.
- Referrals help turn existing goodwill into new opportunities.
- Testimonials create proof for landing pages, postcards, proposals, and follow-up.
- Consistent follow-up reduces missed reputation opportunities.

### Recommended Next Action

Choose one:

- Approve review request drafts
- Approve referral request drafts
- Capture one testimonial
- Follow up with unresolved customer feedback
- Add approved testimonials to a landing page
- Use proof in the next Market Capture or direct mail campaign

Recommendation:

Owner:

Due date:

## Compliance Rules

Do not:

- Generate fake reviews
- Buy reviews
- Misrepresent testimonials
- Publish testimonials without permission
- Gate reviews by only sending public review links after a satisfaction screen
- Pressure customers
- Hide negative feedback
- Offer incentives that violate platform policies
- Send SMS without a valid opt-in/compliance basis

Use:

- Transparent, customer-friendly language
- Easy opt-out language where needed
- Honest testimonial approval
- Internal follow-up for unresolved concerns

## Tracking Results

Track the service with:

- Requests sent
- Reviews received
- Referrals received
- Testimonials approved
- Draft approval rate
- Follow-up completion rate
- Reputation score movement
- Landing page/proposal proof added
- Client-reported impact

Expected outcome for a small business:

- More organized follow-up
- More trust signals over time
- Better sales proof
- More referral opportunities
- Fewer missed happy-customer moments

Do not promise a specific rating increase, lead count, or revenue result.

## Manual Service Readiness

Ready to sell now:

- Review opportunity planning
- Referral opportunity planning
- Testimonial capture planning
- Draft generation and copy support
- Manual approval workflow
- Monthly manual reporting

Requires operator work:

- Customer list review
- Link verification
- Manual sending or client-side sending
- Manual response tracking
- Testimonial permission checks
- Public proof placement

Not ready for autonomous use:

- Automatic review request sending
- Automatic testimonial publication
- Public review scraping
- Review gating automation
- Fake or incentivized review workflows
