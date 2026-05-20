-- ─────────────────────────────────────────────────────────────────────────────
-- HomeReach Migration 074 — Email Observability (additive, provider-agnostic)
--
-- Adds two read-side tracking constructs:
--   1. email_events table       — append-only log of webhook events from any ESP
--      (Postmark today; future-proofed for Mailgun/Resend/SES via provider col)
--   2. sales_leads.email_status — per-lead deliverability state so the send
--      path can skip permanent-bounce / complained / unsubscribed leads
--
-- Populated by:
--   • POST /api/webhooks/postmark
--   • Future: /api/webhooks/{mailgun,resend,ses}
--   • One-time backfill: packages/db/scripts/import-mailgun-bounces.ts
--
-- NEVER written to by /api/admin/sales/event, sendEmail, or any send path.
-- Purely receive-side observability.
--
-- SAFE TO RE-RUN.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Provider-agnostic email events log ─────────────────────────────────────
create table if not exists public.email_events (
  id              uuid primary key default gen_random_uuid(),
  provider        text not null,            -- 'postmark' | 'mailgun' | 'resend' | 'ses'
  event_type      text not null,            -- 'sent' | 'delivered' | 'bounce' | 'spam_complaint' | 'open' | 'click' | 'unsubscribe' | 'subscription_change'
  message_id      text,
  recipient       text,
  subject         text,
  bounce_type     text,                     -- 'hard' | 'soft' | 'permanent' | 'transient' | null
  error_code      text,
  error_message   text,
  click_url       text,                     -- for click events
  ip              text,
  user_agent      text,
  geo_country     text,
  geo_region      text,
  geo_city        text,
  tags            text[],
  raw_payload     jsonb,
  received_at     timestamptz not null default now()
);

create index if not exists email_events_message_id_idx
  on public.email_events (message_id);

create index if not exists email_events_recipient_idx
  on public.email_events (recipient);

create index if not exists email_events_event_type_idx
  on public.email_events (event_type);

create index if not exists email_events_provider_idx
  on public.email_events (provider);

create index if not exists email_events_received_at_idx
  on public.email_events (received_at desc);

comment on table public.email_events is
  'Append-only log of email-provider webhook events. Provider-agnostic. Multiple rows per message_id are expected (sent/delivered/opened/clicked).';

-- ─── sales_leads.email_status (additive nullable column with default) ───────
alter table public.sales_leads
  add column if not exists email_status text default 'unknown';

create index if not exists sales_leads_email_status_idx
  on public.sales_leads (email_status);

comment on column public.sales_leads.email_status is
  'Deliverability state. Values: unknown | valid | bounced_permanent | bounced_temporary | complained | unsubscribed. Send path should skip rows where status in (bounced_permanent, complained, unsubscribed).';

-- ─── RLS ────────────────────────────────────────────────────────────────────
alter table public.email_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'email_events' and policyname = 'admin_read_email_events'
  ) then
    create policy admin_read_email_events on public.email_events
      for select to authenticated using (
        coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'admin'
      );
  end if;
end$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- Done — migration 074 complete.
-- ═════════════════════════════════════════════════════════════════════════════
