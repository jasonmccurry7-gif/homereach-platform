-- ─────────────────────────────────────────────────────────────────────────────
-- HomeReach Migration 073 — Twilio Observability (additive)
--
-- Adds two read-side tracking tables for Twilio SMS visibility:
--   1. twilio_a2p_status      — A2P 10DLC compliance master record (1 row, upsert)
--   2. twilio_message_status  — append-only log of Twilio status callbacks
--
-- These tables are populated by:
--   • POST /api/webhooks/twilio/status   (status callbacks per send)
--   • Manual admin upsert of A2P compliance status
--
-- They are NEVER written to by /api/admin/sales/event, sendSms, or any send
-- path. Purely receive-side observability.
--
-- POLICY (enforced in code review, not in this migration):
--   • The status webhook NEVER mutates outreach_messages or sales_events.
--   • Joining message_sid to other tables is done at read time only.
--
-- SAFE TO RE-RUN.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── A2P 10DLC compliance status ─────────────────────────────────────────────
create table if not exists public.twilio_a2p_status (
  id                       uuid primary key default gen_random_uuid(),
  brand_id                 text,
  campaign_id              text,
  use_case                 text,                -- e.g. 'marketing', 'low-volume', '2fa'
  account_tier             text,                -- e.g. 'standard', 'sole-proprietor'
  verizon_status           text,                -- 'pending' | 'approved' | 'rejected' | null
  att_status               text,
  tmobile_status           text,
  uscellular_status        text,
  compliance_checklist     jsonb default '{}'::jsonb,
  last_audit_at            timestamptz,
  notes                    text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

comment on table public.twilio_a2p_status is
  'A2P 10DLC compliance master record. Read by admin observability dashboards.';

-- ─── Per-message delivery status events ─────────────────────────────────────
create table if not exists public.twilio_message_status (
  id                       uuid primary key default gen_random_uuid(),
  message_sid              text not null,
  message_status           text not null,       -- queued | sent | delivered | undelivered | failed | accepted | scheduled
  error_code               text,
  error_message            text,
  to_number                text,
  from_number              text,
  messaging_service_sid    text,
  sms_sid                  text,
  account_sid              text,
  api_version              text,
  raw_payload              jsonb,
  received_at              timestamptz not null default now()
);

create index if not exists twilio_message_status_message_sid_idx
  on public.twilio_message_status (message_sid);

create index if not exists twilio_message_status_received_at_idx
  on public.twilio_message_status (received_at desc);

create index if not exists twilio_message_status_message_status_idx
  on public.twilio_message_status (message_status);

comment on table public.twilio_message_status is
  'Append-only log of Twilio status callbacks. Multiple rows per message_sid are expected (one per status transition).';

-- ─── RLS ────────────────────────────────────────────────────────────────────
alter table public.twilio_a2p_status     enable row level security;
alter table public.twilio_message_status enable row level security;

-- Service role bypasses RLS by default (Supabase service_role key).
-- Authenticated admins can read both tables.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'twilio_a2p_status' and policyname = 'admin_read_twilio_a2p_status'
  ) then
    create policy admin_read_twilio_a2p_status on public.twilio_a2p_status
      for select to authenticated using (
        coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'admin'
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where tablename = 'twilio_message_status' and policyname = 'admin_read_twilio_message_status'
  ) then
    create policy admin_read_twilio_message_status on public.twilio_message_status
      for select to authenticated using (
        coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'admin'
      );
  end if;
end$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- Done — migration 073 complete.
-- ═════════════════════════════════════════════════════════════════════════════
