-- Daily Outreach Command Center
-- Additive admin execution console tables. This migration does not alter
-- protected intake, auth, Stripe, political, route mapping, or webhook flows.

create extension if not exists pgcrypto;

create table if not exists public.outreach_prospects (
  id uuid primary key default gen_random_uuid(),
  source_table text,
  source_id uuid,
  category text not null check (category in (
    'Targeted Campaign',
    'Procurement / Supplify',
    'Political Outreach',
    'Government Contracting'
  )),
  business_name text,
  campaign_name text,
  contact_name text,
  industry text,
  phone text,
  email text,
  website text,
  facebook_url text,
  messenger_url text,
  priority text not null default 'medium' check (priority in ('low','medium','high','urgent')),
  status text not null default 'available' check (status in ('available','queued','contacted','follow_up','completed','paused','do_not_contact','archived')),
  last_contacted_at timestamptz,
  follow_up_date date,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_outreach_tasks (
  id uuid primary key default gen_random_uuid(),
  outreach_date date not null default current_date,
  prospect_id uuid references public.outreach_prospects(id) on delete set null,
  source_table text,
  source_id uuid,
  category text not null check (category in (
    'Targeted Campaign',
    'Procurement / Supplify',
    'Political Outreach',
    'Government Contracting'
  )),
  business_name text,
  campaign_name text,
  contact_name text,
  industry text,
  phone text,
  email text,
  website text,
  facebook_url text,
  messenger_url text,
  action_type text not null default 'outreach',
  priority text not null default 'medium' check (priority in ('low','medium','high','urgent')),
  status text not null default 'pending' check (status in ('pending','in_progress','follow_up','completed','skipped','blocked')),
  email_subject text,
  email_body text,
  sms_body text,
  dm_body text,
  notes text,
  completed boolean not null default false,
  completed_at timestamptz,
  completed_by uuid references public.profiles(id) on delete set null,
  follow_up_date date,
  response_received boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_social_posts (
  id uuid primary key default gen_random_uuid(),
  outreach_date date not null default current_date,
  category text not null default 'General',
  post_type text not null,
  audience text,
  content text not null,
  short_content text,
  status text not null default 'draft' check (status in ('draft','copied','posted','skipped','needs_review')),
  posted boolean not null default false,
  posted_at timestamptz,
  posted_by uuid references public.profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.outreach_activity_log (
  id uuid primary key default gen_random_uuid(),
  outreach_date date not null default current_date,
  task_id uuid references public.daily_outreach_tasks(id) on delete set null,
  social_post_id uuid references public.daily_social_posts(id) on delete set null,
  prospect_id uuid references public.outreach_prospects(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  category text,
  activity_type text not null,
  channel text,
  status text not null default 'logged',
  summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.outreach_exports (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid references public.profiles(id) on delete set null,
  range_key text not null check (range_key in ('today','week','month')),
  started_on date not null,
  ended_on date not null,
  task_count integer not null default 0,
  social_post_count integer not null default 0,
  activity_count integer not null default 0,
  export_format text not null default 'xls',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists outreach_prospects_rotation_idx
  on public.outreach_prospects (category, status, follow_up_date, last_contacted_at, priority);
create index if not exists daily_outreach_tasks_date_idx
  on public.daily_outreach_tasks (outreach_date, completed, category, priority);
create index if not exists daily_outreach_tasks_followup_idx
  on public.daily_outreach_tasks (follow_up_date, status)
  where follow_up_date is not null;
create index if not exists daily_social_posts_date_idx
  on public.daily_social_posts (outreach_date, posted, post_type);
create index if not exists outreach_activity_log_date_idx
  on public.outreach_activity_log (outreach_date, created_at desc);
create index if not exists outreach_exports_date_idx
  on public.outreach_exports (created_at desc);

alter table public.outreach_prospects enable row level security;
alter table public.daily_outreach_tasks enable row level security;
alter table public.daily_social_posts enable row level security;
alter table public.outreach_activity_log enable row level security;
alter table public.outreach_exports enable row level security;

do $$ declare t text;
begin
  foreach t in array array[
    'outreach_prospects',
    'daily_outreach_tasks',
    'daily_social_posts',
    'outreach_activity_log',
    'outreach_exports'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_service', t);
    execute format(
      'create policy %I on public.%I for all to service_role using (true) with check (true)',
      t || '_service',
      t
    );
  end loop;
end $$;
