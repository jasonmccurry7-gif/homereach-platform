# HomeReach Growth Engine Integration Notes

These notes prepare the SEO/social integration layer without hardcoding credentials or enabling auto-publishing.

## Arvow SEO Article Workflow

Best-fit use: approved SEO/blog briefs become Arvow generation batches, then generated content returns to HomeReach through a webhook.

Required environment variables:

- `ARVOW_API_KEY`
- `SEO_WEBHOOK_SECRET`
- `SEO_PUBLISHING_MODE`
- `CMS_WEBHOOK_URL`

Recommended workflow:

1. Create a HomeReach content brief in the Growth Engine.
2. Human approves the brief for external generation.
3. HomeReach sends a batch request to Arvow with keywords, brand knowledge, tone, and formatting settings.
4. Arvow generates asynchronously.
5. Arvow sends content to a HomeReach webhook.
6. HomeReach queues the payload as Needs Review.
7. Human edits, approves, and publishes through the existing SEO Engine or CMS lane.

Implementation notes:

- Queue webhook payloads before processing because Arvow documentation says failed webhooks are not retried.
- Do not publish directly from the webhook.
- Store source timestamp, keyword seed, meta description, thumbnail alt text, and article body where available.

Sources:

- https://arvow.com/developers-and-ai-agents
- https://docs.arvow.com/docs/webhooks

## Blotato Social Scheduling Workflow

Best-fit use: approved social drafts are scheduled or published through Blotato after connected account discovery.

Required environment variables:

- `BLOTATO_API_KEY`
- `SOCIAL_PUBLISHING_MODE`
- `SOCIAL_REVIEW_REQUIRED`
- `DEFAULT_SOCIAL_TIMEZONE`

Recommended workflow:

1. Create channel-specific social drafts from an approved article, page, postcard concept, or campaign update.
2. Human approves the draft and target platform.
3. HomeReach fetches connected account IDs from Blotato.
4. For Facebook and LinkedIn, fetch subaccounts/page IDs when needed.
5. HomeReach submits the approved post to Blotato.
6. Use `scheduledTime` or `useNextFreeSlot` as a top-level field.
7. Poll status and store the result for reporting.

Implementation notes:

- Blotato uses `blotato-api-key` for REST authentication.
- `mediaUrls` should contain publicly accessible URLs, or use a presigned upload flow for local assets.
- Scheduling fields must not be nested inside the `post` object.
- Social posts stay in Human Review by default.

Sources:

- https://help.blotato.com/api/start
- https://help.blotato.com/api/llm

## CSV Fallback

Until API keys are available, the Growth Engine exports the Top 25 Revenue Pages plan as CSV from:

`/api/admin/growth-engine/top-pages/export`

CSV fields:

- title
- keyword
- supporting keywords
- slug
- priority
- target audience
- content brief
- CTA
- status

This keeps the workflow usable without creating a publishing dependency.
