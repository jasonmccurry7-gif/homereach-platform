-- Food Service Growth OS Phase 8
-- Additive only: creates isolated fsgos_* light A/B test storage, indexes, and RLS policies.
--
-- Rollback reference only:
-- drop table if exists public.fsgos_ab_tests;

create table if not exists public.fsgos_ab_tests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  applied_recommendation_id uuid not null references public.fsgos_applied_recommendations(id) on delete cascade,
  test_type text not null check (test_type in ('pricing', 'bundle')),
  hypothesis text not null,
  variant_a_name text not null,
  variant_a_config jsonb not null default jsonb_build_object('description', ''),
  variant_b_name text not null,
  variant_b_config jsonb not null default jsonb_build_object('description', ''),
  primary_metric text not null default 'aov_cents' check (primary_metric in ('aov_cents', 'revenue_cents', 'orders')),
  start_date date not null,
  end_date date,
  status text not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  winning_variant text check (winning_variant in ('A', 'B', 'tie')),
  confidence text check (confidence in ('low', 'medium', 'high')),
  result_summary jsonb not null default jsonb_build_object(
    'weeksAnalyzed', 0,
    'variantAValue', 0,
    'variantBValue', 0,
    'liftPercent', 0,
    'notes', ''
  )
);

create unique index if not exists fsgos_ab_tests_one_active_idx
  on public.fsgos_ab_tests (user_id)
  where status = 'active';

create index if not exists fsgos_ab_tests_user_status_idx
  on public.fsgos_ab_tests (user_id, status);

create index if not exists fsgos_ab_tests_applied_idx
  on public.fsgos_ab_tests (applied_recommendation_id);

alter table public.fsgos_ab_tests enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'fsgos_ab_tests'
      and policyname = 'fsgos_ab_tests_owner_all'
  ) then
    create policy fsgos_ab_tests_owner_all
      on public.fsgos_ab_tests
      for all
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'fsgos_ab_tests'
      and policyname = 'fsgos_ab_tests_admin_all'
  ) then
    create policy fsgos_ab_tests_admin_all
      on public.fsgos_ab_tests
      for all
      to authenticated
      using (coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'admin')
      with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'admin');
  end if;
end $$;
