-- HomeReach Migration 099 - Human-approved autopilot control layer
--
-- Purpose:
--   * Add a shared approval/control layer for future assisted autopilot.
--   * Reuse existing action sources instead of creating parallel execution systems.
--   * Capture human approval/rejection, notes, guardrails, and audit events.
--   * Do not send messages, place orders, submit bids, approve pricing, or mutate
--     protected operational workflows.

create extension if not exists pgcrypto;

create table if not exists public.ai_autopilot_approval_requests (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),

  source text not null,
  dashboard text not null,
  route text not null,
  title text not null,
  requested_action text not null,
  expected_impact text not null,
  risk_level text not null default 'medium'
    check (risk_level in ('critical','high','medium','low')),
  approval_status text not null default 'pending'
    check (approval_status in ('pending','approved','rejected','canceled','expired','executed')),
  execution_mode text not null default 'human_approval'
    check (execution_mode in ('draft_only','human_approval','assisted_autopilot','full_autopilot')),
  executor_status text not null default 'approval_only'
    check (executor_status in ('approval_only','not_connected','ready','blocked','executed')),
  executor_key text,
  guardrail_summary text not null,
  cannot_execute_reason text not null default 'Phase 5 captures human approval only. Execution stays in the existing workflow until a safe executor is connected.',
  requires_human_approval boolean not null default true,
  source_snapshot jsonb not null default '{}'::jsonb,

  approved_at timestamptz,
  approved_by uuid references public.profiles(id) on delete set null,
  rejected_at timestamptz,
  rejected_by uuid references public.profiles(id) on delete set null,
  decision_note text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists ai_autopilot_requests_status_idx
  on public.ai_autopilot_approval_requests (approval_status, risk_level, updated_at desc);
create index if not exists ai_autopilot_requests_dashboard_idx
  on public.ai_autopilot_approval_requests (dashboard, approval_status, updated_at desc);
create index if not exists ai_autopilot_requests_source_idx
  on public.ai_autopilot_approval_requests (source, approval_status, updated_at desc);

create table if not exists public.ai_autopilot_approval_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.ai_autopilot_approval_requests(id) on delete cascade,
  source_key text,
  created_at timestamptz not null default now(),
  event_type text not null
    check (event_type in ('created','observed','approved','rejected','canceled','expired','executed','commented')),
  actor_id uuid references public.profiles(id) on delete set null,
  note text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists ai_autopilot_events_request_idx
  on public.ai_autopilot_approval_events (request_id, created_at desc);
create index if not exists ai_autopilot_events_source_idx
  on public.ai_autopilot_approval_events (source_key, created_at desc);

alter table public.ai_autopilot_approval_requests enable row level security;
alter table public.ai_autopilot_approval_events enable row level security;

drop policy if exists "ai_autopilot_requests_service" on public.ai_autopilot_approval_requests;
create policy "ai_autopilot_requests_service"
  on public.ai_autopilot_approval_requests for all to service_role
  using (true)
  with check (true);

drop policy if exists "ai_autopilot_events_service" on public.ai_autopilot_approval_events;
create policy "ai_autopilot_events_service"
  on public.ai_autopilot_approval_events for all to service_role
  using (true)
  with check (true);

drop policy if exists "ai_autopilot_requests_admin_read" on public.ai_autopilot_approval_requests;
create policy "ai_autopilot_requests_admin_read"
  on public.ai_autopilot_approval_requests for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');

drop policy if exists "ai_autopilot_events_admin_read" on public.ai_autopilot_approval_events;
create policy "ai_autopilot_events_admin_read"
  on public.ai_autopilot_approval_events for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');
