-- Executive Boardroom Memory Layer
-- Additive meeting memory for the Executive Leadership Team boardroom.
-- Stores participants, transcript entries, outcomes, duration, and recording URL.
-- Does not store passwords, API keys, MFA codes, private secrets, or authorize
-- external execution.

create extension if not exists pgcrypto;

alter table public.executive_meetings
  add column if not exists ended_at timestamptz,
  add column if not exists duration_seconds integer,
  add column if not exists recording_url text;

alter table public.executive_meetings
  drop constraint if exists executive_meetings_meeting_type_check;

alter table public.executive_meetings
  add constraint executive_meetings_meeting_type_check
  check (meeting_type in ('morning','afternoon','strategic','emergency'));

alter table public.executive_agent_reports
  drop constraint if exists executive_agent_reports_report_type_check;

alter table public.executive_agent_reports
  add constraint executive_agent_reports_report_type_check
  check (report_type in ('morning','afternoon','strategic','emergency'));

alter table public.executive_voice_profiles
  alter column provider_key set default 'openai_realtime',
  alter column voice_label set default 'Realtime executive voice';

update public.executive_voice_profiles
set
  provider_key = 'openai_realtime',
  display_name = replace(display_name, ' placeholder', ''),
  notes = 'OpenAI Realtime voice profile; no provider secrets are stored here.',
  updated_at = now()
where provider_key = 'provider_interface_placeholder'
   or display_name ilike '%placeholder%'
   or coalesce(notes, '') ilike '%placeholder%';

update public.executive_meeting_settings
set
  provider_plan_json = provider_plan_json
    || jsonb_build_object(
      'voiceProviderInterface', 'openai_realtime_webrtc',
      'realtimeVoiceRoute', '/api/admin/executive-chat/realtime/connect',
      'externalSendsEnabled', false,
      'humanApprovalRequiredBeforeExternalAction', true
    ),
  updated_at = now()
where settings_key = 'default';

create table if not exists public.executive_meeting_participants (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.executive_meetings(id) on delete cascade,
  participant_type text not null default 'ai_executive'
    check (participant_type in ('ai_executive','human_admin','facilitator','observer','external_future')),
  agent_id uuid references public.executive_agents(id) on delete set null,
  participant_key text not null,
  display_name text not null,
  title text not null,
  role_in_meeting text not null default 'voting_member'
    check (role_in_meeting in ('voting_member','facilitator','silent_note_taker','guest')),
  seat_index integer not null default 100,
  attendance_status text not null default 'joined'
    check (attendance_status in ('invited','joined','speaking','listening','left','blocked')),
  voice_profile_key text,
  current_assignment text not null default '',
  performance_json jsonb not null default '{}'::jsonb,
  joined_at timestamptz,
  left_at timestamptz,
  created_at timestamptz not null default now(),
  unique (meeting_id, participant_key)
);

create table if not exists public.executive_meeting_transcript_entries (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.executive_meetings(id) on delete cascade,
  participant_id uuid references public.executive_meeting_participants(id) on delete set null,
  speaker_key text not null,
  speaker_name text not null,
  speaker_title text not null,
  speaker_type text not null default 'ai_executive'
    check (speaker_type in ('ai_executive','human_admin','facilitator','observer','system')),
  sequence integer not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  statement text not null,
  statement_type text not null default 'agent_report'
    check (statement_type in ('opening','agent_report','user','decision','action_item','risk','commitment','summary','closing','system')),
  source text not null default 'generated_report'
    check (source in ('generated_report','live_voice','manual','system')),
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (meeting_id, sequence)
);

