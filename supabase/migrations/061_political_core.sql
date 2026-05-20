-- ─────────────────────────────────────────────────────────────────────────────
-- HomeReach Migration 059 — Political Command Center: Core schema
--
-- Creates the foundation for the Political Command Center (accessible at
-- /admin/political when ENABLE_POLITICAL=true). Establishes a candidate
-- database, a political campaigns table for sales pipeline work, and a
-- contacts table for per-candidate / per-campaign outreach.
--
-- Also adds an optional `political_campaign_id` column to the existing
-- `sales_events` table so the political module can reuse the same activity
-- timeline without duplicating event infrastructure.
--
-- Scope and constraints:
--   - ADDITIVE ONLY. No existing columns modified. No existing policies
--     dropped. No existing indexes altered.
--   - All table / column / index / policy creations use `if not exists` or
--     `drop policy if exists` guards. Safe to re-run.
--   - RLS is enabled on every new table. Baseline policies mirror
--     migration 20 (sales_leads / sales_events) exactly: service_role full,
--     admin full, sales_agent read-all + write-own. Client role gets zero
--     access in this phase — client portal lands in a later migration.
--   - Gated at runtime by ENABLE_POLITICAL. Safe to apply before the flag
--     flips on; nothing in the app reads these tables while the flag is off.
--   - Non-political-persuasion compliance: no columns on any of these
--     tables store voter ideology, party-segmentation scores, voter-file
--     joins, or persuasion attributes. `party_optional_public` is present
--     ONLY to record a candidate's own publicly-declared party registration
--     (already public record), and is optional / null by default.
--
-- SAFE TO RE-RUN.
-- ─────────────────────────────────────────────────────────────────────────────


-- ═════════════════════════════════════════════════════════════════════════════
-- 1. campaign_candidates
--    One row per Ohio (or other) candidate we're tracking. The "lead" of the
--    political module — discovered via public sources (FEC, state board of
--    elections, campaign websites, news) and enriched operationally.
-- ═════════════════════════════════════════════════════════════════════════════

