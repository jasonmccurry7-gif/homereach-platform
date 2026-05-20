-- HomeReach Migration 079 - Political dual map planning foundation
--
-- Additive schema for synchronized Political Campaign Map + USPS Mail Map.
-- This stores normalized planning sessions, selected political geographies,
-- selected USPS routes, overlap calculations, cost estimates, quality flags,
-- and API/source requirements without changing existing campaign, proposal,
-- payment, auth, or outreach tables.
--
-- Compliance boundary:
-- - Geography and aggregate data only.
-- - No individual ideology inference.
-- - No voter persuasion scores.
-- - No individual voter prediction.

create schema if not exists extensions;
create extension if not exists postgis with schema extensions;

do $$ begin
  create type public.map_data_confidence_enum as enum (
    'exact',
    'estimated',
    'demo_sample',
    'user_provided',
    'public_aggregate',
    'paid_vendor_data',
    'unavailable'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.map_requirement_priority_enum as enum (
    'mvp',
    'phase_2',
    'phase_3'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.map_plan_status_enum as enum (
    'draft',
    'saved',
    'proposal_ready',
    'proposal_sent',
    'approved',
    'paid',
    'production',
    'archived'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.map_data_sources (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  source_name text not null,
  category text not null,
  provider text,
  source_type text not null check (source_type in ('public', 'paid', 'api', 'file_upload', 'manual', 'internal')),
  expected_format text,
  geographic_coverage text,
  update_frequency text,
  licensing_notes text,
  cost_estimate text,
  implementation_difficulty text check (implementation_difficulty in ('low', 'medium', 'high')),
  priority public.map_requirement_priority_enum not null default 'mvp',
  required_for_mvp boolean not null default false,
  enabled boolean not null default false,
  data_confidence public.map_data_confidence_enum not null default 'unavailable',
  homepage_url text,
  terms_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.map_layer_sources (
  id uuid primary key default gen_random_uuid(),
  layer_key text not null,
  map_type text not null check (map_type in ('political', 'usps', 'shared')),
  source_id uuid references public.map_data_sources(id) on delete set null,
  source_status text not null default 'needed',
  confidence public.map_data_confidence_enum not null default 'unavailable',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (layer_key, map_type, source_id)
);

create table if not exists public.map_source_requirements (
  id uuid primary key default gen_random_uuid(),
  requirement_key text not null unique,
  requirement_name text not null,
  category text not null,
  priority public.map_requirement_priority_enum not null default 'mvp',
  status text not null default 'needed' check (status in ('needed', 'identified', 'in_progress', 'connected', 'deferred')),
  candidate_sources jsonb not null default '[]'::jsonb,
  required_for text[] not null default '{}'::text[],
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.political_map_layers (
  id uuid primary key default gen_random_uuid(),
  layer_key text not null unique,
  label text not null,
  group_name text not null,
  geography_type text,
  default_enabled boolean not null default false,
  data_confidence public.map_data_confidence_enum not null default 'unavailable',
  source_id uuid references public.map_data_sources(id) on delete set null,
  active boolean not null default true,
  compliance_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.usps_map_layers (
  id uuid primary key default gen_random_uuid(),
  layer_key text not null unique,
  label text not null,
  group_name text not null,
  geography_type text,
  default_enabled boolean not null default false,
  data_confidence public.map_data_confidence_enum not null default 'unavailable',
  source_id uuid references public.map_data_sources(id) on delete set null,
  active boolean not null default true,
  logistics_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.political_geographies (
  id uuid primary key default gen_random_uuid(),
  geography_key text not null unique,
  state text not null,
  geography_type text not null,
  name text not null,
  geoid text,
  parent_geography_key text,
  geom extensions.geometry(Geometry, 4326),
  boundary_geojson jsonb,
  centroid_geojson jsonb,
  aggregate_metrics jsonb not null default '{}'::jsonb,
  party_advantage text check (party_advantage in ('democrat', 'republican', 'mixed', 'unknown')),
  advantage_intensity text check (advantage_intensity in ('light', 'medium', 'strong')),
  data_confidence public.map_data_confidence_enum not null default 'unavailable',
  source_id uuid references public.map_data_sources(id) on delete set null,
  source_updated_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.usps_geographies (
  id uuid primary key default gen_random_uuid(),
  geography_key text not null unique,
  state text not null,
  zip5 text,
  zip4 text,
  carrier_route_id text,
  route_type text,
  name text,
  geom extensions.geometry(Geometry, 4326),
  boundary_geojson jsonb,
  centroid_geojson jsonb,
  residential_count integer,
  business_count integer,
  po_box_count integer,
  vacant_count integer,
  non_deliverable_count integer,
  total_delivery_points integer,
  eddm_eligible boolean,
  saturation_eligible boolean,
  data_confidence public.map_data_confidence_enum not null default 'unavailable',
  source_id uuid references public.map_data_sources(id) on delete set null,
  source_updated_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (state, zip5, carrier_route_id)
);

create table if not exists public.map_selection_sessions (
  id uuid primary key default gen_random_uuid(),
  public_session_id text,
  user_id uuid references public.profiles(id) on delete set null,
  campaign_id uuid references public.political_campaigns(id) on delete set null,
  outreach_lead_id uuid references public.political_outreach_leads(id) on delete set null,
  state text,
  status text not null default 'active' check (status in ('active', 'saved', 'converted', 'abandoned')),
  selected_layers jsonb not null default '{}'::jsonb,
  planning_object jsonb not null default '{}'::jsonb,
  data_confidence public.map_data_confidence_enum not null default 'unavailable',
  last_event_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campaign_map_plans (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.political_campaigns(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  session_id uuid references public.map_selection_sessions(id) on delete set null,
  proposal_id uuid references public.political_proposals(id) on delete set null,
  plan_name text not null default 'Campaign Map Plan',
  campaign_name text,
  candidate_name text,
  office_sought text,
  election_date date,
  state text,
  selected_map_type text,
  selected_layers jsonb not null default '{}'::jsonb,
  selected_polygons jsonb not null default '[]'::jsonb,
  total_households integer not null default 0,
  total_delivery_points integer not null default 0,
  total_estimated_postcards integer not null default 0,
  estimated_print_cost_cents bigint not null default 0,
  estimated_postage_cents bigint not null default 0,
  estimated_total_cost_cents bigint not null default 0,
  estimated_gross_margin_cents bigint not null default 0,
  selected_number_of_drops integer not null default 1,
  selected_schedule jsonb not null default '[]'::jsonb,
  proposal_status text,
  payment_status text,
  data_confidence public.map_data_confidence_enum not null default 'unavailable',
  source_labels text[] not null default '{}'::text[],
  campaign_health_score integer not null default 0,
  campaign_health_tone text check (campaign_health_tone in ('green', 'yellow', 'red')),
  ai_recommendations jsonb not null default '[]'::jsonb,
  operational_alerts jsonb not null default '[]'::jsonb,
  timeline_snapshot jsonb not null default '[]'::jsonb,
  status public.map_plan_status_enum not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campaign_selected_geographies (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.campaign_map_plans(id) on delete cascade,
  political_geography_id uuid references public.political_geographies(id) on delete set null,
  geography_key text not null,
  geography_type text not null,
  label text not null,
  overlap_percentage numeric(6,3),
  household_count integer,
  data_confidence public.map_data_confidence_enum not null default 'unavailable',
  source_label text,
  created_at timestamptz not null default now()
);

create table if not exists public.campaign_selected_usps_routes (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.campaign_map_plans(id) on delete cascade,
  usps_geography_id uuid references public.usps_geographies(id) on delete set null,
  route_key text not null,
  zip5 text,
  carrier_route_id text,
  label text not null,
  overlap_percentage numeric(6,3),
  deliverable_address_count integer,
  residential_count integer,
  business_count integer,
  estimated_postage_cents bigint,
  data_confidence public.map_data_confidence_enum not null default 'unavailable',
  source_label text,
  created_at timestamptz not null default now()
);

create table if not exists public.campaign_cost_estimates (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.campaign_map_plans(id) on delete cascade,
  estimate_type text not null default 'planner',
  households integer not null default 0,
  delivery_points integer not null default 0,
  print_quantity integer not null default 0,
  print_cost_cents bigint not null default 0,
  postage_cents bigint not null default 0,
  service_cost_cents bigint not null default 0,
  total_price_cents bigint not null default 0,
  gross_margin_cents bigint not null default 0,
  cost_inputs jsonb not null default '{}'::jsonb,
  data_confidence public.map_data_confidence_enum not null default 'unavailable',
  created_at timestamptz not null default now()
);

create table if not exists public.campaign_overlap_calculations (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references public.campaign_map_plans(id) on delete cascade,
  political_geography_id uuid references public.political_geographies(id) on delete set null,
  usps_geography_id uuid references public.usps_geographies(id) on delete set null,
  political_geography_key text,
  usps_geography_key text,
  overlap_percentage numeric(6,3),
  overlap_method text not null default 'unknown',
  household_count integer,
  delivery_point_count integer,
  calculation_snapshot jsonb not null default '{}'::jsonb,
  data_confidence public.map_data_confidence_enum not null default 'unavailable',
  created_at timestamptz not null default now()
);

create table if not exists public.campaign_map_exports (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references public.campaign_map_plans(id) on delete cascade,
  export_type text not null check (export_type in ('csv', 'pdf', 'geojson', 'map_snapshot')),
  status text not null default 'queued' check (status in ('queued', 'ready', 'failed')),
  storage_path text,
  public_url text,
  error_message text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.campaign_map_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.map_selection_sessions(id) on delete cascade,
  plan_id uuid references public.campaign_map_plans(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  event_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.campaign_map_audit_log (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references public.campaign_map_plans(id) on delete cascade,
  session_id uuid references public.map_selection_sessions(id) on delete set null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  before_snapshot jsonb,
  after_snapshot jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.campaign_data_quality_flags (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references public.campaign_map_plans(id) on delete cascade,
  session_id uuid references public.map_selection_sessions(id) on delete cascade,
  source_id uuid references public.map_data_sources(id) on delete set null,
  flag_key text not null,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  data_confidence public.map_data_confidence_enum not null default 'unavailable',
  message text not null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.campaign_map_api_requirements (
  id uuid primary key default gen_random_uuid(),
  requirement_key text not null unique,
  source_name text not null,
  data_provided text not null,
  acquisition_type text not null,
  expected_format text,
  geographic_coverage text,
  update_frequency text,
  licensing_notes text,
  cost_estimate text,
  implementation_difficulty text check (implementation_difficulty in ('low', 'medium', 'high')),
  priority public.map_requirement_priority_enum not null default 'mvp',
  required_for_mvp boolean not null default false,
  status text not null default 'needed',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists political_geographies_state_type_idx on public.political_geographies (state, geography_type);
create index if not exists political_geographies_geoid_idx on public.political_geographies (geoid) where geoid is not null;
create index if not exists political_geographies_geom_idx on public.political_geographies using gist (geom) where geom is not null;
create index if not exists usps_geographies_state_zip_idx on public.usps_geographies (state, zip5);
create index if not exists usps_geographies_route_idx on public.usps_geographies (carrier_route_id) where carrier_route_id is not null;
create index if not exists usps_geographies_geom_idx on public.usps_geographies using gist (geom) where geom is not null;
create index if not exists map_selection_sessions_campaign_idx on public.map_selection_sessions (campaign_id) where campaign_id is not null;
create index if not exists campaign_map_plans_campaign_idx on public.campaign_map_plans (campaign_id) where campaign_id is not null;
create index if not exists campaign_map_plans_status_idx on public.campaign_map_plans (status);
create index if not exists campaign_selected_geographies_plan_idx on public.campaign_selected_geographies (plan_id);
create index if not exists campaign_selected_usps_routes_plan_idx on public.campaign_selected_usps_routes (plan_id);
create index if not exists campaign_overlap_plan_idx on public.campaign_overlap_calculations (plan_id);
create index if not exists campaign_map_events_session_idx on public.campaign_map_events (session_id);
create index if not exists campaign_quality_flags_plan_idx on public.campaign_data_quality_flags (plan_id);

do $$
declare
  table_name text;
  table_names text[] := array[
    'map_data_sources',
    'map_layer_sources',
    'map_source_requirements',
    'political_map_layers',
    'usps_map_layers',
    'political_geographies',
    'usps_geographies',
    'map_selection_sessions',
    'campaign_map_plans',
    'campaign_selected_geographies',
    'campaign_selected_usps_routes',
    'campaign_cost_estimates',
    'campaign_overlap_calculations',
    'campaign_map_exports',
    'campaign_map_events',
    'campaign_map_audit_log',
    'campaign_data_quality_flags',
    'campaign_map_api_requirements'
  ];
begin
  foreach table_name in array table_names loop
    execute format('alter table public.%I enable row level security', table_name);

    execute format('drop policy if exists %I on public.%I', table_name || '_admin_all', table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using ((auth.jwt() -> ''app_metadata'' ->> ''user_role'') = ''admin'') with check ((auth.jwt() -> ''app_metadata'' ->> ''user_role'') = ''admin'')',
      table_name || '_admin_all',
      table_name
    );

    execute format('drop policy if exists %I on public.%I', table_name || '_sales_read', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((auth.jwt() -> ''app_metadata'' ->> ''user_role'') in (''admin'', ''sales_agent''))',
      table_name || '_sales_read',
      table_name
    );
  end loop;
end $$;

insert into public.map_data_sources
  (source_key, source_name, category, provider, source_type, expected_format, geographic_coverage, update_frequency, licensing_notes, cost_estimate, implementation_difficulty, priority, required_for_mvp, data_confidence, homepage_url, notes)
values
  ('census_tiger_counties', 'Census TIGER/Line County Boundaries', 'boundary', 'U.S. Census Bureau', 'public', 'Shapefile/GeoJSON', 'United States', 'Annual', 'Public domain Census geography', 'Free', 'low', 'mvp', true, 'public_aggregate', 'https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html', 'Use for county/state base map.'),
  ('usps_eddm_routes', 'USPS EDDM Route Counts', 'usps', 'United States Postal Service', 'public', 'Web/export/manual import', 'United States where EDDM is available', 'Operator refresh', 'Review USPS terms and route tool usage limits', 'Free/manual', 'medium', 'mvp', true, 'estimated', 'https://eddm.usps.com/eddm/select-routes.htm', 'Counts and eligibility require refresh and source labels.'),
  ('licensed_carrier_route_polygons', 'Licensed USPS Carrier Route Polygons', 'usps', 'GIS data vendor', 'paid', 'Shapefile/GeoJSON', 'United States', 'Quarterly or annual', 'Vendor license required before production use', 'Paid subscription', 'high', 'mvp', true, 'paid_vendor_data', null, 'Needed for true polygon intersection.'),
  ('state_county_precincts', 'State and County Precinct Boundaries', 'political', 'State and county election offices', 'public', 'Shapefile/GeoJSON/CSV', 'Varies by state/county', 'Election cycle', 'Terms vary by jurisdiction', 'Free/manual', 'high', 'phase_2', false, 'public_aggregate', null, 'Needed for precinct overlay.'),
  ('aggregate_election_results', 'Aggregate Election Results', 'political', 'Secretary of State / County BOE', 'public', 'CSV/XLSX/PDF', 'Varies by state/county', 'Election cycle', 'Aggregate use only, no individual predictions', 'Free/manual', 'medium', 'phase_2', false, 'public_aggregate', null, 'Used only for geography-level color coding.')
on conflict (source_key) do update set
  source_name = excluded.source_name,
  category = excluded.category,
  provider = excluded.provider,
  source_type = excluded.source_type,
  expected_format = excluded.expected_format,
  geographic_coverage = excluded.geographic_coverage,
  update_frequency = excluded.update_frequency,
  licensing_notes = excluded.licensing_notes,
  cost_estimate = excluded.cost_estimate,
  implementation_difficulty = excluded.implementation_difficulty,
  priority = excluded.priority,
  required_for_mvp = excluded.required_for_mvp,
  data_confidence = excluded.data_confidence,
  homepage_url = excluded.homepage_url,
  notes = excluded.notes,
  updated_at = now();

insert into public.campaign_map_api_requirements
  (requirement_key, source_name, data_provided, acquisition_type, expected_format, geographic_coverage, update_frequency, licensing_notes, cost_estimate, implementation_difficulty, priority, required_for_mvp, status, notes)
values
  ('usps_carrier_route_boundaries', 'USPS carrier route polygon vendor', 'Carrier route polygons for spatial overlap', 'paid vendor or licensed file import', 'Shapefile/GeoJSON', 'United States', 'Quarterly or annual', 'License required before production use', 'Paid', 'high', 'mvp', true, 'needed', 'Required to replace demo USPS route cells.'),
  ('usps_delivery_counts', 'USPS EDDM / delivery count source', 'Residential/business delivery counts and exclusions', 'public/manual import or paid vendor', 'CSV/export', 'United States', 'Quarterly', 'USPS terms apply', 'Free to paid', 'medium', 'mvp', true, 'identified', 'Needed for exact household and postage quantities.'),
  ('precinct_boundaries', 'State/county BOE precinct files', 'Precinct, ward, and local district polygons', 'public file import', 'Shapefile/GeoJSON', 'State/county specific', 'Election cycle', 'Jurisdiction-specific terms', 'Free/manual', 'high', 'phase_2', false, 'needed', 'Needed for real precinct-to-route intersection.'),
  ('aggregate_results', 'Secretary of State / County BOE results', 'Aggregate election results by geography', 'public file import', 'CSV/XLSX/PDF', 'State/county specific', 'Election cycle', 'Aggregate only', 'Free/manual', 'medium', 'phase_2', false, 'needed', 'Used only for aggregate red/blue/gray display.'),
  ('postgis_spatial_engine', 'Supabase PostGIS extension', 'Server-side polygon intersection and overlap percentages', 'internal platform capability', 'SQL/geography', 'Internal', 'N/A', 'Enable and test extension safely', 'Included with Supabase plan when available', 'medium', 'mvp', true, 'needed', 'Needed for production-grade overlap calculations.')
on conflict (requirement_key) do update set
  source_name = excluded.source_name,
  data_provided = excluded.data_provided,
  acquisition_type = excluded.acquisition_type,
  expected_format = excluded.expected_format,
  geographic_coverage = excluded.geographic_coverage,
  update_frequency = excluded.update_frequency,
  licensing_notes = excluded.licensing_notes,
  cost_estimate = excluded.cost_estimate,
  implementation_difficulty = excluded.implementation_difficulty,
  priority = excluded.priority,
  required_for_mvp = excluded.required_for_mvp,
  status = excluded.status,
  notes = excluded.notes,
  updated_at = now();
