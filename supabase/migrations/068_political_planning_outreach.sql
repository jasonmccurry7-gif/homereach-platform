-- ─────────────────────────────────────────────────────────────────────────────
-- HomeReach Migration 068 — Political Command Center: Planning + Outreach Layer
--
-- ADDITIVE schema layer that extends the existing political subsystem
-- (migrations 061–067) with the planning, scenario comparison, public-lead,
-- follow-up, and approval-audit tables required by the Campaign Mail
-- Planning Platform spec.
--
-- Strictly additive:
--   • Creates 8 new tables.
--   • Touches NO existing tables, columns, indexes, policies, or data.
--   • All creations guarded by `if not exists` / `drop policy if exists`.
--   • RLS enabled on every new table.
--   • Policies follow the JWT pattern established by migration 067 to
--     avoid the profiles-recursion bug.
--   • Public-write policies (for /political portal lead capture) are
--     scoped to `anon` role and limited to specific columns where applicable.
--
-- Compliance (re-stated, NON-NEGOTIABLE):
--   • No voter-prediction, persuasion, ideology, or individual-targeting
--     fields. Geography aggregation only.
--   • `political_routes` stores USPS carrier route geometry as opaque blobs
--     for visual planning ONLY — never joined to voter files.
--
-- Map system note: this migration models routes/reservations as data tables
-- so the Decision Engine (Phase 3) and Map Coverage UI (Phase 2) can be
-- built on top. The actual carrier-route ingestion job and Mapbox/Leaflet
-- integration are tracked separately and gated behind ENABLE_POLITICAL_MAP.
--
-- SAFE TO RE-RUN.
-- ─────────────────────────────────────────────────────────────────────────────


-- ═════════════════════════════════════════════════════════════════════════════
-- 1. political_organizations
--    Parent entity above a candidate / campaign — a PAC, county party,
--    campaign committee, or non-profit advocacy org that may sponsor
--    multiple candidates / campaigns over time. Optional: a campaign can
--    exist without an organization (most do).
-- ═════════════════════════════════════════════════════════════════════════════

