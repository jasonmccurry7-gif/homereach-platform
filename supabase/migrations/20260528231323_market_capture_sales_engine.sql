-- Market Capture Sales Engine MVP
-- Additive Phase 1A tables for sales acquisition, intake, payment readiness,
-- sales tasks, drafts, and client status placeholder. No fulfillment launch
-- systems, ad APIs, reporting automation, or Business Memory are introduced.

create extension if not exists pgcrypto;
create table if not exists public.market_capture_leads (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  client_id uuid references public.profiles(id) on delete set null,
  business_name text not null,
  contact_name text not null,
  email text not null,
  phone text not null,
  website text,
  industry text not null,
  monthly_ad_budget integer not null default 0,
  targeting_objective text not null,
  targeting_type text not null,
  target_area text not null,
  preferred_start_date date,
  campaign_offer text,
  postcard_addon boolean not null default false,
  landing_page_needed boolean not null default false,
  creative_package_needed boolean not null default false,
  consent_acknowledged boolean not null default false,
  compliance_acknowledged boolean not null default false,
  monthly_management_fee integer not null default 49900,
  payment_status text not null default 'payment_required' check (payment_status in (
    'payment_required',
    'checkout_created',
    'manual_invoice_needed',
    'paid',
    'failed',
    'refunded',
    'comped'
  )),
  stripe_checkout_session_id text,
  stripe_subscription_id text,
  stripe_customer_id text,
  stripe_payment_intent_id text,
  paid_at timestamptz,
  owner text not null default 'jason',
  status text not null default 'active' check (status in ('active','qualified','ready_for_fulfillment','closed_won','closed_lost','archived')),
  source text not null default 'market_capture_intake',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.market_capture_pipeline (
  id uuid primary key default gen_random_uuid(),
  market_capture_lead_id uuid not null references public.market_capture_leads(id) on delete cascade,
  stage text not null default 'intake_complete' check (stage in (
    'new_lead',
    'intake_complete',
    'needs_review',
    'payment_pending',
    'qualified',
    'ready_for_fulfillment',
    'closed_won',
    'closed_lost'
  )),
  owner text not null default 'jason',
  status text not null default 'open' check (status in ('open','won','lost','paused','archived')),
  estimated_mrr_cents integer not null default 49900,
  pipeline_value_cents integer not null default 49900,
  next_action text not null default 'Review intake',
  notes text,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.market_capture_tasks (
  id uuid primary key default gen_random_uuid(),
  market_capture_lead_id uuid not null references public.market_capture_leads(id) on delete cascade,
  pipeline_id uuid references public.market_capture_pipeline(id) on delete cascade,
  title text not null,
  owner text not null default 'jason',
  status text not null default 'open' check (status in ('open','in_progress','completed','blocked','cancelled')),
  due_date timestamptz,
  completed_at timestamptz,
  notes text,
  task_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.market_capture_assets (
  id uuid primary key default gen_random_uuid(),
  market_capture_lead_id uuid not null references public.market_capture_leads(id) on delete cascade,
  asset_type text not null check (asset_type in ('logo','image','creative','postcard','other')),
  file_url text,
  file_name text,
  mime_type text,
  size_bytes integer,
  status text not null default 'uploaded' check (status in ('uploaded','needs_admin_upload','approved','rejected','archived')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.market_capture_notes (
  id uuid primary key default gen_random_uuid(),
  market_capture_lead_id uuid not null references public.market_capture_leads(id) on delete cascade,
  author text not null default 'system',
  note_type text not null default 'activity' check (note_type in ('activity','note','payment','stage_change','task')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.market_capture_drafts (
  id uuid primary key default gen_random_uuid(),
  market_capture_lead_id uuid not null references public.market_capture_leads(id) on delete cascade,
  draft_type text not null check (draft_type in (
    'email',
    'sms',
    'dm',
    'proposal_intro',
    'discovery_questions'
  )),
  label text not null,
  content text not null,
  created_by text not null default 'sales_draft_generator',
  created_at timestamptz not null default now()
);
create index if not exists market_capture_leads_status_idx
  on public.market_capture_leads (status, payment_status, created_at desc);
create index if not exists market_capture_leads_email_idx
  on public.market_capture_leads (lower(email), created_at desc);
create index if not exists market_capture_leads_owner_idx
  on public.market_capture_leads (owner, created_at desc);
create index if not exists market_capture_pipeline_lead_idx
  on public.market_capture_pipeline (market_capture_lead_id);
create index if not exists market_capture_pipeline_stage_idx
  on public.market_capture_pipeline (stage, status, updated_at desc);
create index if not exists market_capture_pipeline_owner_idx
  on public.market_capture_pipeline (owner, stage);
create index if not exists market_capture_tasks_lead_idx
  on public.market_capture_tasks (market_capture_lead_id, status, task_order);
create index if not exists market_capture_tasks_owner_idx
  on public.market_capture_tasks (owner, status, due_date);
create index if not exists market_capture_assets_lead_idx
  on public.market_capture_assets (market_capture_lead_id, asset_type, created_at desc);
create index if not exists market_capture_notes_lead_idx
  on public.market_capture_notes (market_capture_lead_id, created_at desc);
create index if not exists market_capture_drafts_lead_idx
  on public.market_capture_drafts (market_capture_lead_id, draft_type, created_at desc);
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'market-capture-assets',
  'market-capture-assets',
  false,
  10485760,
  array['image/png','image/jpeg','image/webp','application/pdf']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
alter table public.market_capture_leads enable row level security;
alter table public.market_capture_pipeline enable row level security;
alter table public.market_capture_tasks enable row level security;
alter table public.market_capture_assets enable row level security;
alter table public.market_capture_notes enable row level security;
alter table public.market_capture_drafts enable row level security;
grant select, insert, update, delete on
  public.market_capture_leads,
  public.market_capture_pipeline,
  public.market_capture_tasks,
  public.market_capture_assets,
  public.market_capture_notes,
  public.market_capture_drafts
to authenticated;
grant all on
  public.market_capture_leads,
  public.market_capture_pipeline,
  public.market_capture_tasks,
  public.market_capture_assets,
  public.market_capture_notes,
  public.market_capture_drafts
to service_role;
drop policy if exists market_capture_leads_service on public.market_capture_leads;
create policy market_capture_leads_service
  on public.market_capture_leads for all to service_role
  using (true) with check (true);
drop policy if exists market_capture_leads_admin_all on public.market_capture_leads;
create policy market_capture_leads_admin_all
  on public.market_capture_leads for all to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'))
  with check ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));
drop policy if exists market_capture_leads_client_select on public.market_capture_leads;
create policy market_capture_leads_client_select
  on public.market_capture_leads for select to authenticated
  using (
    client_id = auth.uid()
    or lower(email) = lower(coalesce(auth.jwt()->>'email', ''))
  );
drop policy if exists market_capture_pipeline_service on public.market_capture_pipeline;
create policy market_capture_pipeline_service
  on public.market_capture_pipeline for all to service_role
  using (true) with check (true);
drop policy if exists market_capture_pipeline_admin_all on public.market_capture_pipeline;
create policy market_capture_pipeline_admin_all
  on public.market_capture_pipeline for all to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'))
  with check ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));
drop policy if exists market_capture_pipeline_client_select on public.market_capture_pipeline;
create policy market_capture_pipeline_client_select
  on public.market_capture_pipeline for select to authenticated
  using (exists (
    select 1 from public.market_capture_leads l
    where l.id = market_capture_lead_id
      and (l.client_id = auth.uid() or lower(l.email) = lower(coalesce(auth.jwt()->>'email', '')))
  ));
drop policy if exists market_capture_tasks_service on public.market_capture_tasks;
create policy market_capture_tasks_service
  on public.market_capture_tasks for all to service_role
  using (true) with check (true);
drop policy if exists market_capture_tasks_admin_all on public.market_capture_tasks;
create policy market_capture_tasks_admin_all
  on public.market_capture_tasks for all to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'))
  with check ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));
drop policy if exists market_capture_assets_service on public.market_capture_assets;
create policy market_capture_assets_service
  on public.market_capture_assets for all to service_role
  using (true) with check (true);
drop policy if exists market_capture_assets_admin_all on public.market_capture_assets;
create policy market_capture_assets_admin_all
  on public.market_capture_assets for all to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'))
  with check ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));
