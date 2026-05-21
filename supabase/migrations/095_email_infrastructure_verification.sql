-- HomeReach Migration 095 - Email infrastructure verification tests
--
-- Adds an admin-only audit log for one-recipient outbound sender verification.
-- This is intentionally separate from webhook-driven email_events so raw
-- Postmark send responses and operator-triggered tests remain observable
-- without mixing them into normal outreach records.
--
-- Safe to re-run. Additive only.

create extension if not exists pgcrypto;

create table if not exists public.email_verification_tests (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'postmark',
  sender_email text not null,
  sender_name text,
  recipient_email text not null,
  subject text,
  status text not null check (status in ('sent', 'failed', 'skipped')),
  message_id text,
  provider_response jsonb,
  error_code text,
  error_message text,
  requested_by uuid,
  requested_at timestamptz not null default now(),
  completed_at timestamptz not null default now()
);

create index if not exists email_verification_tests_sender_idx
  on public.email_verification_tests (sender_email, requested_at desc);

create index if not exists email_verification_tests_recipient_idx
  on public.email_verification_tests (recipient_email, requested_at desc);

create index if not exists email_verification_tests_message_idx
  on public.email_verification_tests (message_id);

create index if not exists email_verification_tests_status_idx
  on public.email_verification_tests (status, requested_at desc);

alter table public.email_verification_tests enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'email_verification_tests'
      and policyname = 'email_verification_tests_admin_read'
  ) then
    create policy email_verification_tests_admin_read
      on public.email_verification_tests
      for select to authenticated
      using (coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'admin');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'email_verification_tests'
      and policyname = 'email_verification_tests_admin_insert'
  ) then
    create policy email_verification_tests_admin_insert
      on public.email_verification_tests
      for insert to authenticated
      with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'admin');
  end if;
end;
$$;

comment on table public.email_verification_tests is
  'Admin-only log of safe one-recipient outbound email verification tests and raw provider send responses.';
