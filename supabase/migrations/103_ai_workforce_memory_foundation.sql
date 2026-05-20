-- HomeReach Migration 103 - AI Workforce persistent memory foundation
--
-- Purpose:
--   * Add the durable Phase 2 substrate for shared AI memory, operational events,
--     internal task queues, and ingestion queues.
--   * Keep all execution human-supervised. These tables do not send outreach,
--     publish content, submit bids, place orders, approve pricing, or change
--     payments.
--   * Reuse existing admin/auth and service-role conventions.

create extension if not exists pgcrypto;

create table if not exists public.ai_workforce_entities (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  entity_key text not null unique,
  entity_type text not null
    check (entity_type in ('customer','business','campaign','candidate','supplier','opportunity','lead','route','creative','system','source')),
  dashboard text not null,
  route text,
  display_name text not null,
  external_table text,
  external_id text,
  status text not null default 'active'
    check (status in ('active','watch','blocked','archived')),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists ai_workforce_entities_type_idx
  on public.ai_workforce_entities (entity_type, dashboard, updated_at desc);
create index if not exists ai_workforce_entities_external_idx
  on public.ai_workforce_entities (external_table, external_id)
  where external_table is not null and external_id is not null;

create table if not exists public.ai_workforce_memory_items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  memory_key text not null unique,
  entity_id uuid references public.ai_workforce_entities(id) on delete set null,
  agent_id text,
  dashboard text not null,
  memory_type text not null
    check (memory_type in ('preference','decision','risk','opportunity','summary','playbook','constraint','credential_gap','source_note','qa_note')),
  title text not null,
  summary text not null,
  source text not null,
  source_id text,
  route text,
  confidence numeric not null default 0.75
    check (confidence >= 0 and confidence <= 1),
  impact_level text not null default 'medium'
    check (impact_level in ('critical','high','medium','low')),
  retention_policy text not null default 'retain_until_replaced'
    check (retention_policy in ('retain_until_replaced','retain_90_days','retain_1_year','permanent','archive_on_resolved')),
  visibility text not null default 'admin'
    check (visibility in ('admin','operations','system')),
  status text not null default 'active'
    check (status in ('active','superseded','resolved','archived')),
  superseded_by uuid references public.ai_workforce_memory_items(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists ai_workforce_memory_dashboard_idx
  on public.ai_workforce_memory_items (dashboard, status, updated_at desc);
create index if not exists ai_workforce_memory_entity_idx
  on public.ai_workforce_memory_items (entity_id, status, updated_at desc)
  where entity_id is not null;
create index if not exists ai_workforce_memory_agent_idx
  on public.ai_workforce_memory_items (agent_id, status, updated_at desc)
  where agent_id is not null;
create index if not exists ai_workforce_memory_type_idx
  on public.ai_workforce_memory_items (memory_type, impact_level, updated_at desc);

create table if not exists public.ai_workforce_event_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  occurred_at timestamptz not null default now(),
  event_key text unique,
  event_type text not null
    check (event_type in ('observed','recommended','queued','approved','rejected','executed_elsewhere','blocked','failed','resolved','commented','ingested','synced')),
  agent_id text,
  dashboard text not null,
  entity_id uuid references public.ai_workforce_entities(id) on delete set null,
  actor_type text not null default 'system'
    check (actor_type in ('admin','agent','system','cron','webhook')),
  actor_id uuid references public.profiles(id) on delete set null,
  title text not null,
  summary text not null,
  route text,
  severity text not null default 'info'
    check (severity in ('info','success','warning','critical')),
  source text not null,
  source_id text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists ai_workforce_event_log_dashboard_idx
  on public.ai_workforce_event_log (dashboard, occurred_at desc);
create index if not exists ai_workforce_event_log_agent_idx
  on public.ai_workforce_event_log (agent_id, occurred_at desc)
  where agent_id is not null;
create index if not exists ai_workforce_event_log_entity_idx
  on public.ai_workforce_event_log (entity_id, occurred_at desc)
  where entity_id is not null;
create index if not exists ai_workforce_event_log_severity_idx
  on public.ai_workforce_event_log (severity, occurred_at desc);

create table if not exists public.ai_workforce_task_queue (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  task_key text not null unique,
  agent_id text not null,
  dashboard text not null,
  entity_id uuid references public.ai_workforce_entities(id) on delete set null,
  title text not null,
  description text not null,
  recommended_action text not null,
  route text,
  priority text not null default 'medium'
    check (priority in ('critical','high','medium','low')),
  status text not null default 'queued'
    check (status in ('queued','needs_approval','approved','in_progress','blocked','done','rejected','archived')),
  requires_human_approval boolean not null default true,
  approval_request_id uuid references public.ai_autopilot_approval_requests(id) on delete set null,
  action_item_id uuid references public.unified_action_items(id) on delete set null,
  due_at timestamptz,
  locked_at timestamptz,
  locked_by text,
  completed_at timestamptz,
  completed_by uuid references public.profiles(id) on delete set null,
  result_summary text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists ai_workforce_task_queue_status_idx
  on public.ai_workforce_task_queue (status, priority, due_at);
create index if not exists ai_workforce_task_queue_agent_idx
  on public.ai_workforce_task_queue (agent_id, status, updated_at desc);
create index if not exists ai_workforce_task_queue_dashboard_idx
  on public.ai_workforce_task_queue (dashboard, status, updated_at desc);

create table if not exists public.ai_workforce_ingestion_queue (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source_key text not null unique,
  source_type text not null
    check (source_type in ('youtube','webpage','rss','sam_gov','manual','csv','api','competitor','document')),
  source_url text,
  title text not null,
  dashboard text not null default 'Learning Engine',
  requested_by uuid references public.profiles(id) on delete set null,
  priority text not null default 'medium'
    check (priority in ('critical','high','medium','low')),
  status text not null default 'queued'
    check (status in ('queued','approved','ingesting','needs_review','blocked','completed','rejected','archived')),
  review_required boolean not null default true,
  assigned_agent_id text,
  next_step text not null default 'Review source and approve ingestion before analysis.',
  last_error text,
  processed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists ai_workforce_ingestion_queue_status_idx
  on public.ai_workforce_ingestion_queue (status, priority, updated_at desc);
create index if not exists ai_workforce_ingestion_queue_dashboard_idx
  on public.ai_workforce_ingestion_queue (dashboard, status, updated_at desc);
create index if not exists ai_workforce_ingestion_queue_agent_idx
  on public.ai_workforce_ingestion_queue (assigned_agent_id, status, updated_at desc)
  where assigned_agent_id is not null;

alter table public.ai_workforce_entities enable row level security;
alter table public.ai_workforce_memory_items enable row level security;
alter table public.ai_workforce_event_log enable row level security;
alter table public.ai_workforce_task_queue enable row level security;
alter table public.ai_workforce_ingestion_queue enable row level security;

drop policy if exists "ai_workforce_entities_service" on public.ai_workforce_entities;
create policy "ai_workforce_entities_service"
  on public.ai_workforce_entities for all to service_role
  using (true)
  with check (true);

drop policy if exists "ai_workforce_memory_items_service" on public.ai_workforce_memory_items;
create policy "ai_workforce_memory_items_service"
  on public.ai_workforce_memory_items for all to service_role
  using (true)
  with check (true);

drop policy if exists "ai_workforce_event_log_service" on public.ai_workforce_event_log;
create policy "ai_workforce_event_log_service"
  on public.ai_workforce_event_log for all to service_role
  using (true)
  with check (true);

drop policy if exists "ai_workforce_task_queue_service" on public.ai_workforce_task_queue;
create policy "ai_workforce_task_queue_service"
  on public.ai_workforce_task_queue for all to service_role
  using (true)
  with check (true);

drop policy if exists "ai_workforce_ingestion_queue_service" on public.ai_workforce_ingestion_queue;
create policy "ai_workforce_ingestion_queue_service"
  on public.ai_workforce_ingestion_queue for all to service_role
  using (true)
  with check (true);

drop policy if exists "ai_workforce_entities_admin_read" on public.ai_workforce_entities;
create policy "ai_workforce_entities_admin_read"
  on public.ai_workforce_entities for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');

drop policy if exists "ai_workforce_memory_items_admin_read" on public.ai_workforce_memory_items;
create policy "ai_workforce_memory_items_admin_read"
  on public.ai_workforce_memory_items for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');

drop policy if exists "ai_workforce_event_log_admin_read" on public.ai_workforce_event_log;
create policy "ai_workforce_event_log_admin_read"
  on public.ai_workforce_event_log for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');

drop policy if exists "ai_workforce_task_queue_admin_read" on public.ai_workforce_task_queue;
create policy "ai_workforce_task_queue_admin_read"
  on public.ai_workforce_task_queue for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');

drop policy if exists "ai_workforce_ingestion_queue_admin_read" on public.ai_workforce_ingestion_queue;
create policy "ai_workforce_ingestion_queue_admin_read"
  on public.ai_workforce_ingestion_queue for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');
