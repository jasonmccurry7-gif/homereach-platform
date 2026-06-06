-- Voice Approval Command Center foundation
--
-- This is an additive bridge layer for spoken review/approval workflows.
-- It reuses existing approval, AI workforce, and outbound systems instead of
-- replacing them. Nothing in this migration sends email/SMS/DMs, changes
-- pricing, submits proposals, or performs external actions.

create extension if not exists pgcrypto;

create table if not exists public.action_queue (
  id uuid primary key default gen_random_uuid(),

  action_type text not null check (action_type in (
    'email',
    'sms',
    'dm',
    'proposal',
    'follow_up',
    'internal_task'
  )),
  channel text not null default 'internal' check (channel in (
    'email',
    'sms',
    'facebook_dm',
    'instagram_dm',
    'linkedin_dm',
    'proposal',
    'internal',
    'other'
  )),

  recipient_name text,
  recipient_email text,
  recipient_phone text,
  business_name text,
  campaign_id uuid,
  city text,
  vertical text,
  subject text,
  body text not null default '',

  status text not null default 'draft' check (status in (
    'draft',
    'pending_approval',
    'approved',
    'rejected',
    'sent',
    'failed',
    'paused'
  )),
  risk_level text not null default 'medium' check (risk_level in (
    'low',
    'medium',
    'high'
  )),

  created_by_agent text,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  sent_at timestamptz,
  failure_reason text,

  source_system text,
  source_table text,
  source_id text,
  source_key text,
  approval_ledger_id uuid references public.approval_ledger(id) on delete set null,
  ai_workforce_task_id uuid references public.ai_workforce_tasks(id) on delete set null,
  ai_output_id uuid references public.ai_outputs(id) on delete set null,

  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint action_queue_approved_state_consistency check (
    (status not in ('approved', 'sent') or approved_at is not null)
  ),
  constraint action_queue_sent_state_consistency check (
    (status <> 'sent' or sent_at is not null)
  )
);

create table if not exists public.voice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  transcript text not null default '',
  summary text not null default '',
  model_used text not null default 'not_started',
  status text not null default 'active' check (status in (
    'active',
    'completed',
    'failed',
    'cancelled'
  )),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.voice_approvals (
  id uuid primary key default gen_random_uuid(),
  voice_session_id uuid references public.voice_sessions(id) on delete set null,
  action_queue_ids uuid[] not null default '{}'::uuid[],
  approval_phrase text not null,
  approval_type text not null check (approval_type in (
    'approve',
    'reject',
    'pause',
    'rewrite',
    'send_now'
  )),
  transcript_snippet text not null default '',
  confidence_score numeric(5,4) not null default 0 check (
    confidence_score >= 0 and confidence_score <= 1
  ),
  executed boolean not null default false,
  executed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint voice_approvals_executed_consistency check (
    (executed = false and executed_at is null) or (executed = true and executed_at is not null)
  )
);

