-- HomeReach Approval Ledger Spine
--
-- Purpose:
--   * Add one canonical approval ledger for review-sensitive work across
--     revenue, political, procurement, GovCon, creative, SEO, ad-tech, AI
--     assets, daily content, and operations workflows.
--   * Preserve existing domain approval tables and routes. This migration is
--     additive and does not send, publish, submit, charge, or mutate source
--     workflow records.
--   * Provide an event history table for approval state transitions without
--     replacing ai_output_reviews or domain-specific audit tables yet.

create extension if not exists pgcrypto;

create table if not exists public.approval_ledger (
  id uuid primary key default gen_random_uuid(),

  source_key text not null,
  source_system text not null,
  source_table text,
  source_id text not null,
  source_href text,

  domain text not null check (domain in (
    'revenue',
    'political',
    'procurement',
    'gov_contracts',
    'creative',
    'ai_assets',
    'daily_content',
    'social',
    'seo',
    'ad_tech',
    'operations',
    'campaigns',
    'other'
  )),
  approval_kind text not null default 'manual_review',

  title text not null,
  detail text not null default '',
  source_status text not null default 'needs_review',
  approval_state text not null default 'needs_review' check (approval_state in (
    'not_required',
    'draft',
    'needs_review',
    'approved',
    'rejected',
    'revision_needed',
    'blocked',
    'ready_to_send',
    'ready_to_publish',
    'sent',
    'published',
    'submitted',
    'completed',
    'archived'
  )),
  lane text not null default 'needs_approval' check (lane in (
    'blocked',
    'needs_approval',
    'ready_to_send',
    'ready_to_publish',
    'learning',
    'completed',
    'archived'
  )),
  priority text not null default 'normal' check (priority in (
    'critical',
    'high',
    'normal',
    'low'
  )),

  approval_required boolean not null default true,
  human_approval_required boolean not null default true,
  sensitive_action boolean not null default true,

  requested_by uuid references public.profiles(id) on delete set null,
  assigned_to uuid references public.profiles(id) on delete set null,
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,

  related_entity_type text,
  related_entity_id text,
  customer_id uuid,
  campaign_id uuid,
  channel text,
  provider text,

  next_action text not null default '',
  guardrail text not null default '',
  policy_flags text[] not null default '{}',
  compliance_notes text,
  action_target jsonb not null default '{}'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,

  due_at timestamptz,
  source_created_at timestamptz,
  source_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint approval_ledger_source_key_uidx unique (source_key)
);

create index if not exists approval_ledger_state_idx
  on public.approval_ledger (approval_state, priority, updated_at desc);

create index if not exists approval_ledger_lane_idx
  on public.approval_ledger (lane, priority, updated_at desc);

create index if not exists approval_ledger_domain_idx
  on public.approval_ledger (domain, approval_kind, updated_at desc);

create index if not exists approval_ledger_source_idx
  on public.approval_ledger (source_system, source_table, source_id);

create index if not exists approval_ledger_related_entity_idx
  on public.approval_ledger (related_entity_type, related_entity_id)
  where related_entity_type is not null and related_entity_id is not null;

create index if not exists approval_ledger_due_idx
  on public.approval_ledger (due_at, priority)
  where due_at is not null and approval_state in ('draft', 'needs_review', 'approved', 'ready_to_send', 'ready_to_publish', 'blocked');

create table if not exists public.approval_ledger_events (
  id uuid primary key default gen_random_uuid(),
  approval_id uuid not null references public.approval_ledger(id) on delete cascade,
  event_type text not null default 'state_snapshot',
  from_state text,
  to_state text,
  actor_user_id uuid references public.profiles(id) on delete set null,
  actor_label text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists approval_ledger_events_approval_idx
  on public.approval_ledger_events (approval_id, created_at desc);

create index if not exists approval_ledger_events_type_idx
  on public.approval_ledger_events (event_type, created_at desc);

alter table public.approval_ledger enable row level security;
alter table public.approval_ledger_events enable row level security;

grant select, insert, update, delete on
  public.approval_ledger,
  public.approval_ledger_events
to authenticated;

grant all on
  public.approval_ledger,
  public.approval_ledger_events
to service_role;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'approval_ledger'
      and policyname = 'approval_ledger_service_all'
  ) then
    create policy approval_ledger_service_all
      on public.approval_ledger for all to service_role
      using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'approval_ledger'
      and policyname = 'approval_ledger_admin_read'
  ) then
    create policy approval_ledger_admin_read
      on public.approval_ledger for select to authenticated
      using ((auth.jwt() -> 'app_metadata' ->> 'user_role') in ('admin', 'sales_agent'));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'approval_ledger'
      and policyname = 'approval_ledger_admin_write'
  ) then
    create policy approval_ledger_admin_write
      on public.approval_ledger for all to authenticated
      using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin')
      with check ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'approval_ledger_events'
      and policyname = 'approval_ledger_events_service_all'
  ) then
    create policy approval_ledger_events_service_all
      on public.approval_ledger_events for all to service_role
      using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'approval_ledger_events'
      and policyname = 'approval_ledger_events_admin_read'
  ) then
    create policy approval_ledger_events_admin_read
      on public.approval_ledger_events for select to authenticated
      using ((auth.jwt() -> 'app_metadata' ->> 'user_role') in ('admin', 'sales_agent'));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'approval_ledger_events'
      and policyname = 'approval_ledger_events_admin_write'
  ) then
    create policy approval_ledger_events_admin_write
      on public.approval_ledger_events for all to authenticated
      using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin')
      with check ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');
  end if;
end;
$$;

comment on table public.approval_ledger is
  'Canonical HomeReach approval spine for review-sensitive work across domain systems. Existing source tables remain authoritative for execution until each workflow is migrated.';

comment on table public.approval_ledger_events is
  'Append-only approval state history for the canonical approval ledger.';

comment on column public.approval_ledger.source_key is
  'Stable unique key from the source workflow, usually source_table:id:approval_kind.';
