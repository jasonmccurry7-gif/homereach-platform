-- HomeReach Migration 097 - Unified Action Center durable queue
--
-- Purpose:
--   * Add durable state to the generated AI Action Center.
--   * Preserve all existing dashboard workflows and action sources.
--   * Support snooze, resolve, dismiss, reopen, comments, and audit events.
--   * Do not execute sends, orders, bids, pricing changes, or political outreach.

create extension if not exists pgcrypto;

create table if not exists public.unified_action_items (
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
  reason text not null,
  recommended_action text not null,
  impact text not null,
  urgency text not null default 'medium'
    check (urgency in ('critical','high','medium','low')),
  status text not null default 'needs_review'
    check (status in ('needs_review','blocked','ready','watch')),
  owner text not null default 'admin'
    check (owner in ('admin','sales','jason','operations')),
  requires_human_approval boolean not null default true,

  source_created_at timestamptz,
  due_at timestamptz,
  source_snapshot jsonb not null default '{}'::jsonb,

  state text not null default 'open'
    check (state in ('open','snoozed','resolved','dismissed','archived')),
  snoozed_until timestamptz,
  assigned_to uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolution_note text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists unified_action_items_state_idx
  on public.unified_action_items (state, urgency, due_at);
create index if not exists unified_action_items_owner_idx
  on public.unified_action_items (owner, state, updated_at desc);
create index if not exists unified_action_items_dashboard_idx
  on public.unified_action_items (dashboard, state, updated_at desc);
create index if not exists unified_action_items_due_idx
  on public.unified_action_items (due_at)
  where due_at is not null;

create table if not exists public.unified_action_events (
  id uuid primary key default gen_random_uuid(),
  action_item_id uuid references public.unified_action_items(id) on delete cascade,
  source_key text,
  created_at timestamptz not null default now(),
  event_type text not null
    check (event_type in ('created','observed','updated','snoozed','resolved','dismissed','reopened','commented','archived')),
  actor_id uuid references public.profiles(id) on delete set null,
  note text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists unified_action_events_item_idx
  on public.unified_action_events (action_item_id, created_at desc);
create index if not exists unified_action_events_source_key_idx
  on public.unified_action_events (source_key, created_at desc);

alter table public.unified_action_items enable row level security;
alter table public.unified_action_events enable row level security;

drop policy if exists "unified_action_items_service" on public.unified_action_items;
create policy "unified_action_items_service"
  on public.unified_action_items for all to service_role
  using (true)
  with check (true);

drop policy if exists "unified_action_events_service" on public.unified_action_events;
create policy "unified_action_events_service"
  on public.unified_action_events for all to service_role
  using (true)
  with check (true);

drop policy if exists "unified_action_items_admin_read" on public.unified_action_items;
create policy "unified_action_items_admin_read"
  on public.unified_action_items for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');

drop policy if exists "unified_action_events_admin_read" on public.unified_action_events;
create policy "unified_action_events_admin_read"
  on public.unified_action_events for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');
