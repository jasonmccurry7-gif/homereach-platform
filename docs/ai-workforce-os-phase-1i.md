# HomeReach AI Workforce OS - Phase 1I

## Purpose

Phase 1I adds read-only source freshness indicators for the data sources AI agents rely on.

Agents should not recommend actions from stale campaign, procurement, outreach, or contract data without making that freshness visible.

## What Was Added

- `getSourceFreshnessReport`
  - Checks latest timestamps from existing source tables.
  - Classifies each source as `fresh`, `aging`, `stale`, `missing`, or `unavailable`.
- `GET /api/admin/ai-orchestration/source-freshness`
  - Admin-only.
  - Read-only.
- `/admin/agents`
  - Adds an Agent Data Freshness panel.

## Sources Checked

- Candidate Intelligence: `candidate_intel_sync_runs`
- Learning Engine Ingestion: `ci_ingestion_queue`
- Gov Contracts Sync: `gov_contract_sync_runs`
- Messaging Webhooks: `revenue_webhook_events`
- Procurement Email Sequence: `auto_sequences`

## Safety Boundary

This phase does not:

- run sync jobs
- send messages
- ingest videos
- trigger SAM.gov
- modify records
- approve actions
- update candidate data
- publish anything

It only reports freshness and recommended next steps.

## Next Safe Phase

Phase 1J should add freshness signals into the Action Center only when a source is stale or unavailable. That keeps stale-data work visible without triggering syncs automatically.
