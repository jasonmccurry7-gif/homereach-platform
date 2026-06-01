-- HomeReach Deliverability & Reputation Control Layer
-- Additive safety/observability layer for email, SMS, Facebook/manual outreach.
-- Existing system_controls, revenue_message_*, agent_identities, and send flows
-- remain authoritative; these tables add risk decisions, suppressions, sender
-- health snapshots, and safe scaling recommendations.

alter table public.system_controls
  add column if not exists deliverability_auto_pause_enabled boolean not null default true,
  add column if not exists domain_reputation_paused boolean not null default false,
  add column if not exists max_domain_daily_email_cap integer not null default 60,
  add column if not exists max_sender_risk_score integer not null default 69,
  add column if not exists sms_marketing_requires_consent boolean not null default true,
  add column if not exists email_domain_authentication_verified boolean not null default false,
  add column if not exists postmark_sender_signatures_verified boolean not null default false,
  add column if not exists twilio_a2p_approved boolean not null default false,
  add column if not exists outreach_weekly_ramp_max_percent integer not null default 25;

update public.system_controls
set
  deliverability_auto_pause_enabled = coalesce(deliverability_auto_pause_enabled, true),
  domain_reputation_paused = coalesce(domain_reputation_paused, false),
  max_domain_daily_email_cap = greatest(coalesce(max_domain_daily_email_cap, 60), 1),
  max_sender_risk_score = least(greatest(coalesce(max_sender_risk_score, 69), 1), 99),
  sms_marketing_requires_consent = coalesce(sms_marketing_requires_consent, true),
  email_domain_authentication_verified = coalesce(email_domain_authentication_verified, false),
  postmark_sender_signatures_verified = coalesce(postmark_sender_signatures_verified, false),
  twilio_a2p_approved = coalesce(twilio_a2p_approved, false),
  outreach_weekly_ramp_max_percent = least(greatest(coalesce(outreach_weekly_ramp_max_percent, 25), 0), 100)
where id = 1;

create table if not exists public.outreach_reputation_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  sender_email text,
  sender_name text,
  channel text not null check (channel in ('email','sms','facebook_dm','manual')),
  recipient text,
  business_line text,
  source_system text,
  source_id uuid,
  template_key text,
  template_hash text,
  message_hash text,
  subject_hash text,
  risk_score integer not null default 0 check (risk_score between 0 and 100),
  risk_level text not null default 'low' check (risk_level in ('low','medium','high','critical')),
  recommended_action text,
  decision text not null default 'allow' check (decision in (
    'allow',
    'delay',
    'rewrite_required',
    'approval_required',
    'pause',
    'block'
  )),
  human_approved boolean not null default false,
  autonomous boolean not null default false,
  factors jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists outreach_reputation_events_created_idx
  on public.outreach_reputation_events (created_at desc);
create index if not exists outreach_reputation_events_sender_channel_idx
  on public.outreach_reputation_events (sender_email, channel, created_at desc);
create index if not exists outreach_reputation_events_risk_idx
  on public.outreach_reputation_events (risk_level, decision, created_at desc);
create index if not exists outreach_reputation_events_recipient_idx
  on public.outreach_reputation_events (recipient, created_at desc)
  where recipient is not null;
create index if not exists outreach_reputation_events_hash_idx
  on public.outreach_reputation_events (message_hash, created_at desc)
  where message_hash is not null;

create table if not exists public.outreach_sender_health_snapshots (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  snapshot_date date not null default current_date,
  sender_email text not null,
  channel text not null check (channel in ('email','sms','facebook_dm','manual')),
  sends integer not null default 0,
  replies integer not null default 0,
  bounces integer not null default 0,
  complaints integer not null default 0,
  unsubscribes integer not null default 0,
  opt_outs integer not null default 0,
  failures integer not null default 0,
  reply_rate numeric(8,4) not null default 0,
  bounce_rate numeric(8,4) not null default 0,
  complaint_rate numeric(8,4) not null default 0,
  opt_out_rate numeric(8,4) not null default 0,
  failure_rate numeric(8,4) not null default 0,
  risk_score integer not null default 0 check (risk_score between 0 and 100),
  health_status text not null default 'healthy' check (health_status in (
    'healthy',
    'watch',
    'needs_review',
    'paused',
    'blocked'
  )),
  safe_daily_limit integer not null default 5,
  recommended_action text,
  metadata jsonb not null default '{}'::jsonb,
  unique (sender_email, channel, snapshot_date)
);

create index if not exists outreach_sender_health_date_idx
  on public.outreach_sender_health_snapshots (snapshot_date desc, channel, sender_email);
create index if not exists outreach_sender_health_status_idx
  on public.outreach_sender_health_snapshots (health_status, risk_score desc, snapshot_date desc);

