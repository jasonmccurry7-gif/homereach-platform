# Political Data Acquisition Engine

Phase 1A foundation. Anchors the system on FEC as the federal identity-resolution layer; OH SoS and county BOE arrive in Phase 4.

This document covers what's shipped today, how to use it, what it explicitly does NOT do, and the deferred scope.

---

## Tables (migration 071)

### Reference taxonomy
- `political_data_sources` — the registry. Every ingested row carries `source_id`.
- `political_offices` — controlled vocabulary (`us_senate`, `oh_governor`, `school_board`, …).
- `political_jurisdictions` — controlled vocabulary (`United States`, `Ohio`, county/district later).
- `political_elections` — specific election dates per jurisdiction.

### Staging (raw ingest queue)
- `staging_candidates`
- `staging_organizations`
- `staging_campaigns`

Each staging row carries the full source payload (`raw_payload jsonb`), source provenance (`source_id`, `source_url`, `source_record_id`, `source_retrieved_at`, `source_license_notes`), a `dedupe_hash`, validation status, review status, and (Phase 1B) match suggestions against the live tables.

### Crawler (Phase 2 placeholders)
- `crawl_sources`
- `crawl_jobs`

Schema only. **No crawler executes today.** See `/admin/political/data-sources/crawl-jobs` for the full compliance gate list.

### Live tables — additive columns
- `campaign_candidates.fec_candidate_id` (text, unique sparse index)
- `campaign_candidates.source_data_source_id`
- `campaign_candidates.outreach_allowed` boolean **defaulting to false**
- `political_organizations.fec_committee_id` (text, unique sparse index)
- `political_organizations.source_data_source_id`

`outreach_allowed = false` is the system-wide gate. Outreach engines must check this column on every send.

---

## FEC ingestion — operator runbook

### One-time setup

1. **Run migration 071** in the Supabase SQL editor.
2. **Get a free API key** at <https://api.data.gov/signup/>. Set it in your environment:
   ```
   FEC_API_KEY=your_key_here
   ```
   Without this, the system falls back to `DEMO_KEY` (~30 requests/hour, hard rate-limited at api.data.gov). The `/admin/political/data-sources` page shows a banner when the key is missing.
3. Confirm the FEC source rows exist:
   ```sql
   select source_key, enabled, last_run_status
   from political_data_sources
   where source_key like 'fec_%';
   ```
   You should see `fec_candidates_v1` and `fec_committees_v1`. They ship **disabled by default**.

### Running an ingestion

1. Open `/admin/political/data-sources`.
2. Click the **Disabled** pill next to `FEC — Candidates (OpenFEC API)` to flip it to **Enabled**.
3. In the right-hand action cell, set:
   - **Cycle** (e.g. `2026` — election year)
   - **State** (2-letter, e.g. `OH`; leave blank for all states — much slower)
4. Click **Run now**.

The fetcher pages through OpenFEC at 100 records per page, hard-capped at 5,000 records per run. Results land in `staging_candidates` with `review_status = 'pending'`.

The same flow applies to `FEC — Committees (OpenFEC API)`, which lands rows in `staging_organizations`.

### Audit trail

Every run creates a `political_imports` audit row. View at:
- `/admin/political/imports` — full history
- `/admin/political/data-sources` — per-source last-run summary card with fetched/inserted/skipped/failed counts

### Re-running is safe

A partial unique index on `(source_id, source_record_id)` means re-runs upsert with `ignoreDuplicates: true`. The skip count in the audit row tells you how many rows were already known.

---

## Review queue

`/admin/political/review` shows all `pending` staging records across all three staging tables (powered by the `political_review_queue` view).

### Per-row actions

- **Approve** → marks `review_status = 'approved'`. Does NOT promote to live yet (that's a separate Phase 1B step).
- **Reject** → marks `review_status = 'rejected'`. Stays in staging for audit.

### Per-batch actions

When the URL is filtered to one import batch (`?batch=<importId>`), the page exposes **Approve all pending in batch** and **Reject all pending in batch**. Use this for "I trust everything from this FEC pull" workflows.

### What you'll see

For each row:
- **Kind** (candidate / organization / campaign)
- **Display name + office/type + jurisdiction/state + cycle**
- **Source provenance** — link to the upstream FEC URL, link to filter the queue to the source's batch
- **Match confidence** (Phase 1B will populate this from the dedup engine)

---

## Compliance posture

Implemented today, enforced by code review and schema:

- Every staging row carries `source_url`, `source_record_id`, `source_retrieved_at`, `source_license_notes`
- Reference data only ships in seeds (offices, jurisdictions, source registry rows). **No fake political seed data** anywhere — see `supabase/seeds/README.md`
- `outreach_allowed = false` default on `campaign_candidates`. Outreach paths must check this
- No persuasion / ideology / voter-prediction logic anywhere in `lib/political/`. Confidence scores are pure data-completeness signals
- No scraping. The crawler page is a placeholder

---

## What Phase 1A explicitly does NOT do

These are **deliberate** gaps; they're scheduled for follow-up phases.

| Capability | Phase | Why deferred |
| --- | --- | --- |
| Auto-suggest dedup matches in review queue | 1B | Needs the fuzzy-name + office + jurisdiction matcher; non-trivial |
| Promote `approved` staging rows → live tables | 1B | Should land together with the dedup engine so the merge UI is coherent |
| Batch-level rollback of promoted rows | 1B | Reuses the existing `political_imports` rollback logic but needs to know about the promotion target rows |
| `/admin/political/candidates` full list view | 1C | Skipped for now; the existing dashboard surfaces enough |
| `/admin/political/committees` list view | 1C | Same reason |
| Data Reference public-facing tab content | 1C | The internal `/admin/political/data-sources` page covers operators |
| Refresh scheduler (nightly cron) | 1C | Build only after manual runs are stable |
| OH SoS importer | 4 | FEC must be the anchor first |
| County BOE ingestion | 4 | Per-county formats vary widely; design pattern after OH SoS lands |
| Crawler execution | 2 | Compliance gates not all wired |

---

## Adding a new data source

When you wire a new upstream (e.g. OH SoS) in a future phase:

1. Add a row to `political_data_sources` (migration or admin UI later).
2. Implement an ingestion module under `apps/web/lib/political/<source>/{client,normalize,ingest}.ts`. Mirror the FEC structure.
3. Add a server action to invoke it.
4. Wire a "Run now" button in `DataSourcesTable.tsx` matching on the `source_key`.
5. Records land in the same staging tables → same review queue → same promotion path. No new UI required.

---

## Files added in this phase

- `supabase/migrations/071_political_data_acquisition.sql`
- `apps/web/lib/political/fec/{client.ts,normalize.ts,ingest.ts}`
- `apps/web/app/(admin)/admin/political/data-sources/page.tsx` (replaces stub)
- `apps/web/app/(admin)/admin/political/data-sources/actions.ts`
- `apps/web/app/(admin)/admin/political/data-sources/_components/DataSourcesTable.tsx`
- `apps/web/app/(admin)/admin/political/data-sources/imports/page.tsx` (redirect to unified imports)
- `apps/web/app/(admin)/admin/political/data-sources/crawl-jobs/page.tsx` (Phase 2 placeholder)
- `apps/web/app/(admin)/admin/political/review/page.tsx`
- `apps/web/app/(admin)/admin/political/review/actions.ts`
- `apps/web/app/(admin)/admin/political/review/_components/ReviewQueue.tsx`
- `apps/web/app/(admin)/admin/political/_components/SubNav.tsx` (Review + Imports + Data Sources tabs added)
