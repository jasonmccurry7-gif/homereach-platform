# Social Content Drafting Service Kit

## Production Position

Social Content Drafting is a sellable manual service for local businesses that need consistent visibility without managing a content calendar themselves.

HomeReach sells this as approval-ready content support, not autonomous posting software.

Founder-rate packages:

- $399/month for 8 draft posts.
- $699/month for 16 draft posts.
- Managed Social Content + Auto-Publishing: ~~$699/month~~ $599/month for 8 approved posts, or ~~$1,099/month~~ $899/month for 16 approved posts.
- Optional connected publishing setup: ~~$299~~ $199.
- Launch, seasonal, direct mail support, political batches, and custom campaign packs are quoted before work begins.

## Client Value

The client receives a simple monthly content plan, draft posts, creative notes, channel guidance, and a clear approval path.

Expected outcomes:

- Less owner time spent deciding what to post.
- More consistent local visibility.
- Better reuse of offers, photos, reviews, events, and campaigns.
- Safer content review before public use.
- Clearer monthly view of what was drafted, approved, revised, and manually published.

Do not promise viral reach, guaranteed engagement, guaranteed leads, ranking improvement, or revenue lift.

## Production Surfaces

Public sales page:

- `/services/social-content`

Public intake:

- `/waitlist?product=social-content`

Admin surfaces:

- `/admin/content-intel`
- `/admin/content-review`
- `/admin/daily-content`
- `/admin/ai-assets`
- `/admin/agents`

Client publishing setup:

- `/dashboard/social-publishing`

Protected APIs:

- `/api/admin/social-content/metrics`
- `/api/admin/social-content/metrics/sync`
- `/api/social-content/meta/connections`
- `/api/social-content/meta/oauth/start`
- `/api/social-content/meta/oauth/callback`
- `/api/social-content/meta/publications`
- `/api/social-content/meta/publish`
- `/api/admin/social-content/meta/publish-due`

## Data Flow

1. Prospect submits `/waitlist?product=social-content`.
2. System saves a `waitlist_entries` row with `product_intent = social-content`.
3. System creates an `ai_workforce_tasks` row with `related_opportunity = social-content-drafting`.
4. Task is assigned to `Content Strategy Agent`.
5. Task has `approval_required = true`.
6. Activity is logged in `ai_workforce_activity_logs`.
7. Drafts and reusable artifacts should move through `ai_outputs`, `ai_output_reviews`, and content review before public use.
8. Manual publishing and performance notes can be tracked through `social_publication_records` and `social_post_metrics_daily`.
9. If the client buys managed auto-publishing, they authorize Meta through OAuth.
10. HomeReach stores encrypted Page tokens in `social_meta_connections`.
11. Approved/scheduled publish attempts are logged in `social_publish_attempts`.

## Intake Requirements

Required:

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

Optional:

- Phone.
- Website.
- Brand voice.
- Notes, deadlines, topics to avoid, examples, or compliance concerns.

## Fulfillment SOP

1. Review intake and confirm package.
2. Confirm target audience, channels, offer, tone, approval owner, and deadline.
3. Confirm available brand assets and missing asset needs.
4. Build a monthly calendar or campaign batch.
5. Draft posts, hooks, captions, and creative briefs.
6. Route drafts through content review.
7. Collect human approval or revision notes.
8. Deliver approved copy/export for manual use or schedule approved posts through the Meta queue.
9. Log manual publish status or Meta publication proof when known.
10. Enter metrics and next-month recommendations when available.

## Connected Publishing Add-On

Use Meta OAuth only. Never ask for Facebook or Instagram passwords.

Required environment variables:

- `ENABLE_META_CONNECTED_PUBLISHING=true`
- `ENABLE_META_AUTO_PUBLISHING=true`
- `SOCIAL_PUBLISHING_MODE=live`
- `META_APP_ID`
- `META_APP_SECRET`
- `META_REDIRECT_URI`
- `META_TOKEN_ENCRYPTION_KEY`

Required Meta permissions:

- `pages_show_list`
- `pages_read_engagement`
- `pages_manage_posts`
- `pages_manage_metadata`
- `instagram_basic`
- `instagram_content_publish`

If permissions, app review, or tokens are unavailable, use the manual publishing workflow and record proof manually.

## Approval Gates

Human approval is required before:

- Publishing or scheduling social posts.
- Sending DMs, SMS, emails, comments, or replies.
- Posting political content.
- Using testimonials.
- Making customer, revenue, savings, compliance, ranking, performance, or guarantee claims.
- Running paid ads or boosting posts.
- Changing pricing, offers, campaign settings, or spend.

Political content must use geography, public context, and campaign-provided data only. Do not infer individual voter beliefs or use ideology-based targeting.

## Reporting

Monthly reporting should include:

- Drafts requested.
- Drafts delivered.
- Drafts approved.
- Drafts revised.
- Posts manually published.
- Channel.
- Published URL or screenshot when available.
- Engagement, clicks, DMs, leads, calls, or website visits when known.
- Top themes.
- Next recommended content batch.

If platform metrics are unavailable, report only known manual metrics and label unknowns clearly.

## Failure Handling

- Missing assets: prepare text-only drafts and request logo/photos.
- Missing approval owner: hold drafts in review.
- Risky claim: rewrite before approval.
- Political or regulated topic: escalate before customer-facing copy.
- Native publishing unavailable: use manual copy/export.
- Meta token expired or revoked: ask the business owner to reconnect in `/dashboard/social-publishing`.
- Metrics unavailable: use manual report notes only.

## Smoke Test

Run:

```bash
pnpm smoke:social-content
pnpm smoke:meta-connected-publishing
```

This verifies:

- Public service page loads.
- Public intake loads.
- Admin surfaces gate or load cleanly.
- Metrics APIs require admin access.
- QA intake saves.
- AI Workforce task is created.
- Approval gate is preserved.
- Content asset, publication, metrics, and learning tables exist.
- QA records are archived by default after verification.

## Rollback

If Social Content must be paused:

- Remove or hide `/waitlist?product=social-content` from public CTAs.
- Keep existing waitlist, task, output, review, publication, and metric records intact.
- Stop owner quoting/sales activity for the package.
- Continue blocking publishing through approval gates.
