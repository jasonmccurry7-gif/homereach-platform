-- HomeReach Migration 093 - Revenue Messaging Engine foundation
--
-- Purpose:
--   * Add a normalized, additive messaging layer across targeted mail,
--     procurement, and political leads.
--   * Preserve existing sales, political, Twilio, Postmark, Stripe, intake,
--     and dashboard flows.
--   * Keep political replies in human-handoff mode by default.

create extension if not exists pgcrypto;

create table if not exists public.revenue_message_threads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  business_line text not null check (business_line in (
    'targeted_mailing',
    'inventory_procurement',
    'political',
    'unknown'
  )),
  source_system text not null,
  source_id uuid,
  channel text not null check (channel in ('sms', 'email', 'facebook_dm', 'instagram_dm', 'website', 'intake', 'manual')),

  contact_name text,
  contact_phone text,
  contact_email text,
  display_name text,
  organization_name text,
  city text,
  category text,

  status text not null default 'open' check (status in (
    'open',
    'needs_review',
    'waiting_on_customer',
    'waiting_on_homereach',
    'paused',
    'closed',
    'archived'
  )),
  lead_status text,
  assigned_to uuid references public.profiles(id) on delete set null,

  latest_message_body text,
  latest_message_at timestamptz,
  latest_direction text check (latest_direction in ('inbound', 'outbound')),
  unread_count integer not null default 0,

  automation_mode text not null default 'human_approval' check (automation_mode in (
    'draft_only',
    'human_approval',
    'assisted_autopilot',
    'full_autopilot'
  )),
  automation_paused boolean not null default false,
  pause_reason text,

  metadata jsonb not null default '{}'::jsonb
);

create unique index if not exists revenue_threads_source_channel_uidx
  on public.revenue_message_threads (business_line, source_system, source_id, channel)
  where source_id is not null;

create index if not exists revenue_threads_business_line_idx
  on public.revenue_message_threads (business_line);
create index if not exists revenue_threads_latest_idx
  on public.revenue_message_threads (latest_message_at desc);
create index if not exists revenue_threads_assigned_idx
  on public.revenue_message_threads (assigned_to)
  where assigned_to is not null;

create table if not exists public.revenue_message_events (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references public.revenue_message_threads(id) on delete set null,
  created_at timestamptz not null default now(),

  business_line text not null check (business_line in (
    'targeted_mailing',
    'inventory_procurement',
    'political',
    'unknown'
  )),
  source_system text not null,
  source_id uuid,

  provider text,
  provider_message_id text,
  webhook_event_id text,
  channel text not null check (channel in ('sms', 'email', 'facebook_dm', 'instagram_dm', 'website', 'intake', 'manual')),
  direction text not null check (direction in ('inbound', 'outbound')),
  event_type text not null default 'message',

  normalized_from text,
  normalized_to text,
  contact_name text,
  contact_phone text,
  contact_email text,
  subject text,
  message_body text not null,

  processing_status text not null default 'processed' check (processing_status in (
    'received',
    'processed',
    'ignored',
    'failed',
    'suppressed'
  )),
  processing_notes text,
  raw_payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb
);

create unique index if not exists revenue_events_provider_message_uidx
  on public.revenue_message_events (provider, provider_message_id)
  where provider is not null and provider_message_id is not null;

create index if not exists revenue_events_thread_idx
  on public.revenue_message_events (thread_id);
create index if not exists revenue_events_business_line_idx
  on public.revenue_message_events (business_line);
create index if not exists revenue_events_created_idx
  on public.revenue_message_events (created_at desc);
create index if not exists revenue_events_contact_phone_idx
  on public.revenue_message_events (contact_phone)
  where contact_phone is not null;