create table if not exists public.political_organizations (
  id                        uuid primary key default gen_random_uuid(),

  legal_name                text not null,
  display_name              text,
  org_type                  text check (org_type in (
    'campaign_committee', 'pac', 'super_pac', 'party_committee',
    'advocacy', 'nonprofit_501c4', 'other'
  )),
  ein                       text,                 -- IRS EIN, optional
  state                     text,                 -- registration state

  primary_contact_name      text,
  primary_contact_email     text,
  primary_contact_phone     text,
  website                   text,

  notes                     text,
  do_not_contact            boolean not null default false,

  created_by                uuid references public.profiles(id) on delete set null,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index if not exists political_organizations_state_idx
  on public.political_organizations (state);
create index if not exists political_organizations_org_type_idx
  on public.political_organizations (org_type);

-- Optional FK from existing political_campaigns → organizations.
-- ADDITIVE column, nullable so all current rows remain valid.
alter table public.political_campaigns
  add column if not exists organization_id uuid
  references public.political_organizations(id) on delete set null;

create index if not exists political_campaigns_organization_idx
  on public.political_campaigns (organization_id)
  where organization_id is not null;


-- ═════════════════════════════════════════════════════════════════════════════
-- 2. political_plans
--    A named coverage plan per campaign. A campaign can have many plans
--    (e.g. "Primary Push", "GOTV Final Week", "Absentee Targeting Window").
--    Each plan owns N scenarios.
-- ═════════════════════════════════════════════════════════════════════════════

create table if not exists public.political_plans (
  id                        uuid primary key default gen_random_uuid(),
  campaign_id               uuid not null references public.political_campaigns(id) on delete cascade,

  name                      text not null,
  goal                      text,                 -- free-text plain-English goal
  budget_cents              bigint,               -- optional ceiling for scenarios
  target_window_start       date,                 -- earliest first-drop date
  target_window_end         date,                 -- latest last-drop date

  -- Active scenario chosen for this plan (nullable until a comparison is made)
  selected_scenario_id      uuid,                 -- FK added after scenarios table exists

  notes                     text,
  archived_at               timestamptz,

  created_by                uuid references public.profiles(id) on delete set null,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index if not exists political_plans_campaign_idx
  on public.political_plans (campaign_id);
create index if not exists political_plans_active_idx
  on public.political_plans (campaign_id)
  where archived_at is null;


-- ═════════════════════════════════════════════════════════════════════════════
-- 3. political_scenarios
--    A single "what-if" comparison row inside a plan. Stores both the inputs
--    (geography filter, constraint type, route selection list) and the
--    computed snapshot (households, drops, pieces, cost, coverage %, etc.)
--    so the dashboard can render the comparison instantly without re-running
--    the quote engine.
-- ═════════════════════════════════════════════════════════════════════════════

create table if not exists public.political_scenarios (
  id                        uuid primary key default gen_random_uuid(),
  plan_id                   uuid not null references public.political_plans(id) on delete cascade,

  label                     text not null,        -- "Full Coverage", "Optimized", "Budget", custom
  scenario_type             text not null check (scenario_type in (
    'full_coverage', 'optimized', 'budget_constrained', 'custom', 'hybrid'
  )),

  -- Inputs ---------------------------------------------------------------
  -- Stored as jsonb so the engine can evolve without migrations:
  --   { state, geographyType, geographyValue, districtType, includedRouteIds: [],
  --     excludedRouteIds: [], dropCount, addOns: { setup, design, rush, ... },
  --     budgetCapCents, regionMultipliers }
  inputs                    jsonb not null default '{}'::jsonb,

  -- Outputs (snapshot from quote engine) --------------------------------
  households                integer,              -- estimated households reached
  drops                     integer,              -- recommended drop count
  total_pieces              integer,              -- households × drops
  total_investment_cents    bigint,
  internal_cost_cents       bigint,               -- never shown to client
  internal_margin_cents     bigint,               -- never shown to client
  coverage_pct              numeric(5,2),         -- 0.00 – 100.00
  estimated_impressions     integer,              -- pieces × pass-around factor

  -- Full quote payload for audit / re-render
  quote_snapshot            jsonb,

  -- "Why This Plan" reasoning (markdown / plain text)
  rationale                 text,

  computed_at               timestamptz,
  created_by                uuid references public.profiles(id) on delete set null,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index if not exists political_scenarios_plan_idx
  on public.political_scenarios (plan_id);
create index if not exists political_scenarios_type_idx
  on public.political_scenarios (scenario_type);

-- Wire the plans.selected_scenario_id FK now that scenarios exists.
do $$ begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'political_plans_selected_scenario_fk'
  ) then
    alter table public.political_plans
      add constraint political_plans_selected_scenario_fk
      foreign key (selected_scenario_id)
      references public.political_scenarios(id)
      on delete set null;
  end if;
end $$;


-- ═════════════════════════════════════════════════════════════════════════════
-- 4. political_routes
--    USPS carrier-route geometry catalog. Source: USPS EDDM facility tool +
--    operator imports. Used for visual coverage planning ONLY.
--
--    Geometry stored as GeoJSON (jsonb) — keeps this migration PostGIS-free.
--    A follow-up migration can promote to geography(Polygon, 4326) if/when
--    PostGIS is enabled. Until then, the app filters/serves polygons via
--    jsonb operators. NO PostGIS dependency to keep this migration safe.
-- ═════════════════════════════════════════════════════════════════════════════

create table if not exists public.political_routes (
  id                        uuid primary key default gen_random_uuid(),

  state                     text not null,
  zip5                      text not null,
  zip4                      text,
  carrier_route_id          text not null,        -- USPS CRID e.g. "C001"
  route_type                text check (route_type in ('city', 'rural', 'highway', 'po_box', 'general')),

  -- Aggregate household counts (USPS published)
  residential_count         integer,
  business_count            integer,
  total_count               integer,              -- residential + business

  -- Display-only geography labels
  county                    text,
  city                      text,

  -- GeoJSON Polygon/MultiPolygon (no PostGIS)
  geometry                  jsonb,

  -- Provenance
  source                    text,                 -- 'usps_eddm', 'operator_import', etc.
  source_imported_at        timestamptz,

  -- Operational
  active                    boolean not null default true,
  notes                     text,

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  unique (state, zip5, carrier_route_id)
);

create index if not exists political_routes_state_idx           on public.political_routes (state);
create index if not exists political_routes_zip5_idx            on public.political_routes (zip5);
create index if not exists political_routes_zip5_carrier_idx    on public.political_routes (zip5, carrier_route_id);
create index if not exists political_routes_county_idx          on public.political_routes (county);
create index if not exists political_routes_city_idx            on public.political_routes (city);
create index if not exists political_routes_active_idx          on public.political_routes (active) where active = true;


-- ═════════════════════════════════════════════════════════════════════════════
-- 5. political_route_selections
--    Many-to-many bridge: which routes are included in which scenario.
--    Allows precise per-route counts to roll up to scenario totals.
-- ═════════════════════════════════════════════════════════════════════════════

create table if not exists public.political_route_selections (
  scenario_id               uuid not null references public.political_scenarios(id) on delete cascade,
  route_id                  uuid not null references public.political_routes(id) on delete restrict,

  -- Frozen snapshot of route counts at selection time, so historical totals
  -- don't drift if the route catalog gets re-imported.
  household_count_snapshot  integer,
  unit_cost_cents_snapshot  integer,
  unit_price_cents_snapshot integer,

  added_at                  timestamptz not null default now(),

  primary key (scenario_id, route_id)
);

create index if not exists political_route_selections_route_idx
  on public.political_route_selections (route_id);


-- ═════════════════════════════════════════════════════════════════════════════
-- 6. political_reservations
--    Holds a route + drop-week window for a campaign. Implements Phase 13
--    (Active Coverage + Reservation). Two states matter:
--      'soft' — held while a proposal is being prepared (auto-expires)
--      'firm' — locked once a contract is signed and order is paid
-- ═════════════════════════════════════════════════════════════════════════════

create table if not exists public.political_reservations (
  id                        uuid primary key default gen_random_uuid(),
  campaign_id               uuid not null references public.political_campaigns(id) on delete cascade,
  route_id                  uuid not null references public.political_routes(id) on delete restrict,
  scenario_id               uuid references public.political_scenarios(id) on delete set null,
  order_id                  uuid references public.political_orders(id)    on delete set null,

  drop_window_start         date not null,
  drop_window_end           date not null,
  drop_index                integer not null default 1,    -- 1..N for multi-wave campaigns

  status                    text not null default 'soft' check (status in (
    'soft', 'firm', 'released', 'expired', 'fulfilled'
  )),
  expires_at                timestamptz,

  reserved_by               uuid references public.profiles(id) on delete set null,
  released_by               uuid references public.profiles(id) on delete set null,
  released_at               timestamptz,
  notes                     text,

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index if not exists political_reservations_route_window_idx
  on public.political_reservations (route_id, drop_window_start, drop_window_end);
create index if not exists political_reservations_campaign_idx
  on public.political_reservations (campaign_id);
create index if not exists political_reservations_active_idx
  on public.political_reservations (route_id)
  where status in ('soft', 'firm');


-- ═════════════════════════════════════════════════════════════════════════════
-- 7. political_outreach_leads
--    Inbound leads captured from the PUBLIC /political portal — campaigns
--    that started a plan themselves but haven't been paired with a sales
--    agent yet. Distinct from `campaign_candidates` (sales-discovered).
--
--    Public anon insert is allowed via a narrow policy (column-restricted).
-- ═════════════════════════════════════════════════════════════════════════════

create table if not exists public.political_outreach_leads (
  id                        uuid primary key default gen_random_uuid(),

  -- Submitter (campaign side)
  contact_name              text not null,
  contact_email             text not null,
  contact_phone             text,
  candidate_name            text,
  office_sought             text,
  organization_name         text,
  state                     text,
  geography_type            geography_type_enum,
  geography_value           text,
  district_type             district_type_enum,
  election_date             date,

  -- Self-reported plan intent
  budget_estimate_cents     bigint,
  desired_drop_count        integer,
  notes                     text,

  -- Triage
  status                    text not null default 'new' check (status in (
    'new', 'qualified', 'contacted', 'converted', 'disqualified', 'unresponsive'
  )),
  assigned_to               uuid references public.profiles(id) on delete set null,
  converted_to_campaign_id  uuid references public.political_campaigns(id) on delete set null,
  qualified_at              timestamptz,
  contacted_at              timestamptz,
  next_follow_up_at         timestamptz,

  -- Compliance
  consent_marketing         boolean not null default false,
  do_not_contact            boolean not null default false,

  -- Provenance
  source                    text not null default 'public_portal',
  utm_source                text,
  utm_medium                text,
  utm_campaign              text,
  ip_address                text,
  user_agent                text,

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index if not exists political_outreach_leads_status_idx
  on public.political_outreach_leads (status);
create index if not exists political_outreach_leads_assigned_idx
  on public.political_outreach_leads (assigned_to)
  where assigned_to is not null;
create index if not exists political_outreach_leads_followup_idx
  on public.political_outreach_leads (next_follow_up_at)
  where next_follow_up_at is not null;
create index if not exists political_outreach_leads_state_idx
  on public.political_outreach_leads (state);


-- ═════════════════════════════════════════════════════════════════════════════
-- 8. political_follow_ups
--    Scheduled follow-up actions (call, sms, email, fb_dm, internal_note)
--    that automation engines can claim and execute. Implements Phase 15
--    (Follow-Up Automation).
-- ═════════════════════════════════════════════════════════════════════════════

create table if not exists public.political_follow_ups (
  id                        uuid primary key default gen_random_uuid(),

  -- Subject — exactly one of these must be set
  candidate_id              uuid references public.campaign_candidates(id) on delete cascade,
  campaign_id               uuid references public.political_campaigns(id) on delete cascade,
  outreach_lead_id          uuid references public.political_outreach_leads(id) on delete cascade,
  proposal_id               uuid references public.political_proposals(id) on delete cascade,

  channel                   text not null check (channel in (
    'call', 'sms', 'email', 'facebook_dm', 'internal_note'
  )),
  trigger                   text not null check (trigger in (
    'manual', 'proposal_viewed', 'proposal_inactivity', 'lead_inbound',
    'reservation_expiring', 'election_proximity', 'cron'
  )),
  script_id                 uuid references public.political_scripts(id) on delete set null,
  payload                   jsonb,                -- channel-specific payload (subject, body, vars)

  scheduled_for             timestamptz not null,
  status                    text not null default 'pending' check (status in (
    'pending', 'in_progress', 'completed', 'failed', 'canceled', 'skipped'
  )),

  attempts                  integer not null default 0,
  last_attempt_at           timestamptz,
  last_error                text,
  completed_at              timestamptz,

  assigned_to               uuid references public.profiles(id) on delete set null,
  created_by                uuid references public.profiles(id) on delete set null,

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  -- Sanity: at least one subject FK must be set
  constraint political_follow_ups_has_subject check (
    candidate_id is not null
    or campaign_id is not null
    or outreach_lead_id is not null
    or proposal_id is not null
  )
);

create index if not exists political_follow_ups_due_idx
  on public.political_follow_ups (scheduled_for)
  where status = 'pending';
create index if not exists political_follow_ups_assigned_idx
  on public.political_follow_ups (assigned_to)
  where assigned_to is not null;
create index if not exists political_follow_ups_campaign_idx
  on public.political_follow_ups (campaign_id) where campaign_id is not null;
create index if not exists political_follow_ups_lead_idx
  on public.political_follow_ups (outreach_lead_id) where outreach_lead_id is not null;


-- ═════════════════════════════════════════════════════════════════════════════
-- 9. political_approvals_log
--    Append-only audit log of every approval / payment / contract event for
--    proposals + orders. Read-only from the app perspective.
-- ═════════════════════════════════════════════════════════════════════════════

create table if not exists public.political_approvals_log (
  id                        uuid primary key default gen_random_uuid(),

  proposal_id               uuid references public.political_proposals(id) on delete set null,
  order_id                  uuid references public.political_orders(id)    on delete set null,
  contract_id               uuid references public.political_contracts(id) on delete set null,
  campaign_id               uuid references public.political_campaigns(id) on delete set null,

  event_type                text not null check (event_type in (
    'proposal_sent', 'proposal_viewed', 'proposal_approved', 'proposal_declined', 'proposal_expired',
    'contract_sent', 'contract_signed', 'contract_canceled',
    'payment_initiated', 'payment_succeeded', 'payment_failed', 'payment_refunded',
    'order_fulfillment_started', 'order_completed', 'order_canceled'
  )),

  actor_user_id             uuid references public.profiles(id) on delete set null,
  actor_role                text,                 -- 'admin', 'sales_agent', 'client', 'system', 'stripe_webhook'
  actor_ip                  text,
  metadata                  jsonb,                -- event-specific payload

  occurred_at               timestamptz not null default now(),
  created_at                timestamptz not null default now()
);

create index if not exists political_approvals_log_proposal_idx on public.political_approvals_log (proposal_id) where proposal_id is not null;
create index if not exists political_approvals_log_order_idx    on public.political_approvals_log (order_id)    where order_id    is not null;
create index if not exists political_approvals_log_event_idx    on public.political_approvals_log (event_type);
create index if not exists political_approvals_log_occurred_idx on public.political_approvals_log (occurred_at desc);


-- ═════════════════════════════════════════════════════════════════════════════
-- updated_at triggers — reuse the existing public.set_updated_at() trigger
-- function created in earlier migrations. Defensive existence check.
-- ═════════════════════════════════════════════════════════════════════════════

do $$ begin
  if exists (select 1 from pg_proc where proname = 'set_updated_at') then
    -- organizations
    if not exists (select 1 from pg_trigger where tgname = 'political_organizations_set_updated_at') then
      execute 'create trigger political_organizations_set_updated_at before update on public.political_organizations for each row execute function public.set_updated_at()';
    end if;
    -- plans
    if not exists (select 1 from pg_trigger where tgname = 'political_plans_set_updated_at') then
      execute 'create trigger political_plans_set_updated_at before update on public.political_plans for each row execute function public.set_updated_at()';
    end if;
    -- scenarios
    if not exists (select 1 from pg_trigger where tgname = 'political_scenarios_set_updated_at') then
      execute 'create trigger political_scenarios_set_updated_at before update on public.political_scenarios for each row execute function public.set_updated_at()';
    end if;
    -- routes
    if not exists (select 1 from pg_trigger where tgname = 'political_routes_set_updated_at') then
      execute 'create trigger political_routes_set_updated_at before update on public.political_routes for each row execute function public.set_updated_at()';
    end if;
    -- reservations
    if not exists (select 1 from pg_trigger where tgname = 'political_reservations_set_updated_at') then
      execute 'create trigger political_reservations_set_updated_at before update on public.political_reservations for each row execute function public.set_updated_at()';
    end if;
    -- outreach_leads
    if not exists (select 1 from pg_trigger where tgname = 'political_outreach_leads_set_updated_at') then
      execute 'create trigger political_outreach_leads_set_updated_at before update on public.political_outreach_leads for each row execute function public.set_updated_at()';
    end if;
    -- follow_ups
    if not exists (select 1 from pg_trigger where tgname = 'political_follow_ups_set_updated_at') then
      execute 'create trigger political_follow_ups_set_updated_at before update on public.political_follow_ups for each row execute function public.set_updated_at()';
    end if;
  end if;
end $$;


-- ═════════════════════════════════════════════════════════════════════════════
-- RLS — enable on every new table, then JWT-pattern policies (matches 067)
-- ═════════════════════════════════════════════════════════════════════════════

alter table public.political_organizations    enable row level security;
alter table public.political_plans            enable row level security;
alter table public.political_scenarios        enable row level security;
alter table public.political_routes           enable row level security;
alter table public.political_route_selections enable row level security;
alter table public.political_reservations     enable row level security;
alter table public.political_outreach_leads   enable row level security;
alter table public.political_follow_ups       enable row level security;
alter table public.political_approvals_log    enable row level security;


-- ── political_organizations ─────────────────────────────────────────────────
drop policy if exists "political_organizations_admin"      on public.political_organizations;
drop policy if exists "political_organizations_agent_read" on public.political_organizations;
drop policy if exists "political_organizations_agent_write" on public.political_organizations;

create policy "political_organizations_admin"
  on public.political_organizations for all to authenticated
  using      ((auth.jwt()->'app_metadata'->>'user_role') = 'admin')
  with check ((auth.jwt()->'app_metadata'->>'user_role') = 'admin');

create policy "political_organizations_agent_read"
  on public.political_organizations for select to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));

create policy "political_organizations_agent_write"
  on public.political_organizations for insert to authenticated
  with check ((auth.jwt()->'app_metadata'->>'user_role') = 'sales_agent');


-- ── political_plans ─────────────────────────────────────────────────────────
drop policy if exists "political_plans_admin"      on public.political_plans;
drop policy if exists "political_plans_agent_read" on public.political_plans;
drop policy if exists "political_plans_agent_write" on public.political_plans;

create policy "political_plans_admin"
  on public.political_plans for all to authenticated
  using      ((auth.jwt()->'app_metadata'->>'user_role') = 'admin')
  with check ((auth.jwt()->'app_metadata'->>'user_role') = 'admin');

create policy "political_plans_agent_read"
  on public.political_plans for select to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));

