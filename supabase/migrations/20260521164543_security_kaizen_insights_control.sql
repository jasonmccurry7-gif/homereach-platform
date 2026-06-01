-- Foundation hardening: keep the Kaizen agent observable without runtime DDL.
-- The route only records findings and approval recommendations; it does not
-- mutate leads or create tables at request time.

create table if not exists public.kaizen_insights (
  id uuid primary key default gen_random_uuid(),
  run_at timestamptz not null default now(),
  cycle_date date not null default current_date,
  findings jsonb not null default '{}'::jsonb,
  auto_fixes_applied integer not null default 0,
  flagged_for_approval jsonb not null default '[]'::jsonb,
  email_sent boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.kaizen_insights enable row level security;

drop policy if exists kaizen_insights_service_all on public.kaizen_insights;
drop policy if exists kaizen_insights_admin_all on public.kaizen_insights;

create policy kaizen_insights_service_all
  on public.kaizen_insights
  for all
  to service_role
  using (true)
  with check (true);

create policy kaizen_insights_admin_all
  on public.kaizen_insights
  for all
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');;
