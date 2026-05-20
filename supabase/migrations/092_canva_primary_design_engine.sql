-- 092_canva_primary_design_engine.sql
-- Additive Canva integration tables for HomeReach Design OS.
-- Does not modify intake, payments, political routes, dashboards, auth, or webhook tables.

create table if not exists public.canva_connections (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  canva_user_id text,
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  scopes text[] not null default '{}',
  status text not null default 'connected',
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_user_id)
);

create table if not exists public.canva_template_registry (
  id uuid primary key default gen_random_uuid(),
  template_key text not null unique,
  template_label text not null,
  canva_brand_template_id text,
  use_case text not null,
  required_fields jsonb not null default '[]'::jsonb,
  export_types text[] not null default '{}',
  status text not null default 'needs_template_id',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.canva_design_jobs (
  id uuid primary key default gen_random_uuid(),
  source_system text not null,
  source_record_id text,
  context text not null,
  template_key text not null,
  canva_brand_template_id text,
  canva_design_id text,
  canva_autofill_job_id text,
  title text not null,
  autofill_payload jsonb not null default '{}'::jsonb,
  status text not null default 'planned',
  dry_run boolean not null default true,
  error_message text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.canva_export_jobs (
  id uuid primary key default gen_random_uuid(),
  canva_design_job_id uuid references public.canva_design_jobs(id) on delete cascade,
  canva_export_job_id text,
  canva_design_id text,
  export_type text not null,
  export_url text,
  export_url_expires_at timestamptz,
  status text not null default 'planned',
  error_message text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.canva_connections enable row level security;
alter table public.canva_template_registry enable row level security;
alter table public.canva_design_jobs enable row level security;
alter table public.canva_export_jobs enable row level security;

drop policy if exists "canva_connections_admin_read" on public.canva_connections;
create policy "canva_connections_admin_read"
  on public.canva_connections for select
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');

drop policy if exists "canva_connections_owner_read" on public.canva_connections;
create policy "canva_connections_owner_read"
  on public.canva_connections for select
  using (owner_user_id = auth.uid());

drop policy if exists "canva_template_registry_admin_all" on public.canva_template_registry;
create policy "canva_template_registry_admin_all"
  on public.canva_template_registry for all
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');

drop policy if exists "canva_design_jobs_admin_all" on public.canva_design_jobs;
create policy "canva_design_jobs_admin_all"
  on public.canva_design_jobs for all
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');

drop policy if exists "canva_export_jobs_admin_all" on public.canva_export_jobs;
create policy "canva_export_jobs_admin_all"
  on public.canva_export_jobs for all
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');

insert into public.canva_template_registry (
  template_key,
  template_label,
  use_case,
  required_fields,
  export_types,
  status
) values
  ('political_statewide_deck', 'Political Statewide Campaign Deck', 'political_deck', '["candidate_name","race_name","strategy_title","targeting_summary","phase_table","cost_summary"]', '{"pdf","pptx","png"}', 'needs_template_id'),
  ('political_postcard_front_back', 'Political Postcard Front/Back', 'campaign_postcard', '["headline","subheadline","body_copy","cta","disclaimer","qr_url","candidate_name"]', '{"pdf","png","jpg"}', 'needs_template_id'),
  ('shared_postcard_business_spot', 'Shared Postcard Business Spot', 'business_postcard', '["business_name","headline","offer","phone","website","logo_or_image"]', '{"pdf","png","jpg"}', 'needs_template_id'),
  ('campaign_proposal', 'Campaign Proposal Presentation', 'proposal_deck', '["client_name","campaign_goal","geography","quantity","price","timeline"]', '{"pdf","pptx"}', 'needs_template_id'),
  ('route_saturation_report', 'Route Saturation Report', 'map_report', '["map_image","route_table","household_count","coverage_percent","risk_notes"]', '{"pdf","png"}', 'needs_template_id'),
  ('dashboard_visual_card', 'Dashboard Visual Card', 'dashboard_visual', '["metric_label","metric_value","status","supporting_context"]', '{"png","jpg"}', 'needs_template_id')
on conflict (template_key) do nothing;