create table if not exists public.agent_briefings (
  id uuid primary key default gen_random_uuid(),
  briefing_type text not null check (briefing_type in (
    'morning',
    'afternoon',
    'on_demand'
  )),
  agent_name text not null,
  agent_role text not null,
  summary text not null default '',
  recommendations jsonb not null default '[]'::jsonb,
  proposed_actions jsonb not null default '[]'::jsonb,
  source_snapshot jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.communication_audit_log (
  id uuid primary key default gen_random_uuid(),
  action_queue_id uuid references public.action_queue(id) on delete set null,
  event_type text not null,
  old_status text,
  new_status text,
  actor_type text not null default 'system' check (actor_type in (
    'user',
    'agent',
    'system'
  )),
  actor_name text,
  actor_user_id uuid references public.profiles(id) on delete set null,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists action_queue_status_idx
  on public.action_queue (status, risk_level, updated_at desc);

create index if not exists action_queue_channel_idx
  on public.action_queue (channel, status, updated_at desc);

create index if not exists action_queue_campaign_idx
  on public.action_queue (campaign_id, status)
  where campaign_id is not null;

create index if not exists action_queue_source_idx
  on public.action_queue (source_system, source_table, source_id)
  where source_system is not null and source_id is not null;

create unique index if not exists action_queue_source_key_uidx
  on public.action_queue (source_key);

create index if not exists action_queue_approval_ledger_idx
  on public.action_queue (approval_ledger_id)
  where approval_ledger_id is not null;

create index if not exists voice_sessions_user_idx
  on public.voice_sessions (user_id, started_at desc);

create index if not exists voice_sessions_status_idx
  on public.voice_sessions (status, started_at desc);

create index if not exists voice_approvals_session_idx
  on public.voice_approvals (voice_session_id, created_at desc);

create index if not exists voice_approvals_action_ids_idx
  on public.voice_approvals using gin (action_queue_ids);

create index if not exists agent_briefings_latest_idx
  on public.agent_briefings (briefing_type, created_at desc);

create index if not exists agent_briefings_agent_idx
  on public.agent_briefings (agent_name, created_at desc);

create index if not exists communication_audit_action_idx
  on public.communication_audit_log (action_queue_id, created_at desc);

create index if not exists communication_audit_event_idx
  on public.communication_audit_log (event_type, created_at desc);

create or replace function public.tg_voice_command_center_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists action_queue_touch_updated_at on public.action_queue;
create trigger action_queue_touch_updated_at
before update on public.action_queue
for each row execute function public.tg_voice_command_center_touch_updated_at();

drop trigger if exists voice_sessions_touch_updated_at on public.voice_sessions;
create trigger voice_sessions_touch_updated_at
before update on public.voice_sessions
for each row execute function public.tg_voice_command_center_touch_updated_at();

create or replace function public.voice_command_center_prevent_secret_like_storage()
returns trigger
language plpgsql
as $$
declare
  row_json jsonb;
  text_field text;
  json_field text;
begin
  row_json := to_jsonb(new);

  foreach text_field in array array[
    'recipient_name',
    'recipient_email',
    'recipient_phone',
    'business_name',
    'city',
    'vertical',
    'subject',
    'body',
    'created_by_agent',
    'failure_reason',
    'transcript',
    'summary',
    'model_used',
    'approval_phrase',
    'transcript_snippet',
    'agent_name',
    'agent_role',
    'event_type',
    'actor_name',
    'notes'
  ] loop
    if row_json ? text_field then
      perform public.agent_assert_text_has_no_secret_like_value(row_json->>text_field, tg_table_name || '.' || text_field);
    end if;
  end loop;

  foreach json_field in array array[
    'metadata',
    'recommendations',
    'proposed_actions',
    'source_snapshot'
  ] loop
    if row_json ? json_field then
      perform public.agent_assert_jsonb_has_no_secret_like_value(row_json->json_field, tg_table_name || '.' || json_field);
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists action_queue_prevent_secret_like_storage on public.action_queue;
create trigger action_queue_prevent_secret_like_storage
before insert or update on public.action_queue
for each row execute function public.voice_command_center_prevent_secret_like_storage();

drop trigger if exists voice_sessions_prevent_secret_like_storage on public.voice_sessions;
create trigger voice_sessions_prevent_secret_like_storage
before insert or update on public.voice_sessions
for each row execute function public.voice_command_center_prevent_secret_like_storage();

drop trigger if exists voice_approvals_prevent_secret_like_storage on public.voice_approvals;
create trigger voice_approvals_prevent_secret_like_storage
before insert or update on public.voice_approvals
for each row execute function public.voice_command_center_prevent_secret_like_storage();

drop trigger if exists agent_briefings_prevent_secret_like_storage on public.agent_briefings;
create trigger agent_briefings_prevent_secret_like_storage
before insert or update on public.agent_briefings
for each row execute function public.voice_command_center_prevent_secret_like_storage();

drop trigger if exists communication_audit_log_prevent_secret_like_storage on public.communication_audit_log;
create trigger communication_audit_log_prevent_secret_like_storage
before insert or update on public.communication_audit_log
for each row execute function public.voice_command_center_prevent_secret_like_storage();

alter table public.action_queue enable row level security;
alter table public.voice_sessions enable row level security;
alter table public.voice_approvals enable row level security;
alter table public.agent_briefings enable row level security;
alter table public.communication_audit_log enable row level security;

grant select, insert, update, delete on
  public.action_queue,
  public.voice_sessions,
  public.voice_approvals,
  public.agent_briefings,
  public.communication_audit_log
to authenticated;

grant all on
  public.action_queue,
  public.voice_sessions,
  public.voice_approvals,
  public.agent_briefings,
  public.communication_audit_log
to service_role;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'action_queue',
    'voice_sessions',
    'voice_approvals',
    'agent_briefings',
    'communication_audit_log'
  ] loop
    execute format(
      'drop policy if exists %I on public.%I',
      table_name || '_service_all',
      table_name
    );
    execute format(
      'create policy %I on public.%I for all to service_role using (true) with check (true)',
      table_name || '_service_all',
      table_name
    );

    execute format(
      'drop policy if exists %I on public.%I',
      table_name || '_admin_sales_read',
      table_name
    );
    execute format(
      'create policy %I on public.%I for select to authenticated using ((auth.jwt() -> ''app_metadata'' ->> ''user_role'') in (''admin'', ''sales_agent''))',
      table_name || '_admin_sales_read',
      table_name
    );

    execute format(
      'drop policy if exists %I on public.%I',
      table_name || '_admin_write',
      table_name
    );
    execute format(
      'create policy %I on public.%I for all to authenticated using ((auth.jwt() -> ''app_metadata'' ->> ''user_role'') = ''admin'') with check ((auth.jwt() -> ''app_metadata'' ->> ''user_role'') = ''admin'')',
      table_name || '_admin_write',
      table_name
    );
  end loop;
end;
$$;

revoke execute on function public.voice_command_center_prevent_secret_like_storage() from public, anon, authenticated;
revoke execute on function public.tg_voice_command_center_touch_updated_at() from public, anon, authenticated;

comment on table public.action_queue is
  'Voice Approval Command Center bridge queue for reviewable outbound and internal actions. Links to existing approval ledger, AI workforce, and AI output records where available. Does not send by itself.';

comment on table public.voice_sessions is
  'Voice command sessions with transcript and summary capture. Sensitive actions must be linked through voice_approvals and communication_audit_log.';

comment on table public.voice_approvals is
  'Durable record of spoken approval, rejection, pause, rewrite, or send-now intent linked to action_queue rows.';

comment on table public.agent_briefings is
  'Voice-ready agent briefing snapshots for morning, afternoon, and on-demand executive reports.';

comment on table public.communication_audit_log is
  'Durable audit trail for action_queue status changes and communication-safety events.';
