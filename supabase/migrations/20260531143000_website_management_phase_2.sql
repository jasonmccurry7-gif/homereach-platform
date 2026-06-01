-- HomeReach Website Management Module - Phase 2
-- Adds maintenance request tracking and keeps website code/hosting external.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'website_maintenance_request_type') then
    create type public.website_maintenance_request_type as enum (
      'change_phone_number',
      'add_service',
      'replace_image',
      'add_testimonial',
      'new_page_request',
      'content_update',
      'technical_issue',
      'other'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'website_maintenance_priority') then
    create type public.website_maintenance_priority as enum (
      'low',
      'medium',
      'high',
      'urgent'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'website_maintenance_status') then
    create type public.website_maintenance_status as enum (
      'new',
      'assigned',
      'in_progress',
      'waiting_on_client',
      'completed',
      'cancelled'
    );
  end if;
end
$$;

create table if not exists public.website_maintenance_requests (
  id uuid primary key default gen_random_uuid(),
  website_project_id uuid not null references public.website_projects(id) on delete cascade,
  request_type public.website_maintenance_request_type not null default 'other',
  description text not null,
  priority public.website_maintenance_priority not null default 'medium',
  status public.website_maintenance_status not null default 'new',
  assigned_to text,
  completed_date date,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists website_maintenance_requests_website_idx
  on public.website_maintenance_requests (website_project_id, status);

create index if not exists website_maintenance_requests_status_idx
  on public.website_maintenance_requests (status, priority, updated_at desc);

alter table public.website_maintenance_requests enable row level security;

grant select, insert, update, delete on public.website_maintenance_requests to authenticated;
grant all on public.website_maintenance_requests to service_role;

drop policy if exists "website_maintenance_requests_service" on public.website_maintenance_requests;
create policy "website_maintenance_requests_service"
  on public.website_maintenance_requests for all to service_role
  using (true) with check (true);

drop policy if exists "website_maintenance_requests_admin_select" on public.website_maintenance_requests;
create policy "website_maintenance_requests_admin_select"
  on public.website_maintenance_requests for select to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));

drop policy if exists "website_maintenance_requests_admin_write" on public.website_maintenance_requests;
create policy "website_maintenance_requests_admin_write"
  on public.website_maintenance_requests for all to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') = 'admin')
  with check ((auth.jwt()->'app_metadata'->>'user_role') = 'admin');
