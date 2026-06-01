-- HomeReach Migration 096 - Foundation Control Tower
--
-- Purpose:
--   * Add one universal, admin-only audit surface for system, communication,
--     automation, approval, webhook, and AI workflow events.
--   * Register feature/safety controls without replacing existing
--     system_controls, revenue_message_*, Postmark, Twilio, Stripe, or
--     campaign tables.
--   * Add a daily executive brief store for 5 PM operational summaries.
--
-- Safe to re-run. Additive only.

create extension if not exists pgcrypto;

create table if not exists public.platform_audit_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),

  actor_type text not null default 'system' check (actor_type in (
    'human',
    'ai',
    'system',
    'cron',
    'webhook',
    'integration'
  )),
  actor_id uuid,
  actor_label text,

  module text not null,
  action_type text not null,
  entity_type text,
  entity_id text,
  source_table text,
  source_id text,
  customer_id uuid,
  campaign_id uuid,
  channel text,
  provider text,

  result_status text not null default 'success' check (result_status in (
    'success',
    'failure',
    'blocked',
    'pending_approval',
    'skipped',
    'warning'
  )),
  approval_state text not null default 'not_required' check (approval_state in (
    'not_required',
    'draft',
    'needs_review',
    'approved',
    'rejected',
    'sent',
    'canceled'
  )),
  severity text not null default 'info' check (severity in (
    'info',
    'low',
    'medium',
    'high',
    'critical'
  )),

  message text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists platform_audit_events_time_idx
  on public.platform_audit_events (occurred_at desc);

create index if not exists platform_audit_events_module_idx
  on public.platform_audit_events (module, occurred_at desc);

create index if not exists platform_audit_events_result_idx
  on public.platform_audit_events (result_status, severity, occurred_at desc);

create index if not exists platform_audit_events_entity_idx
  on public.platform_audit_events (entity_type, entity_id)
  where entity_type is not null and entity_id is not null;

