# HomeReach Local SEO Landing Page Publishing Workflow

Status: Production manual workflow  
Owner: SEO Growth / Revenue Operations  
Applies to: HomeReach-owned local SEO, authority, city/category, targeted, and conversion landing pages  
Last updated: 2026-05-30

## Purpose

This workflow lets HomeReach publish local SEO landing pages without creating spam, duplicate pages, unsupported claims, or broken revenue paths.

The goal is not to mass-generate pages. The goal is to create useful, local, conversion-focused pages that help qualified visitors understand:

- What HomeReach does
- Why it matters locally
- What proof or context supports the page
- What action should happen next

## SEO Lane

Primary lanes from the SEO Growth SOP:

- Local SEO Authority
- Conversion SEO
- SEO QA

Every public-facing SEO output starts as `needs_review` until a human approves it.

## Public Request Handoff

Local SEO / Landing Pages can be sold from:

- `/services/local-seo`
- `/waitlist?product=local-seo`

The intake route captures the business, service, geography, page goal, page type, existing page URL, proof notes, and optional SMS consent metadata.

After submission, the system creates an approval-gated AI Workforce task:

- Assigned agent: `Local SEO Authority Agent`
- Workflow: `SEO Authority Chain`
- Related opportunity: `local-seo-landing-pages`
- Input path: `/admin/waitlist?entry=<waitlist_entry_id>`
- Required output: route recommendation, search intent, conversion path, proof gaps, metadata/schema notes, approval status, and next action

This handoff is advisory and operational only. It does not publish a page, change metadata, change schema, update citations, change redirects, or make public local claims.

## Existing HomeReach SEO Surfaces

Admin and planning:

- `/admin/marketing/seo-command-center`
- `/admin/content-review`
- `apps/web/lib/seo/`
- `skills/seo-growth/SKILL.md`

Public authority routes:

- `/ohio`
- `/ohio/[citySlug]`
- `/ohio/[citySlug]/[topicSlug]`
- `/ohio/counties/[countySlug]/[topicSlug]`
- `/political-mail`
- `/services`
- `/services/[serviceSlug]`
- `/case-studies`
- `/tools`
- `/visuals`
- `/benchmarks`
- `/insights`

SEO engine routes:

- `/advertise/[citySlug]`
- `/advertise/[citySlug]/[categorySlug]`
- `/advertise/[citySlug]/[categorySlug]/featured`
- `/targeted/[citySlug]`

Legacy city-category routes:

- `/{city}-{category}` for the existing hardcoded city/category landing pages

Technical files:

- `apps/web/app/sitemap.ts`
- `apps/web/app/robots.ts`
- `apps/web/app/image-sitemap.xml/route.ts`
- `apps/web/lib/seo/schema.ts`
- `apps/web/lib/seo/quality.ts`
- `apps/web/lib/seo/inventory-rules.ts`
- `apps/web/lib/seo/registry.ts`

## Source Of Truth

Use these in order:

1. AGENTS.md and the HomeReach SEO Growth SOP
2. AI Assets business context and approved examples
3. Existing public HomeReach pages
4. Existing records: campaigns, Market Capture, direct mail, political, local visibility, reputation, cost control, Business Memory
5. Search Console, analytics, or connector data when available
6. Public sources only when needed, with source notes

Do not invent local proof, reviews, customer results, offices, service locations, rankings, or performance claims.

## Route Type Decision

Choose the route type before drafting.

### Authority Page

Use for:

- Ohio, county, city, service, political mail, tools, insights, and educational authority
- Pages intended to build trust and explain a market, service, or workflow

Default path:

- Existing static authority route if already supported

Approval requirement:

- Human approval before copy, metadata, schema, or CTA changes go live

### SEO Engine Page

Use for:

- City/category advertising pages
- City-level advertise pages
- Targeted city pages
- Featured category pages

Supported slugs:

- `advertise/[citySlug]`
- `advertise/[citySlug]/[categorySlug]`
- `advertise/[citySlug]/[categorySlug]/featured`
- `targeted/[citySlug]`

Source table:

- `seo_pages`

Statuses:

- draft
- review
- approved
- published
- archived

Approval requirement:

- Must be approved before the publish endpoint accepts it

Approval endpoint:

- `POST /api/admin/seo-engine/pages/[id]/approve`

Approval endpoint behavior:

- Admin-only
- Feature-flag gated by `ENABLE_SEO_ENGINE`
- Accepts draft or review pages only
- Re-runs the full quality check before approval
- Records `approved_by`, `approved_at`, and `approval_notes`
- Moves the page to approved
- Does not publish the page

Publishing endpoint:

- `POST /api/admin/seo-engine/pages/[id]/publish`

Publishing endpoint behavior:

- Admin-only
- Requires `status = approved`
- Requires approval audit fields
- Re-runs quality, CTA, inventory, cap, and rate-limit checks
- Publishes only after all checks pass

### Legacy City-Category Page

Use for:

- Existing hardcoded `/{city}-{category}` pages only

Risk:

- These pages are not the preferred expansion path for new SEO work because route data can drift from the sitemap constants.

Recommended action:

- Use SEO Engine or authority routes for new pages unless intentionally maintaining an existing legacy page.

## Publishing Workflow

### 1. Select The Opportunity

Create a page only when there is a clear business reason.

Valid signals:

- Existing service demand
- Existing campaign or sales activity
- Market Capture target area
- Direct mail geography
- Political mail geography
- Local visibility scan
- Search Console query data
- Business Memory geography
- Admin-entered local intelligence
- Approved service expansion

Do not create pages only because a city and keyword combination exists.

### 2. Define The Brief

Each page brief must include:

- SEO lane
- Target route
- Target geography
- Target audience
- Search intent
- Conversion path
- Primary CTA
- Inputs used
- Sources referenced
- Related entity
- Approval status
- Next action