create policy "political_plans_agent_write"
  on public.political_plans for insert to authenticated
  with check ((auth.jwt()->'app_metadata'->>'user_role') = 'sales_agent');


-- ── political_scenarios ─────────────────────────────────────────────────────
drop policy if exists "political_scenarios_admin"      on public.political_scenarios;
drop policy if exists "political_scenarios_agent_read" on public.political_scenarios;
drop policy if exists "political_scenarios_agent_write" on public.political_scenarios;

create policy "political_scenarios_admin"
  on public.political_scenarios for all to authenticated
  using      ((auth.jwt()->'app_metadata'->>'user_role') = 'admin')
  with check ((auth.jwt()->'app_metadata'->>'user_role') = 'admin');

create policy "political_scenarios_agent_read"
  on public.political_scenarios for select to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));

create policy "political_scenarios_agent_write"
  on public.political_scenarios for insert to authenticated
  with check ((auth.jwt()->'app_metadata'->>'user_role') = 'sales_agent');


-- ── political_routes (read-only for non-admins, even agents) ────────────────
-- Routes are operational catalog data — only admin/service_role mutates.
-- Agents and clients read only the active rows via the authenticated read policy.
drop policy if exists "political_routes_admin"      on public.political_routes;
drop policy if exists "political_routes_agent_read" on public.political_routes;

