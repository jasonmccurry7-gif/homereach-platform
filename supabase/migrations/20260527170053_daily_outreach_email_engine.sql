create extension if not exists pgcrypto;

alter table public.daily_outreach_tasks
  add column if not exists sender_key text,
  add column if not exists sender_name text,
  add column if not exists sender_email text,
  add column if not exists scheduled_send_at timestamptz,
  add column if not exists send_status text not null default 'draft',
  add column if not exists approval_status text not null default 'needs_review',
  add column if not exists approval_queue_id uuid references public.revenue_message_approval_queue(id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references public.profiles(id) on delete set null,
  add column if not exists visual_url text,
  add column if not exists visual_alt text,
  add column if not exists visual_type text,
  add column if not exists subject_variant_key text,
  add column if not exists cta_variant_key text,
  add column if not exists intro_variant_key text,
  add column if not exists signature_variant_key text,
  add column if not exists daily_sequence integer,
  add column if not exists household_density_estimate text,
  add column if not exists neighborhood_example text,
  add column if not exists lead_source text,
  add column if not exists delivery_status text,
  add column if not exists opened_at timestamptz,
  add column if not exists replied_at timestamptz,
  add column if not exists bounced_at timestamptz,
  add column if not exists provider_message_id text,
  add column if not exists last_error text,
  add column if not exists send_attempts integer not null default 0,
  add column if not exists manual_approval_required boolean not null default true;

create index if not exists daily_outreach_tasks_sender_schedule_idx
  on public.daily_outreach_tasks (outreach_date, sender_key, scheduled_send_at);
create index if not exists daily_outreach_tasks_approval_idx
  on public.daily_outreach_tasks (approval_status, send_status, scheduled_send_at)
  where email is not null;
create index if not exists daily_outreach_tasks_sender_email_idx
  on public.daily_outreach_tasks (sender_email, outreach_date)
  where sender_email is not null;
create index if not exists daily_outreach_tasks_approval_queue_idx
  on public.daily_outreach_tasks (approval_queue_id)
  where approval_queue_id is not null;

create table if not exists public.daily_outreach_sender_controls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  sender_key text not null unique check (sender_key in ('heather','josh','chelsi','jason')),
  sender_name text not null,
  sender_email text not null,
  business_line text not null default 'unknown' check (business_line in (
    'targeted_mailing',
    'inventory_procurement',
    'political',
    'unknown'
  )),
  daily_cap integer not null default 5 check (daily_cap between 0 and 5),
  paused boolean not null default false,
  manual_approval_required boolean not null default true,
  min_spacing_minutes integer not null default 45 check (min_spacing_minutes >= 45),
  business_start_minutes integer not null default 510,
  business_end_minutes integer not null default 990,
  timezone text not null default 'America/New_York',
  updated_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.daily_outreach_sender_controls (
  sender_key,
  sender_name,
  sender_email,
  business_line,
  daily_cap,
  paused,
  manual_approval_required,
  min_spacing_minutes,
  business_start_minutes,
  business_end_minutes,
  timezone,
  metadata
)
values
  ('heather','Heather HomeReach','heather@home-reach.com','targeted_mailing',5,false,true,45,510,990,'America/New_York','{"persona":"friendly local marketing advisor","audience":"targeted postcard campaign leads"}'::jsonb),
  ('josh','Josh HomeReach','josh@home-reach.com','political',5,false,true,45,510,990,'America/New_York','{"persona":"campaign operations strategist","audience":"political candidates and campaign staff"}'::jsonb),
  ('chelsi','Chelsi HomeReach','chelsi@home-reach.com','inventory_procurement',5,false,true,45,510,990,'America/New_York','{"persona":"helpful small business savings consultant","audience":"Supplify small business leads"}'::jsonb),
  ('jason','Jason McCurry','jason@home-reach.com','inventory_procurement',5,false,true,45,510,990,'America/New_York','{"persona":"founder executive strategic tone","audience":"Supplify strategic small business leads"}'::jsonb)
on conflict (sender_key) do nothing;

alter table public.daily_outreach_sender_controls enable row level security;

drop policy if exists daily_outreach_sender_controls_service
  on public.daily_outreach_sender_controls;
create policy daily_outreach_sender_controls_service
  on public.daily_outreach_sender_controls
  for all to service_role
  using (true)
  with check (true);

drop policy if exists daily_outreach_sender_controls_admin_read
  on public.daily_outreach_sender_controls;
create policy daily_outreach_sender_controls_admin_read
  on public.daily_outreach_sender_controls
  for select to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));

comment on table public.daily_outreach_sender_controls is
  'Sender-level daily outreach controls for small-volume, approval-first email planning.';
comment on column public.daily_outreach_sender_controls.manual_approval_required is
  'When true, approved daily outreach emails remain manual-send only even after approval queue review.';;
