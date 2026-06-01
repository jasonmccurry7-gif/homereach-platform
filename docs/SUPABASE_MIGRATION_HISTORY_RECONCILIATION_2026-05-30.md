# Supabase Migration History Reconciliation - 2026-05-30

## Purpose

Production migration history and the local `supabase/migrations` directory had drifted. The active local folder contained older numeric migrations, duplicate version prefixes, and pending/recreated timestamped migrations that did not match production.

This created a risk that `supabase db push` could either fail or attempt to apply unrelated historical work to production.

## Source Of Truth

For this reconciliation, production was treated as the source of truth:

- Remote table: `supabase_migrations.schema_migrations`
- Active local folder after cleanup: `supabase/migrations`
- Archived pre-cleanup folder: `supabase/migrations_pending_review_20260530`

## Before Cleanup

- Remote migration records: 40
- Local migration files: 102
- Remote-only versions: 28
- Local-only versions: 90
- Duplicate local version prefixes: `048`, `078`, `079`

## Cleanup Performed

1. Fetched migration files directly from the production migration history table.
2. Archived the previous active local migration folder to `supabase/migrations_pending_review_20260530`.
3. Rebuilt `supabase/migrations` with the 40 production-applied migration files.
4. Confirmed migration `20260530144000_seo_page_approval_audit` is present locally and remotely.
5. Verified `supabase migration list --db-url <production-db>` shows matching local and remote versions.
6. Verified `supabase db push --db-url <production-db> --dry-run` reports the remote database is up to date.

## Important Guardrail

Do not move files from `supabase/migrations_pending_review_20260530` back into the active migration folder wholesale.

If an archived migration contains schema work that still needs to go live, create a new reviewed forward-only migration using `supabase migration new <name>`, copy only the approved SQL needed, and dry-run before applying.

## Current State

The active migration ledger is now clean and production-aligned. Future migrations can be created from the current production baseline instead of from the historical mixed backlog.
