# HomeReach Growth Engine Blueprint

Status: approved for additive MVP.

Purpose: create one internal orchestration layer for SEO pages, local landing pages, blog/article briefs, RSS repurposing, social posts, postcard creative, political campaign content, lead capture, intake, Stripe, dashboards, reporting, review queues, and AI agents.

This does not replace the existing HomeReach platform. It connects existing systems and keeps all publishing, payment, campaign, and production actions behind review and existing protected flows.

## Operating Model

1. Research signals enter through Content Intelligence, SEO opportunity planning, competitor notes, campaign intelligence, and sales feedback.
2. Growth agents convert signals into structured drafts for SEO pages, local pages, blogs, social posts, postcard concepts, and political content.
3. Every draft enters Human Review by default.
4. Approved SEO/local work moves into the existing SEO Engine and sitemap flow.
5. Approved social work moves to the social connector only after account setup and review.
6. Approved postcard and political work moves to existing ad designer, Canva, political, proposal, or production review lanes.
7. Leads continue through existing CTA paths, intake, proposal, Stripe checkout, contracts, admin visibility, sales follow-up, and customer dashboards.
8. Performance returns to Growth Intelligence, admin, sales, reports, and weekly growth summaries.

## System Connections

| Source | Destination | Handoff | Guardrail |
| --- | --- | --- | --- |
| SEO Command Center | Existing SEO Engine | Approved briefs become draft SEO pages through `/api/admin/seo-engine/pages`. | No page publishes without quality checks, inventory checks, and human approval. |
| Local Landing Page Engine | Website CTA and intake | CTAs route to `/get-started`, political plan pages, or lead capture. | No CTA bypasses account creation, city/category availability, or Stripe checkout. |
| Blog Content Engine | Human Review Queue | Blog briefs include metadata, internal links, FAQ, image prompts, and social repurposing. | Drafts remain unpublished until reviewed. |
| RSS Repurposing | Social Media Engine | Published content can generate channel-specific drafts. | Repurposed posts default to Needs Review. |
| Postcard Creative Engine | Ad Designer and Political Creative | Approved concepts become creative briefs. | Creative remains draft until approved. |
| Performance Dashboard | Admin and Sales Dashboards | Leads, assets, reviews, campaign assets, and Stripe revenue roll into reporting. | Admin-only margin stays out of customer-facing screens. |

## Protected Flows

- Homepage CTA paths
- Get-started intake
- City/category exclusivity
- Spot availability
- Auth/login
- Stripe checkout and webhooks
- Contracts
- Admin dashboard
- Sales dashboard
- Political dashboard
- Customer dashboard
- Twilio, Postmark, and email/SMS workflows
- Supabase schema integrity

## Growth Engine Sections

1. SEO Command Center
2. Local Landing Page Engine
3. Blog Content Engine
4. Social Media Engine
5. Political Content Engine
6. Postcard Creative Engine
7. Competitor Research Engine
8. CTA/Button Optimization Audit
9. Publishing Queue
10. Human Review Queue
11. Performance Dashboard
12. Weekly Growth Report

## Review Policy

Default status is Draft or Needs Review. The Growth Engine must not auto-publish SEO pages, articles, social posts, postcard creative, political content, email drafts, SMS drafts, image prompts, or campaign content unless an explicit environment flag and a human-approved workflow are added later.

## Environment Variables

Prepared placeholders:

- `ENABLE_HOMEREACH_GROWTH_ENGINE`
- `ARVOW_API_KEY`
- `SEO_WEBHOOK_SECRET`
- `SEO_PUBLISHING_MODE`
- `CMS_API_KEY`
- `CMS_WEBHOOK_URL`
- `RSS_REPURPOSING_ENABLED`
- `BLOTATO_API_KEY`
- `SOCIAL_PUBLISHING_MODE`
- `SOCIAL_REVIEW_REQUIRED`
- `DEFAULT_SOCIAL_TIMEZONE`
- `GROWTH_ENGINE_REVIEW_REQUIRED`
- `GROWTH_ENGINE_AUTO_PUBLISH`

Existing related flags:

- `ENABLE_SEO_ENGINE`
- `ENABLE_SEO_DRAFT_GENERATION`
- `ENABLE_CONTENT_INTEL`
- `DISABLE_CONTENT_INTEL_AI`
- `CONTENT_INTEL_DAILY_CAP`
- `CONTENT_INTEL_CRON_SECRET`

## Integration Notes

Arvow is documented as an async article generation system that can deliver generated articles to a webhook. The integration should accept payloads into a queue and mark them Needs Review before any publish action.

Blotato is documented as a social publishing and scheduling API that requires connected account discovery before posting. The integration should publish only approved posts and should store status after async submission.

Sources:

- Arvow developer/API overview: https://arvow.com/developers-and-ai-agents
- Arvow webhook docs: https://docs.arvow.com/docs/webhooks
- Blotato API quickstart: https://help.blotato.com/api/start
- Blotato API reference for LLMs: https://help.blotato.com/api/llm

## Revenue Path Test

1. Visitor lands on SEO, local, political, or service page.
2. Visitor clicks CTA.
3. Customer submits intake or campaign plan request.
4. Admin/sales sees the lead, review item, proposal, or campaign status.
5. Customer approves proposal or postcard draft.
6. Customer pays through Stripe.
7. Webhooks update order, campaign, admin dashboard, sales dashboard, and customer dashboard.
8. Follow-up tasks and notifications are created.
9. Reporting reflects the transaction.

No Growth Engine feature is complete until this path is verified end to end for the relevant product.
