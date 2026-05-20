-- ─────────────────────────────────────────────────────────────────────────────
-- HomeReach Migration 071 — Political Data Acquisition Engine: Foundation
--
-- Phase 1A of the Campaign & Candidate Data Acquisition Engine spec.
--
-- This migration adds the SCHEMA + REFERENCE DATA layer. No fake political
-- records — only operational/reference rows (offices, jurisdictions, source
-- registry entries) that ship as part of the product.
--
-- New tables:
--   • political_data_sources       — registry of every approved data source
--   • political_offices            — taxonomy: US Senator, OH Governor, etc.
--   • political_jurisdictions      — taxonomy: US, OH, OH-1, Cuyahoga County
--   • political_elections          — specific election dates
--   • staging_candidates           — raw ingest queue, awaits review
--   • staging_organizations        — raw ingest queue, awaits review
--   • staging_campaigns            — raw ingest queue, awaits review
--   • crawl_sources                — Phase 2 placeholder (no execution yet)
--   • crawl_jobs                   — Phase 2 placeholder (no execution yet)
--
-- Columns added to existing tables:
--   • campaign_candidates: fec_candidate_id, source_data_source_id,
--                          outreach_allowed
--   • political_organizations: fec_committee_id, source_data_source_id
--
-- Compliance:
--   - No voter prediction. No persuasion scoring. No ideology inference.
--   - All records carry source provenance (source_url, retrieved_at).
--   - outreach_allowed defaults FALSE on every promoted record — must be
--     flipped manually by an admin after review.
--
-- SAFE TO RE-RUN.
-- ─────────────────────────────────────────────────────────────────────────────


-- ═════════════════════════════════════════════════════════════════════════════
-- 1. Enums
-- ═════════════════════════════════════════════════════════════════════════════