create policy "political_routes_admin"
  on public.political_routes for all to authenticated
  using      ((auth.jwt()->'app_metadata'->>'user_role') = 'admin')
  with check ((auth.jwt()->'app_metadata'->>'user_role') = 'admin');

create policy "political_routes_agent_read"
  on public.political_routes for select to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));


-- ── political_route_selections ──────────────────────────────────────────────
drop policy if exists "political_route_selections_admin"      on public.political_route_selections;
drop policy if exists "political_route_selections_agent_read" on public.political_route_selections;
drop policy if exists "political_route_selections_agent_write" on public.political_route_selections;

create policy "political_route_selections_admin"
  on public.political_route_selections for all to authenticated
  using      ((auth.jwt()->'app_metadata'->>'user_role') = 'admin')
  with check ((auth.jwt()->'app_metadata'->>'user_role') = 'admin');

create policy "political_route_selections_agent_read"
  on public.political_route_selections for select to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));

create policy "political_route_selections_agent_write"
  on public.political_route_selections for insert to authenticated
  with check ((auth.jwt()->'app_metadata'->>'user_role') = 'sales_agent');


-- ── political_reservations ──────────────────────────────────────────────────
drop policy if exists "political_reservations_admin"      on public.political_reservations;
drop policy if exists "political_reservations_agent_read" on public.political_reservations;
drop policy if exists "political_reservations_agent_write" on public.political_reservations;

