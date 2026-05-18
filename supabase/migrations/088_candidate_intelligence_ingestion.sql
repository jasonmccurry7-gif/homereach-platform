-- HomeReach Migration 088 - Candidate Intelligence Ingestion Layer
--
-- Adds the canonical candidate/election intelligence layer that sits above
-- existing staging_candidates and the current political review queue.
--
-- Compliance boundary:
-- - Candidate party is stored only when published by an upstream source.
-- - No voter-level records, ideology inference, persuasion scoring, or turnout
--   prediction is stored in these tables.
-- - Geographic hints are jurisdiction/map lookup hints for campaign planning.

create extension if not exists pg_trgm;
create extension if not exists unaccent;

alter table public.political_data_sources
  add column if not exists api_base_url text,
  add column if not exists auth_env_key text,
  add column if not exists source_category text not null default 'candidate_intelligence',
  add column if not exists supports_webhook boolean not null default false,
  add column if not exists supports_incremental_sync boolean not null default false,
  add column if not exists default_state_scope text[] not null default '{}',
  add column if not exists source_priority integer not null default 100,
  add column if not exists rate_limit_per_minute integer,
  add column if not exists last_cursor text,
  add column if not exists api_endpoint_config jsonb not null default '{}'::jsonb,
  add column if not exists credential_status text not null default 'unknown';

