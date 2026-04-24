-- ─────────────────────────────────────────────────────────────────────────────
-- HomeReach Migration 060 — Political Command Center: Spec Alignment
--
-- Additive follow-up to migration 059 (already applied). Brings the political
-- schema in line with the revised Phase 1 spec:
--   • Adds proper Postgres ENUMs for geography_type, district_type,
--     candidate_status, pipeline_status.
--   • Adds geography_type + geography_value normalized pair on
--     campaign_candidates and political_campaigns (for national scaling —
--     replaces the per-granularity district/city/county columns).
--   • Adds district_type enum column on both tables (replaces the
--     race_level / race_type text-with-CHECK columns from 059).
--   • Adds typed status enum columns: candidate_status (on candidates) and
--     pipeline_status (on campaigns). New column names chosen to preserve
--     the existing text status / stage columns for a deprecation window.
--   • Adds budget_estimate_cents (bigint) on political_campaigns. Kept in
--     cents for consistency with the rest of HomeReach revenue code;
--     backfills from existing estimated_deal_value_cents.
--   • Backfills every new column from the corresponding old column so
--     existing rows (e.g. admin test data) don't lose information.
--
-- Strictly additive:
--   • No existing columns dropped, renamed, or retyped.
--   • No existing indexes dropped or altered.
--   • No existing RLS policies modified — new columns inherit the
--     already-enabled RLS from the parent table.
--   • Old columns (district/city/county/race_level/race_type/status/stage/
--     estimated_deal_value_cents) kept in place; marked deprecated via
--     column comments. Dropping them is a separate later migration
--     (e.g. 061_political_core_cleanup.sql) after Phase 2+ code confirms
--     only the new columns are read.
--
-- All backfill statements use WHERE new_col IS NULL so they cannot overwrite
-- a row that was manually updated after this migration first ran.
--
-- SAFE TO RE-RUN.
-- ─────────────────────────────────────────────────────────────────────────────


-- ═════════════════════════════════════════════════════════════════════════════
-- 1. Enums
--    CREATE TYPE has no IF NOT EXISTS form; wrap each in a DO block so the
--    migration is idempotent.
-- ═════════════════════════════════════════════════════════════════════════════

do $$ begin
  create type public.geography_type_enum as enum ('state', 'county', 'city', 'district');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.district_type_enum as enum ('federal', 'state', 'local');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.candidate_status_enum as enum ('active', 'inactive', 'won', 'lost');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.campaign_pipeline_status_enum as enum
    ('prospect', 'contacted', 'proposal_sent', 'won', 'lost');
exception
  when duplicate_object then null;
end $$;


-- ═════════════════════════════════════════════════════════════════════════════
-- 2. campaign_candidates — additive columns + backfill
-- ═════════════════════════════════════════════════════════════════════════════

alter table public.campaign_candidates
  add column if not exists geography_type   public.geography_type_enum;
alter table public.campaign_candidates
  add column if not exists geography_value  text;
alter table public.campaign_candidates
  add column if not exists district_type    public.district_type_enum;
-- New status column — kept separate from the existing text `status` so this
-- migration is strictly additive. Phase 2+ code reads `candidate_status`.
alter table public.campaign_candidates
  add column if not exists candidate_status public.candidate_status_enum
    not null default 'active';

-- Backfill geography: prefer most-specific → least-specific.
-- WHERE guard keeps re-runs a no-op.
update public.campaign_candidates
set
  geography_type = case
    when district is not null then 'district'::public.geography_type_enum
    when city     is not null then 'city'::public.geography_type_enum
    when county   is not null then 'county'::public.geography_type_enum
    when state    is not null then 'state'::public.geography_type_enum
    else null
  end,
  geography_value = coalesce(district, city, county, state)
where geography_type is null;

-- Backfill district_type from the old race_level text column (only 'federal',
-- 'state', 'local' are valid per the 059 CHECK, so a direct cast is safe).
update public.campaign_candidates
set district_type = race_level::public.district_type_enum
where district_type is null
  and race_level in ('federal', 'state', 'local');

-- Backfill candidate_status from the old status text column.
-- Map legacy 'new' → 'active'; keep valid enum values; unknown → 'active'.
update public.campaign_candidates
set candidate_status = case status
  when 'active'   then 'active'::public.candidate_status_enum
  when 'inactive' then 'inactive'::public.candidate_status_enum
  when 'won'      then 'won'::public.candidate_status_enum
  when 'lost'     then 'lost'::public.candidate_status_enum
  else 'active'::public.candidate_status_enum
end
where candidate_status is null  -- impossible because of NOT NULL DEFAULT, but
                                -- keeps the statement idempotent in spirit
  or candidate_status = 'active';  -- only overwrite rows still at default

-- Deprecation comments (visible in psql \d+).
comment on column public.campaign_candidates.district is
  'DEPRECATED 2026-04-23: use geography_type + geography_value. Kept for deprecation window; drop in 061_political_core_cleanup.';
