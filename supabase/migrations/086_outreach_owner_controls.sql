-- HomeReach Migration 086 - Outreach owner controls and send-safety hardening
--
-- Purpose:
--   * Store the owner outreach identity in one editable database row.
--   * Add global/channel outreach controls for emergency pause, test mode,
--     manual review mode, and conservative daily caps.
--   * Repair historical schema drift between count/sent_count and
--     msg_hash/message_hash so existing routes keep working.
--   * Replace the send-count RPC with a conservative cap-aware version.
--
-- Safe to re-run. All DDL is additive or CREATE OR REPLACE.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- System-level controls
-- ---------------------------------------------------------------------------

create table if not exists public.system_controls (
  id smallint primary key default 1 check (id = 1),
  all_paused boolean not null default false,
  paused_by uuid,
  paused_at timestamptz,
  pause_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.system_controls
  add column if not exists sms_paused boolean not null default false,
  add column if not exists email_paused boolean not null default false,
  add column if not exists facebook_paused boolean not null default false,
  add column if not exists outreach_test_mode boolean not null default false,
  add column if not exists manual_approval_mode boolean not null default false,
  add column if not exists sms_prospecting_live_enabled boolean not null default false,
  add column if not exists email_rotation_enabled boolean not null default false,
  add column if not exists daily_sms_cap integer not null default 30,
  add column if not exists daily_email_cap_per_sender integer not null default 30,
  add column if not exists automation_batch_limit integer not null default 10,
  add column if not exists business_start_minutes integer not null default 510,
  add column if not exists business_end_minutes integer not null default 1050,
  add column if not exists weekday_only boolean not null default true,
  add column if not exists default_time_zone text not null default 'America/New_York',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists updated_by uuid;

insert into public.system_controls (id)
values (1)
on conflict (id) do nothing;

update public.system_controls
set
  daily_sms_cap = least(greatest(coalesce(daily_sms_cap, 30), 1), 30),
  daily_email_cap_per_sender = least(greatest(coalesce(daily_email_cap_per_sender, 30), 1), 30),
  automation_batch_limit = least(greatest(coalesce(automation_batch_limit, 10), 1), 10),
  business_start_minutes = coalesce(business_start_minutes, 510),
  business_end_minutes = coalesce(business_end_minutes, 1050),
  default_time_zone = coalesce(nullif(default_time_zone, ''), 'America/New_York')
where id = 1;

-- ---------------------------------------------------------------------------
-- Editable owner identity singleton
-- ---------------------------------------------------------------------------

create table if not exists public.outreach_owner_settings (
  id smallint primary key default 1 check (id = 1),
  owner_name text not null default 'Jason McCurry',
  owner_cell_phone text not null default '+13302069639',
  owner_personal_email text not null default 'Jasonmccurry7@gmail.com',
  owner_secondary_email text not null default 'Livetogivemarketing@gmail.com',
  owner_domain_email text not null default 'Jason@home-reach.com',
  default_from_email text not null default 'Jason@home-reach.com',
  default_reply_to_email text not null default 'Jason@home-reach.com',
  fallback_reply_to_email text not null default 'Jasonmccurry7@gmail.com',
  editable_from_admin boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

insert into public.outreach_owner_settings (
  id,
  owner_name,
  owner_cell_phone,
  owner_personal_email,
  owner_secondary_email,
  owner_domain_email,
  default_from_email,
  default_reply_to_email,
  fallback_reply_to_email
)
values (
  1,
  'Jason McCurry',
  '+13302069639',
  'Jasonmccurry7@gmail.com',
  'Livetogivemarketing@gmail.com',
  'Jason@home-reach.com',
  'Jason@home-reach.com',
  'Jason@home-reach.com',
  'Jasonmccurry7@gmail.com'
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Agent identity and daily send count compatibility
-- ---------------------------------------------------------------------------

create table if not exists public.agent_identities (
  agent_id uuid primary key,
  from_email text,
  from_name text,
  mailgun_domain text,
  reply_to_email text,
  twilio_phone text,
  twilio_msgsvc_sid text,
  email_daily_limit integer not null default 30,
  sms_daily_limit integer not null default 30,
  email_ramp_day integer not null default 1,
  email_ramp_started date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agent_identities
  add column if not exists from_email text,
  add column if not exists from_name text,
  add column if not exists mailgun_domain text,
  add column if not exists reply_to_email text,
  add column if not exists twilio_phone text,
  add column if not exists twilio_msgsvc_sid text,
  add column if not exists email_daily_limit integer not null default 30,
  add column if not exists sms_daily_limit integer not null default 30,
  add column if not exists email_ramp_day integer not null default 1,
  add column if not exists email_ramp_started date,
  add column if not exists is_active boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.agent_identities
  alter column email_daily_limit set default 30,
  alter column sms_daily_limit set default 30;

create table if not exists public.agent_daily_send_counts (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null,
  send_date date not null default current_date,
  channel text not null,
  sent_count integer not null default 0,
  "count" integer not null default 0,
  last_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agent_daily_send_counts
  add column if not exists sent_count integer not null default 0,
  add column if not exists "count" integer not null default 0,
  add column if not exists last_sent_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.agent_daily_send_counts
set
  sent_count = greatest(coalesce(sent_count, 0), coalesce("count", 0)),
  "count" = greatest(coalesce(sent_count, 0), coalesce("count", 0)),
  updated_at = now();

with ranked as (
  select
    id,
    row_number() over (
      partition by agent_id, send_date, channel
      order by updated_at desc nulls last, created_at desc nulls last, id
    ) as rn
  from public.agent_daily_send_counts
)
delete from public.agent_daily_send_counts c
using ranked r
where c.id = r.id
  and r.rn > 1;

create unique index if not exists agent_daily_send_counts_agent_day_channel_uidx
  on public.agent_daily_send_counts (agent_id, send_date, channel);

create index if not exists agent_daily_send_counts_agent_date_idx
  on public.agent_daily_send_counts (agent_id, send_date desc);

create index if not exists agent_daily_send_counts_channel_idx
  on public.agent_daily_send_counts (channel);

create or replace function public.sync_agent_daily_send_counts()
returns trigger language plpgsql as $$
declare
  v_next integer;
begin
  v_next := greatest(coalesce(new.sent_count, 0), coalesce(new."count", 0));
  new.sent_count := v_next;
  new."count" := v_next;
  new.updated_at := now();
  if new.last_sent_at is null and v_next > 0 then
    new.last_sent_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_agent_daily_send_counts on public.agent_daily_send_counts;
create trigger trg_sync_agent_daily_send_counts
before insert or update on public.agent_daily_send_counts
for each row execute function public.sync_agent_daily_send_counts();

-- ---------------------------------------------------------------------------
-- Message-hash compatibility and dedupe
-- ---------------------------------------------------------------------------

create table if not exists public.agent_message_hashes (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid,
  lead_id uuid,
  channel text default 'email',
  msg_hash text,
  message_hash text,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.agent_message_hashes
  add column if not exists channel text default 'email',
  add column if not exists msg_hash text,
  add column if not exists message_hash text,
  add column if not exists sent_at timestamptz not null default now(),
  add column if not exists created_at timestamptz not null default now();

update public.agent_message_hashes
set
  msg_hash = coalesce(msg_hash, message_hash),
  message_hash = coalesce(message_hash, msg_hash),
  channel = coalesce(channel, 'email'),
  sent_at = coalesce(sent_at, created_at, now()),
  created_at = coalesce(created_at, sent_at, now());

with ranked as (
  select
    id,
    row_number() over (
      partition by
        coalesce(agent_id::text, 'system'),
        lead_id,
        coalesce(channel, 'email'),
        coalesce(msg_hash, message_hash)
      order by sent_at desc nulls last, created_at desc nulls last, id
    ) as rn
  from public.agent_message_hashes
  where coalesce(msg_hash, message_hash) is not null
)
delete from public.agent_message_hashes h
using ranked r
where h.id = r.id
  and r.rn > 1;

create or replace function public.sync_agent_message_hashes()
returns trigger language plpgsql as $$
declare
  v_hash text;
begin
  v_hash := coalesce(new.msg_hash, new.message_hash);
  new.msg_hash := v_hash;
  new.message_hash := v_hash;
  new.channel := coalesce(new.channel, 'email');
  new.sent_at := coalesce(new.sent_at, now());
  new.created_at := coalesce(new.created_at, now());
  return new;
end;
$$;

drop trigger if exists trg_sync_agent_message_hashes on public.agent_message_hashes;
create trigger trg_sync_agent_message_hashes
before insert or update on public.agent_message_hashes
for each row execute function public.sync_agent_message_hashes();

create unique index if not exists agent_message_hashes_dedupe_uidx
  on public.agent_message_hashes (
    coalesce(agent_id::text, 'system'),
    lead_id,
    coalesce(channel, 'email'),
    coalesce(msg_hash, message_hash)
  )
  where coalesce(msg_hash, message_hash) is not null;

create index if not exists agent_message_hashes_lead_idx
  on public.agent_message_hashes (lead_id);

create index if not exists agent_message_hashes_created_idx
  on public.agent_message_hashes (created_at desc);

-- ---------------------------------------------------------------------------
-- Conservative daily send-count RPC
-- ---------------------------------------------------------------------------

create or replace function public.check_and_increment_send_count(
  p_agent_id uuid,
  p_channel text,
  p_date date default current_date
)
returns jsonb language plpgsql security definer as $$
declare
  v_current integer := 0;
  v_identity_limit integer;
  v_system_cap integer;
  v_limit integer;
  v_is_active boolean;
  v_channel text := lower(coalesce(p_channel, 'email'));
begin
  if v_channel not in ('sms', 'email') then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'unsupported_channel',
      'channel', v_channel
    );
  end if;

  select
    case when v_channel = 'sms' then sms_daily_limit else email_daily_limit end,
    is_active
  into v_identity_limit, v_is_active
  from public.agent_identities
  where agent_id = p_agent_id;

  if v_is_active is false then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'agent_identity_inactive'
    );
  end if;

  select case
    when v_channel = 'sms' then daily_sms_cap
    else daily_email_cap_per_sender
  end
  into v_system_cap
  from public.system_controls
  where id = 1;

  v_limit := least(
    coalesce(v_identity_limit, v_system_cap, 30),
    coalesce(v_system_cap, 30),
    30
  );

  select greatest(coalesce(sent_count, 0), coalesce("count", 0))
  into v_current
  from public.agent_daily_send_counts
  where agent_id = p_agent_id
    and send_date = p_date
    and channel = v_channel;

  v_current := coalesce(v_current, 0);

  if v_current >= v_limit then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'daily_limit_reached',
      'limit', v_limit,
      'current', v_current,
      'sent', v_current,
      'remaining', 0
    );
  end if;

  insert into public.agent_daily_send_counts (
    agent_id,
    send_date,
    channel,
    sent_count,
    "count",
    last_sent_at
  )
  values (
    p_agent_id,
    p_date,
    v_channel,
    1,
    1,
    now()
  )
  on conflict (agent_id, send_date, channel)
  do update set
    sent_count = greatest(
      coalesce(public.agent_daily_send_counts.sent_count, 0),
      coalesce(public.agent_daily_send_counts."count", 0)
    ) + 1,
    "count" = greatest(
      coalesce(public.agent_daily_send_counts.sent_count, 0),
      coalesce(public.agent_daily_send_counts."count", 0)
    ) + 1,
    last_sent_at = now(),
    updated_at = now();

  return jsonb_build_object(
    'allowed', true,
    'limit', v_limit,
    'current', v_current + 1,
    'sent', v_current + 1,
    'remaining', greatest(v_limit - v_current - 1, 0)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Sender health view used by admin endpoints
-- ---------------------------------------------------------------------------

drop view if exists public.v_sender_health;

create or replace view public.v_sender_health as
with controls as (
  select *
  from public.system_controls
  where id = 1
),
today_counts as (
  select
    agent_id,
    channel,
    greatest(coalesce(sent_count, 0), coalesce("count", 0)) as sent_today
  from public.agent_daily_send_counts
  where send_date = current_date
)
select
  ai.agent_id,
  null::text as full_name,
  ai.from_email,
  ai.from_name,
  ai.twilio_phone,
  least(coalesce(ai.email_daily_limit, c.daily_email_cap_per_sender, 30), coalesce(c.daily_email_cap_per_sender, 30), 30) as email_daily_limit,
  least(coalesce(ai.sms_daily_limit, c.daily_sms_cap, 30), coalesce(c.daily_sms_cap, 30), 30) as sms_daily_limit,
  ai.email_ramp_day,
  coalesce(email_today.sent_today, 0) as emails_sent_today,
  coalesce(sms_today.sent_today, 0) as sms_sent_today,
  case
    when c.all_paused then 'paused'
    when ai.is_active is false then 'inactive'
    when coalesce(email_today.sent_today, 0) >= least(coalesce(ai.email_daily_limit, c.daily_email_cap_per_sender, 30), coalesce(c.daily_email_cap_per_sender, 30), 30) then 'email_limit_reached'
    when coalesce(sms_today.sent_today, 0) >= least(coalesce(ai.sms_daily_limit, c.daily_sms_cap, 30), coalesce(c.daily_sms_cap, 30), 30) then 'sms_limit_reached'
    when coalesce(email_today.sent_today, 0) >= 0.8 * least(coalesce(ai.email_daily_limit, c.daily_email_cap_per_sender, 30), coalesce(c.daily_email_cap_per_sender, 30), 30) then 'email_warm'
    when coalesce(sms_today.sent_today, 0) >= 0.8 * least(coalesce(ai.sms_daily_limit, c.daily_sms_cap, 30), coalesce(c.daily_sms_cap, 30), 30) then 'sms_warm'
    else 'healthy'
  end as health_status
from public.agent_identities ai
cross join controls c
left join today_counts email_today
  on email_today.agent_id = ai.agent_id
  and email_today.channel = 'email'
left join today_counts sms_today
  on sms_today.agent_id = ai.agent_id
  and sms_today.channel = 'sms';

-- ---------------------------------------------------------------------------
-- RLS and policies
-- ---------------------------------------------------------------------------

alter table public.system_controls enable row level security;
alter table public.outreach_owner_settings enable row level security;
alter table public.agent_identities enable row level security;
alter table public.agent_daily_send_counts enable row level security;
alter table public.agent_message_hashes enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'outreach_owner_settings'
      and policyname = 'outreach_owner_settings_admin_all'
  ) then
    create policy outreach_owner_settings_admin_all
      on public.outreach_owner_settings
      for all to authenticated
      using (coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'admin')
      with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'admin');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'system_controls'
      and policyname = 'system_controls_admin_all'
  ) then
    create policy system_controls_admin_all
      on public.system_controls
      for all to authenticated
      using (coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'admin')
      with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'admin');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'agent_identities'
      and policyname = 'agent_identities_admin_all'
  ) then
    create policy agent_identities_admin_all
      on public.agent_identities
      for all to authenticated
      using (coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'admin')
      with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'admin');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'agent_daily_send_counts'
      and policyname = 'agent_daily_send_counts_admin_read'
  ) then
    create policy agent_daily_send_counts_admin_read
      on public.agent_daily_send_counts
      for select to authenticated
      using (coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'admin');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'agent_message_hashes'
      and policyname = 'agent_message_hashes_admin_read'
  ) then
    create policy agent_message_hashes_admin_read
      on public.agent_message_hashes
      for select to authenticated
      using (coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'admin');
  end if;
end;
$$;

comment on table public.outreach_owner_settings is
  'Singleton owner identity row for outbound messaging and future admin settings editing.';

comment on column public.system_controls.sms_prospecting_live_enabled is
  'Keep false until Twilio/A2P and sender compliance are approved. Test mode can still simulate sends.';
