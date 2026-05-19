-- HomeReach Migration 100 - Safe internal autopilot handoff queue
--
-- Purpose:
--   * Add the first Phase 6 execution surface without touching live business workflows.
--   * Approved low/medium-risk AI gates can be queued as internal admin handoffs.
--   * This table is an audit/work queue only. It does not send messages, place orders,
--     submit bids, change pricing, create checkout links, or contact customers.

create extension if not exists pgcrypto;

alter table public.ai_autopilot_approval_requests
  drop constraint if exists ai_autopilot_approval_requests_executor_status_check;

alter table public.ai_autopilot_approval_requests
  add constraint ai_autopilot_approval_requests_executor_status_check
  check (executor_status in ('approval_only','not_connected','ready','blocked','executed','handoff_ready','handoff_queued'));

alter table public.ai_autopilot_approval_events
  drop constraint if exists ai_autopilot_approval_events_event_type_check;

alter table public.ai_autopilot_approval_events
  add constraint ai_autopilot_approval_events_event_type_check
  check (event_type in (
    'created',
    'observed',
    'approved',
    'rejected',
    'canceled',
    'expired',
    'executed',
    'commented',
    'execution_queued',
    'execution_blocked',
    'execution_completed',
    'execution_failed'
  ));

create table if not exists public.ai_autopilot_execution_runs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.ai_autopilot_approval_requests(id) on delete cascade,
  source_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  queued_by uuid references public.profiles(id) on delete set null,
  completed_by uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,

  execution_type text not null default 'internal_handoff'
    check (execution_type in ('internal_handoff')),
  execution_status text not null default 'queued'
    check (execution_status in ('queued','completed','failed','blocked','canceled')),
  executor_key text not null default 'safe_internal_handoff_v1',
  action_summary text not null,
  guardrail_summary text not null,
  rollback_note text not null default 'No external workflow was executed. Canceling this run only changes the internal handoff status.',
  preview_payload jsonb not null default '{}'::jsonb,
  result_summary text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists ai_autopilot_execution_runs_request_idx
  on public.ai_autopilot_execution_runs (request_id, created_at desc);
create index if not exists ai_autopilot_execution_runs_status_idx
  on public.ai_autopilot_execution_runs (execution_status, created_at desc);
create unique index if not exists ai_autopilot_execution_runs_open_handoff_idx
  on public.ai_autopilot_execution_runs (request_id)
  where execution_status in ('queued','blocked');

alter table public.ai_autopilot_execution_runs enable row level security;

drop policy if exists "ai_autopilot_execution_runs_service" on public.ai_autopilot_execution_runs;
create policy "ai_autopilot_execution_runs_service"
  on public.ai_autopilot_execution_runs for all to service_role
  using (true)
  with check (true);

drop policy if exists "ai_autopilot_execution_runs_admin_read" on public.ai_autopilot_execution_runs;
create policy "ai_autopilot_execution_runs_admin_read"
  on public.ai_autopilot_execution_runs for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');
