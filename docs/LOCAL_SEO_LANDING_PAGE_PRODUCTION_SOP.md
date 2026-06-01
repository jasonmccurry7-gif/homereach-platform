# Local SEO / Landing Pages Production SOP

Status: Production-ready manual service with publish gate  
Owner: SEO Operations / Revenue Operations  
Primary agent: Local SEO Authority Agent  
Price: $499 setup + $299/month monitoring for one local landing page package; additional page clusters quoted  
Last updated: 2026-06-01

## Service Promise

HomeReach helps a local business turn real services, geographies, campaigns, QR traffic, and approved proof into useful local landing pages.

This is not mass page generation. This is a supervised local visibility workflow that produces review-ready page briefs, drafts, metadata, schema recommendations, QA notes, and monthly monitoring.

## Sellable Package

The base package includes:

- One local SEO or campaign landing page plan
- Route type recommendation
- Search intent and conversion path
- Proof/source gap checklist
- Metadata and schema recommendations
- Draft copy direction or page draft
- SEO QA checklist
- Publish approval log
- Monthly monitoring summary

Additional city, service, QR, or campaign page clusters require owner-approved quoting before work begins.

## Public Entry Points

- Public service page: `/services/local-seo`
- Intake: `/waitlist?product=local-seo`
- Admin operating surface: `/admin/marketing/seo-command-center`
- Approval endpoint: `POST /api/admin/seo-engine/pages/[id]/approve`
- Publish endpoint: `POST /api/admin/seo-engine/pages/[id]/publish`
- Smoke test: `pnpm smoke:local-seo`

## Intake Workflow

The public Local SEO request form collects:

- Contact and business details
- Website
- Primary service
- Target city, county, ZIP, or service area
- Page goal
- Page type
- Existing page URL when available
- Proof points or notes
- Optional SMS consent metadata

After submission, `/api/waitlist` must:

1. Save the waitlist entry.
2. Store `product_intent = local-seo`.
3. Store the SEO context in `product_context`.
4. Create an `ai_workforce_tasks` row assigned to `Local SEO Authority Agent`.
5. Set `related_opportunity = local-seo-landing-pages`.
6. Mark `approval_required = true`.
7. Log the handoff in `ai_workforce_activity_logs`.

If AI Workforce tables are unavailable, the waitlist entry should still save and the API should degrade gracefully.

## Operator Workflow

1. Review the waitlist request in `/admin/waitlist`.
2. Open the AI Workforce task for the Local SEO Authority Agent.
3. Confirm the business, geography, primary service, and route type.
4. Collect missing proof, approved offers, photos, testimonials, campaign context, or source notes.
5. Decide whether the work belongs in an authority route, SEO Engine page, campaign landing page, QR page, or existing page improvement.
6. Prepare the local SEO brief.
7. Draft or revise the page only after proof gaps are clear.
8. Run the SEO QA checklist.
9. Record human approval.
10. Publish only through the existing SEO publish gate.
11. Verify route, metadata, CTA, schema, mobile layout, sitemap behavior, and lead path.

## Approval Gates

Human approval is required before:

- Publishing any SEO page
- Changing public copy
- Changing metadata
- Adding or changing schema
- Changing redirects or indexing controls
- Updating citations or local profiles
- Changing CTAs
- Publishing customer proof, testimonials, political content, or compliance-sensitive claims

Do not publish:

- Fake local offices
- Doorway pages
- Unsupported local dominance claims
- Fake reviews or ratings
- Unsupported customer outcomes
- Ranking, traffic, lead, or ROI guarantees

## Reporting

Monthly reporting may include:

- Pages drafted
- Pages approved
- Pages published
- Route health
- CTA path health
- Known visits or form submissions
- QR scans when tied to a campaign
- Search Console metrics when connected
- Source gaps
- Recommended next page or consolidation

Use measured language such as "visibility signal", "tracked visits", "known lead path activity", and "Search Console data when connected".

## Issue Handling

- If proof is missing, keep the page unpublished.
- If the page overlaps an existing route, consolidate or update rather than creating a duplicate.
- If analytics is unavailable, report page inventory, QA status, known conversions, and source gaps only.
- If a CTA breaks, pause publishing and fix the lead path first.
- If the SEO Engine feature flag is off, keep the service in manual brief/draft mode.

## Rollback

Use the least destructive option:

1. Archive the `seo_pages` row.
2. Revert to a prior version when available.
3. Disable `ENABLE_SEO_ENGINE` if the engine creates systemic risk.
4. Revert the specific public copy change.

Never delete historical SEO records unless there is a clear data-retention or compliance reason.