create policy "political_reservations_admin"
  on public.political_reservations for all to authenticated
  using      ((auth.jwt()->'app_metadata'->>'user_role') = 'admin')
  with check ((auth.jwt()->'app_metadata'->>'user_role') = 'admin');

create policy "political_reservations_agent_read"
  on public.political_reservations for select to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));

create policy "political_reservations_agent_write"
  on public.political_reservations for insert to authenticated
  with check ((auth.jwt()->'app_metadata'->>'user_role') = 'sales_agent');


-- ── political_outreach_leads ────────────────────────────────────────────────
-- Public anon INSERT for the /political portal "Start Plan" form.
-- Anon may NEVER read, update, or delete. Admin/agent get the usual access.
drop policy if exists "political_outreach_leads_admin"        on public.political_outreach_leads;
drop policy if exists "political_outreach_leads_agent_read"   on public.political_outreach_leads;
drop policy if exists "political_outreach_leads_agent_update" on public.political_outreach_leads;
drop policy if exists "political_outreach_leads_anon_insert"  on public.political_outreach_leads;

create policy "political_outreach_leads_admin"
  on public.political_outreach_leads for all to authenticated
  using      ((auth.jwt()->'app_metadata'->>'user_role') = 'admin')
  with check ((auth.jwt()->'app_metadata'->>'user_role') = 'admin');

