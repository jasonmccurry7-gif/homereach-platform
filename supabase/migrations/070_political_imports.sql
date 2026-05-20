-- ─────────────────────────────────────────────────────────────────────────────
-- HomeReach Migration 070 — Political Import Audit + Rollback Infra
--
-- ADDITIVE foundation for the production-only data ingestion path. Every row
-- in `political_routes` and `political_organizations` will be tagged with the
-- import batch that loaded it, so an admin can preview → commit → rollback
-- with full provenance.
--
-- Tables:
--   political_imports          — one row per upload attempt (preview, commit,
--                                rollback all logged here)
--
-- Columns added:
--   political_routes.import_id          uuid, FK → political_imports
--   political_organizations.import_id   uuid, FK → political_imports
--
-- Strictly additive. No fake data. No schema changes to other tables.
-- RLS: admin only. Service role bypasses RLS for cron/system inserts.
--
-- SAFE TO RE-RUN.
-- ─────────────────────────────────────────────────────────────────────────────


-- ═════════════════════════════════════════════════════════════════════════════
-- 1. political_imports — audit + rollback table
-- ═════════════════════════════════════════════════════════════════════════════

create table if not exists public.political_imports (
  id                        uuid primary key default gen_random_uuid(),

  -- Which dataset this batch loaded into
  kind                      text not null check (kind in (
    'routes', 'organizations'
  )),

  -- Provenance — the human-meaningful source label, e.g.
  -- 'usps_eddm_csv_2026_04', 'fec_committees_2026_q1',
  -- 'oh_sos_pacs_2026_04', 'manual_csv'.
  source                    text not null,

  -- Original upload filename (for operator recall)
  original_filename         text,

  -- File hash — sha256 of the uploaded bytes. Cheap dup-detection across
  -- the imports table (same file uploaded twice is usually a mistake).
  file_sha256               text,

  uploaded_by               uuid references public.profiles(id) on delete set null,
  uploaded_at               timestamptz not null default now(),

  -- Row counts captured at preview time
  row_count_total           integer not null default 0,
  row_count_accepted        integer not null default 0,
  row_count_rejected        integer not null default 0,
  row_count_duplicate       integer not null default 0,

  -- Lifecycle
  status                    text not null default 'previewed' check (status in (
    'previewed', 'committed', 'rolled_back', 'failed'
  )),
  committed_at              timestamptz,
  rollback_at               timestamptz,
  rollback_by               uuid references public.profiles(id) on delete set null,

  -- Up to N rejection reasons captured for the admin UI.
  -- Schema: [{ row: int, reason: text, raw: jsonb }, ...]
  sample_rejections         jsonb,

  notes                     text,

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index if not exists political_imports_kind_idx
  on public.political_imports (kind);
create index if not exists political_imports_status_idx
  on public.political_imports (status);
create index if not exists political_imports_uploaded_at_idx
  on public.political_imports (uploaded_at desc);
create index if not exists political_imports_source_idx
  on public.political_imports (source);


-- ═════════════════════════════════════════════════════════════════════════════
-- 2. Wire import_id onto the data tables
-- ═════════════════════════════════════════════════════════════════════════════

alter table public.political_routes
  add column if not exists import_id uuid
  references public.political_imports(id) on delete set null;

create index if not exists political_routes_import_idx
  on public.political_routes (import_id)
  where import_id is not null;

alter table public.political_organizations
  add column if not exists import_id uuid
  references public.political_imports(id) on delete set null;

create index if not exists political_organizations_import_idx
  on public.political_organizations (import_id)
  where import_id is not null;


-- ═════════════════════════════════════════════════════════════════════════════
-- 3. updated_at trigger
-- ═════════════════════════════════════════════════════════════════════════════

do $$ begin
  if exists (select 1 from pg_proc where proname = 'tg_political_touch_updated_at') then
    if not exists (select 1 from pg_trigger where tgname = 'trg_political_imports_updated_at') then
      execute 'create trigger trg_political_imports_updated_at
                 before update on public.political_imports
                 for each row execute function public.tg_political_touch_updated_at()';
    end if;
  end if;
end $$;


-- ═════════════════════════════════════════════════════════════════════════════
-- 4. RLS — admin only (service_role bypasses for cron/system jobs)
-- ═════════════════════════════════════════════════════════════════════════════

alter table public.political_imports enable row level security;

drop policy if exists "political_imports_admin_all" on public.political_imports;

create policy "political_imports_admin_all"
  on public.political_imports for all to authenticated
  using      ((auth.jwt()->'app_metadata'->>'user_role') = 'admin')
  with check ((auth.jwt()->'app_metadata'->>'user_role') = 'admin');


-- ═════════════════════════════════════════════════════════════════════════════
-- 5. Helper view — political_import_summary
--    Convenience read for the admin UI: per-import rollup with how many rows
--    are currently still attached (rollback would reverse this many).
-- ═════════════════════════════════════════════════════════════════════════════

create or replace view public.political_import_summary as
select
  pi.id,
  pi.kind,
  pi.source,
  pi.original_filename,
  pi.uploaded_by,
  pi.uploaded_at,
  pi.row_count_total,
  pi.row_count_accepted,
  pi.row_count_rejected,
  pi.row_count_duplicate,
  pi.status,
  pi.committed_at,
  pi.rollback_at,
  case pi.kind
    when 'routes'        then (select count(*) from public.political_routes        r where r.import_id = pi.id)
    when 'organizations' then (select count(*) from public.political_organizations o where o.import_id = pi.id)
    else 0
  end as rows_currently_attached
from public.political_imports pi;

comment on view public.political_import_summary is
  'Per-import audit row plus a live count of rows still tied to the batch (drives rollback impact preview).';


-- ═════════════════════════════════════════════════════════════════════════════
-- Done — migration 070 complete.
-- ═════════════════════════════════════════════════════════════════════════════
