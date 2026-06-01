-- HomeReach Website Management Module
-- Additive management layer for external client website projects.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'website_project_status') then
    create type public.website_project_status as enum (
      'intake_received',
      'awaiting_assets',
      'building',
      'client_review',
      'revisions',
      'ready_for_launch',
      'live',
      'paused',
      'cancelled'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'website_account_status') then
    create type public.website_account_status as enum (
      'active',
      'past_due',
      'cancelled'
    );
  end if;
end
$$;

create table if not exists public.website_projects (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete set null,
  client_name text not null default '',
  business_name text not null,
  business_type text,
  phone_number text,
  email text,
  domain text,
  website_url text,
  hosting_provider text,
  github_repository_url text,
  deployment_url text,
  hosting_dashboard_url text,
  domain_registrar_url text,
  google_business_profile_url text,
  facebook_page_url text,
  analytics_dashboard_url text,
  monthly_plan_amount_cents integer not null default 0,
  setup_fee_cents integer not null default 0,
  last_payment_date date,
  next_billing_date date,
  revenue_to_date_cents integer not null default 0,
  account_status public.website_account_status not null default 'active',
  status public.website_project_status not null default 'intake_received',
  launch_date date,
  assigned_team_member text,
  notes text,
  intake jsonb not null default '{}'::jsonb,
  asset_checklist jsonb not null default '{}'::jsonb,
  future_audit_hooks jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists website_projects_business_idx
  on public.website_projects (business_id);

create index if not exists website_projects_status_idx
  on public.website_projects (status, account_status, updated_at desc);

create index if not exists website_projects_billing_idx
  on public.website_projects (next_billing_date, account_status);

create index if not exists website_projects_email_idx
  on public.website_projects (lower(email));

alter table public.website_projects enable row level security;

grant select, insert, update, delete on public.website_projects to authenticated;
grant all on public.website_projects to service_role;

drop policy if exists "website_projects_service" on public.website_projects;
create policy "website_projects_service"
  on public.website_projects for all to service_role
  using (true) with check (true);

drop policy if exists "website_projects_admin_select" on public.website_projects;
create policy "website_projects_admin_select"
  on public.website_projects for select to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));

drop policy if exists "website_projects_admin_write" on public.website_projects;
create policy "website_projects_admin_write"
  on public.website_projects for all to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') = 'admin')
  with check ((auth.jwt()->'app_metadata'->>'user_role') = 'admin');
