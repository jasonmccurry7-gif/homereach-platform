-- Food Service Growth OS Phase 2
-- Additive only: creates isolated fsgos_* recommendation storage, indexes, and RLS policies.
--
-- Rollback reference only:
-- drop table if exists public.fsgos_recommendations;

create table if not exists public.fsgos_recommendations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start_date date not null,
  trigger_key text not null,
  source text not null check (source in ('profile_based', 'trend_based', 'baseline_based', 'fallback')),
  lever_category text not null check (lever_category in ('pricing', 'waste', 'staffing', 'aov', 'demand')),
  title text not null,
  problem text not null,
  why_it_matters text not null,
  action_text text not null,
  estimated_monthly_impact_cents integer not null default 0 check (estimated_monthly_impact_cents >= 0),
  confidence text not null check (confidence in ('low', 'medium', 'high')),
  confidence_reasoning text not null,
  ranking_score numeric(12, 2) not null default 0,
  fast_win boolean not null default false,
  status text not null default 'recommended' check (status in ('recommended', 'dismissed', 'applied')),
  data_snapshot jsonb not null default jsonb_build_object(
    'dataWeeks', 0,
    'currentRevenueCents', 0,
    'currentAovCents', 0,
    'currentFoodCostPercent', 0,
    'currentLaborPercent', 0,
    'contextFlags', jsonb_build_array()
  )
);

create unique index if not exists fsgos_recommendations_user_week_trigger_key
  on public.fsgos_recommendations (user_id, week_start_date, trigger_key);

create index if not exists fsgos_recommendations_user_status_idx
  on public.fsgos_recommendations (user_id, status);

create index if not exists fsgos_recommendations_user_week_idx
  on public.fsgos_recommendations (user_id, week_start_date desc);

alter table public.fsgos_recommendations enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'fsgos_recommendations'
      and policyname = 'fsgos_recommendations_owner_all'
  ) then
    create policy fsgos_recommendations_owner_all
      on public.fsgos_recommendations
      for all
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'fsgos_recommendations'
      and policyname = 'fsgos_recommendations_admin_all'
  ) then
    create policy fsgos_recommendations_admin_all
      on public.fsgos_recommendations
      for all
      to authenticated
      using (coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'admin')
      with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'admin');
  end if;
end $$;
