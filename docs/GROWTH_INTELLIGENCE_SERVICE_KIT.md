# Growth Intelligence Service Kit

## Status

Growth Intelligence is an internal-to-client advisory layer in HomeReach OS. It is included with Growth Review and managed HomeReach services. It is not sold as a standalone automated intelligence product yet.

Production posture: approval-led opportunity cards, admin-entered intelligence, guarded APIs, manual campaign conversion, no scraping, no autonomous outreach, and no campaign launch without human approval.

## Value

Growth Intelligence helps HomeReach and clients answer:

- Where should we grow next?
- Which neighborhood, service area, event, competitor area, or seasonal moment deserves attention?
- Which clients have useful campaign, memory, savings, reputation, or direct mail context that can become a new growth opportunity?
- Which recommendations should become a Market Capture, direct mail, reputation, referral, political, or cost-control workflow?

## Live Surfaces

- Client view: `/dashboard/growth-intelligence`
- Admin view: `/admin/growth-intelligence`
- Opportunity feed API: `/api/growth-intelligence/opportunities`
- Opportunity action API: `/api/growth-intelligence/opportunities/[opportunityId]`
- Admin sync API: `/api/admin/growth-intelligence/sync`
- Admin local intelligence entry API: `/api/admin/growth-intelligence/admin-entries`

## Database Tables

The Growth Intelligence MVP uses:

- `growth_intelligence_admin_entries`
- `growth_intelligence_sources`
- `growth_intelligence_opportunities`
- `growth_intelligence_scores`
- `growth_intelligence_reports`
- `growth_intelligence_client_matches`
- `growth_intelligence_actions`
- `growth_intelligence_drafts`

All tables must keep RLS enabled. Client-facing reads must only expose records linked to the authenticated client's `client_id` or client email. Admin and sales agent access remains role-gated.

## Source Inputs

Phase-ready inputs include:

- Existing clients.
- Market Capture records.
- Direct mail records.
- Political campaign records.
- Cost Control/Supplyfy records.
- Reputation records.
- Business Memory.
- Admin-entered competitors, events, neighborhoods, developments, seasonal notes, political races, local observations, referral targets, and partnership targets.

The MVP does not scrape private platforms or auto-discover public records. Admin-entered records should identify the source context in notes.

## Operating Workflow

1. Open `/admin/growth-intelligence`.
2. Add or sync local intelligence.
3. Review generated opportunities and scores.
4. Keep weak or unsourced opportunities internal until reviewed.
5. Use copyable drafts only as review-ready starting points.
6. Convert approved opportunities into the appropriate manual workflow:
   - Market Capture Campaign
   - Direct Mail Campaign
   - Political Campaign
   - Review Campaign
   - Referral Campaign
   - Supplyfy/Cost Control Task
   - General Growth Task
7. Log actions and sync Business Memory after outcomes are known.

## Result Tracking

Track:

- Opportunities found.
- High-priority opportunities.
- Opportunities approved.
- Opportunities dismissed.
- Opportunities converted to campaigns or tasks.
- Estimated revenue potential.
- Actual campaigns created.
- Top opportunity categories.
- Top clients.
- Recommended next actions.

Do not present estimated potential as guaranteed revenue.

## Approval And Safety

Growth Intelligence must not:

- Scrape private platforms.
- Auto-message prospects or clients.
- Infer sensitive traits.
- Infer individual political beliefs.
- Classify individuals.
- Build voter persuasion scoring.
- Guarantee revenue, leads, rankings, or outcomes.
- Launch paid campaigns or outreach without human approval.

Any outreach, proposal, campaign, pricing, political, procurement, or public claim requires human approval.

## Smoke Test

Run:

```bash
pnpm smoke:growth-intelligence
```

The smoke verifies:

- Client/admin routes gate or load cleanly.
- The opportunity feed requires authentication.
- Admin sync and admin-entry creation require admin access.
- Opportunity actions require authentication.
- Supabase Growth Intelligence tables exist when local service credentials are available.

## Rollback

If Growth Intelligence causes production issues:

1. Set `ENABLE_GROWTH_INTELLIGENCE_ENGINE=false`.
2. Keep Local Growth Review and Market Capture operating from their native records.
3. Preserve the tables; do not delete opportunity history.
4. Re-enable only after `pnpm smoke:growth-intelligence` passes.

## Next Improvements

- Source quality checklist for admin-entered intelligence.
- Campaign conversion task linkage to Market Capture and direct mail records.
- Duplicate opportunity merge workflow.
- Monthly growth report review workflow.
- Better scoring calibration after real client outcomes exist.