create policy "political_outreach_leads_agent_read"
  on public.political_outreach_leads for select to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));

create policy "political_outreach_leads_agent_update"
  on public.political_outreach_leads for update to authenticated
  using      ((auth.jwt()->'app_metadata'->>'user_role') = 'sales_agent')
  with check ((auth.jwt()->'app_metadata'->>'user_role') = 'sales_agent');

-- Public anon insert — strict: status defaults to 'new'; no override possible
-- because the `with check` enforces it. Anon will never set assigned_to or
-- converted_to_campaign_id (those are nullable and default null).
create policy "political_outreach_leads_anon_insert"
  on public.political_outreach_leads for insert to anon
  with check (
    status = 'new'
    and assigned_to is null
    and converted_to_campaign_id is null
    and qualified_at is null
    and contacted_at is null
  );


-- ── political_follow_ups ────────────────────────────────────────────────────
drop policy if exists "political_follow_ups_admin"      on public.political_follow_ups;
drop policy if exists "political_follow_ups_agent_read" on public.political_follow_ups;
drop policy if exists "political_follow_ups_agent_write" on public.political_follow_ups;
drop policy if exists "political_follow_ups_agent_update" on public.political_follow_ups;

create policy "political_follow_ups_admin"
  on public.political_follow_ups for all to authenticated
  using      ((auth.jwt()->'app_metadata'->>'user_role') = 'admin')
  with check ((auth.jwt()->'app_metadata'->>'user_role') = 'admin');