create table if not exists public.executive_meeting_outcomes (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.executive_meetings(id) on delete cascade,
  outcome_type text not null
    check (outcome_type in ('executive_summary','action_item','decision','risk','commitment','scorecard_update','opportunity')),
  owner_agent_id uuid references public.executive_agents(id) on delete set null,
  owner_key text,
  owner_name text,
  title text not null,
  detail text not null default '',
  priority text not null default 'normal'
    check (priority in ('low','normal','high','urgent')),
  due_at timestamptz,
  status text not null default 'open'
    check (status in ('open','in_progress','needs_approval','completed','blocked','archived')),
  source_transcript_entry_id uuid references public.executive_meeting_transcript_entries(id) on delete set null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists executive_meeting_participants_meeting_idx
  on public.executive_meeting_participants (meeting_id, seat_index);

create index if not exists executive_meeting_transcript_entries_meeting_idx
  on public.executive_meeting_transcript_entries (meeting_id, sequence);

create index if not exists executive_meeting_transcript_entries_search_idx
  on public.executive_meeting_transcript_entries using gin (to_tsvector('english', statement));

create index if not exists executive_meeting_outcomes_meeting_idx
  on public.executive_meeting_outcomes (meeting_id, outcome_type, status);

create index if not exists executive_meeting_outcomes_owner_idx
  on public.executive_meeting_outcomes (owner_key, status, due_at);

drop trigger if exists executive_meeting_outcomes_touch_updated_at on public.executive_meeting_outcomes;
create trigger executive_meeting_outcomes_touch_updated_at
before update on public.executive_meeting_outcomes
for each row execute function public.tg_executive_touch_updated_at();

drop trigger if exists executive_meeting_participants_prevent_secret_like_storage on public.executive_meeting_participants;
create trigger executive_meeting_participants_prevent_secret_like_storage
before insert or update on public.executive_meeting_participants
for each row execute function public.executive_prevent_secret_like_storage();

drop trigger if exists executive_meeting_transcript_entries_prevent_secret_like_storag on public.executive_meeting_transcript_entries;
drop trigger if exists executive_meeting_transcripts_prevent_secrets on public.executive_meeting_transcript_entries;
create trigger executive_meeting_transcripts_prevent_secrets
before insert or update on public.executive_meeting_transcript_entries
for each row execute function public.executive_prevent_secret_like_storage();

drop trigger if exists executive_meeting_outcomes_prevent_secret_like_storage on public.executive_meeting_outcomes;
create trigger executive_meeting_outcomes_prevent_secret_like_storage
before insert or update on public.executive_meeting_outcomes
for each row execute function public.executive_prevent_secret_like_storage();

alter table public.executive_meeting_participants enable row level security;
alter table public.executive_meeting_transcript_entries enable row level security;
alter table public.executive_meeting_outcomes enable row level security;

grant select, insert, update, delete on public.executive_meeting_participants to authenticated;
grant select, insert, update, delete on public.executive_meeting_transcript_entries to authenticated;
grant select, insert, update, delete on public.executive_meeting_outcomes to authenticated;

grant all on public.executive_meeting_participants to service_role;
grant all on public.executive_meeting_transcript_entries to service_role;
grant all on public.executive_meeting_outcomes to service_role;

drop policy if exists "Admins can read executive meeting participants" on public.executive_meeting_participants;
create policy "Admins can read executive meeting participants"
  on public.executive_meeting_participants
  for select
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');

drop policy if exists "Admins can write executive meeting participants" on public.executive_meeting_participants;
create policy "Admins can write executive meeting participants"
  on public.executive_meeting_participants
  for all
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');

drop policy if exists "Admins can read executive meeting transcripts" on public.executive_meeting_transcript_entries;
create policy "Admins can read executive meeting transcripts"
  on public.executive_meeting_transcript_entries
  for select
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');

drop policy if exists "Admins can write executive meeting transcripts" on public.executive_meeting_transcript_entries;
create policy "Admins can write executive meeting transcripts"
  on public.executive_meeting_transcript_entries
  for all
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');

drop policy if exists "Admins can read executive meeting outcomes" on public.executive_meeting_outcomes;
create policy "Admins can read executive meeting outcomes"
  on public.executive_meeting_outcomes
  for select
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');

drop policy if exists "Admins can write executive meeting outcomes" on public.executive_meeting_outcomes;
create policy "Admins can write executive meeting outcomes"
  on public.executive_meeting_outcomes
  for all
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');

comment on table public.executive_meeting_participants is
  'Participants and future extensible seats for Executive Boardroom meetings.';

comment on table public.executive_meeting_transcript_entries is
  'Immutable-style boardroom transcript entries for generated and live voice meetings.';

comment on table public.executive_meeting_outcomes is
  'Executive summaries, decisions, action items, risks, commitments, opportunities, and scorecard updates from boardroom meetings.';
