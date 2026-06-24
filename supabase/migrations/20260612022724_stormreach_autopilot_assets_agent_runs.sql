create table if not exists public.storm_generated_assets (
  id uuid primary key default gen_random_uuid(),
  storm_event_id uuid not null references public.storm_events(id) on delete cascade,
  marketing_package_id uuid references public.storm_marketing_packages(id) on delete set null,
  asset_type text not null check (asset_type in (
    'storm_opportunity_image',
    'social_image_16x9',
    'social_image_1080x1350',
    'pdf_one_pager',
    'word_export',
    'excel_export',
    'campaign_summary'
  )),
  title text not null,
  format text not null default 'svg',
  status text not null default 'generated' check (status in ('draft', 'generated', 'failed', 'archived')),
  approval_status text not null default 'needs_review' check (approval_status in ('draft', 'needs_review', 'approved', 'rejected', 'archived')),
  storage_bucket text,
  storage_path text,
  public_url text,
  content_text text not null default '',
  asset_payload jsonb not null default '{}'::jsonb,
  source_data jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  generated_by text not null default 'StormReach Agent',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create unique index if not exists storm_generated_assets_event_asset_format_uidx
  on public.storm_generated_assets(storm_event_id, asset_type, format)
  where status <> 'archived';
create index if not exists storm_generated_assets_event_status_idx
  on public.storm_generated_assets(storm_event_id, status, created_at desc);
create index if not exists storm_generated_assets_type_idx
  on public.storm_generated_assets(asset_type, approval_status, created_at desc);

create table if not exists public.storm_agent_runs (
  id uuid primary key default gen_random_uuid(),
  run_key text not null unique,
  run_type text not null default 'autopilot_4h',
  agent_name text not null default 'StormReach Agent',
  status text not null default 'started' check (status in ('started', 'completed', 'warning', 'failed')),
  state text,
  started_at timestamptz not null default timezone('utc'::text, now()),
  completed_at timestamptz,
  events_seen integer not null default 0,
  events_upserted integer not null default 0,
  events_qualified integer not null default 0,
  prospects_created integer not null default 0,
  outreach_drafts_created integer not null default 0,
  assets_created integer not null default 0,
  campaigns_created integer not null default 0,
  errors text[] not null default '{}',
  summary text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists storm_agent_runs_type_status_idx
  on public.storm_agent_runs(run_type, status, started_at desc);
create index if not exists storm_agent_runs_state_idx
  on public.storm_agent_runs(state, started_at desc);

create table if not exists public.storm_campaigns (
  id uuid primary key default gen_random_uuid(),
  storm_event_id uuid not null references public.storm_events(id) on delete cascade,
  marketing_package_id uuid references public.storm_marketing_packages(id) on delete set null,
  campaign_name text not null,
  campaign_type text not null default 'storm_autopilot' check (campaign_type in ('geofence', 'postcard', 'combined', 'storm_autopilot')),
  status text not null default 'draft' check (status in ('draft', 'needs_review', 'approved', 'ready_to_launch', 'launched', 'won', 'lost', 'archived')),
  approval_status text not null default 'needs_review' check (approval_status in ('draft', 'needs_review', 'approved', 'rejected', 'archived')),
  opportunity_level text not null default 'Watch' check (opportunity_level in ('Critical', 'High', 'Medium', 'Watch')),
  estimated_value_cents integer not null default 0,
  recommended_mail_quantity integer not null default 0,
  geofence_radius_miles numeric(6,2) not null default 25,
  owner_user_id uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create unique index if not exists storm_campaigns_event_type_active_uidx
  on public.storm_campaigns(storm_event_id, campaign_type)
  where status <> 'archived';
create index if not exists storm_campaigns_status_idx
  on public.storm_campaigns(status, approval_status, created_at desc);
create index if not exists storm_campaigns_level_idx
  on public.storm_campaigns(opportunity_level, created_at desc);

alter table public.storm_generated_assets enable row level security;
alter table public.storm_agent_runs enable row level security;
alter table public.storm_campaigns enable row level security;

grant select, insert, update, delete on public.storm_generated_assets to authenticated, service_role;
grant select, insert, update, delete on public.storm_agent_runs to authenticated, service_role;
grant select, insert, update, delete on public.storm_campaigns to authenticated, service_role;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['storm_generated_assets', 'storm_agent_runs', 'storm_campaigns']
  loop
    execute format('drop policy if exists %I on public.%I', table_name || '_service_all', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_admin_select', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_sales_select', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_admin_write', table_name);

    execute format('create policy %I on public.%I for all to service_role using (true) with check (true)', table_name || '_service_all', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((auth.jwt() -> %L ->> %L) = %L)',
      table_name || '_admin_select',
      table_name,
      'app_metadata',
      'user_role',
      'admin'
    );
    execute format(
      'create policy %I on public.%I for select to authenticated using ((auth.jwt() -> %L ->> %L) = %L)',
      table_name || '_sales_select',
      table_name,
      'app_metadata',
      'user_role',
      'sales_agent'
    );
    execute format(
      'create policy %I on public.%I for all to authenticated using ((auth.jwt() -> %L ->> %L) = %L) with check ((auth.jwt() -> %L ->> %L) = %L)',
      table_name || '_admin_write',
      table_name,
      'app_metadata',
      'user_role',
      'admin',
      'app_metadata',
      'user_role',
      'admin'
    );
  end loop;
end $$;

comment on table public.storm_generated_assets is 'HomeReach StormReach Autopilot generated images, one-pagers, and export artifacts. Approval required before external use.';
comment on table public.storm_agent_runs is 'StormReach Agent autonomous run ledger for 4-hour severe-weather opportunity sweeps.';
comment on table public.storm_campaigns is 'StormReach Autopilot campaign tracking records that coordinate geofence, postcard, proposal, and outreach package status.';
