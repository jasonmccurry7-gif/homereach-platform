-- Market Capture Fulfillment Engine MVP
-- Phase 1B adds fulfillment, launch readiness, approvals, direct mail tracking,
-- and manual reporting foundations. It intentionally does not add Meta/Google
-- API launch, Business Memory, AI COO, Growth Intelligence, or automation.

alter table public.market_capture_pipeline
  drop constraint if exists market_capture_pipeline_stage_check;
alter table public.market_capture_pipeline
  add constraint market_capture_pipeline_stage_check check (stage in (
    'new_lead',
    'intake_complete',
    'needs_review',
    'payment_pending',
    'qualified',
    'ready_for_fulfillment',
    'campaign_setup',
    'asset_collection',
    'creative_review',
    'client_approval',
    'ready_for_launch',
    'live',
    'reporting',
    'renewal_opportunity',
    'closed',
    'closed_lost',
    'closed_won'
  ));
alter table public.market_capture_tasks
  add column if not exists task_type text not null default 'sales',
  add column if not exists priority text not null default 'normal',
  add column if not exists assigned_role text,
  add column if not exists completion_history jsonb not null default '[]'::jsonb;
alter table public.market_capture_assets
  add column if not exists approval_status text not null default 'awaiting_review',
  add column if not exists reviewed_by text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists rejection_reason text,
  add column if not exists client_visible boolean not null default true;
create table if not exists public.market_capture_campaigns (
  id uuid primary key default gen_random_uuid(),
  market_capture_lead_id uuid not null references public.market_capture_leads(id) on delete cascade,
  pipeline_id uuid references public.market_capture_pipeline(id) on delete set null,
  client_id uuid references public.profiles(id) on delete set null,
  campaign_name text not null,
  campaign_status text not null default 'campaign_setup' check (campaign_status in (
    'ready_for_fulfillment',
    'campaign_setup',
    'asset_collection',
    'creative_review',
    'client_approval',
    'ready_for_launch',
    'live',
    'reporting',
    'renewal_opportunity',
    'closed'
  )),
  launch_status text not null default 'not_started' check (launch_status in (
    'not_started',
    'blocked',
    'ready',
    'manual_launch_complete',
    'live',
    'paused',
    'complete'
  )),
  direct_mail_status text not null default 'not_requested' check (direct_mail_status in (
    'not_requested',
    'requested',
    'proposed',
    'approved',
    'in_production',
    'delivered'
  )),
  creative_status text not null default 'missing' check (creative_status in (
    'missing',
    'uploaded',
    'needs_review',
    'approved',
    'rejected'
  )),
  approval_status text not null default 'awaiting_approval' check (approval_status in (
    'awaiting_approval',
    'approved',
    'needs_revision',
    'rejected'
  )),
  reporting_status text not null default 'not_started' check (reporting_status in (
    'not_started',
    'scheduled',
    'due',
    'submitted'
  )),
  target_geography text,
  radius_miles numeric(6,2),
  monthly_ad_budget integer not null default 0,
  monthly_management_fee integer not null default 49900,
  payment_status text not null default 'payment_required',
  landing_page_url text,
  tracking_url text,
  owner text not null default 'jason',
  reviewer text,
  designer text,
  account_manager text,
  next_best_action text not null default 'Review intake and validate target area',
  notes text,
  direct_mail_requested boolean not null default false,
  direct_mail_quantity integer,
  direct_mail_estimated_cost_cents integer,
  direct_mail_notes text,
  launch_date date,
  report_due_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (market_capture_lead_id)
);
create table if not exists public.market_capture_campaign_locations (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.market_capture_campaigns(id) on delete cascade,
  location_type text not null default 'custom_area' check (location_type in (
    'target_geography',
    'jobsite',
    'competitor',
    'service_area',
    'political_geography',
    'event',
    'custom_area'
  )),
  name text not null,
  address text,
  radius_miles numeric(6,2),
  latitude numeric(10,7),
  longitude numeric(10,7),
  notes text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.market_capture_checklists (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.market_capture_campaigns(id) on delete cascade,
  title text not null,
  owner text not null default 'jason',
  status text not null default 'open' check (status in ('open','in_progress','completed','blocked','cancelled')),
  due_date timestamptz,
  completed_at timestamptz,
  notes text,
  completion_history jsonb not null default '[]'::jsonb,
  item_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, title)
);
create table if not exists public.market_capture_approvals (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.market_capture_campaigns(id) on delete cascade,
  approval_type text not null default 'creative',
  status text not null default 'awaiting_approval' check (status in (
    'awaiting_approval',
    'approved',
    'needs_revision',
    'rejected'
  )),
  client_name text,
  client_email text,
  content_summary text,
  requested_at timestamptz not null default now(),
  responded_at timestamptz,
  notes text,
  revision_notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.market_capture_reports (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.market_capture_campaigns(id) on delete cascade,
  reporting_period_start date,
  reporting_period_end date,
  impressions integer not null default 0,
  reach integer not null default 0,
  clicks integer not null default 0,
  ctr numeric(8,4) not null default 0,
  spend integer not null default 0,
  leads integer not null default 0,
  calls integer not null default 0,
  landing_page_visits integer not null default 0,
  qr_scans integer not null default 0,
  direct_mail_quantity integer not null default 0,
  notes text,
  recommendations text,
  created_by text not null default 'admin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.market_capture_launch_readiness (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.market_capture_campaigns(id) on delete cascade,
  readiness_score integer not null default 0 check (readiness_score >= 0 and readiness_score <= 100),
  payment_ready boolean not null default false,
  target_area_ready boolean not null default false,
  assets_ready boolean not null default false,
  creative_ready boolean not null default false,
  approval_ready boolean not null default false,
  tracking_ready boolean not null default false,
  checklist_ready boolean not null default false,
  missing_items jsonb not null default '[]'::jsonb,
  recommended_next_action text not null default 'Review intake and validate target area',
  calculated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id)
);
create index if not exists market_capture_campaigns_status_idx
  on public.market_capture_campaigns (campaign_status, launch_status, updated_at desc);
