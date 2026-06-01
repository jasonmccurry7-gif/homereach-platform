# HomeReach Local SEO Landing Page QA Checklist

Status: Production QA checklist  
Owner: SEO QA / Revenue Operations  
Applies to: Local SEO, authority, city/category, targeted, and conversion landing pages  
Last updated: 2026-05-30

## Purpose

Use this checklist before and after publishing any HomeReach local SEO landing page.

Approval status must remain `needs_review` until the checklist passes and a human approves the page.

## Pre-Publish Checklist

### Strategy

- [ ] Page has a clear business reason
- [ ] Search intent is defined
- [ ] Target audience is defined
- [ ] Target geography is real and relevant
- [ ] Route type is selected
- [ ] Conversion path is clear
- [ ] Related entity is recorded
- [ ] Inputs used are listed
- [ ] Sources referenced are listed

### Local Proof

- [ ] No fake local office claim
- [ ] No fake customer claim
- [ ] No fabricated testimonial
- [ ] No unsupported market leadership claim
- [ ] Local context is hand-authored or source-supported
- [ ] If proof is unavailable, page uses honest early-access, availability, or proposal framing

### Copy Quality

- [ ] Page is useful to a real buyer
- [ ] Page avoids keyword stuffing
- [ ] Page avoids doorway-page patterns
- [ ] Page avoids copied or thin content
- [ ] Page uses business-owner language
- [ ] Page explains what happens next
- [ ] Page avoids guaranteed rankings, traffic, leads, ROI, sales, or outcomes
- [ ] Political copy, if any, uses geography and public/campaign-provided context only

### SEO Engine Gate

- [ ] `seo_pages.status` is draft or review during editing
- [ ] Slug does not collide with reserved paths
- [ ] Title tag is 40 to 60 characters
- [ ] Meta description is 120 to 160 characters
- [ ] H1 is present
- [ ] Word count is at least 500 words
- [ ] Human-authored local/proof/FAQ/category sections total at least 200 words
- [ ] Primary CTA URL starts with `/get-started/` or `/targeted/start`
- [ ] CTA URL resolves
- [ ] Inventory check passes, or page uses honest waitlist framing
- [ ] Quality check passes

### Metadata And Schema

- [ ] Canonical URL matches the intended route
- [ ] Open Graph title and description are appropriate where present
- [ ] Schema matches real HomeReach services
- [ ] LocalBusiness schema does not imply a fake office
- [ ] FAQ schema matches visible page content
- [ ] Breadcrumb schema matches page hierarchy
- [ ] Image alt text is descriptive

### Links And Funnels

- [ ] Primary CTA works
- [ ] Secondary CTA works if present
- [ ] Internal links are useful and not excessive
- [ ] No admin, dashboard, checkout, or token routes are exposed unintentionally
- [ ] CTA tracking or source parameter is present where supported
- [ ] Payment or checkout language is accurate and approval-safe

### Mobile And Accessibility

- [ ] Page reads clearly on mobile
- [ ] Text does not overlap
- [ ] Buttons are tappable
- [ ] Images load and have alt text
- [ ] Headings follow a logical order
- [ ] Contrast is readable
- [ ] No layout shift blocks the CTA

### Approval

- [ ] Human approver recorded
- [ ] Approval date recorded
- [ ] Approval scope recorded
- [ ] Source gaps recorded
- [ ] Compliance notes recorded
- [ ] Approval completed through `POST /api/admin/seo-engine/pages/[id]/approve`
- [ ] Page status moved to approved only after review and quality check
- [ ] Approved page has `approved_by`, `approved_at`, and `approval_notes`

## Publish Checklist

- [ ] Page status is approved
- [ ] Approval audit fields are present
- [ ] Publish rate limit will not be exceeded
- [ ] Published cap will not be exceeded
- [ ] Protected core routes are not affected
- [ ] Publish endpoint returns success
- [ ] Revalidation completes or is retried safely

## Post-Publish Checklist

- [ ] Public route returns 200
- [ ] Page is not blocked by robots
- [ ] Canonical is correct
- [ ] Title tag appears correctly
- [ ] Meta description appears correctly
- [ ] H1 appears correctly
- [ ] CTA route works
- [ ] JSON-LD parses
- [ ] Internal links work
- [ ] Mobile rendering is acceptable
- [ ] Sitemap includes the route when expected
- [ ] Image sitemap includes the visual asset when applicable
- [ ] Analytics/Search Console tracking plan is recorded

## Monitoring Checklist

Track where available:

- [ ] Indexing status
- [ ] Impressions
- [ ] Clicks
- [ ] CTR
- [ ] Average position
- [ ] Organic sessions
- [ ] CTA clicks
- [ ] Form starts
- [ ] Leads
- [ ] Campaign or proposal handoffs

Use "unavailable" when a metric is not connected. Do not invent performance numbers.

## Blockers

Block publishing when:

- Source support is missing for a factual claim
- CTA route is broken
- Inventory conflicts with the page claim
- Page implies fake local presence
- Page has fabricated reviews or testimonials
- Page makes ranking or ROI guarantees
- Political copy creates individual voter profiling risk
- Protected core route behavior is uncertain
- Human approval is not recorded

## Rollback Checklist

If a page needs to come down:

- [ ] Archive the specific page if using `seo_pages`
- [ ] Revert to a prior version if content changed after publish
- [ ] Disable `ENABLE_SEO_ENGINE` only for systemic SEO Engine issues
- [ ] Confirm public route no longer exposes the problematic page
- [ ] Record reason, owner, timestamp, and next action