create table if not exists public.candidate_intel_sync_runs (
  id uuid primary key default gen_random_uuid(),
  source_key text not null,
  trigger_type text not null default 'manual',
  status text not null default 'queued'
    check (status in ('queued', 'running', 'completed', 'partial', 'failed', 'skipped')),
  state_scope text[] not null default '{}',
  cycle integer,
  cursor_before text,
  cursor_after text,
  requested_by uuid references auth.users(id) on delete set null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  duration_ms integer,
  records_seen integer not null default 0,
  records_normalized integer not null default 0,
  records_inserted integer not null default 0,
  records_updated integer not null default 0,
  records_merged integer not null default 0,
  records_skipped integer not null default 0,
  errors jsonb not null default '[]'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists candidate_intel_sync_runs_source_idx
  on public.candidate_intel_sync_runs (source_key, started_at desc);
create index if not exists candidate_intel_sync_runs_status_idx
  on public.candidate_intel_sync_runs (status);

create table if not exists public.candidate_intel_profiles (
  id uuid primary key default gen_random_uuid(),

  canonical_candidate_name text not null,
  normalized_name text not null,
  display_name text,
  party text,
  incumbent_status text,

  office_name text,
  office_level text not null default 'other'
    check (office_level in (
      'federal', 'state', 'county', 'municipal', 'city', 'township',
      'school_board', 'judicial', 'party', 'ballot_measure', 'other'
    )),
  office_hierarchy text[] not null default '{}',
  office_code text,

  state text,
  jurisdiction_name text,
  jurisdiction_type text,
  district_type text,
  district_label text,
  district_geoid text,

  election_name text,
  election_type text,
  election_date date,
  election_year integer,
  filing_status text,
  filing_status_updated_at timestamptz,

  campaign_website text,
  campaign_email text,
  campaign_phone text,
  social_links jsonb not null default '{}'::jsonb,

  map_layer_hint jsonb not null default '{}'::jsonb,
  usps_route_hint jsonb not null default '{}'::jsonb,
  timeline_hint jsonb not null default '{}'::jsonb,

  source_confidence integer not null default 50 check (source_confidence between 0 and 100),
  data_confidence text not null default 'estimated'
    check (data_confidence in ('exact', 'estimated', 'demo', 'user_provided', 'public_aggregate', 'paid_vendor', 'unavailable')),
  source_keys text[] not null default '{}',
  matched_source_record_ids uuid[] not null default '{}',
  dedupe_key text not null,
  search_text text not null,
  search_vector tsvector generated always as (to_tsvector('simple', coalesce(search_text, ''))) stored,

  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists candidate_intel_profiles_dedupe_key_idx
  on public.candidate_intel_profiles (dedupe_key);
create index if not exists candidate_intel_profiles_state_idx
  on public.candidate_intel_profiles (state);
create index if not exists candidate_intel_profiles_election_idx
  on public.candidate_intel_profiles (election_date, election_year);
create index if not exists candidate_intel_profiles_office_idx
  on public.candidate_intel_profiles (office_level, office_name);
create index if not exists candidate_intel_profiles_search_tsv_idx
  on public.candidate_intel_profiles using gin (search_vector);
create index if not exists candidate_intel_profiles_search_trgm_idx
  on public.candidate_intel_profiles using gin (search_text gin_trgm_ops);
create index if not exists candidate_intel_profiles_name_trgm_idx
  on public.candidate_intel_profiles using gin (normalized_name gin_trgm_ops);

create table if not exists public.candidate_intel_source_records (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.candidate_intel_profiles(id) on delete set null,
  sync_run_id uuid references public.candidate_intel_sync_runs(id) on delete set null,

  source_key text not null,
  source_record_id text not null,
  source_url text,
  source_retrieved_at timestamptz not null default now(),
  record_hash text not null,

  raw_payload jsonb not null default '{}'::jsonb,
  normalized_payload jsonb not null default '{}'::jsonb,

  normalized_name text not null,
  state text,
  office_name text,
  election_date date,
  filing_status text,
  confidence integer not null default 50 check (confidence between 0 and 100),
  match_status text not null default 'unmatched'
    check (match_status in ('unmatched', 'auto_matched', 'manual_matched', 'conflict', 'ignored')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (source_key, source_record_id)
);

create index if not exists candidate_intel_source_records_profile_idx
  on public.candidate_intel_source_records (profile_id);
create index if not exists candidate_intel_source_records_source_idx
  on public.candidate_intel_source_records (source_key, source_record_id);
create index if not exists candidate_intel_source_records_hash_idx
  on public.candidate_intel_source_records (record_hash);

create table if not exists public.candidate_intel_match_decisions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.candidate_intel_profiles(id) on delete cascade,
  source_record_id uuid references public.candidate_intel_source_records(id) on delete cascade,
  decision text not null
    check (decision in ('auto_merge', 'manual_merge', 'new_profile', 'no_match', 'conflict')),
  score numeric(6, 3) not null default 0,
  reasons jsonb not null default '[]'::jsonb,
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz not null default now()
);

create index if not exists candidate_intel_match_decisions_profile_idx
  on public.candidate_intel_match_decisions (profile_id, decided_at desc);

create table if not exists public.candidate_intel_election_timelines (
  id uuid primary key default gen_random_uuid(),
  election_name text not null,
  election_type text,
  election_date date not null,
  cycle integer not null,
  state text,
  jurisdiction_name text,
  jurisdiction_type text,
  office_level text,

  filing_deadline date,
  registration_deadline date,
  absentee_start date,
  absentee_deadline date,
  early_vote_start date,
  early_vote_end date,
  recommended_mail_start date,
  recommended_mail_end date,

  source_key text,
  source_url text,
  data_confidence text not null default 'estimated'
    check (data_confidence in ('exact', 'estimated', 'demo', 'user_provided', 'public_aggregate', 'paid_vendor', 'unavailable')),
  raw_payload jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (state, jurisdiction_name, election_date, election_type)
);

create index if not exists candidate_intel_election_timelines_lookup_idx
  on public.candidate_intel_election_timelines (state, election_date);

create table if not exists public.candidate_intel_refresh_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  source_key text not null,
  source_record_id text,
  status text not null default 'queued'
    check (status in ('queued', 'processed', 'failed', 'ignored')),
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text
);

create index if not exists candidate_intel_refresh_events_status_idx
  on public.candidate_intel_refresh_events (status, received_at);

create table if not exists public.candidate_intel_search_cache (
  id uuid primary key default gen_random_uuid(),
  query_hash text not null unique,
  query text not null,
  state text,
  result_ids uuid[] not null default '{}',
  response jsonb not null default '[]'::jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists candidate_intel_search_cache_expires_idx
  on public.candidate_intel_search_cache (expires_at);

create or replace view public.candidate_intel_suggestions as
select
  id,
  canonical_candidate_name,
  display_name,
  party,
  office_name,
  office_level,
  state,
  jurisdiction_name,
  jurisdiction_type,
  district_type,
  district_label,
  election_name,
  election_type,
  election_date,
  election_year,
  filing_status,
  campaign_website,
  campaign_email,
  campaign_phone,
  map_layer_hint,
  usps_route_hint,
  timeline_hint,
  source_confidence,
  data_confidence,
  source_keys,
  search_text,
  updated_at
from public.candidate_intel_profiles;

alter table public.candidate_intel_sync_runs enable row level security;
alter table public.candidate_intel_profiles enable row level security;
alter table public.candidate_intel_source_records enable row level security;
alter table public.candidate_intel_match_decisions enable row level security;
alter table public.candidate_intel_election_timelines enable row level security;
alter table public.candidate_intel_refresh_events enable row level security;
alter table public.candidate_intel_search_cache enable row level security;

do $$ begin
  create policy "candidate_intel_admin_all_sync_runs"
    on public.candidate_intel_sync_runs
    for all
    using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin')
    with check ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "candidate_intel_admin_all_profiles"
    on public.candidate_intel_profiles
    for all
    using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin')
    with check ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "candidate_intel_admin_all_source_records"
    on public.candidate_intel_source_records
    for all
    using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin')
    with check ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "candidate_intel_admin_all_match_decisions"
    on public.candidate_intel_match_decisions
    for all
    using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin')
    with check ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "candidate_intel_admin_all_timelines"
    on public.candidate_intel_election_timelines
    for all
    using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin')
    with check ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "candidate_intel_admin_all_refresh_events"
    on public.candidate_intel_refresh_events
    for all
    using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin')
    with check ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "candidate_intel_admin_all_search_cache"
    on public.candidate_intel_search_cache
    for all
    using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin')
    with check ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');
exception when duplicate_object then null; end $$;

insert into public.political_data_sources
  (source_key, display_name, publisher, homepage_url, terms_url, license_notes,
   kind, reliability_tier, refresh_cadence, enabled, notes, api_base_url,
   auth_env_key, source_category, supports_webhook, supports_incremental_sync,
   default_state_scope, source_priority, api_endpoint_config, credential_status)
values
  ('google_civic_elections_v1',
   'Google Civic Information API - Elections',
   'Google',
   'https://developers.google.com/civic-information',
   'https://developers.google.com/civic-information/terms',
   'Requires Google API key. Candidate availability is election/address dependent and comes through supported Voting Information Project data.',
   'api', 'aggregator', 'nightly', false,
   'Used for election IDs, voterInfoQuery candidate data where supported, OCD geography, and election-office metadata.',
   'https://www.googleapis.com/civicinfo/v2',
   'GOOGLE_CIVIC_API_KEY',
   'candidate_intelligence',
   false, true, '{}', 20,
   '{"elections":"/elections","voterInfo":"/voterinfo"}'::jsonb,
   'missing'),

  ('democracy_works_elections_v2',
   'Democracy Works Elections API',
   'Democracy Works',
   'https://developers.democracy.works/api/v2',
   'https://developers.democracy.works/api/v2',
   'Requires x-api-key and partnership access. Best for authoritative election timelines, authorities, and deadline metadata.',
   'api', 'aggregator', 'nightly', false,
   'Enterprise election timeline feed for local/state/federal elections and authority metadata.',
   'https://api.democracy.works/v2',
   'DEMOCRACY_WORKS_API_KEY',
   'candidate_intelligence',
   false, true, '{}', 25,
   '{"elections":"/elections","authorities":"/election-authorities"}'::jsonb,
   'missing'),

  ('ballotpedia_data_api_v1',
   'Ballotpedia Data API',
   'Ballotpedia',
   'https://developer.ballotpedia.org/',
   'https://developer.ballotpedia.org/dictionaries-and-terms/terms-of-use',
   'Requires active API key/package and domain or server-side usage according to Ballotpedia API terms.',
   'api', 'aggregator', 'nightly', false,
   'Candidate, ballot measure, officeholder, and geography data where licensed.',
   'https://api4.ballotpedia.org/data',
   'BALLOTPEDIA_API_KEY',
   'candidate_intelligence',
   false, true, '{}', 30,
   '{"candidates":"configured_by_package","ballotMeasures":"configured_by_package","geographies":"configured_by_package"}'::jsonb,
   'missing'),

  ('state_sos_candidate_filings',
   'Secretary of State Candidate Filing Feeds',
   'State Secretaries of State',
   null,
   null,
   'Public election filing records. Format and refresh cadence vary by state.',
   'csv', 'official', 'nightly', false,
   'Generic adapter for state candidate filing files/APIs. Start with OH, IL, TN.',
   null,
   'STATE_SOS_FEED_CONFIG_JSON',
   'candidate_intelligence',
   true, true, '{OH,IL,TN}', 10,
   '{"mode":"configured_feed_or_upload"}'::jsonb,
   'missing'),

  ('state_boe_candidate_filings',
   'State Board of Elections Candidate Filing Feeds',
   'State Boards of Elections',
   null,
   null,
   'Public election filing records. Format and refresh cadence vary by state and county.',
   'csv', 'official', 'nightly', false,
   'Generic adapter for board-of-elections candidate filing datasets.',
   null,
   'STATE_BOE_FEED_CONFIG_JSON',
   'candidate_intelligence',
   true, true, '{OH,IL,TN}', 12,
   '{"mode":"configured_feed_or_upload"}'::jsonb,
   'missing'),

  ('municipal_election_filings',
   'Municipal Election Filing Feeds',
   'Municipal election offices',
   null,
   null,
   'Public municipal filing records. Often PDF/CSV/manual import; verify before outreach.',
   'manual', 'official', 'weekly', false,
   'Generic local-race ingestion source for municipal, school board, judicial, and ballot initiative records.',
   null,
   'MUNICIPAL_ELECTION_FEED_CONFIG_JSON',
   'candidate_intelligence',
   true, false, '{}', 15,
   '{"mode":"configured_feed_or_upload"}'::jsonb,
   'missing')
on conflict (source_key) do update set
  display_name = excluded.display_name,
  publisher = excluded.publisher,
  homepage_url = excluded.homepage_url,
  terms_url = excluded.terms_url,
  license_notes = excluded.license_notes,
  kind = excluded.kind,
  reliability_tier = excluded.reliability_tier,
  refresh_cadence = excluded.refresh_cadence,
  notes = excluded.notes,
  api_base_url = excluded.api_base_url,
  auth_env_key = excluded.auth_env_key,
  source_category = excluded.source_category,
  supports_webhook = excluded.supports_webhook,
  supports_incremental_sync = excluded.supports_incremental_sync,
  default_state_scope = excluded.default_state_scope,
  source_priority = excluded.source_priority,
  api_endpoint_config = excluded.api_endpoint_config,
  updated_at = now();

update public.political_data_sources
set
  api_base_url = 'https://api.open.fec.gov/v1',
  auth_env_key = 'FEC_API_KEY',
  source_category = 'candidate_intelligence',
  supports_incremental_sync = true,
  source_priority = 5,
  api_endpoint_config = jsonb_build_object('candidates', '/candidates/', 'committees', '/committees/'),
  credential_status = case when auth_env_key is null then 'unknown' else credential_status end,
  updated_at = now()
where source_key in ('fec_candidates_v1', 'fec_committees_v1');
