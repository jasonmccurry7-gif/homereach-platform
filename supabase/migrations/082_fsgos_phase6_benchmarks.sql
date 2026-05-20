-- Food Service Growth OS Phase 6
-- Additive only: creates isolated fsgos_* benchmark storage, indexes, and RLS policies.
--
-- Rollback reference only:
-- drop table if exists public.fsgos_benchmarks;

create table if not exists public.fsgos_benchmarks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_type text not null,
  revenue_tier text not null,
  region text not null,
  metric_type text not null check (metric_type in ('aov_cents', 'food_cost_percent', 'labor_percent', 'waste_percent')),
  p25 numeric(12, 2) not null,
  p50 numeric(12, 2) not null,
  p75 numeric(12, 2) not null,
  sample_size integer not null default 0 check (sample_size >= 0),
  source text not null default 'aggregated_user_data' check (source in ('aggregated_user_data', 'public_industry_fallback'))
);

create unique index if not exists fsgos_benchmarks_unique_key
  on public.fsgos_benchmarks (business_type, revenue_tier, region, metric_type);

create index if not exists fsgos_benchmarks_lookup_idx
  on public.fsgos_benchmarks (business_type, revenue_tier, region);

alter table public.fsgos_benchmarks enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'fsgos_benchmarks'
      and policyname = 'fsgos_benchmarks_authenticated_read'
  ) then
    create policy fsgos_benchmarks_authenticated_read
      on public.fsgos_benchmarks
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'fsgos_benchmarks'
      and policyname = 'fsgos_benchmarks_owner_all'
  ) then
    create policy fsgos_benchmarks_owner_all
      on public.fsgos_benchmarks
      for all
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'fsgos_benchmarks'
      and policyname = 'fsgos_benchmarks_admin_all'
  ) then
    create policy fsgos_benchmarks_admin_all
      on public.fsgos_benchmarks
      for all
      to authenticated
      using (coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'admin')
      with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'admin');
  end if;
end $$;
