# Business Memory Service Kit

## Status

Business Memory is an internal HomeReach OS foundation layer. It is included with managed HomeReach services and is not sold as a standalone product yet.

Production posture: read-only client/admin visibility, explicit sync actions, guarded API access, RLS-backed Supabase tables, and approval-gated downstream use.

## Value

Business Memory helps HomeReach remember what has happened for each client so future recommendations become less generic and more useful.

It should support:

- Better AI COO recommendations.
- Faster client onboarding.
- Cleaner renewal conversations.
- More accurate campaign, geography, offer, supplier, savings, reputation, and growth history.
- Clearer missing-data prompts for the internal team.

## Live Surfaces

- Client view: `/dashboard/business-memory`
- Admin profile list: `/admin/business-memory`
- Admin profile detail: `/admin/business-memory/[profileId]`
- Client sync API: `/api/business-memory/sync`
- Admin sync API: `/api/admin/business-memory/sync`
- Guarded read API: `/api/business-memory/profile`

## Database Tables

The Business Memory MVP uses:

- `business_memory_profiles`
- `business_memory_geographies`
- `business_memory_campaigns`
- `business_memory_campaign_results`
- `business_memory_opportunities`
- `business_memory_offers`
- `business_memory_suppliers`
- `business_memory_savings`
- `business_memory_reputation`
- `business_memory_growth`
- `business_memory_ai_coo`
- `business_memory_timeline`
- `business_memory_insights`
- `business_memory_scores`

All tables must keep RLS enabled. Client-facing reads must only expose records linked to the authenticated client's `client_id` or client email. Admin and sales agent access remains role-gated.

## Sync Sources

Business Memory currently pulls from existing internal records where present:

- Market Capture leads, campaigns, locations, reports, and assets.
- AI COO recommendations and actions.
- Operations Copilot/Supplyfy supplier and savings records.
- Reputation and growth records when available.
- Business context records and operational alerts where available.

The sync process should not fabricate outcomes. Unknown outcomes stay unknown until a report, note, or verified metric exists.

## Operating Workflow

1. Confirm the client has a business name, email, industry, website, and primary service area.
2. Run Business Memory sync from the admin view.
3. Review the memory completeness score.
4. Fill gaps through onboarding or account review.
5. Use insights to guide AI COO recommendations.
6. After each campaign/report/review/savings event, sync memory again.
7. Use the timeline and insights in renewal or upsell conversations.

## Result Tracking

Track:

- Memory completeness score.
- Campaigns remembered.
- Geographies remembered.
- Opportunities accepted, dismissed, or completed.
- Offers used.
- Suppliers and savings reviewed.
- Reviews/referrals/testimonials captured.
- AI COO recommendations influenced by memory.
- Missing fields blocking useful recommendations.

## Approval And Safety

Business Memory is advisory context. It must not:

- Expose one client's data to another client.
- Infer sensitive personal traits.
- Infer individual political beliefs.
- Claim success when an outcome is unknown.
- Automatically send outreach, launch campaigns, charge clients, publish content, or change active services.

Any customer-facing recommendation, campaign change, payment action, political output, vendor action, or public claim still requires human approval.

## Smoke Test

Run:

```bash
pnpm smoke:business-memory
```

The smoke verifies:

- Client/admin routes gate or load cleanly.
- The profile read API requires authentication.
- Client/admin sync endpoints require authentication and role checks.
- Supabase Business Memory tables exist when local service credentials are available.

## Rollback

If Business Memory causes production issues:

1. Set `ENABLE_BUSINESS_MEMORY=false`.
2. Keep existing services running from their native records.
3. Do not delete memory tables; preserve historical context.
4. Re-enable only after route/API smoke passes.

## Next Improvements

- Mandatory onboarding memory fields.
- Admin duplicate profile merge process.
- More disciplined report-to-memory ingestion.
- Memory quality review queue.
- Better client-facing explanation of why each recommendation improved.
