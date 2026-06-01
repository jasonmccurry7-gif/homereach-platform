# Reputation Follow-Up Production SOP

Status: Production-ready manual service  
Owner: Reputation Operations  
Applies to: Reputation Follow-Up, Reputation Engine, Reputation Agent handoff  
Last updated: 2026-05-31

## Sellable Offer

Public name:

```text
Reputation Follow-Up
```

Founder pricing:

```text
$299/month reputation follow-up management. Testimonial capture package starts at $499 one-time.
```

Client promise:

```text
HomeReach helps turn happy customers into organized review, referral, and testimonial opportunities without creating fake reviews, review gating, or unmanaged outreach.
```

Do not promise rating increases, lead volume, referrals, revenue, or review-platform outcomes.

## Production Surfaces

- Public page: `/services/reputation`
- Request form: `/waitlist?product=reputation`
- Admin queue: `/admin/reputation`
- Client view: `/dashboard/reputation`
- Legacy review/admin view: `/admin/reviews`
- Admin sync API: `/api/admin/reputation/sync`
- Opportunity action API: `/api/reputation/opportunities/[opportunityId]`
- Production smoke: `pnpm smoke:reputation-follow-up`

## Intake Workflow

The public request form must collect:

- Name
- Business name
- Email
- Optional phone
- Optional website
- Main reputation goal
- Recent customer or completed-job range
- Optional review profile link
- Optional SMS consent

After intake, the system should:

- Save a `waitlist_entries` row tagged with `product_intent = reputation`
- Preserve reputation context in `product_context`
- Preserve phone separately from SMS consent
- Create an `ai_workforce_tasks` row assigned to `Reputation Agent`
- Mark `approval_required = true`
- Log the intake in `ai_workforce_activity_logs` when AI Workforce tables are available

## Operator Workflow

1. Open `/admin/reputation`.
2. Review new Reputation Agent tasks and related waitlist entries.
3. Verify the client has legitimate customer/job context for follow-up.
4. Request approved review profile links, customer lists, or testimonial permissions when needed.
5. Prepare review request, referral request, testimonial request, or public reply drafts.
6. QA every draft for transparent, pressure-free language.
7. Require approval before any customer-facing outreach, public reply, or testimonial use.
8. Track sent status, responses, reviews received, testimonials approved, and follow-up actions.
9. Deliver a monthly reputation activity summary.

## Approval Gates

Human approval is required before:

- Sending review request messages
- Sending referral request messages
- Sending SMS
- Posting public review replies
- Publishing or reusing testimonials
- Using customer names, quotes, photos, or case-study details
- Making claims about review improvement, rankings, conversion, or referrals

HomeReach must not create fake reviews, buy reviews, gate review requests, hide negative feedback, pressure customers, or publish testimonials without permission.

## Tracking Results

Track:

- Review opportunities found
- Review requests drafted
- Review requests sent after approval
- Reviews received
- Referral opportunities found
- Referral requests sent after approval
- Testimonials requested
- Testimonials approved
- Follow-ups needed
- Reputation score movement
- Proof added to landing pages, proposals, or postcards

## Smoke Test

Run before or after deployment:

```bash
pnpm smoke:reputation-follow-up
```

The smoke test verifies:

- `/services/reputation` loads the public offer
- `/waitlist?product=reputation` loads the product-specific request form
- Admin and client routes gate or load cleanly
- Admin sync API requires authorization
- Opportunity action API requires authorization
- A QA intake saves successfully
- Product context and SMS consent state are preserved
- A Reputation Agent task is generated with approval required
- QA rows are marked as archived instead of treated as real leads

Use `--skip-intake-write` when route-only testing is required. Use `--keep-qa-record` only when debugging the generated QA handoff.

## Rollback

If the Reputation Follow-Up funnel fails:

1. Set `ENABLE_REPUTATION_ENGINE=false` or `ENABLE_REPUTATION_QUEUE=false` to disable the operational queue.
2. Hide or replace the `/services/reputation` CTA if the public request path is not accepting requests.
3. Keep existing waitlist entries intact.
4. Do not delete client, testimonial, review, or QA records unless a separate cleanup has been reviewed.
5. Revert only the Reputation Follow-Up form/script/SOP changes from the latest deployment.