create table if not exists public.platform_feature_flags (
  flag_key text primary key,
  label text not null,
  module text not null,
  status text not null default 'future_ready' check (status in (
    'active',
    'paused',
    'monitor_only',
    'future_ready',
    'retired'
  )),
  enabled boolean not null default false,
  kill_switch boolean not null default false,
  requires_approval boolean not null default true,
  safety_level text not null default 'medium' check (safety_level in (
    'low',
    'medium',
    'high',
    'critical'
  )),
  backing_control_table text,
  backing_control_column text,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create index if not exists platform_feature_flags_module_idx
  on public.platform_feature_flags (module, status);

create table if not exists public.platform_daily_briefs (
  id uuid primary key default gen_random_uuid(),
  brief_date date not null unique,
  title text not null default 'HomeReach Daily Executive Brief',
  status text not null default 'draft' check (status in (
    'draft',
    'ready',
    'sent',
    'archived'
  )),
  generated_at timestamptz not null default now(),
  delivery_channel text not null default 'admin_dashboard',
  recipient text,
  summary_markdown text not null,
  metrics jsonb not null default '{}'::jsonb,
  risks jsonb not null default '[]'::jsonb,
  priorities jsonb not null default '[]'::jsonb,
  source_snapshot jsonb not null default '{}'::jsonb,
  created_by uuid
);

create index if not exists platform_daily_briefs_generated_idx
  on public.platform_daily_briefs (generated_at desc);

insert into public.platform_feature_flags (
  flag_key,
  label,
  module,
  status,
  enabled,
  kill_switch,
  requires_approval,
  safety_level,
  backing_control_table,
  backing_control_column,
  description
) values
  (
    'control.global_outbound_pause',
    'Global outbound pause',
    'communications',
    'monitor_only',
    false,
    true,
    true,
    'critical',
    'system_controls',
    'all_paused',
    'Authoritative runtime kill switch remains system_controls.all_paused.'
  ),
  (
    'control.email_channel_pause',
    'Email channel pause',
    'communications',
    'monitor_only',
    false,
    true,
    true,
    'high',
    'system_controls',
    'email_paused',
    'Authoritative email channel pause remains system_controls.email_paused.'
  ),
  (
    'control.sms_channel_pause',
    'SMS channel pause',
    'communications',
    'monitor_only',
    false,
    true,
    true,
    'high',
    'system_controls',
    'sms_paused',
    'Authoritative SMS channel pause remains system_controls.sms_paused.'
  ),
  (
    'control.manual_approval_mode',
    'Manual approval mode',
    'approvals',
    'monitor_only',
    false,
    false,
    true,
    'critical',
    'system_controls',
    'manual_approval_mode',
    'Authoritative approval gate remains system_controls.manual_approval_mode.'
  ),
  (
    'ai.autonomous_high_risk_actions',
    'AI autonomous high-risk actions',
    'ai_workforce',
    'paused',
    false,
    true,
    true,
    'critical',
    null,
    null,
    'High-risk sends, bids, payments, political publishing, and ad launches remain human-approved.'
  ),
  (
    'seo.auto_publish',
    'SEO auto-publish',
    'seo',
    'paused',
    false,
    true,
    true,
    'high',
    null,
    null,
    'SEO content generation may draft and recommend; publishing requires human approval.'
  ),
  (
    'gov_contracts.auto_submit',
    'Government bid auto-submit',
    'government_contracts',
    'paused',
    false,
    true,
    true,
    'critical',
    null,
    null,
    'Government bids must never submit without explicit human approval.'
  ),
  (
    'paid_media.auto_launch',
    'Paid media auto-launch',
    'paid_media',
    'future_ready',
    false,
    true,
    true,
    'high',
    null,
    null,
    'Paid ads are structurally reserved but not auto-launched.'
  )
on conflict (flag_key) do update
set
  label = excluded.label,
  module = excluded.module,
  status = excluded.status,
  kill_switch = excluded.kill_switch,
  requires_approval = excluded.requires_approval,
  safety_level = excluded.safety_level,
  backing_control_table = excluded.backing_control_table,
  backing_control_column = excluded.backing_control_column,
  description = excluded.description,
  updated_at = now();

alter table public.platform_audit_events enable row level security;
alter table public.platform_feature_flags enable row level security;
alter table public.platform_daily_briefs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'platform_audit_events'
      and policyname = 'platform_audit_events_service_all'
  ) then
    create policy platform_audit_events_service_all
      on public.platform_audit_events for all to service_role
      using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'platform_audit_events'
      and policyname = 'platform_audit_events_admin_read'
  ) then
    create policy platform_audit_events_admin_read
      on public.platform_audit_events for select to authenticated
      using (coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'admin');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'platform_feature_flags'
      and policyname = 'platform_feature_flags_service_all'
  ) then
    create policy platform_feature_flags_service_all
      on public.platform_feature_flags for all to service_role
      using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'platform_feature_flags'
      and policyname = 'platform_feature_flags_admin_all'
  ) then
    create policy platform_feature_flags_admin_all
      on public.platform_feature_flags for all to authenticated
      using (coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'admin')
      with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'admin');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'platform_daily_briefs'
      and policyname = 'platform_daily_briefs_service_all'
  ) then
    create policy platform_daily_briefs_service_all
      on public.platform_daily_briefs for all to service_role
      using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'platform_daily_briefs'
      and policyname = 'platform_daily_briefs_admin_all'
  ) then
    create policy platform_daily_briefs_admin_all
      on public.platform_daily_briefs for all to authenticated
      using (coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'admin')
      with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'admin');
  end if;
end;
$$;

comment on table public.platform_audit_events is
  'Universal append-first audit log for HomeReach control tower, communications, approvals, webhooks, AI, automation, and safety events.';

comment on table public.platform_feature_flags is
  'Feature and safety-control registry. Existing runtime controls remain authoritative where backing_control_* is set.';

comment on table public.platform_daily_briefs is
  'Daily executive brief store for HomeReach 5 PM operational summaries.';;
