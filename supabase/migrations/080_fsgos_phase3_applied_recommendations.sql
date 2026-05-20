-- Food Service Growth OS Phase 3
-- Additive only: creates isolated fsgos_* applied lever storage, indexes, and RLS policies.
--
-- Rollback reference only:
-- drop table if exists public.fsgos_applied_recommendations;

create table if not exists public.fsgos_applied_recommendations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recommendation_id uuid not null references public.fsgos_recommendations(id) on delete cascade,
  lever_category text not null check (lever_category in ('pricing', 'waste', 'staffing', 'aov', 'demand')),
  fast_win boolean not null default false,
  baseline_metrics jsonb not null default jsonb_build_object(
    'source', 'profile_fallback',
    'weeksIncluded', 0,
    'capturedAt', '',
    'weekStartDates', jsonb_build_array(),
    'revenueCents', 0,
    'aovCents', 0,
    'foodCostPercent', 0,
    'laborPercent', 0,
    'wastePercent', 0
  ),
  date_applied timestamptz not null default now(),
  status text not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  completion_date timestamptz,
  final_impact_cents integer,
  confidence text not null check (confidence in ('low', 'medium', 'high'))
);

create unique index if not exists fsgos_applied_recommendations_one_active_idx
  on public.fsgos_applied_recommendations (user_id)
  where status = 'active';

create index if not exists fsgos_applied_recommendations_user_status_idx
  on public.fsgos_applied_recommendations (user_id, status);

create index if not exists fsgos_applied_recommendations_recommendation_idx
  on public.fsgos_applied_recommendations (recommendation_id);

alter table public.fsgos_applied_recommendations enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'fsgos_applied_recommendations'
      and policyname = 'fsgos_applied_recommendations_owner_all'
  ) then
    create policy fsgos_applied_recommendations_owner_all
      on public.fsgos_applied_recommendations
      for all
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'fsgos_applied_recommendations'
      and policyname = 'fsgos_applied_recommendations_admin_all'
  ) then
    create policy fsgos_applied_recommendations_admin_all
      on public.fsgos_applied_recommendations
      for all
      to authenticated
      using (coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'admin')
      with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'admin');
  end if;
end $$;