drop policy if exists market_capture_assets_client_select on public.market_capture_assets;
create policy market_capture_assets_client_select
  on public.market_capture_assets for select to authenticated
  using (exists (
    select 1 from public.market_capture_leads l
    where l.id = market_capture_lead_id
      and (l.client_id = auth.uid() or lower(l.email) = lower(coalesce(auth.jwt()->>'email', '')))
  ));
drop policy if exists market_capture_notes_service on public.market_capture_notes;
create policy market_capture_notes_service
  on public.market_capture_notes for all to service_role
  using (true) with check (true);
drop policy if exists market_capture_notes_admin_all on public.market_capture_notes;
create policy market_capture_notes_admin_all
  on public.market_capture_notes for all to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'))
  with check ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));
drop policy if exists market_capture_drafts_service on public.market_capture_drafts;
create policy market_capture_drafts_service
  on public.market_capture_drafts for all to service_role
  using (true) with check (true);
drop policy if exists market_capture_drafts_admin_all on public.market_capture_drafts;
create policy market_capture_drafts_admin_all
  on public.market_capture_drafts for all to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'))
  with check ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));
drop policy if exists market_capture_storage_service on storage.objects;
create policy market_capture_storage_service
  on storage.objects for all to service_role
  using (bucket_id = 'market-capture-assets')
  with check (bucket_id = 'market-capture-assets');
drop policy if exists market_capture_storage_admin_select on storage.objects;
create policy market_capture_storage_admin_select
  on storage.objects for select to authenticated
  using (
    bucket_id = 'market-capture-assets'
    and (auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent')
  );
comment on table public.market_capture_leads is
  'Phase 1A Market Capture sales intake and qualification records. Fulfillment is intentionally not modeled here.';
comment on table public.market_capture_pipeline is
  'Market Capture sales pipeline from intake through qualified, payment, and fulfillment handoff.';
comment on table public.market_capture_tasks is
  'Sales tasks only: intake review, budget confirmation, payment follow-up, and fulfillment handoff.';
comment on column public.market_capture_leads.monthly_management_fee is
  'Cents. Default HomeReach Market Capture management fee is $499/month. Client ad spend is separate.';
comment on column public.market_capture_leads.monthly_ad_budget is
  'Cents. Client-funded media budget, not included in the management fee.';