create index if not exists market_capture_campaigns_owner_idx
  on public.market_capture_campaigns (owner, campaign_status, updated_at desc);
create index if not exists market_capture_campaigns_direct_mail_idx
  on public.market_capture_campaigns (direct_mail_status, direct_mail_requested);
create index if not exists market_capture_locations_campaign_idx
  on public.market_capture_campaign_locations (campaign_id, location_type);
create index if not exists market_capture_checklists_campaign_idx
  on public.market_capture_checklists (campaign_id, status, item_order);
create index if not exists market_capture_approvals_campaign_idx
  on public.market_capture_approvals (campaign_id, status, requested_at desc);
create index if not exists market_capture_reports_campaign_idx
  on public.market_capture_reports (campaign_id, reporting_period_end desc);
create index if not exists market_capture_readiness_campaign_idx
  on public.market_capture_launch_readiness (campaign_id, readiness_score);
create index if not exists market_capture_tasks_type_idx
  on public.market_capture_tasks (task_type, status, due_date);
create index if not exists market_capture_assets_approval_idx
  on public.market_capture_assets (approval_status, status, created_at desc);
alter table public.market_capture_campaigns enable row level security;
alter table public.market_capture_campaign_locations enable row level security;
alter table public.market_capture_checklists enable row level security;
alter table public.market_capture_approvals enable row level security;
alter table public.market_capture_reports enable row level security;
alter table public.market_capture_launch_readiness enable row level security;
grant select, insert, update, delete on
  public.market_capture_campaigns,
  public.market_capture_campaign_locations,
  public.market_capture_checklists,
  public.market_capture_approvals,
  public.market_capture_reports,
  public.market_capture_launch_readiness
to authenticated;
grant all on
  public.market_capture_campaigns,
  public.market_capture_campaign_locations,
  public.market_capture_checklists,
  public.market_capture_approvals,
  public.market_capture_reports,
  public.market_capture_launch_readiness
to service_role;
drop policy if exists market_capture_campaigns_service on public.market_capture_campaigns;
create policy market_capture_campaigns_service
  on public.market_capture_campaigns for all to service_role
  using (true) with check (true);
drop policy if exists market_capture_campaigns_admin_all on public.market_capture_campaigns;
create policy market_capture_campaigns_admin_all
  on public.market_capture_campaigns for all to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'))
  with check ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));
drop policy if exists market_capture_campaigns_client_select on public.market_capture_campaigns;
create policy market_capture_campaigns_client_select
  on public.market_capture_campaigns for select to authenticated
  using (exists (
    select 1 from public.market_capture_leads l
    where l.id = market_capture_lead_id
      and (l.client_id = auth.uid() or lower(l.email) = lower(coalesce(auth.jwt()->>'email', '')))
  ));
drop policy if exists market_capture_locations_service on public.market_capture_campaign_locations;
create policy market_capture_locations_service
  on public.market_capture_campaign_locations for all to service_role
  using (true) with check (true);
