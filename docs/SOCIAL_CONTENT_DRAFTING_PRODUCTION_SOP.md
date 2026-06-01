# Social Content Drafting Production SOP

## Offer

Social Content Drafting is a draft-and-approval service for local businesses that need consistent local visibility without managing a content machine.

Founder-rate packages:

- $399/month for 8 draft posts.
- $699/month for 16 draft posts.
- Launch, seasonal, direct mail support, or political batches are quoted before work begins.

This is not an auto-posting product. HomeReach drafts, organizes, and prepares content for review. Sending, scheduling, posting, ad use, and political publishing require human approval.

## Client Outcome

The client gets a simple content plan, draft posts, channel guidance, creative notes, and a review path that helps them stay visible, promote offers, support campaigns, and build trust with customers.

Expected outcomes to track:

- Drafts created.
- Drafts approved.
- Drafts revised.
- Posts manually published by the client or approved operator.
- Engagement or replies manually entered.
- Leads, calls, DMs, or website visits when known.

Do not promise viral reach, guaranteed leads, guaranteed engagement, or ranking improvement.

## Intake

Public intake route:

- `/waitlist?product=social-content`

Required intake:

- Name.
- Business name.
- Email.
- Content package.
- Main content goal.
- Primary channels.
- Target audience.
- Offer, topic, or promotion.
- Asset status.
- Approval owner.

Optional intake:

- Phone.
- Website.
- Brand voice.
- Notes, deadlines, topics to avoid, examples, or compliance concerns.

## AI Workforce Handoff

Every public request creates:

- `waitlist_entries` row with `product_intent = social-content`.
- `ai_workforce_tasks` row with `related_opportunity = social-content-drafting`.
- Assigned agent: `Content Strategy Agent`.
- `approval_required = true`.
- Activity log event: `waitlist_social_content_request_received`.

The expected output is a review-ready content plan with:

- Recommended package.
- Channel plan.
- Draft themes.
- Example post angles.
- Creative asset needs.
- Compliance notes.
- Approval owner.
- Next action.

## Fulfillment Workflow

1. Review intake.
2. Confirm offer, audience, channels, tone, and approval owner.
3. Confirm asset status and missing creative needs.
4. Create a simple monthly calendar or campaign batch.
5. Draft posts and creative briefs.
6. Route drafts through the content review queue.
7. Receive human approval or revision request.
8. Deliver approved copy/export for manual use.
9. Log manual publish status when known.
10. Enter performance notes or engagement metrics when available.

## Approval Gates

Human approval is required before:

- Publishing or scheduling social posts.
- Sending DMs, SMS, emails, or comments.
- Posting political content.
- Using testimonials.
- Making customer, revenue, savings, compliance, ranking, or performance claims.
- Running paid ads or boosting content.
- Changing pricing or offers.

Political content must stay geography/public-context/campaign-provided only. Do not infer individual voter beliefs or use ideology-based targeting.

## Admin Surfaces

- Content Intelligence: `/admin/content-intel`
- Executive Review Queue: `/admin/content-review`
- Daily Content Command Center: `/admin/daily-content`
- AI Assets / output review: `/admin/ai-assets`

## Reporting

Manual reporting is acceptable for this phase.

Track:

- Drafts requested.
- Drafts delivered.
- Drafts approved.
- Drafts revised.
- Posts manually published.
- Channel.
- Published URL or screenshot when available.
- Engagement, clicks, DMs, leads, or calls when available.
- Notes and next recommendation.

If platform metrics are unavailable, report only known manual metrics and clearly label unknowns.

## Failure Handling

- Missing assets: prepare text-only drafts and request logo/photos.
- Missing approval owner: hold drafts in review.
- Risky claim: rewrite before approval.
- Political or regulated topic: escalate before drafting customer-facing copy.
- Native publishing unavailable: use manual copy/export.
- Metrics unavailable: use manual report notes only.

## Production Smoke

Run:

```bash
pnpm smoke:social-content
```

This verifies:

- Public service page loads.
- Public Social Content intake loads.
- Admin surfaces are protected or load cleanly.
- Metrics APIs require admin access.
- QA intake saves.
- AI Workforce handoff task is created.
- Approval gate is preserved.

## Rollback

If the service needs to be paused:

- Remove or hide `/waitlist?product=social-content` from public CTAs.
- Keep existing waitlist records intact.
- Disable owner quoting/sales activity for the service.
- Continue blocking publishing through the existing approval gates.