create table if not exists public.outreach_suppression_list (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  contact_email text,
  contact_phone text,
  channel text not null check (channel in ('email','sms','facebook_dm','manual','all')),
  reason text not null,
  source_system text,
  source_id uuid,
  active boolean not null default true,
  evidence jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  constraint outreach_suppression_contact_required
    check (contact_email is not null or contact_phone is not null)
);

create unique index if not exists outreach_suppression_email_active_uidx
  on public.outreach_suppression_list (lower(contact_email), channel)
  where active and contact_email is not null;
create unique index if not exists outreach_suppression_phone_active_uidx
  on public.outreach_suppression_list (contact_phone, channel)
  where active and contact_phone is not null;
create index if not exists outreach_suppression_active_idx
  on public.outreach_suppression_list (active, channel, created_at desc);

create table if not exists public.outreach_scaling_recommendations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  sender_email text,
  channel text not null check (channel in ('email','sms','facebook_dm','manual')),
  current_limit integer not null default 0,
  recommended_limit integer not null default 0,
  direction text not null default 'hold' check (direction in ('hold','increase','reduce','pause')),
  reason text not null,
  risk_level text not null default 'low' check (risk_level in ('low','medium','high','critical')),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists outreach_scaling_recommendations_created_idx
  on public.outreach_scaling_recommendations (created_at desc);
create index if not exists outreach_scaling_recommendations_sender_idx
  on public.outreach_scaling_recommendations (sender_email, channel, created_at desc)
  where sender_email is not null;
create index if not exists outreach_scaling_recommendations_risk_idx
  on public.outreach_scaling_recommendations (risk_level, direction, created_at desc);

alter table public.outreach_reputation_events enable row level security;
alter table public.outreach_sender_health_snapshots enable row level security;
alter table public.outreach_suppression_list enable row level security;
alter table public.outreach_scaling_recommendations enable row level security;

drop policy if exists "outreach_reputation_events_service" on public.outreach_reputation_events;
create policy "outreach_reputation_events_service"
  on public.outreach_reputation_events for all to service_role
  using (true) with check (true);

drop policy if exists "outreach_reputation_events_admin_sales_read" on public.outreach_reputation_events;
create policy "outreach_reputation_events_admin_sales_read"
  on public.outreach_reputation_events for select to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));

drop policy if exists "outreach_sender_health_service" on public.outreach_sender_health_snapshots;
create policy "outreach_sender_health_service"
  on public.outreach_sender_health_snapshots for all to service_role
  using (true) with check (true);

drop policy if exists "outreach_sender_health_admin_sales_read" on public.outreach_sender_health_snapshots;
create policy "outreach_sender_health_admin_sales_read"
  on public.outreach_sender_health_snapshots for select to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));

drop policy if exists "outreach_suppression_service" on public.outreach_suppression_list;
create policy "outreach_suppression_service"
  on public.outreach_suppression_list for all to service_role
  using (true) with check (true);

drop policy if exists "outreach_suppression_admin_read" on public.outreach_suppression_list;
create policy "outreach_suppression_admin_read"
  on public.outreach_suppression_list for select to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') = 'admin');

drop policy if exists "outreach_scaling_service" on public.outreach_scaling_recommendations;
create policy "outreach_scaling_service"
  on public.outreach_scaling_recommendations for all to service_role
  using (true) with check (true);

drop policy if exists "outreach_scaling_admin_sales_read" on public.outreach_scaling_recommendations;
create policy "outreach_scaling_admin_sales_read"
  on public.outreach_scaling_recommendations for select to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));

comment on table public.outreach_reputation_events is
  'Per-send deliverability and compliance risk decisions for HomeReach outbound governance.';
comment on table public.outreach_sender_health_snapshots is
  'Daily sender/channel health snapshots used for safe volume recommendations.';
comment on table public.outreach_suppression_list is
  'Cross-channel suppression records for bounces, complaints, unsubscribes, SMS opt-outs, DNC, and provider warnings.';
comment on table public.outreach_scaling_recommendations is
  'Safe-volume guidance generated from sender health and reputation controls.';

comment on column public.system_controls.deliverability_auto_pause_enabled is
  'When true, high-risk deliverability findings can pause or block outbound sends before provider submission.';
comment on column public.system_controls.domain_reputation_paused is
  'Emergency domain-level email pause separate from channel pause.';
comment on column public.system_controls.max_domain_daily_email_cap is
  'Conservative total domain daily cap used by the reputation controller.';
comment on column public.system_controls.sms_marketing_requires_consent is
  'Blocks marketing/prospecting SMS unless consent/opt-in evidence is present.';
comment on column public.system_controls.email_domain_authentication_verified is
  'Set true only after SPF, DKIM, and DMARC are verified for the active sending domain.';
comment on column public.system_controls.postmark_sender_signatures_verified is
  'Set true only after Postmark sender signatures/domain sender are verified.';
comment on column public.system_controls.twilio_a2p_approved is
  'Set true only after Twilio A2P/10DLC registration and callbacks are verified.';;
