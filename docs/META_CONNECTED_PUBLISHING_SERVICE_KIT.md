# Meta Connected Publishing Service Kit

## Offer

Managed Social Content + Auto-Publishing is the upgraded version of Social Content Drafting.

Founder rates:

- 8 approved posts per month: ~~$699/month~~ $599/month
- 16 approved posts per month: ~~$1,099/month~~ $899/month
- Optional setup: ~~$299~~ $199

Draft-only remains available at $399/month for 8 draft posts or $699/month for 16 draft posts.

## Customer Value

The pain point is simple: business owners do not want to log into Facebook and Instagram every week to post.

HomeReach solves this by creating the content calendar, drafting the posts, routing them for approval, and publishing approved content on schedule through the business owner's authorized Meta connection.

Expected outcome:

- Less owner time spent posting
- More consistent local visibility
- Better content approval discipline
- Cleaner proof of work for monthly reporting
- Fewer missed posting windows

## Safety Model

HomeReach never asks for or stores Facebook passwords.

The business owner connects Meta through OAuth. Tokens are encrypted server-side and can be revoked by the business inside Meta.

Publishing is blocked unless:

- `ENABLE_META_CONNECTED_PUBLISHING=true`
- `ENABLE_META_AUTO_PUBLISHING=true`
- `SOCIAL_PUBLISHING_MODE=live`
- `META_APP_ID`, `META_APP_SECRET`, and `META_REDIRECT_URI` are configured
- `META_TOKEN_ENCRYPTION_KEY` is configured
- The business has connected a Page through OAuth
- The content source is approved and verified
- The publication record is approved

Unapproved posts never publish.

## Required Meta Setup

Create a Meta app and configure Facebook Login with the callback URL:

`https://www.home-reach.com/api/social-content/meta/oauth/callback`

Requested scopes:

- `pages_show_list`
- `pages_read_engagement`
- `pages_manage_posts`
- `pages_manage_metadata`
- `instagram_basic`
- `instagram_content_publish`

Meta app review may be required before publishing works for real client Pages.

## Environment Variables

Required for OAuth connection:

- `ENABLE_META_CONNECTED_PUBLISHING=true`
- `META_APP_ID`
- `META_APP_SECRET`
- `META_REDIRECT_URI`
- `META_TOKEN_ENCRYPTION_KEY`

Required for approved scheduled publishing:

- `ENABLE_META_AUTO_PUBLISHING=true`
- `SOCIAL_PUBLISHING_MODE=live`

Optional:

- `META_GRAPH_API_VERSION`
- `META_OAUTH_SCOPES`

## Workflow

1. Client buys Managed Social Content + Auto-Publishing.
2. Client opens `/dashboard/social-publishing`.
3. Client clicks Connect Meta Account.
4. Client authorizes HomeReach through Meta OAuth.
5. HomeReach stores encrypted Page tokens.
6. HomeReach creates approved social publication records from approved AI outputs.
7. Approved posts are scheduled or published through the guarded Meta queue.
8. Publication attempts are logged in `social_publish_attempts`.
9. Published proof is stored on `social_publication_records`.
10. Monthly reporting uses publication proof plus manually entered or future imported metrics.

## Fallback

If Meta credentials, app review, Page permissions, or publishing mode are unavailable, HomeReach continues in manual publishing mode:

- Approved drafts remain in the approval queue.
- The operator copies posts into Meta manually.
- Proof URLs and metrics are recorded after posting.

## Compliance

Do not promise leads, sales, reach, ranking, or engagement.

Do not publish political content without political compliance review.

Do not publish customer claims, offers, discounts, before/after statements, or regulated content unless the client has approved the content and supporting facts.