drop policy if exists market_capture_locations_admin_all on public.market_capture_campaign_locations;
create policy market_capture_locations_admin_all
  on public.market_capture_campaign_locations for all to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'))
  with check ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));
drop policy if exists market_capture_locations_client_select on public.market_capture_campaign_locations;
create policy market_capture_locations_client_select
  on public.market_capture_campaign_locations for select to authenticated
  using (exists (
    select 1
    from public.market_capture_campaigns c
    join public.market_capture_leads l on l.id = c.market_capture_lead_id
    where c.id = campaign_id
      and (l.client_id = auth.uid() or lower(l.email) = lower(coalesce(auth.jwt()->>'email', '')))
  ));
drop policy if exists market_capture_checklists_service on public.market_capture_checklists;
create policy market_capture_checklists_service
  on public.market_capture_checklists for all to service_role
  using (true) with check (true);
drop policy if exists market_capture_checklists_admin_all on public.market_capture_checklists;
create policy market_capture_checklists_admin_all
  on public.market_capture_checklists for all to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'))
  with check ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));
drop policy if exists market_capture_checklists_client_select on public.market_capture_checklists;
create policy market_capture_checklists_client_select
  on public.market_capture_checklists for select to authenticated
  using (exists (
    select 1
    from public.market_capture_campaigns c
    join public.market_capture_leads l on l.id = c.market_capture_lead_id
    where c.id = campaign_id
      and (l.client_id = auth.uid() or lower(l.email) = lower(coalesce(auth.jwt()->>'email', '')))
  ));
drop policy if exists market_capture_approvals_service on public.market_capture_approvals;
create policy market_capture_approvals_service
  on public.market_capture_approvals for all to service_role
  using (true) with check (true);
drop policy if exists market_capture_approvals_admin_all on public.market_capture_approvals;
create policy market_capture_approvals_admin_all
  on public.market_capture_approvals for all to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'))
  with check ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));
drop policy if exists market_capture_approvals_client_select on public.market_capture_approvals;
create policy market_capture_approvals_client_select
  on public.market_capture_approvals for select to authenticated
  using (exists (
    select 1
    from public.market_capture_campaigns c
    join public.market_capture_leads l on l.id = c.market_capture_lead_id
    where c.id = campaign_id
      and (l.client_id = auth.uid() or lower(l.email) = lower(coalesce(auth.jwt()->>'email', '')))
  ));
drop policy if exists market_capture_reports_service on public.market_capture_reports;
create policy market_capture_reports_service
  on public.market_capture_reports for all to service_role
  using (true) with check (true);
drop policy if exists market_capture_reports_admin_all on public.market_capture_reports;
create policy market_capture_reports_admin_all
  on public.market_capture_reports for all to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'))
  with check ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));
drop policy if exists market_capture_reports_client_select on public.market_capture_reports;
create policy market_capture_reports_client_select
  on public.market_capture_reports for select to authenticated
  using (exists (
    select 1
    from public.market_capture_campaigns c
    join public.market_capture_leads l on l.id = c.market_capture_lead_id
    where c.id = campaign_id
      and (l.client_id = auth.uid() or lower(l.email) = lower(coalesce(auth.jwt()->>'email', '')))
  ));
drop policy if exists market_capture_readiness_service on public.market_capture_launch_readiness;
create policy market_capture_readiness_service
  on public.market_capture_launch_readiness for all to service_role
  using (true) with check (true);
drop policy if exists market_capture_readiness_admin_all on public.market_capture_launch_readiness;
create policy market_capture_readiness_admin_all
  on public.market_capture_launch_readiness for all to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'))
  with check ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));
drop policy if exists market_capture_readiness_client_select on public.market_capture_launch_readiness;
create policy market_capture_readiness_client_select
  on public.market_capture_launch_readiness for select to authenticated
  using (exists (
    select 1
    from public.market_capture_campaigns c
    join public.market_capture_leads l on l.id = c.market_capture_lead_id
    where c.id = campaign_id
      and (l.client_id = auth.uid() or lower(l.email) = lower(coalesce(auth.jwt()->>'email', '')))
  ));
comment on table public.market_capture_campaigns is
  'Phase 1B Market Capture fulfillment campaign records created after sale/payment handoff.';
comment on table public.market_capture_checklists is
  'Fulfillment launch checklist with owner, due date, status, notes, and completion history.';
comment on table public.market_capture_launch_readiness is
  'Simple 0-100 launch readiness score for Phase 1B manual fulfillment.';
comment on table public.market_capture_reports is
  'Manual reporting foundation for Market Capture until ad platform reporting imports exist.';
