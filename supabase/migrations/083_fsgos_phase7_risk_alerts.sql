-- Food Service Growth OS Phase 7
-- Additive only: creates isolated fsgos_* risk alert storage, indexes, and RLS policies.
--
-- Rollback reference only:
-- drop table if exists public.fsgos_risk_alerts;

create table if not exists public.fsgos_risk_alerts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  alert_type text not null check (alert_type in ('profit_decline', 'labor_spike', 'revenue_drop')),
  severity text not null check (severity in ('low', 'medium', 'high')),
  title text not null,
  description text not null,
  metric_snapshot jsonb not null default jsonb_build_object(
    'weeksAnalyzed', 0,
    'cleanWeeks', 0,
    'currentValue', 0,
    'priorAverage', 0,
    'changePercent', 0,
    'weekStartDates', jsonb_build_array()
  ),
  status text not null default 'active' check (status in ('active', 'resolved', 'dismissed')),
  detected_at timestamptz not null default now(),
  resolved_at timestamptz
);

create unique index if not exists fsgos_risk_alerts_user_type_active_key
  on public.fsgos_risk_alerts (user_id, alert_type)
  where status = 'active';

create index if not exists fsgos_risk_alerts_user_status_idx
  on public.fsgos_risk_alerts (user_id, status);

create index if not exists fsgos_risk_alerts_user_detected_idx
  on public.fsgos_risk_alerts (user_id, detected_at desc);

alter table public.fsgos_risk_alerts enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'fsgos_risk_alerts'
      and policyname = 'fsgos_risk_alerts_owner_all'
  ) then
    create policy fsgos_risk_alerts_owner_all
      on public.fsgos_risk_alerts
      for all
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'fsgos_risk_alerts'
      and policyname = 'fsgos_risk_alerts_admin_all'
  ) then
    create policy fsgos_risk_alerts_admin_all
      on public.fsgos_risk_alerts
      for all
      to authenticated
      using (coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'admin')
      with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'admin');
  end if;
end $$;