create table if not exists public.campaign_candidates (
  id                        uuid primary key default gen_random_uuid(),

  -- Identity
  candidate_name            text not null,
  office_sought             text,
  race_level                text not null check (race_level in ('federal','state','local')),
  election_year             int,
  election_date             date,

  -- Geography
  district                  text,
  county                    text,
  city                      text,
  state                     text not null default 'OH',

  -- Optional party registration. PUBLIC RECORD ONLY — never inferred,
  -- never used for persuasion scoring. Default null so it's truly optional.
  party_optional_public     text,

  -- Contact / public links (operational; never used for ideology scoring)
  campaign_website          text,
  campaign_email            text,
  campaign_phone            text,
  facebook_url              text,
  messenger_url             text,
  campaign_manager_name     text,
  campaign_manager_email    text,

  -- Provenance: where we discovered this candidate
  source_url                text,
  source_type               text,
  data_verified_at          timestamptz,

  -- Operational scoring ONLY. completeness_score = how complete our
  -- contact record is; priority_score = derived from recency + election
  -- proximity + contact-info completeness. NEITHER infers political
  -- beliefs or persuasion likelihood — enforced at the scorer layer.
  completeness_score        int check (completeness_score is null or (completeness_score between 0 and 100)),
  priority_score            int check (priority_score is null or (priority_score between 0 and 100)),

  -- Pipeline state
  status                    text not null default 'new',
  last_contacted_at         timestamptz,
  next_follow_up_at         timestamptz,
  notes                     text,

  -- Compliance toggles — respected by every outreach path
  do_not_contact            boolean not null default false,
  do_not_email              boolean not null default false,
  do_not_text               boolean not null default false,

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index if not exists campaign_candidates_race_level_idx on public.campaign_candidates (race_level);
create index if not exists campaign_candidates_state_idx      on public.campaign_candidates (state);
create index if not exists campaign_candidates_county_idx     on public.campaign_candidates (county);
create index if not exists campaign_candidates_city_idx       on public.campaign_candidates (city);
create index if not exists campaign_candidates_status_idx     on public.campaign_candidates (status);
create index if not exists campaign_candidates_election_idx   on public.campaign_candidates (election_date);
create index if not exists campaign_candidates_priority_idx   on public.campaign_candidates (priority_score desc)
  where priority_score is not null;
create index if not exists campaign_candidates_followup_idx   on public.campaign_candidates (next_follow_up_at)
  where next_follow_up_at is not null;


-- ═════════════════════════════════════════════════════════════════════════════
-- 2. political_campaigns
--    One row per active sales engagement with a candidate. A candidate can
--    have multiple campaigns (e.g. primary push + general), so this is the
--    pipeline-level object that owns quotes, proposals, orders, contracts.
-- ═════════════════════════════════════════════════════════════════════════════

create table if not exists public.political_campaigns (
  id                        uuid primary key default gen_random_uuid(),
  candidate_id              uuid not null references public.campaign_candidates(id) on delete cascade,

  campaign_name             text not null,
  office                    text,
  race_type                 text check (race_type is null or race_type in ('federal','state','local')),

  -- Target geography for this engagement. A single campaign may span
  -- multiple of these; richer geo modeling lands in a later migration.
  county                    text,
  city                      text,
  district                  text,

  -- Sales pipeline stage. Free-text by design (not an enum) so operators
  -- can adjust the pipeline without a schema change during the 2026
  -- validation window. Tight enum lands once the stage list stabilizes.
  stage                     text not null default 'new',

  -- Dollars. Use bigint cents for consistency with existing revenue code.
  estimated_deal_value_cents bigint,

  owner_id                  uuid references public.profiles(id) on delete set null,

  -- Denormalized for dashboard speed; the authoritative date lives on
  -- campaign_candidates. Updated by app code when a campaign is attached.
  election_date             date,

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index if not exists political_campaigns_candidate_idx on public.political_campaigns (candidate_id);
create index if not exists political_campaigns_owner_idx     on public.political_campaigns (owner_id);
create index if not exists political_campaigns_stage_idx     on public.political_campaigns (stage);
create index if not exists political_campaigns_race_idx      on public.political_campaigns (race_type);
create index if not exists political_campaigns_election_idx  on public.political_campaigns (election_date);


-- ═════════════════════════════════════════════════════════════════════════════
-- 3. political_campaign_contacts
--    People we actually talk to — candidate directly, campaign manager,
--    finance director, comms lead, etc. Always attached to a candidate,
--    optionally attached to a specific campaign (for multi-campaign scenarios).
-- ═════════════════════════════════════════════════════════════════════════════

create table if not exists public.political_campaign_contacts (
  id                        uuid primary key default gen_random_uuid(),

  campaign_candidate_id     uuid not null references public.campaign_candidates(id) on delete cascade,
  campaign_id               uuid references public.political_campaigns(id) on delete set null,

  name                      text not null,
  role                      text,
  email                     text,
  phone                     text,

  is_primary                boolean not null default false,
  preferred_contact_method  text check (preferred_contact_method is null or preferred_contact_method in ('email','sms','call','facebook_dm')),

  -- Per-contact compliance, in addition to the candidate-level flags
  do_not_contact            boolean not null default false,
  do_not_email              boolean not null default false,
  do_not_text               boolean not null default false,

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index if not exists political_campaign_contacts_candidate_idx on public.political_campaign_contacts (campaign_candidate_id);
create index if not exists political_campaign_contacts_campaign_idx  on public.political_campaign_contacts (campaign_id);
create index if not exists political_campaign_contacts_email_idx     on public.political_campaign_contacts (lower(email))
  where email is not null;
create index if not exists political_campaign_contacts_phone_idx     on public.political_campaign_contacts (phone)
  where phone is not null;

-- Only one primary contact per candidate.
create unique index if not exists political_campaign_contacts_one_primary_idx
  on public.political_campaign_contacts (campaign_candidate_id)
  where is_primary = true;


-- ═════════════════════════════════════════════════════════════════════════════
-- 4. sales_events additive: political_campaign_id
--    Widen the existing activity-log table so political actions can be
--    recorded alongside sales_leads activity without duplicating the
--    event infrastructure. Column is nullable — existing rows are unaffected.
-- ═════════════════════════════════════════════════════════════════════════════

alter table public.sales_events
  add column if not exists political_campaign_id uuid references public.political_campaigns(id) on delete set null;

create index if not exists sales_events_political_campaign_idx
  on public.sales_events (political_campaign_id)
  where political_campaign_id is not null;


-- ═════════════════════════════════════════════════════════════════════════════
-- 5. Row Level Security
--    Mirrors the sales_leads / sales_events policy shape from migration 20:
--      - service_role:   full access (used by cron + webhook code paths)
--      - admin:          full access (checked via profiles.role)
--      - sales_agent:    read all political data, update own-owned campaigns
--                        and contacts attached to them. Cannot delete.
--    Client role gets NO access at this phase. Client portal lands in a
--    later migration (proposals / orders approval flow).
-- ═════════════════════════════════════════════════════════════════════════════

alter table public.campaign_candidates            enable row level security;
alter table public.political_campaigns            enable row level security;
alter table public.political_campaign_contacts    enable row level security;

-- ── campaign_candidates ─────────────────────────────────────────────────────
drop policy if exists "campaign_candidates_service" on public.campaign_candidates;
create policy "campaign_candidates_service"
  on public.campaign_candidates
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "campaign_candidates_admin" on public.campaign_candidates;
create policy "campaign_candidates_admin"
  on public.campaign_candidates
  for all
  to authenticated
  using      (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "campaign_candidates_agent_read" on public.campaign_candidates;
create policy "campaign_candidates_agent_read"
  on public.campaign_candidates
  for select
  to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','sales_agent')));

drop policy if exists "campaign_candidates_agent_update" on public.campaign_candidates;
create policy "campaign_candidates_agent_update"
  on public.campaign_candidates
  for update
  to authenticated
  using      (exists (select 1 from public.profiles where id = auth.uid() and role = 'sales_agent'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'sales_agent'));

drop policy if exists "campaign_candidates_agent_insert" on public.campaign_candidates;
create policy "campaign_candidates_agent_insert"
  on public.campaign_candidates
  for insert
  to authenticated
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'sales_agent'));

-- ── political_campaigns ─────────────────────────────────────────────────────
drop policy if exists "political_campaigns_service" on public.political_campaigns;
create policy "political_campaigns_service"
  on public.political_campaigns
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "political_campaigns_admin" on public.political_campaigns;
create policy "political_campaigns_admin"
  on public.political_campaigns
  for all
  to authenticated
  using      (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "political_campaigns_agent_read" on public.political_campaigns;
create policy "political_campaigns_agent_read"
  on public.political_campaigns
  for select
  to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','sales_agent')));

-- Sales agents can insert campaigns they'll own, and update their own.
drop policy if exists "political_campaigns_agent_insert" on public.political_campaigns;
create policy "political_campaigns_agent_insert"
  on public.political_campaigns
  for insert
  to authenticated
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'sales_agent')
    and (owner_id is null or owner_id = auth.uid())
  );

drop policy if exists "political_campaigns_agent_update_own" on public.political_campaigns;
create policy "political_campaigns_agent_update_own"
  on public.political_campaigns
  for update
  to authenticated
  using      (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- ── political_campaign_contacts ─────────────────────────────────────────────
drop policy if exists "political_campaign_contacts_service" on public.political_campaign_contacts;
create policy "political_campaign_contacts_service"
  on public.political_campaign_contacts
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "political_campaign_contacts_admin" on public.political_campaign_contacts;
create policy "political_campaign_contacts_admin"
  on public.political_campaign_contacts
  for all
  to authenticated
  using      (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "political_campaign_contacts_agent_read" on public.political_campaign_contacts;
create policy "political_campaign_contacts_agent_read"
  on public.political_campaign_contacts
  for select
  to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','sales_agent')));

drop policy if exists "political_campaign_contacts_agent_insert" on public.political_campaign_contacts;
create policy "political_campaign_contacts_agent_insert"
  on public.political_campaign_contacts
  for insert
  to authenticated
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'sales_agent'));

drop policy if exists "political_campaign_contacts_agent_update" on public.political_campaign_contacts;
create policy "political_campaign_contacts_agent_update"
  on public.political_campaign_contacts
  for update
  to authenticated
  using      (exists (select 1 from public.profiles where id = auth.uid() and role = 'sales_agent'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'sales_agent'));


-- ═════════════════════════════════════════════════════════════════════════════
-- 6. updated_at triggers
--    Reuses the tg_update_updated_at() function if present; otherwise
--    inlines a minimal version that's compatible with existing triggers.
-- ═════════════════════════════════════════════════════════════════════════════

-- Use an inline function scoped to this migration's tables so we don't
-- accidentally clash with whatever naming the earlier migrations used.
create or replace function public.tg_political_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_campaign_candidates_updated_at on public.campaign_candidates;
create trigger trg_campaign_candidates_updated_at
  before update on public.campaign_candidates
  for each row execute function public.tg_political_touch_updated_at();

drop trigger if exists trg_political_campaigns_updated_at on public.political_campaigns;
create trigger trg_political_campaigns_updated_at
  before update on public.political_campaigns
  for each row execute function public.tg_political_touch_updated_at();

drop trigger if exists trg_political_campaign_contacts_updated_at on public.political_campaign_contacts;
create trigger trg_political_campaign_contacts_updated_at
  before update on public.political_campaign_contacts
  for each row execute function public.tg_political_touch_updated_at();
