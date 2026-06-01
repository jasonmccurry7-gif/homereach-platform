create extension if not exists pgcrypto;

create table if not exists public.campaign_drafts (
  id uuid primary key default gen_random_uuid(),
  market_capture_campaign_id uuid references public.market_capture_campaigns(id) on delete cascade,
  digital_targeting_campaign_id uuid,
  client_id uuid references public.profiles(id) on delete set null,
  client_email text,
  platform text not null check (platform in ('meta', 'google', 'manual')),
  draft_type text not null check (draft_type in ('campaign', 'ad_set', 'audience', 'creative', 'tracking', 'budget', 'location_target')),
  name text not null,
  objective text,
  status text not null default 'draft_created' check (status in ('draft_created', 'needs_review', 'awaiting_approval', 'ready_for_launch', 'archived', 'launch_completed_manually')),
  summary text,
  payload jsonb not null default '{}'::jsonb,
  reviewed_by text,
  reviewed_at timestamptz,
  ready_at timestamptz,
  archived_at timestamptz,
  created_by text not null default 'ad_tech_integration_layer',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campaign_geocodes (
  id uuid primary key default gen_random_uuid(),
  market_capture_campaign_id uuid references public.market_capture_campaigns(id) on delete cascade,
  digital_targeting_campaign_id uuid,
  location_id uuid,
  client_id uuid references public.profiles(id) on delete set null,
  client_email text,
  location_type text not null default 'custom_area',
  input_address text,
  normalized_address text,
  place_id text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  radius_miles numeric(6,2),
  validation_status text not null default 'warning' check (validation_status in ('valid', 'warning', 'invalid')),
  validation_message text,
  provider text not null default 'manual_validation',
  provider_payload jsonb not null default '{}'::jsonb,
  created_by text not null default 'ad_tech_integration_layer',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campaign_target_validation (
  id uuid primary key default gen_random_uuid(),
  market_capture_campaign_id uuid references public.market_capture_campaigns(id) on delete cascade,
  digital_targeting_campaign_id uuid,
  geocode_id uuid references public.campaign_geocodes(id) on delete cascade,
  client_id uuid references public.profiles(id) on delete set null,
  client_email text,
  target_label text not null,
  target_type text not null default 'custom_area',
  status text not null default 'warning' check (status in ('valid', 'warning', 'invalid')),
  address_exists boolean not null default false,
  zip_exists boolean not null default false,
  geography_valid boolean not null default false,
  radius_reasonable boolean not null default true,
  duplicate_location boolean not null default false,
  linked_to_campaign boolean not null default true,
  warnings text[] not null default '{}'::text[],
  errors text[] not null default '{}'::text[],
  recommended_action text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campaign_launch_packages (
  id uuid primary key default gen_random_uuid(),
  market_capture_campaign_id uuid references public.market_capture_campaigns(id) on delete cascade,
  digital_targeting_campaign_id uuid,
  client_id uuid references public.profiles(id) on delete set null,
  client_email text,
  package_name text not null,
  package_status text not null default 'draft_created' check (package_status in ('draft_created', 'needs_review', 'awaiting_client_approval', 'awaiting_admin_approval', 'ready_for_launch', 'launch_completed_manually', 'archived')),
  campaign_summary text not null,
  target_areas jsonb not null default '[]'::jsonb,
  budget_summary jsonb not null default '{}'::jsonb,
  creative_summary jsonb not null default '{}'::jsonb,
  tracking_urls jsonb not null default '[]'::jsonb,
  landing_page_url text,
  launch_checklist jsonb not null default '[]'::jsonb,
  missing_items text[] not null default '{}'::text[],
  readiness_score integer not null default 0 check (readiness_score >= 0 and readiness_score <= 100),
  ready_status text not null default 'not_ready' check (ready_status in ('ready', 'not_ready')),
  recommended_next_action text,
  client_approval_status text not null default 'awaiting_approval',
  admin_approval_status text not null default 'needs_review',
  approved_for_launch_by text,
  approved_for_launch_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campaign_approvals (
  id uuid primary key default gen_random_uuid(),
  market_capture_campaign_id uuid references public.market_capture_campaigns(id) on delete cascade,
  digital_targeting_campaign_id uuid,
  launch_package_id uuid references public.campaign_launch_packages(id) on delete cascade,
  campaign_draft_id uuid references public.campaign_drafts(id) on delete set null,
  client_id uuid references public.profiles(id) on delete set null,
  client_email text,
  approval_type text not null check (approval_type in ('campaign', 'creative', 'geography', 'budget', 'launch_package', 'tracking')),
  status text not null default 'awaiting_approval' check (status in ('awaiting_approval', 'approved', 'needs_changes', 'rejected', 'question')),
  requested_by text not null default 'ad_tech_integration_layer',
  approver_user_id uuid references public.profiles(id) on delete set null,
  approver_name text,
  approver_email text,
  notes text,
  revision_notes text,
  responded_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campaign_launch_history (
  id uuid primary key default gen_random_uuid(),
  market_capture_campaign_id uuid references public.market_capture_campaigns(id) on delete cascade,
  digital_targeting_campaign_id uuid,
  launch_package_id uuid references public.campaign_launch_packages(id) on delete set null,
  client_id uuid references public.profiles(id) on delete set null,
  client_email text,
  event_type text not null default 'manual_launch_note',
  platform text not null default 'manual',
  status text not null default 'recorded',
  actor_user_id uuid references public.profiles(id) on delete set null,
  actor_role text,
  summary text not null,
  budget_snapshot jsonb not null default '{}'::jsonb,
  creative_snapshot jsonb not null default '{}'::jsonb,
  target_area_snapshot jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.campaign_reporting_imports (
  id uuid primary key default gen_random_uuid(),
  market_capture_campaign_id uuid references public.market_capture_campaigns(id) on delete cascade,
  digital_targeting_campaign_id uuid,
  client_id uuid references public.profiles(id) on delete set null,
  client_email text,
  source text not null default 'manual' check (source in ('manual', 'future_api', 'csv', 'platform')),
  platform text not null default 'manual',
  reporting_period_start date,
  reporting_period_end date,
  impressions integer not null default 0,
  reach integer not null default 0,
  clicks integer not null default 0,
  ctr numeric(8,4) not null default 0,
  spend integer not null default 0,
  leads integer not null default 0,
  calls integer not null default 0,
  forms integer not null default 0,
  landing_page_visits integer not null default 0,
  qr_scans integer not null default 0,
  cost_per_click integer not null default 0,
  cost_per_lead integer not null default 0,
  campaign_notes text,
  recommendations text,
  import_status text not null default 'manual_entry' check (import_status in ('manual_entry', 'pending_review', 'imported', 'failed', 'archived')),
  imported_by text not null default 'admin',
  raw_payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campaign_attribution (
  id uuid primary key default gen_random_uuid(),
  market_capture_campaign_id uuid references public.market_capture_campaigns(id) on delete cascade,
  digital_targeting_campaign_id uuid,
  reporting_import_id uuid references public.campaign_reporting_imports(id) on delete set null,
  client_id uuid references public.profiles(id) on delete set null,
  client_email text,
  source text not null default 'manual',
  medium text,
  landing_page_url text,
  qr_scan_id text,
  lead_id uuid references public.leads(id) on delete set null,
  call_reference text,
  form_reference text,
  conversion_type text,
  conversion_notes text,
  confidence text not null default 'observed' check (confidence in ('observed', 'estimated', 'unknown')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.integration_health (
  id uuid primary key default gen_random_uuid(),
  integration_key text not null unique,
  integration_name text not null,
  status text not null default 'not_configured' check (status in ('ready', 'degraded', 'not_configured', 'disabled', 'error')),
  api_key_status text not null default 'missing',
  last_sync_at timestamptz,
  warnings text[] not null default '{}'::text[],
  errors text[] not null default '{}'::text[],
  feature_flag_status jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists campaign_drafts_campaign_idx on public.campaign_drafts(market_capture_campaign_id, platform, status, updated_at);
create index if not exists campaign_drafts_client_idx on public.campaign_drafts(client_id, status, updated_at);
create index if not exists campaign_geocodes_campaign_idx on public.campaign_geocodes(market_capture_campaign_id, validation_status, updated_at);
create index if not exists campaign_target_validation_campaign_idx on public.campaign_target_validation(market_capture_campaign_id, status, updated_at);
create index if not exists campaign_launch_packages_campaign_idx on public.campaign_launch_packages(market_capture_campaign_id, package_status, readiness_score, updated_at);
create index if not exists campaign_approvals_campaign_idx on public.campaign_approvals(market_capture_campaign_id, approval_type, status, updated_at);
create index if not exists campaign_launch_history_campaign_idx on public.campaign_launch_history(market_capture_campaign_id, created_at);
create index if not exists campaign_reporting_imports_campaign_idx on public.campaign_reporting_imports(market_capture_campaign_id, reporting_period_end, platform);
create index if not exists campaign_attribution_campaign_idx on public.campaign_attribution(market_capture_campaign_id, source, created_at);
create index if not exists integration_health_status_idx on public.integration_health(status, updated_at);

alter table public.campaign_drafts enable row level security;
alter table public.campaign_geocodes enable row level security;
alter table public.campaign_target_validation enable row level security;
alter table public.campaign_launch_packages enable row level security;
alter table public.campaign_approvals enable row level security;
alter table public.campaign_launch_history enable row level security;
alter table public.campaign_reporting_imports enable row level security;
alter table public.campaign_attribution enable row level security;
alter table public.integration_health enable row level security;

grant select, insert, update, delete on public.campaign_drafts to authenticated, service_role;
grant select, insert, update, delete on public.campaign_geocodes to authenticated, service_role;
grant select, insert, update, delete on public.campaign_target_validation to authenticated, service_role;
grant select, insert, update, delete on public.campaign_launch_packages to authenticated, service_role;
grant select, insert, update, delete on public.campaign_approvals to authenticated, service_role;
grant select, insert, update, delete on public.campaign_launch_history to authenticated, service_role;
grant select, insert, update, delete on public.campaign_reporting_imports to authenticated, service_role;
grant select, insert, update, delete on public.campaign_attribution to authenticated, service_role;
grant select, insert, update, delete on public.integration_health to authenticated, service_role;

create policy "campaign_drafts_service_role_all" on public.campaign_drafts for all to service_role using (true) with check (true);
create policy "campaign_geocodes_service_role_all" on public.campaign_geocodes for all to service_role using (true) with check (true);
create policy "campaign_target_validation_service_role_all" on public.campaign_target_validation for all to service_role using (true) with check (true);
create policy "campaign_launch_packages_service_role_all" on public.campaign_launch_packages for all to service_role using (true) with check (true);
create policy "campaign_approvals_service_role_all" on public.campaign_approvals for all to service_role using (true) with check (true);
create policy "campaign_launch_history_service_role_all" on public.campaign_launch_history for all to service_role using (true) with check (true);
create policy "campaign_reporting_imports_service_role_all" on public.campaign_reporting_imports for all to service_role using (true) with check (true);
create policy "campaign_attribution_service_role_all" on public.campaign_attribution for all to service_role using (true) with check (true);
create policy "integration_health_service_role_all" on public.integration_health for all to service_role using (true) with check (true);

create policy "campaign_drafts_admin_all" on public.campaign_drafts for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') in ('admin', 'sales_agent'))
  with check ((auth.jwt() -> 'app_metadata' ->> 'user_role') in ('admin', 'sales_agent'));
create policy "campaign_geocodes_admin_all" on public.campaign_geocodes for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') in ('admin', 'sales_agent'))
  with check ((auth.jwt() -> 'app_metadata' ->> 'user_role') in ('admin', 'sales_agent'));
create policy "campaign_target_validation_admin_all" on public.campaign_target_validation for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') in ('admin', 'sales_agent'))
  with check ((auth.jwt() -> 'app_metadata' ->> 'user_role') in ('admin', 'sales_agent'));
create policy "campaign_launch_packages_admin_all" on public.campaign_launch_packages for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') in ('admin', 'sales_agent'))
  with check ((auth.jwt() -> 'app_metadata' ->> 'user_role') in ('admin', 'sales_agent'));
create policy "campaign_approvals_admin_all" on public.campaign_approvals for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') in ('admin', 'sales_agent'))
  with check ((auth.jwt() -> 'app_metadata' ->> 'user_role') in ('admin', 'sales_agent'));
create policy "campaign_launch_history_admin_all" on public.campaign_launch_history for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') in ('admin', 'sales_agent'))
  with check ((auth.jwt() -> 'app_metadata' ->> 'user_role') in ('admin', 'sales_agent'));
create policy "campaign_reporting_imports_admin_all" on public.campaign_reporting_imports for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') in ('admin', 'sales_agent'))
  with check ((auth.jwt() -> 'app_metadata' ->> 'user_role') in ('admin', 'sales_agent'));
create policy "campaign_attribution_admin_all" on public.campaign_attribution for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') in ('admin', 'sales_agent'))
  with check ((auth.jwt() -> 'app_metadata' ->> 'user_role') in ('admin', 'sales_agent'));
create policy "integration_health_admin_all" on public.integration_health for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') in ('admin', 'sales_agent'))
  with check ((auth.jwt() -> 'app_metadata' ->> 'user_role') in ('admin', 'sales_agent'));

create policy "campaign_drafts_client_select" on public.campaign_drafts for select to authenticated
  using (client_id = auth.uid() or lower(coalesce(client_email, '')) = lower(coalesce(auth.jwt() ->> 'email', '')));
create policy "campaign_geocodes_client_select" on public.campaign_geocodes for select to authenticated
  using (client_id = auth.uid() or lower(coalesce(client_email, '')) = lower(coalesce(auth.jwt() ->> 'email', '')));
create policy "campaign_target_validation_client_select" on public.campaign_target_validation for select to authenticated
  using (client_id = auth.uid() or lower(coalesce(client_email, '')) = lower(coalesce(auth.jwt() ->> 'email', '')));
create policy "campaign_launch_packages_client_select" on public.campaign_launch_packages for select to authenticated
  using (client_id = auth.uid() or lower(coalesce(client_email, '')) = lower(coalesce(auth.jwt() ->> 'email', '')));
create policy "campaign_approvals_client_select" on public.campaign_approvals for select to authenticated
  using (client_id = auth.uid() or lower(coalesce(client_email, '')) = lower(coalesce(auth.jwt() ->> 'email', '')));
create policy "campaign_launch_history_client_select" on public.campaign_launch_history for select to authenticated
  using (client_id = auth.uid() or lower(coalesce(client_email, '')) = lower(coalesce(auth.jwt() ->> 'email', '')));
create policy "campaign_reporting_imports_client_select" on public.campaign_reporting_imports for select to authenticated
  using (client_id = auth.uid() or lower(coalesce(client_email, '')) = lower(coalesce(auth.jwt() ->> 'email', '')));
create policy "campaign_attribution_client_select" on public.campaign_attribution for select to authenticated
  using (client_id = auth.uid() or lower(coalesce(client_email, '')) = lower(coalesce(auth.jwt() ->> 'email', '')));

comment on table public.campaign_drafts is 'Phase 7 ad-tech draft records only. These records must never create or publish paid ads without explicit human approval.';
comment on table public.campaign_launch_packages is 'Phase 7 Launch Package records. Ready status means operationally ready for manual/admin review, not auto-launched.';
comment on table public.campaign_reporting_imports is 'Manual and future reporting import framework. Metrics must not imply attribution certainty where unavailable.';
comment on table public.campaign_attribution is 'Lightweight attribution notes. Do not claim deterministic attribution unless source data proves it.';
comment on table public.integration_health is 'Integration health and feature flag observability. Missing API keys degrade workflow to manual mode.';