create table if not exists public.revenue_business_line_settings (
  business_line text primary key check (business_line in (
    'targeted_mailing',
    'inventory_procurement',
    'political'
  )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  default_automation_mode text not null check (default_automation_mode in (
    'draft_only',
    'human_approval',
    'assisted_autopilot',
    'full_autopilot'
  )),
  allow_autopilot boolean not null default false,
  pause_on_inbound boolean not null default false,
  notify_owner_on_inbound boolean not null default false,
  owner_handoff_required boolean not null default false,
  notes text,
  metadata jsonb not null default '{}'::jsonb
);

insert into public.revenue_business_line_settings (
  business_line,
  default_automation_mode,
  allow_autopilot,
  pause_on_inbound,
  notify_owner_on_inbound,
  owner_handoff_required,
  notes
) values
  (
    'targeted_mailing',
    'human_approval',
    false,
    false,
    true,
    false,
    'Local business outreach may support approved follow-up, intake, proposal, and payment handoff.'
  ),
  (
    'inventory_procurement',
    'human_approval',
    false,
    false,
    true,
    false,
    'Procurement leads may support demo, savings audit, intake, proposal, and subscription handoff.'
  ),
  (
    'political',
    'human_approval',
    false,
    true,
    true,
    true,
    'Political messaging stays human-approved. Inbound replies pause automation and notify Jason.'
  )
on conflict (business_line) do nothing;

create table if not exists public.revenue_notification_rules (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  business_line text not null,
  event_type text not null,
  channel text not null default 'dashboard',
  enabled boolean not null default true,
  urgency text not null default 'medium' check (urgency in ('low', 'medium', 'high', 'critical')),
  recipient_role text not null default 'owner',
  delivery_mode text not null default 'log_only' check (delivery_mode in ('log_only', 'dashboard', 'email', 'sms', 'multi')),
  quiet_hours_respected boolean not null default true,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists revenue_notification_rules_lookup_idx
  on public.revenue_notification_rules (business_line, event_type, enabled);

create table if not exists public.revenue_ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references public.revenue_message_threads(id) on delete cascade,
  event_id uuid references public.revenue_message_events(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  business_line text not null,
  suggestion_type text not null default 'reply',
  status text not null default 'draft' check (status in (
    'draft',
    'needs_review',
    'approved',
    'rejected',
    'sent',
    'archived'
  )),
  automation_mode text not null default 'human_approval',
  recommended_action text,
  suggested_body text,
  confidence numeric(4,2),
  safety_notes text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists revenue_ai_suggestions_thread_idx
  on public.revenue_ai_suggestions (thread_id);
create index if not exists revenue_ai_suggestions_status_idx
  on public.revenue_ai_suggestions (status);

create table if not exists public.revenue_message_approval_queue (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references public.revenue_message_threads(id) on delete cascade,
  suggestion_id uuid references public.revenue_ai_suggestions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  business_line text not null,
  channel text not null,
  status text not null default 'needs_review' check (status in (
    'draft',
    'needs_review',
    'approved',
    'rejected',
    'scheduled',
    'sent',
    'canceled'
  )),
  title text not null,
  message_body text,
  requested_by text not null default 'revenue_messaging_engine',
  assigned_to uuid references public.profiles(id) on delete set null,
  due_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists revenue_approval_queue_status_idx
  on public.revenue_message_approval_queue (status, created_at desc);
create index if not exists revenue_approval_queue_assigned_idx
  on public.revenue_message_approval_queue (assigned_to)
  where assigned_to is not null;

create table if not exists public.revenue_consent_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  business_line text not null,
  source_system text not null,
  source_id uuid,
  channel text not null,
  contact_phone text,
  contact_email text,
  event_type text not null check (event_type in ('opt_in', 'opt_out', 'consent_captured', 'consent_revoked', 'suppressed')),
  keyword text,
  evidence jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists revenue_consent_phone_idx
  on public.revenue_consent_events (contact_phone)
  where contact_phone is not null;
create index if not exists revenue_consent_email_idx
  on public.revenue_consent_events (contact_email)
  where contact_email is not null;

create table if not exists public.revenue_webhook_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  provider text not null,
  event_type text not null,
  provider_event_id text,
  processing_status text not null default 'received' check (processing_status in (
    'received',
    'processed',
    'ignored',
    'failed'
  )),
  processing_notes text,
  payload jsonb not null default '{}'::jsonb
);

create unique index if not exists revenue_webhook_provider_event_uidx
  on public.revenue_webhook_events (provider, provider_event_id)
  where provider_event_id is not null;
create index if not exists revenue_webhook_created_idx
  on public.revenue_webhook_events (created_at desc);

alter table public.revenue_message_threads enable row level security;
alter table public.revenue_message_events enable row level security;
alter table public.revenue_business_line_settings enable row level security;
alter table public.revenue_notification_rules enable row level security;
alter table public.revenue_ai_suggestions enable row level security;
alter table public.revenue_message_approval_queue enable row level security;
alter table public.revenue_consent_events enable row level security;
alter table public.revenue_webhook_events enable row level security;

drop policy if exists "revenue_threads_service" on public.revenue_message_threads;
create policy "revenue_threads_service"
  on public.revenue_message_threads for all to service_role
  using (true) with check (true);

drop policy if exists "revenue_threads_admin_sales" on public.revenue_message_threads;
create policy "revenue_threads_admin_sales"
  on public.revenue_message_threads for select to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));

drop policy if exists "revenue_events_service" on public.revenue_message_events;
create policy "revenue_events_service"
  on public.revenue_message_events for all to service_role
  using (true) with check (true);

drop policy if exists "revenue_events_admin_sales" on public.revenue_message_events;
create policy "revenue_events_admin_sales"
  on public.revenue_message_events for select to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));

