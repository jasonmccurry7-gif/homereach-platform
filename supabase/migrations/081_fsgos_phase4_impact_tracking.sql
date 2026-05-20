-- Food Service Growth OS Phase 4
-- Additive only: creates isolated fsgos_* impact tracking storage, indexes, and RLS policies.
--
-- Rollback reference only:
-- drop table if exists public.fsgos_impact_tracking;

create table if not exists public.fsgos_impact_tracking (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  applied_recommendation_id uuid not null references public.fsgos_applied_recommendations(id) on delete cascade,
  baseline_value_cents integer not null default 0,
  current_value_cents integer not null default 0,
  estimated_monthly_impact_cents integer not null default 0,
  aov_driven_revenue_delta_cents integer not null default 0,
  volume_driven_revenue_delta_cents integer not null default 0,
  cost_savings_delta_cents integer not null default 0,
  confidence text not null check (confidence in ('low', 'medium', 'high')),
  confidence_reasoning text not null,
  last_updated timestamptz not null default now()
);

create unique index if not exists fsgos_impact_tracking_applied_recommendation_key
  on public.fsgos_impact_tracking (applied_recommendation_id);

create index if not exists fsgos_impact_tracking_user_idx
  on public.fsgos_impact_tracking (user_id);

alter table public.fsgos_impact_tracking enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'fsgos_impact_tracking'
      and policyname = 'fsgos_impact_tracking_owner_all'
  ) then
    create policy fsgos_impact_tracking_owner_all
      on public.fsgos_impact_tracking
      for all
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'fsgos_impact_tracking'
      and policyname = 'fsgos_impact_tracking_admin_all'
  ) then
    create policy fsgos_impact_tracking_admin_all
      on public.fsgos_impact_tracking
      for all
      to authenticated
      using (coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'admin')
      with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'admin');
  end if;
end $$;
