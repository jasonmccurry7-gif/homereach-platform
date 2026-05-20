-- Food Service Growth OS Phase 1
-- Additive only: creates isolated fsgos_* tables, indexes, and RLS policies.
--
-- Rollback reference only:
-- drop table if exists public.fsgos_user_state;
-- drop table if exists public.fsgos_weekly_inputs;
-- drop table if exists public.fsgos_business_profiles;

create table if not exists public.fsgos_business_profiles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_name text not null,
  location_zip text not null,
  business_type text not null,
  weekly_revenue_cents integer not null default 0 check (weekly_revenue_cents >= 0),
  avg_order_value_cents integer not null default 0 check (avg_order_value_cents >= 0),
  daily_customers integer not null default 0 check (daily_customers >= 0),
  labor_cost_weekly_cents integer not null default 0 check (labor_cost_weekly_cents >= 0),
  ingredient_cost_weekly_cents integer not null default 0 check (ingredient_cost_weekly_cents >= 0),
  overhead_monthly_cents integer not null default 0 check (overhead_monthly_cents >= 0),
  owner_goal text not null,
  timezone text not null default 'America/New_York'
);

create unique index if not exists fsgos_business_profiles_user_id_key
  on public.fsgos_business_profiles (user_id);

create index if not exists fsgos_business_profiles_business_type_idx
  on public.fsgos_business_profiles (business_type);

create table if not exists public.fsgos_weekly_inputs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start_date date not null,
  weekly_revenue_cents integer not null default 0 check (weekly_revenue_cents >= 0),
  weekly_orders integer not null default 0 check (weekly_orders >= 0),
  weekly_labor_cost_cents integer not null default 0 check (weekly_labor_cost_cents >= 0),
  weekly_ingredient_cost_cents integer not null default 0 check (weekly_ingredient_cost_cents >= 0),
  weekly_waste_estimate_cents integer not null default 0 check (weekly_waste_estimate_cents >= 0),
  avg_order_value_cents integer not null default 0 check (avg_order_value_cents >= 0),
  notes text,
  context_flags jsonb not null default '{}'::jsonb,
  same_as_previous boolean not null default false
);

create unique index if not exists fsgos_weekly_inputs_user_week_key
  on public.fsgos_weekly_inputs (user_id, week_start_date);

create index if not exists fsgos_weekly_inputs_user_week_idx
  on public.fsgos_weekly_inputs (user_id, week_start_date desc);

create table if not exists public.fsgos_user_state (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  current_streak_weeks integer not null default 0 check (current_streak_weeks >= 0),
  longest_streak_weeks integer not null default 0 check (longest_streak_weeks >= 0),
  last_input_week_start date,
  onboarding_completed_at timestamptz,
  first_win_achieved_at timestamptz
);

create unique index if not exists fsgos_user_state_user_id_key
  on public.fsgos_user_state (user_id);

alter table public.fsgos_business_profiles enable row level security;
alter table public.fsgos_weekly_inputs enable row level security;
alter table public.fsgos_user_state enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'fsgos_business_profiles'
      and policyname = 'fsgos_business_profiles_owner_all'
  ) then
    create policy fsgos_business_profiles_owner_all
      on public.fsgos_business_profiles
      for all
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'fsgos_business_profiles'
      and policyname = 'fsgos_business_profiles_admin_all'
  ) then
    create policy fsgos_business_profiles_admin_all
      on public.fsgos_business_profiles
      for all
      to authenticated
      using (coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'admin')
      with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'admin');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'fsgos_weekly_inputs'
      and policyname = 'fsgos_weekly_inputs_owner_all'
  ) then
    create policy fsgos_weekly_inputs_owner_all
      on public.fsgos_weekly_inputs
      for all
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'fsgos_weekly_inputs'
      and policyname = 'fsgos_weekly_inputs_admin_all'
  ) then
    create policy fsgos_weekly_inputs_admin_all
      on public.fsgos_weekly_inputs
      for all
      to authenticated
      using (coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'admin')
      with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'admin');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'fsgos_user_state'
      and policyname = 'fsgos_user_state_owner_all'
  ) then
    create policy fsgos_user_state_owner_all
      on public.fsgos_user_state
      for all
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'fsgos_user_state'
      and policyname = 'fsgos_user_state_admin_all'
  ) then
    create policy fsgos_user_state_admin_all
      on public.fsgos_user_state
      for all
      to authenticated
      using (coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'admin')
      with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'admin');
  end if;
end $$;