drop policy if exists "revenue_business_settings_service" on public.revenue_business_line_settings;
create policy "revenue_business_settings_service"
  on public.revenue_business_line_settings for all to service_role
  using (true) with check (true);

drop policy if exists "revenue_business_settings_admin_sales" on public.revenue_business_line_settings;
create policy "revenue_business_settings_admin_sales"
  on public.revenue_business_line_settings for select to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));

drop policy if exists "revenue_notification_rules_service" on public.revenue_notification_rules;
create policy "revenue_notification_rules_service"
  on public.revenue_notification_rules for all to service_role
  using (true) with check (true);

drop policy if exists "revenue_notification_rules_admin_sales" on public.revenue_notification_rules;
create policy "revenue_notification_rules_admin_sales"
  on public.revenue_notification_rules for select to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));

drop policy if exists "revenue_suggestions_service" on public.revenue_ai_suggestions;
create policy "revenue_suggestions_service"
  on public.revenue_ai_suggestions for all to service_role
  using (true) with check (true);

drop policy if exists "revenue_suggestions_admin_sales" on public.revenue_ai_suggestions;
create policy "revenue_suggestions_admin_sales"
  on public.revenue_ai_suggestions for select to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));

drop policy if exists "revenue_approval_service" on public.revenue_message_approval_queue;
create policy "revenue_approval_service"
  on public.revenue_message_approval_queue for all to service_role
  using (true) with check (true);

drop policy if exists "revenue_approval_admin_sales" on public.revenue_message_approval_queue;
create policy "revenue_approval_admin_sales"
  on public.revenue_message_approval_queue for all to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'))
  with check ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));

drop policy if exists "revenue_consent_service" on public.revenue_consent_events;
create policy "revenue_consent_service"
  on public.revenue_consent_events for all to service_role
  using (true) with check (true);

drop policy if exists "revenue_consent_admin_sales" on public.revenue_consent_events;
create policy "revenue_consent_admin_sales"
  on public.revenue_consent_events for select to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));

drop policy if exists "revenue_webhooks_service" on public.revenue_webhook_events;
create policy "revenue_webhooks_service"
  on public.revenue_webhook_events for all to service_role
  using (true) with check (true);

drop policy if exists "revenue_webhooks_admin" on public.revenue_webhook_events;
create policy "revenue_webhooks_admin"
  on public.revenue_webhook_events for select to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') = 'admin');
