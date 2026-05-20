-- HomeReach Migration 101 - Autopilot internal task executor
--
-- Purpose:
--   * Connect safe autopilot handoffs to existing internal CRM tasks.
--   * Preserve the existing CRM/admin task workflow instead of creating another task system.
--   * This creates internal tasks only. It does not send outreach, place orders,
--     submit bids, alter pricing, create checkout, or contact customers.

alter table public.ai_autopilot_approval_requests
  drop constraint if exists ai_autopilot_approval_requests_executor_status_check;

alter table public.ai_autopilot_approval_requests
  add constraint ai_autopilot_approval_requests_executor_status_check
  check (executor_status in (
    'approval_only',
    'not_connected',
    'ready',
    'blocked',
    'executed',
    'handoff_ready',
    'handoff_queued',
    'task_ready',
    'task_created'
  ));

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
    'execution_failed',
    'internal_task_created'
  ));

alter table public.ai_autopilot_execution_runs
  add column if not exists internal_task_id uuid references public.crm_tasks(id) on delete set null,
  add column if not exists internal_task_created_at timestamptz;

create unique index if not exists ai_autopilot_execution_runs_one_task_per_request_idx
  on public.ai_autopilot_execution_runs (request_id)
  where internal_task_id is not null;