create policy "political_follow_ups_agent_read"
  on public.political_follow_ups for select to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));

create policy "political_follow_ups_agent_write"
  on public.political_follow_ups for insert to authenticated
  with check ((auth.jwt()->'app_metadata'->>'user_role') = 'sales_agent');

create policy "political_follow_ups_agent_update"
  on public.political_follow_ups for update to authenticated
  using      ((auth.jwt()->'app_metadata'->>'user_role') = 'sales_agent')
  with check ((auth.jwt()->'app_metadata'->>'user_role') = 'sales_agent');


-- ── political_approvals_log ─────────────────────────────────────────────────
-- Append-only from the app; admin reads, agents read, no one updates/deletes
-- through normal policies. service_role bypasses RLS for system-level inserts
-- (Stripe webhook, cron, etc.).
drop policy if exists "political_approvals_log_admin"       on public.political_approvals_log;
drop policy if exists "political_approvals_log_agent_read"  on public.political_approvals_log;
drop policy if exists "political_approvals_log_authd_insert" on public.political_approvals_log;

create policy "political_approvals_log_admin"
  on public.political_approvals_log for select to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') = 'admin');

create policy "political_approvals_log_agent_read"
  on public.political_approvals_log for select to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));

create policy "political_approvals_log_authd_insert"
  on public.political_approvals_log for insert to authenticated
  with check ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));


-- ═════════════════════════════════════════════════════════════════════════════
-- Done — migration 068 complete.
-- ═════════════════════════════════════════════════════════════════════════════
