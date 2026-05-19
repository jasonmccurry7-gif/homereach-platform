-- HomeReach Migration 098 - AI operational briefings and monitor runs
--
-- Purpose:
--   * Add durable monitor snapshots for the unified AI orchestration layer.
--   * Add dashboard-only morning/evening operational briefings.
--   * Preserve human control. These tables do not send messages, submit bids,
--     place orders, approve pricing, or mutate protected revenue workflows.

create extension if not exists pgcrypto;

create table if not exists public.ai_dashboard_monitor_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  run_key text not null unique,
  run_type text not null default 'manual'
    check (run_type in ('morning','evening','manual','cron')),
  triggered_by text not null default 'admin'
    check (triggered_by in ('admin','cron','system')),
  status text not null default 'ok'
    check (status in ('ok','warning','critical','failed')),
  action_total integer not null default 0,
  critical_actions integer not null default 0,
  high_actions integer not null default 0,
  blocked_actions integer not null default 0,
  source_unavailable_count integer not null default 0,
  dashboard_agents_ready integer not null default 0,
  dashboard_agents_blocked integer not null default 0,
  summary text not null,
  monitors jsonb not null default '[]'::jsonb,
  source_health jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists ai_dashboard_monitor_runs_created_idx
  on public.ai_dashboard_monitor_runs (created_at desc);
create index if not exists ai_dashboard_monitor_runs_status_idx
  on public.ai_dashboard_monitor_runs (status, created_at desc);

create table if not exists public.ai_operational_briefings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  briefing_type text not null default 'manual'
    check (briefing_type in ('morning','evening','manual','cron')),
  status text not null default 'ok'
    check (status in ('ok','warning','critical','failed')),
  headline text not null,
  summary text not null,
  top_actions jsonb not null default '[]'::jsonb,
  risks jsonb not null default '[]'::jsonb,
  wins jsonb not null default '[]'::jsonb,
  next_actions jsonb not null default '[]'::jsonb,
  action_summary jsonb not null default '{}'::jsonb,
  source_health jsonb not null default '[]'::jsonb,
  monitor_run_id uuid references public.ai_dashboard_monitor_runs(id) on delete set null,
  delivery_status text not null default 'dashboard_only'
    check (delivery_status in ('dashboard_only','queued','sent','failed','suppressed')),
  delivered_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists ai_operational_briefings_created_idx
  on public.ai_operational_briefings (created_at desc);
create index if not exists ai_operational_briefings_type_idx
  on public.ai_operational_briefings (briefing_type, created_at desc);

alter table public.ai_dashboard_monitor_runs enable row level security;
alter table public.ai_operational_briefings enable row level security;

drop policy if exists "ai_dashboard_monitor_runs_service" on public.ai_dashboard_monitor_runs;
create policy "ai_dashboard_monitor_runs_service"
  on public.ai_dashboard_monitor_runs for all to service_role
  using (true)
  with check (true);

drop policy if exists "ai_operational_briefings_service" on public.ai_operational_briefings;
create policy "ai_operational_briefings_service"
  on public.ai_operational_briefings for all to service_role
  using (true)
  with check (true);

drop policy if exists "ai_dashboard_monitor_runs_admin_read" on public.ai_dashboard_monitor_runs;
create policy "ai_dashboard_monitor_runs_admin_read"
  on public.ai_dashboard_monitor_runs for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');

drop policy if exists "ai_operational_briefings_admin_read" on public.ai_operational_briefings;
create policy "ai_operational_briefings_admin_read"
  on public.ai_operational_briefings for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');