do $$ begin
  create type public.data_source_kind_enum as enum (
    'api', 'bulk', 'csv', 'crawl', 'manual'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.data_source_reliability_enum as enum (
    'official',     -- The original publisher (FEC, OH SoS, county BOE)
    'aggregator',   -- Licensed third party (Ballotpedia, etc.)
    'community',    -- Operator-prepared / unofficial
    'derived'       -- Computed from another source
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.office_level_enum as enum (
    'federal', 'state', 'county', 'city', 'township',
    'school_board', 'judicial', 'party', 'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.jurisdiction_kind_enum as enum (
    'country', 'state', 'congressional_district', 'state_senate_district',
    'state_house_district', 'county', 'city', 'township', 'school_district',
    'judicial_district', 'precinct', 'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.election_type_enum as enum (
    'primary', 'general', 'special', 'runoff', 'caucus', 'recall', 'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.staging_validation_enum as enum (
    'valid', 'warning', 'rejected'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.staging_review_enum as enum (
    'pending', 'approved', 'rejected', 'merged', 'promoted'
  );
exception when duplicate_object then null; end $$;


-- ═════════════════════════════════════════════════════════════════════════════
-- 2. political_data_sources — registry
-- ═════════════════════════════════════════════════════════════════════════════

create table if not exists public.political_data_sources (
  id                        uuid primary key default gen_random_uuid(),
  source_key                text not null unique,         -- 'fec_candidates_v1' etc.

  display_name              text not null,
  publisher                 text not null,                -- 'fec.gov', 'ohiosos.gov'
  homepage_url              text,
  terms_url                 text,                         -- where the operator can read terms
  license_notes             text,                         -- any restrictions / attribution required

  kind                      public.data_source_kind_enum not null,
  reliability_tier          public.data_source_reliability_enum not null default 'official',

  -- Cadence: 'manual', 'nightly', 'weekly', 'monthly', 'quarterly'.
  -- Free-text by design until the scheduler lands in Phase 1C.
  refresh_cadence           text not null default 'manual',

  enabled                   boolean not null default false,

  -- Last successful run summary
  last_run_at               timestamptz,
  last_run_status           text,                         -- 'ok' / 'partial' / 'failed' / 'never_run'
  last_run_summary          jsonb,                        -- counts, errors, durationMs

  notes                     text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index if not exists political_data_sources_kind_idx
  on public.political_data_sources (kind);
create index if not exists political_data_sources_enabled_idx
  on public.political_data_sources (enabled) where enabled = true;


-- ═════════════════════════════════════════════════════════════════════════════
-- 3. political_offices — taxonomy
-- ═════════════════════════════════════════════════════════════════════════════

create table if not exists public.political_offices (
  id                        uuid primary key default gen_random_uuid(),
  code                      text not null unique,         -- 'us_house', 'oh_governor'
  name                      text not null,                -- 'US Representative'

  level                     public.office_level_enum not null,
  is_partisan               boolean not null default true,
  default_term_years        integer,                      -- e.g. 2 for US House

  -- Optional: when this office is canonically tied to one jurisdiction
  -- type (e.g. US House → congressional_district), we hint here so the
  -- ingestion normalizer can guess the right jurisdiction kind.
  jurisdiction_kind_hint    public.jurisdiction_kind_enum,

  notes                     text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index if not exists political_offices_level_idx
  on public.political_offices (level);


-- ═════════════════════════════════════════════════════════════════════════════
-- 4. political_jurisdictions — taxonomy
-- ═════════════════════════════════════════════════════════════════════════════

create table if not exists public.political_jurisdictions (
  id                        uuid primary key default gen_random_uuid(),

  -- Canonical name (e.g. 'United States', 'Ohio', 'OH-1', 'Cuyahoga County, OH')
  name                      text not null,
  short_code                text,                         -- 'US', 'OH', 'OH-01'

  kind                      public.jurisdiction_kind_enum not null,
  state                     text,                         -- 2-letter, where applicable
  parent_id                 uuid references public.political_jurisdictions(id) on delete set null,

  -- External identifiers — FIPS for counties, district codes for districts
  geoid                     text,                         -- e.g. FIPS 39035 (Cuyahoga, OH)

  source_url                text,                         -- where the canonical record lives
  source_id                 uuid references public.political_data_sources(id) on delete set null,

  active                    boolean not null default true,

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  -- A given (kind, name, state) should be unique
  unique (kind, name, state)
);

create index if not exists political_jurisdictions_state_idx
  on public.political_jurisdictions (state);
create index if not exists political_jurisdictions_kind_idx
  on public.political_jurisdictions (kind);
create index if not exists political_jurisdictions_geoid_idx
  on public.political_jurisdictions (geoid)
  where geoid is not null;


-- ═════════════════════════════════════════════════════════════════════════════
-- 5. political_elections — specific election dates
-- ═════════════════════════════════════════════════════════════════════════════

create table if not exists public.political_elections (
  id                        uuid primary key default gen_random_uuid(),

  name                      text not null,                -- '2026 General Election (OH)'
  election_date             date not null,
  election_type             public.election_type_enum not null,
  cycle                     integer not null,             -- election year, e.g. 2026

  jurisdiction_id           uuid references public.political_jurisdictions(id) on delete set null,

  source_id                 uuid references public.political_data_sources(id) on delete set null,
  source_url                text,

  notes                     text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  unique (jurisdiction_id, election_date, election_type)
);

create index if not exists political_elections_date_idx
  on public.political_elections (election_date);
create index if not exists political_elections_cycle_idx
  on public.political_elections (cycle);


-- ═════════════════════════════════════════════════════════════════════════════
-- 6. staging_candidates — raw ingest queue
--    Records here have NOT yet entered the live sales pipeline.
--    Promoted rows materialize into campaign_candidates after review.
-- ═════════════════════════════════════════════════════════════════════════════

create table if not exists public.staging_candidates (
  id                        uuid primary key default gen_random_uuid(),

  -- Provenance
  import_batch_id           uuid references public.political_imports(id) on delete cascade,
  source_id                 uuid references public.political_data_sources(id) on delete set null,
  source_type               text not null,                -- 'fec_api' / 'fec_bulk' / 'oh_sos' / 'boe_csv' / 'manual'
  source_url                text,
  source_record_id          text,                         -- e.g. FEC candidate_id
  source_retrieved_at       timestamptz not null default now(),
  source_license_notes      text,

  -- Raw payload from the source — kept verbatim for re-normalization later
  raw_payload               jsonb not null,

  -- Normalized identity fields
  candidate_name            text not null,
  party_optional            text,                         -- only if publicly listed
  incumbent_optional        boolean,                      -- only if publicly listed

  -- Office + jurisdiction (text first; FK linkage when normalizer matches)
  office_text               text,
  office_id                 uuid references public.political_offices(id) on delete set null,
  jurisdiction_text         text,
  jurisdiction_id           uuid references public.political_jurisdictions(id) on delete set null,
  district                  text,
  state                     text,

  -- Election context
  election_date             date,
  election_id               uuid references public.political_elections(id) on delete set null,
  cycle                     integer,

  -- Optional contact (only when public-source provided)
  campaign_email            text,
  campaign_phone            text,
  campaign_website          text,
  campaign_address          text,
  treasurer_name            text,

  -- Dedupe + validation
  dedupe_hash               text not null,                -- normalized name | office | jurisdiction | cycle
  validation_status         public.staging_validation_enum not null default 'valid',
  validation_notes          text,

  -- Review lifecycle
  review_status             public.staging_review_enum not null default 'pending',
  reviewed_by               uuid references public.profiles(id) on delete set null,
  reviewed_at               timestamptz,
  review_notes              text,

  -- Match suggestion (filled by Phase 1B dedup engine)
  merge_candidate_id        uuid references public.campaign_candidates(id) on delete set null,
  match_confidence          numeric(5,2),                 -- 0.00 – 100.00
  match_signals             jsonb,                        -- which fields matched

  -- Promotion result
  promoted_at               timestamptz,
  promoted_to_id            uuid references public.campaign_candidates(id) on delete set null,

  -- Confidence in the data itself (completeness + source reliability ONLY)
  data_confidence_score     integer check (data_confidence_score is null or (data_confidence_score between 0 and 100)),

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index if not exists staging_candidates_review_idx
  on public.staging_candidates (review_status, created_at desc);
create index if not exists staging_candidates_batch_idx
  on public.staging_candidates (import_batch_id);
create index if not exists staging_candidates_dedupe_idx
  on public.staging_candidates (dedupe_hash);
create index if not exists staging_candidates_state_idx
  on public.staging_candidates (state);
create index if not exists staging_candidates_cycle_idx
  on public.staging_candidates (cycle);
-- Plain unique index (NULLs are treated as distinct in Postgres unique
-- indexes, so multiple manual-entry rows without source_record_id remain
-- allowed). A plain index is required so Supabase's upsert ON CONFLICT
-- target can match.
create unique index if not exists staging_candidates_source_id_unique
  on public.staging_candidates (source_id, source_record_id);


-- ═════════════════════════════════════════════════════════════════════════════
-- 7. staging_organizations — raw committee/org queue
-- ═════════════════════════════════════════════════════════════════════════════

create table if not exists public.staging_organizations (
  id                        uuid primary key default gen_random_uuid(),

  import_batch_id           uuid references public.political_imports(id) on delete cascade,
  source_id                 uuid references public.political_data_sources(id) on delete set null,
  source_type               text not null,
  source_url                text,
  source_record_id          text,                         -- FEC committee_id, OH SoS PAC id
  source_retrieved_at       timestamptz not null default now(),
  source_license_notes      text,

  raw_payload               jsonb not null,

  legal_name                text not null,
  display_name              text,
  org_type                  text,                         -- normalized to enum on promotion
  ein                       text,
  state                     text,

  primary_contact_name      text,
  primary_contact_email     text,
  primary_contact_phone     text,
  website                   text,
  address                   text,

  -- Optional linkage to a candidate (FEC's principal-campaign-committee tie)
  linked_candidate_source_id text,

  dedupe_hash               text not null,
  validation_status         public.staging_validation_enum not null default 'valid',
  validation_notes          text,

  review_status             public.staging_review_enum not null default 'pending',
  reviewed_by               uuid references public.profiles(id) on delete set null,
  reviewed_at               timestamptz,
  review_notes              text,

  merge_organization_id     uuid references public.political_organizations(id) on delete set null,
  match_confidence          numeric(5,2),
  match_signals             jsonb,

  promoted_at               timestamptz,
  promoted_to_id            uuid references public.political_organizations(id) on delete set null,

  data_confidence_score     integer check (data_confidence_score is null or (data_confidence_score between 0 and 100)),

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index if not exists staging_organizations_review_idx
  on public.staging_organizations (review_status, created_at desc);
create index if not exists staging_organizations_batch_idx
  on public.staging_organizations (import_batch_id);
create index if not exists staging_organizations_dedupe_idx
  on public.staging_organizations (dedupe_hash);
create index if not exists staging_organizations_state_idx
  on public.staging_organizations (state);
create unique index if not exists staging_organizations_source_id_unique
  on public.staging_organizations (source_id, source_record_id);


-- ═════════════════════════════════════════════════════════════════════════════
-- 8. staging_campaigns — raw campaign-level records
--    Some sources (FEC) report campaign committees per cycle. We keep these
--    separate from organizations because their lifecycle is per-election.
-- ═════════════════════════════════════════════════════════════════════════════

create table if not exists public.staging_campaigns (
  id                        uuid primary key default gen_random_uuid(),

  import_batch_id           uuid references public.political_imports(id) on delete cascade,
  source_id                 uuid references public.political_data_sources(id) on delete set null,
  source_type               text not null,
  source_url                text,
  source_record_id          text,
  source_retrieved_at       timestamptz not null default now(),
  source_license_notes      text,

  raw_payload               jsonb not null,

  campaign_name             text not null,
  candidate_source_id       text,                         -- FEC candidate_id, etc.
  committee_source_id       text,                         -- FEC committee_id, etc.

  office_text               text,
  office_id                 uuid references public.political_offices(id) on delete set null,
  jurisdiction_text         text,
  jurisdiction_id           uuid references public.political_jurisdictions(id) on delete set null,
  state                     text,

  cycle                     integer,
  election_date             date,
  election_id               uuid references public.political_elections(id) on delete set null,

  dedupe_hash               text not null,
  validation_status         public.staging_validation_enum not null default 'valid',
  validation_notes          text,

  review_status             public.staging_review_enum not null default 'pending',
  reviewed_by               uuid references public.profiles(id) on delete set null,
  reviewed_at               timestamptz,
  review_notes              text,

  merge_campaign_id         uuid references public.political_campaigns(id) on delete set null,
  match_confidence          numeric(5,2),
  match_signals             jsonb,

  promoted_at               timestamptz,
  promoted_to_id            uuid references public.political_campaigns(id) on delete set null,

  data_confidence_score     integer check (data_confidence_score is null or (data_confidence_score between 0 and 100)),

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index if not exists staging_campaigns_review_idx
  on public.staging_campaigns (review_status, created_at desc);
create index if not exists staging_campaigns_batch_idx
  on public.staging_campaigns (import_batch_id);
create index if not exists staging_campaigns_dedupe_idx
  on public.staging_campaigns (dedupe_hash);
create index if not exists staging_campaigns_state_idx
  on public.staging_campaigns (state);
create unique index if not exists staging_campaigns_source_id_unique
  on public.staging_campaigns (source_id, source_record_id);


-- ═════════════════════════════════════════════════════════════════════════════
-- 9. crawl_sources + crawl_jobs — Phase 2 PLACEHOLDERS
--    Schema only. No execution code references these yet. The /admin
--    crawl-jobs page is read-only and explicitly states crawling is not
--    enabled.
-- ═════════════════════════════════════════════════════════════════════════════

create table if not exists public.crawl_sources (
  id                        uuid primary key default gen_random_uuid(),

  hostname                  text not null unique,         -- e.g. 'boe.cuyahogacounty.gov'
  source_id                 uuid references public.political_data_sources(id) on delete set null,

  robots_url                text,
  robots_allowed            boolean,                      -- result of latest robots check
  robots_checked_at         timestamptz,

  terms_url                 text,
  terms_reviewed_at         timestamptz,
  terms_approved            boolean not null default false,

  rate_limit_rps            numeric(6,3),                 -- requested rate; null = source default

  enabled                   boolean not null default false,
  notes                     text,

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create table if not exists public.crawl_jobs (
  id                        uuid primary key default gen_random_uuid(),

  crawl_source_id           uuid not null references public.crawl_sources(id) on delete cascade,
  target_url                text not null,
  schedule                  text,                         -- 'manual' / cron-like

  status                    text not null default 'pending' check (status in (
    'pending', 'queued', 'running', 'completed', 'failed', 'blocked_by_robots',
    'blocked_by_terms', 'disabled'
  )),

  -- Filled by future executor (Phase 2)
  scheduled_for             timestamptz,
  started_at                timestamptz,
  completed_at              timestamptz,
  fetched_bytes             bigint,
  artifact_url              text,                         -- where the fetched page got stored
  error                     text,

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index if not exists crawl_jobs_status_idx on public.crawl_jobs (status);
create index if not exists crawl_jobs_source_idx on public.crawl_jobs (crawl_source_id);


-- ═════════════════════════════════════════════════════════════════════════════
-- 10. Column additions to existing live tables
-- ═════════════════════════════════════════════════════════════════════════════

alter table public.campaign_candidates
  add column if not exists fec_candidate_id        text,
  add column if not exists source_data_source_id   uuid references public.political_data_sources(id) on delete set null,
  add column if not exists outreach_allowed        boolean not null default false;

create unique index if not exists campaign_candidates_fec_candidate_id_unique
  on public.campaign_candidates (fec_candidate_id)
  where fec_candidate_id is not null;
create index if not exists campaign_candidates_outreach_allowed_idx
  on public.campaign_candidates (outreach_allowed) where outreach_allowed = true;

alter table public.political_organizations
  add column if not exists fec_committee_id        text,
  add column if not exists source_data_source_id   uuid references public.political_data_sources(id) on delete set null;

create unique index if not exists political_organizations_fec_committee_id_unique
  on public.political_organizations (fec_committee_id)
  where fec_committee_id is not null;


-- ═════════════════════════════════════════════════════════════════════════════
-- 11. updated_at triggers (reuse existing tg_political_touch_updated_at)
-- ═════════════════════════════════════════════════════════════════════════════

do $$
declare
  t text;
  triggers text[] := array[
    'political_data_sources', 'political_offices', 'political_jurisdictions',
    'political_elections',
    'staging_candidates', 'staging_organizations', 'staging_campaigns',
    'crawl_sources', 'crawl_jobs'
  ];
begin
  if exists (select 1 from pg_proc where proname = 'tg_political_touch_updated_at') then
    foreach t in array triggers loop
      if not exists (
        select 1 from pg_trigger
        where tgname = format('trg_%s_updated_at', t)
      ) then
        execute format(
          'create trigger trg_%I_updated_at before update on public.%I for each row execute function public.tg_political_touch_updated_at()',
          t, t
        );
      end if;
    end loop;
  end if;
end $$;


-- ═════════════════════════════════════════════════════════════════════════════
-- 12. RLS — admin only on staging + sources; admin/sales_agent read on
--      reference tables (offices, jurisdictions, elections, data_sources).
-- ═════════════════════════════════════════════════════════════════════════════

alter table public.political_data_sources    enable row level security;
alter table public.political_offices         enable row level security;
alter table public.political_jurisdictions   enable row level security;
alter table public.political_elections       enable row level security;
alter table public.staging_candidates        enable row level security;
alter table public.staging_organizations     enable row level security;
alter table public.staging_campaigns         enable row level security;
alter table public.crawl_sources             enable row level security;
alter table public.crawl_jobs                enable row level security;

-- Reference tables: agents read, admins write
do $$
declare
  t text;
  ref_tables text[] := array[
    'political_data_sources', 'political_offices',
    'political_jurisdictions', 'political_elections'
  ];
begin
  foreach t in array ref_tables loop
    execute format('drop policy if exists "%s_admin" on public.%I', t || '_admin', t);
    execute format('drop policy if exists "%s_agent_read" on public.%I', t || '_agent_read', t);

    execute format(
      'create policy "%s_admin" on public.%I for all to authenticated using ((auth.jwt()->''app_metadata''->>''user_role'') = ''admin'') with check ((auth.jwt()->''app_metadata''->>''user_role'') = ''admin'')',
      t || '_admin', t
    );
    execute format(
      'create policy "%s_agent_read" on public.%I for select to authenticated using ((auth.jwt()->''app_metadata''->>''user_role'') in (''admin'',''sales_agent''))',
      t || '_agent_read', t
    );
  end loop;
end $$;

-- Staging tables: admin only
do $$
declare
  t text;
  staging_tables text[] := array[
    'staging_candidates', 'staging_organizations', 'staging_campaigns',
    'crawl_sources', 'crawl_jobs'
  ];
begin
  foreach t in array staging_tables loop
    execute format('drop policy if exists "%s_admin" on public.%I', t || '_admin', t);
    execute format(
      'create policy "%s_admin" on public.%I for all to authenticated using ((auth.jwt()->''app_metadata''->>''user_role'') = ''admin'') with check ((auth.jwt()->''app_metadata''->>''user_role'') = ''admin'')',
      t || '_admin', t
    );
  end loop;
end $$;


-- ═════════════════════════════════════════════════════════════════════════════
-- 13. Reference seed data — operational taxonomy ONLY.
--      These are NOT campaign records. They are the controlled vocabulary
--      every campaign record will reference. Permitted under the seeds
--      README policy (operational reference data).
-- ═════════════════════════════════════════════════════════════════════════════

-- ── 13a. political_data_sources — registry rows for the sources we plan to
--          consume. enabled=false until the operator flips them on.
insert into public.political_data_sources
  (source_key, display_name, publisher, homepage_url, terms_url, license_notes,
   kind, reliability_tier, refresh_cadence, enabled, notes)
values
  ('fec_candidates_v1',
   'FEC — Candidates (OpenFEC API)',
   'fec.gov',
   'https://api.open.fec.gov/developers/',
   'https://api.open.fec.gov/developers/',
   'Public domain (US Government work). FEC requires no special license; rate-limited by api.data.gov key tier.',
   'api', 'official', 'weekly', false,
   'OpenFEC /candidates endpoint. Federal candidates only. Phase 1A target.'),

  ('fec_committees_v1',
   'FEC — Committees (OpenFEC API)',
   'fec.gov',
   'https://api.open.fec.gov/developers/',
   'https://api.open.fec.gov/developers/',
   'Public domain (US Government work). FEC requires no special license; rate-limited by api.data.gov key tier.',
   'api', 'official', 'weekly', false,
   'OpenFEC /committees endpoint. Includes PACs, party committees, super PACs. Phase 1A target.'),

  ('fec_bulk_v1',
   'FEC — Bulk download files',
   'fec.gov',
   'https://www.fec.gov/data/browse-data/?tab=bulk-data',
   'https://www.fec.gov/data/browse-data/?tab=bulk-data',
   'Public domain (US Government work). Pipe-delimited; convert to CSV before upload.',
   'bulk', 'official', 'monthly', false,
   'Use when API rate limits are an issue. Reuses the existing /admin/political/organizations/import flow.'),

  ('oh_sos_committees_v1',
   'Ohio Secretary of State — Campaign Finance',
   'ohiosos.gov',
   'https://www.ohiosos.gov/campaign-finance/',
   'https://www.ohiosos.gov/legal/',
   'Public records — no license required for non-commercial use. Operator must respect attribution where requested.',
   'csv', 'official', 'monthly', false,
   'Phase 4 target. Not yet wired.'),

  ('oh_county_boe_v1',
   'Ohio County Boards of Elections — Candidate filings',
   'various',
   'https://www.ohiosos.gov/elections/candidates/',
   null,
   '88 counties; each has its own publishing schedule and format. Mostly PDFs and CSVs.',
   'manual', 'official', 'monthly', false,
   'Phase 4 target. Operator-uploaded CSVs to start; per-county crawl-jobs in Phase 2.')
on conflict (source_key) do nothing;


-- ── 13b. political_offices — minimal federal + key state offices
insert into public.political_offices
  (code, name, level, is_partisan, default_term_years, jurisdiction_kind_hint, notes)
values
  ('us_president',     'President of the United States',         'federal', true, 4, 'country', null),
  ('us_vice_president','Vice President of the United States',    'federal', true, 4, 'country', null),
  ('us_senate',        'US Senator',                             'federal', true, 6, 'state', null),
  ('us_house',         'US Representative',                      'federal', true, 2, 'congressional_district', null),
  ('oh_governor',      'Governor (Ohio)',                        'state',   true, 4, 'state', null),
  ('oh_lt_governor',   'Lieutenant Governor (Ohio)',             'state',   true, 4, 'state', null),
  ('oh_sos',           'Secretary of State (Ohio)',              'state',   true, 4, 'state', null),
  ('oh_attorney_gen',  'Attorney General (Ohio)',                'state',   true, 4, 'state', null),
  ('oh_auditor',       'Auditor of State (Ohio)',                'state',   true, 4, 'state', null),
  ('oh_treasurer',     'Treasurer of State (Ohio)',              'state',   true, 4, 'state', null),
  ('oh_state_senate',  'State Senator (Ohio)',                   'state',   true, 4, 'state_senate_district', null),
  ('oh_state_house',   'State Representative (Ohio)',            'state',   true, 2, 'state_house_district', null),
  ('oh_supreme_court', 'Justice of the Ohio Supreme Court',      'judicial',false,6, 'state', 'Officially nonpartisan as of 2026; party affiliation appears on ballot per HB 290 — list per public record only.'),
  ('county_commissioner','County Commissioner',                  'county',  true, 4, 'county', null),
  ('mayor',            'Mayor',                                  'city',    true, 4, 'city', null),
  ('city_council',     'City Council Member',                    'city',    true, 4, 'city', null),
  ('township_trustee', 'Township Trustee',                       'township',true, 4, 'township', null),
  ('school_board',     'School Board Member',                    'school_board', false, 4, 'school_district', null),
  ('common_pleas',     'Common Pleas Judge',                     'judicial',true, 6, 'judicial_district', null)
on conflict (code) do nothing;


-- ── 13c. political_jurisdictions — anchors only.
--          Counties / districts will be loaded from official sources later;
--          we ship just the parents needed for FEC ingestion to attach to.
insert into public.political_jurisdictions
  (name, short_code, kind, state, parent_id, source_url)
values
  ('United States', 'US', 'country', null, null,
   'https://www.usa.gov/'),
  ('Ohio',          'OH', 'state',   'OH', null,
   'https://ohio.gov/')
on conflict (kind, name, state) do nothing;


-- ═════════════════════════════════════════════════════════════════════════════
-- 13d. Extend political_imports.kind to cover staging ingestions
--      The CSV importers in 070 used 'routes' / 'organizations'. The new
--      data-acquisition path needs 'fec_candidates' / 'fec_committees' (and
--      reserves slots for OH SoS + BOE in Phase 4) so the audit trail is
--      semantically correct AND the rollback logic can dispatch.
-- ═════════════════════════════════════════════════════════════════════════════

do $$ begin
  if exists (
    select 1 from pg_constraint
    where conname = 'political_imports_kind_check'
      and conrelid = 'public.political_imports'::regclass
  ) then
    alter table public.political_imports drop constraint political_imports_kind_check;
  end if;

  alter table public.political_imports
    add constraint political_imports_kind_check check (kind in (
      'routes',
      'organizations',
      'fec_candidates',
      'fec_committees',
      'oh_sos_candidates',
      'oh_sos_committees',
      'boe_candidates'
    ));
end $$;


-- ═════════════════════════════════════════════════════════════════════════════
-- 13e. Refresh political_import_summary view to count staging rows
--      Drop + recreate so the case expression covers the new kinds.
-- ═════════════════════════════════════════════════════════════════════════════

drop view if exists public.political_import_summary;

create view public.political_import_summary as
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
    when 'routes'             then (select count(*) from public.political_routes        r where r.import_id = pi.id)
    when 'organizations'      then (select count(*) from public.political_organizations o where o.import_id = pi.id)
    when 'fec_candidates'     then (select count(*) from public.staging_candidates      s where s.import_batch_id = pi.id)
    when 'fec_committees'     then (select count(*) from public.staging_organizations   s where s.import_batch_id = pi.id)
    when 'oh_sos_candidates'  then (select count(*) from public.staging_candidates      s where s.import_batch_id = pi.id)
    when 'oh_sos_committees'  then (select count(*) from public.staging_organizations   s where s.import_batch_id = pi.id)
    when 'boe_candidates'     then (select count(*) from public.staging_candidates      s where s.import_batch_id = pi.id)
    else 0
  end as rows_currently_attached
from public.political_imports pi;

comment on view public.political_import_summary is
  'Per-import audit row plus a live count of rows still tied to the batch (drives rollback impact preview). Updated in 071 to cover staging kinds.';


-- ═════════════════════════════════════════════════════════════════════════════
-- 14. View — political_review_queue
--     Unified read across the three staging tables for the review UI.
-- ═════════════════════════════════════════════════════════════════════════════

create or replace view public.political_review_queue as
  select
    'candidate'::text                  as record_kind,
    sc.id,
    sc.review_status,
    sc.validation_status,
    sc.candidate_name                  as display_name,
    sc.office_text                     as detail_1,
    sc.jurisdiction_text               as detail_2,
    sc.state                           as state,
    sc.cycle                           as cycle,
    sc.source_type                     as source_type,
    sc.source_url                      as source_url,
    sc.source_id                       as source_id,
    sc.import_batch_id                 as import_batch_id,
    sc.match_confidence                as match_confidence,
    sc.created_at                      as created_at
  from public.staging_candidates sc
  where sc.review_status = 'pending'

  union all

  select
    'organization'::text,
    so.id,
    so.review_status,
    so.validation_status,
    so.legal_name,
    so.org_type,
    so.state,
    so.state,
    null::integer,
    so.source_type,
    so.source_url,
    so.source_id,
    so.import_batch_id,
    so.match_confidence,
    so.created_at
  from public.staging_organizations so
  where so.review_status = 'pending'

  union all

  select
    'campaign'::text,
    sca.id,
    sca.review_status,
    sca.validation_status,
    sca.campaign_name,
    sca.office_text,
    sca.jurisdiction_text,
    sca.state,
    sca.cycle,
    sca.source_type,
    sca.source_url,
    sca.source_id,
    sca.import_batch_id,
    sca.match_confidence,
    sca.created_at
  from public.staging_campaigns sca
  where sca.review_status = 'pending';

comment on view public.political_review_queue is
  'Pending staging records across candidates / organizations / campaigns for the admin review UI.';


-- ═════════════════════════════════════════════════════════════════════════════
-- Done — migration 071 complete.
-- ═════════════════════════════════════════════════════════════════════════════