Use this format:

```text
SEO lane:
Target route:
Geography:
Audience:
Search intent:
Conversion path:
Inputs used:
Sources referenced:
Related entity:
Approval status: needs_review
Next action:
```

### 3. Validate Local Proof

Before drafting, confirm at least one of:

- HomeReach already serves or sells into the geography
- There is an approved campaign, offer, or service relevant to the geography
- The page is framed honestly as an availability, proposal, or review path
- The page is an educational authority page, not a false local-presence claim

Do not publish:

- Fake local offices
- Fake testimonials
- Fake customer examples
- Unsupported market leadership claims
- Doorway pages with thin rewritten city names

### 4. Draft The Page

For SEO Engine pages, the draft generator is designed to leave human-authored placeholders in:

- city_relevance
- category_pain
- proof_trust
- faq

These blocks must be hand-edited before publish.

Required copy rules:

- Outcome-first language
- Clear local relevance
- HomeReach positioning as an AI-powered operational growth and execution ecosystem
- No ranking guarantees
- No lead or ROI guarantees
- No keyword stuffing
- No fabricated local proof
- No scraped private-platform claims

### 5. Set Metadata And CTA

Check:

- Title tag is 40 to 60 characters
- Meta description is 120 to 160 characters
- H1 is present and not a title-tag duplicate
- Primary CTA is specific
- CTA route resolves
- Internal links support the user journey
- Canonical URL matches the intended route

Allowed CTA patterns for SEO Engine quality gate:

- `/get-started/...`
- `/targeted/start...`

Use specific funnel paths when possible. Avoid generic CTA paths when a city/category-specific path exists.

### 6. Add Schema Carefully

Allowed schema types already supported:

- Organization
- WebSite
- Service
- FAQPage
- BreadcrumbList
- LocalBusiness
- ImageObject

Do not use schema to imply:

- A fake physical location
- Unsupported local dominance
- Fake reviews or ratings
- Services HomeReach does not actually offer

### 7. Run Quality Review

For SEO Engine pages:

- Run the quality check
- Confirm CTA HEAD check passes
- Confirm inventory check passes or page uses honest waitlist framing
- Confirm status is ready for human review

Publish-time checks already enforced:

- Word count at least 500 words
- Human-authored local/proof/FAQ/category sections at least 200 words
- Title length
- Meta description length
- H1 present
- CTA URL present and funnel-aligned
- Inventory availability or waitlist framing
- Reserved slug protection
- CTA URL reachable
- Published page cap
- 24-hour publish rate limit

### 8. Human Approval

Human approval is required before:

- Publishing SEO copy
- Changing metadata
- Adding or changing schema
- Changing redirects
- Changing indexing controls
- Updating local profiles or citations
- Changing CTAs
- Publishing customer-facing recommendations
- Using testimonials or customer proof
- Publishing political or compliance-sensitive copy

Approval record must include:

- Approver
- Date
- Page route
- Approval scope
- Known source gaps
- Compliance notes
- Next action

### 9. Publish

Only publish after:

- Quality check passes
- Inventory or waitlist logic passes
- Human approval is recorded
- CTA is verified
- Page is mobile-readable
- No protected core route is affected

For SEO Engine pages:

- Approve first with `POST /api/admin/seo-engine/pages/[id]/approve`
- Use the publish route only when the row is approved and approval audit fields are present
- The publish action revalidates the public path
- The sitemap includes published SEO Engine pages when the feature flag is enabled

Never publish pages in bulk without reviewing each page.

### 10. Post-Publish Verification

Verify:

- Public route returns 200
- Page is not blocked by robots
- Canonical is correct
- Title and meta are correct
- H1 is visible
- CTA works
- Internal links work
- JSON-LD parses
- Mobile layout is readable
- Sitemap includes the route when expected
- Image sitemap includes relevant visual assets when applicable

### 11. Monitor

Track:

- Indexed status where available
- Impressions
- Clicks
- CTR
- Average position when Search Console is connected
- Organic sessions when analytics is connected
- CTA clicks
- Form starts
- Leads
- Assisted campaign or proposal creation

Use measured language:

- "Organic visibility"
- "Search impressions"
- "Tracked clicks"
- "Lead path activity"
- "Directional signal"

Do not claim:

- Guaranteed rankings
- Guaranteed traffic
- Guaranteed leads
- Guaranteed ROI

### 12. Rollback

Use the least destructive rollback that solves the problem:

1. Archive the specific `seo_pages` row
2. Revert to a prior `seo_page_versions` snapshot
3. Disable `ENABLE_SEO_ENGINE` if SEO Engine pages create systemic risk
4. Apply the SEO rollback migration only if explicitly approved

Do not delete historical SEO records unless there is a clear data-retention or compliance reason.

## Ready To Publish Definition

A local SEO landing page is ready to publish when:

- The business reason is clear
- Route type is selected
- Local proof is real or the page is honestly framed
- Human-authored blocks are complete
- Metadata fits length and intent
- CTA route resolves
- Schema is accurate
- Internal links are useful
- No spam tactics are present
- Human approval is recorded
- Protected core route risk is low

## Manual Service Readiness

Ready to sell now:

- Local SEO opportunity audit
- Local authority page brief
- Conversion SEO review
- Metadata and schema recommendations
- Manual page QA
- Existing authority route improvement plan
- SEO Engine page preparation when flags and approval process are configured

Requires operator work:

- Source collection
- Human-authored local proof
- Manual copy review
- Approval recording
- Route and sitemap verification
- Performance monitoring

Not ready for autonomous use:

- Mass local page generation
- Auto-publishing
- Automated redirects/indexing changes
- Fake office or review claims
- Ranking guarantees
- Thin doorway-page expansion