comment on column public.campaign_candidates.county is
  'DEPRECATED 2026-04-23: use geography_type + geography_value.';
comment on column public.campaign_candidates.city is
  'DEPRECATED 2026-04-23: use geography_type + geography_value.';
comment on column public.campaign_candidates.race_level is
  'DEPRECATED 2026-04-23: use district_type enum column instead.';
comment on column public.campaign_candidates.status is
  'DEPRECATED 2026-04-23: use candidate_status enum column instead.';


-- ═════════════════════════════════════════════════════════════════════════════
-- 3. political_campaigns — additive columns + backfill
-- ═════════════════════════════════════════════════════════════════════════════

alter table public.political_campaigns
  add column if not exists geography_type       public.geography_type_enum;
alter table public.political_campaigns
  add column if not exists geography_value      text;
alter table public.political_campaigns
  add column if not exists district_type        public.district_type_enum;
-- Separate from the existing `stage` text column; strictly additive.
-- Phase 2+ code reads `pipeline_status`.
alter table public.political_campaigns
  add column if not exists pipeline_status      public.campaign_pipeline_status_enum
    not null default 'prospect';
-- New budget column — keeps HomeReach's money-in-cents convention.
-- Backfills from the existing estimated_deal_value_cents.
alter table public.political_campaigns
  add column if not exists budget_estimate_cents bigint;

-- Backfill geography.
update public.political_campaigns
set
  geography_type = case
    when district is not null then 'district'::public.geography_type_enum
    when city     is not null then 'city'::public.geography_type_enum
    when county   is not null then 'county'::public.geography_type_enum
    else null
  end,
  geography_value = coalesce(district, city, county)
where geography_type is null;

-- Backfill district_type from existing race_type (nullable text, already
-- CHECK-constrained to the valid enum values in 059).
update public.political_campaigns
set district_type = race_type::public.district_type_enum
where district_type is null
  and race_type in ('federal', 'state', 'local');

-- Backfill pipeline_status from the old stage text column.
-- Map legacy 'new' → 'prospect'; unknown → 'prospect'.
update public.political_campaigns
set pipeline_status = case stage
  when 'prospect'      then 'prospect'::public.campaign_pipeline_status_enum
  when 'contacted'     then 'contacted'::public.campaign_pipeline_status_enum
  when 'proposal_sent' then 'proposal_sent'::public.campaign_pipeline_status_enum
  when 'won'           then 'won'::public.campaign_pipeline_status_enum
  when 'lost'          then 'lost'::public.campaign_pipeline_status_enum
  else 'prospect'::public.campaign_pipeline_status_enum
end
where pipeline_status = 'prospect'  -- only overwrite rows still at default
  and (stage is null or stage <> 'prospect');

-- Backfill budget cents from the existing estimated_deal_value_cents.
update public.political_campaigns
set budget_estimate_cents = estimated_deal_value_cents
where budget_estimate_cents is null
  and estimated_deal_value_cents is not null;

-- Deprecation comments.
comment on column public.political_campaigns.district is
  'DEPRECATED 2026-04-23: use geography_type + geography_value.';
comment on column public.political_campaigns.county is
  'DEPRECATED 2026-04-23: use geography_type + geography_value.';
comment on column public.political_campaigns.city is
  'DEPRECATED 2026-04-23: use geography_type + geography_value.';
comment on column public.political_campaigns.race_type is
  'DEPRECATED 2026-04-23: use district_type enum column instead.';
comment on column public.political_campaigns.stage is
  'DEPRECATED 2026-04-23: use pipeline_status enum column instead.';
comment on column public.political_campaigns.estimated_deal_value_cents is
  'DEPRECATED 2026-04-23: use budget_estimate_cents (same units, same semantics, new name per spec).';


-- ═════════════════════════════════════════════════════════════════════════════
-- 4. Indexes for the new columns
--    Compound indexes on (state, geography_type, geography_value) accelerate
--    the national-scale lookup pattern "give me every campaign targeting
--    Franklin County, OH" without scanning by-column.
-- ═════════════════════════════════════════════════════════════════════════════

create index if not exists campaign_candidates_geo_idx
  on public.campaign_candidates (state, geography_type, geography_value);

create index if not exists campaign_candidates_district_type_idx
  on public.campaign_candidates (district_type)
  where district_type is not null;

create index if not exists campaign_candidates_candidate_status_idx
  on public.campaign_candidates (candidate_status);

create index if not exists political_campaigns_geo_idx
  on public.political_campaigns (geography_type, geography_value);

create index if not exists political_campaigns_district_type_idx
  on public.political_campaigns (district_type)
  where district_type is not null;

create index if not exists political_campaigns_pipeline_status_idx
  on public.political_campaigns (pipeline_status);

create index if not exists political_campaigns_budget_idx
  on public.political_campaigns (budget_estimate_cents desc)
  where budget_estimate_cents is not null;
