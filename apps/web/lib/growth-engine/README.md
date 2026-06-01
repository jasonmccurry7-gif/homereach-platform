# HomeReach Growth Engine

Purpose: a review-first orchestration layer for revenue growth work.

This module stores the Growth Engine blueprint, section definitions, Top 25 Revenue Pages plan, human review queue blueprint, integration requirements, CTA audit items, revenue path test, and internal agent definitions.

It does not publish content, create Stripe checkout sessions, mutate campaign records, or bypass existing intake and approval flows.

## Feature Flags

- `ENABLE_HOMEREACH_GROWTH_ENGINE=false` disables the admin page and API exports.
- `GROWTH_ENGINE_REVIEW_REQUIRED=false` is reserved for future use. Default behavior is review required.
- `GROWTH_ENGINE_AUTO_PUBLISH=true` is reserved for future use and is not consumed by publish logic in this MVP.

## Safe Integration Pattern

1. Plan the content or creative item.
2. Place it in Human Review.
3. Human approves.
4. Existing HomeReach systems handle publishing, proposal, checkout, creative, campaign, or reporting actions.

## External Systems

Prepared only:

- Arvow for SEO article generation by webhook.
- Blotato for approved social scheduling.
- RSS/CMS repurposing after content is approved or published.

No external API calls are made by this module.
