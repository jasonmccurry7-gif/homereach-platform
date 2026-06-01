-- Agent Execution Readiness
-- Preparation layer for future browser/computer-use agents.
-- This migration creates queues, registry records, and audit logs only.
-- It does not store passwords, API keys, MFA secrets, or browser session tokens,
-- and it does not execute external actions.

create table if not exists public.agent_execution_queue (
  id uuid primary key default gen_random_uuid(),
  task_id text not null,
  mini_app_id text not null,
  source_agent text not null,
  task_type text not null,
  target_system text not null,
  target_url text,
  permission_scope text not null default 'read_only' check (
    permission_scope in (
      'read_only',
      'draft_only',
      'prepare_only',
      'send_after_approval',
      'purchase_after_approval',
      'submit_after_approval'
    )
  ),
  status text not null default 'pending_approval' check (
    status in (
      'pending_approval',
      'approved',
      'dry_run_ready',
      'running',
      'completed',
      'failed',
      'paused',
      'rejected',
      'manual_takeover_required',
      'executed_manually'
    )
  ),
  human_approval_required boolean not null default true,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  execution_started_at timestamptz,
  execution_completed_at timestamptz,
  screenshot_before_url text,
  screenshot_after_url text,
  execution_log jsonb not null default '[]'::jsonb,
  failure_reason text,
  retry_allowed boolean not null default false,
  manual_takeover_required boolean not null default false,
  dry_run_enabled boolean not null default true,
  dry_run_checklist jsonb not null default '[]'::jsonb,
  sensitive_action_flags text[] not null default '{}',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists agent_execution_queue_task_id_idx
  on public.agent_execution_queue (task_id);
create index if not exists agent_execution_queue_status_idx
  on public.agent_execution_queue (status, permission_scope, updated_at desc);
create index if not exists agent_execution_queue_mini_app_idx
  on public.agent_execution_queue (mini_app_id, status, updated_at desc);
create index if not exists agent_execution_queue_target_system_idx
  on public.agent_execution_queue (target_system, status, updated_at desc);

create table if not exists public.agent_browser_session_registry (
  id uuid primary key default gen_random_uuid(),
  system_name text not null unique,
  login_url text,
  purpose text not null default '',
  account_owner text not null default 'HomeReach Admin',
  allowed_actions text[] not null default '{}',
  blocked_actions text[] not null default '{}',
  requires_mfa boolean not null default true,
  notes text,
  preferred_browser_profile text not null default 'Dedicated HomeReach Windows user + dedicated Chrome profile',
  active_session_status text not null default 'not_configured' check (
    active_session_status in (
      'not_configured',
      'manual_login_required',
      'active',
      'expired',
      'blocked',
      'do_not_automate'
    )
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_browser_session_registry_status_idx
  on public.agent_browser_session_registry (active_session_status, updated_at desc);

create table if not exists public.agent_execution_audit_log (
  id uuid primary key default gen_random_uuid(),
  execution_task_id uuid references public.agent_execution_queue(id) on delete set null,
  task_public_id text,
  mini_app_id text,
  actor_user_id uuid references public.profiles(id) on delete set null,
  actor_label text not null default 'HomeReach Admin',
  event_type text not null,
  what_changed jsonb not null default '{}'::jsonb,
  allowed_scope text not null default 'read_only',
  attempted_action text,
  result text not null default 'logged',
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists agent_execution_audit_task_idx
  on public.agent_execution_audit_log (execution_task_id, created_at desc);
create index if not exists agent_execution_audit_public_task_idx
  on public.agent_execution_audit_log (task_public_id, created_at desc);
create index if not exists agent_execution_audit_event_idx
  on public.agent_execution_audit_log (event_type, created_at desc);

alter table public.agent_execution_queue enable row level security;
alter table public.agent_browser_session_registry enable row level security;
alter table public.agent_execution_audit_log enable row level security;

grant select, insert, update, delete on
  public.agent_execution_queue,
  public.agent_browser_session_registry,
  public.agent_execution_audit_log
to authenticated;

grant all on
  public.agent_execution_queue,
  public.agent_browser_session_registry,
  public.agent_execution_audit_log
to service_role;

drop policy if exists "agent_execution_queue_service" on public.agent_execution_queue;
create policy "agent_execution_queue_service"
  on public.agent_execution_queue for all to service_role
  using (true) with check (true);

drop policy if exists "agent_execution_queue_admin_select" on public.agent_execution_queue;
create policy "agent_execution_queue_admin_select"
  on public.agent_execution_queue for select to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));

drop policy if exists "agent_execution_queue_admin_write" on public.agent_execution_queue;
create policy "agent_execution_queue_admin_write"
  on public.agent_execution_queue for all to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') = 'admin')
  with check ((auth.jwt()->'app_metadata'->>'user_role') = 'admin');

drop policy if exists "agent_browser_session_registry_service" on public.agent_browser_session_registry;
create policy "agent_browser_session_registry_service"
  on public.agent_browser_session_registry for all to service_role
  using (true) with check (true);

drop policy if exists "agent_browser_session_registry_admin_select" on public.agent_browser_session_registry;
create policy "agent_browser_session_registry_admin_select"
  on public.agent_browser_session_registry for select to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));

drop policy if exists "agent_browser_session_registry_admin_write" on public.agent_browser_session_registry;
create policy "agent_browser_session_registry_admin_write"
  on public.agent_browser_session_registry for all to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') = 'admin')
  with check ((auth.jwt()->'app_metadata'->>'user_role') = 'admin');

drop policy if exists "agent_execution_audit_log_service" on public.agent_execution_audit_log;
create policy "agent_execution_audit_log_service"
  on public.agent_execution_audit_log for all to service_role
  using (true) with check (true);

drop policy if exists "agent_execution_audit_log_admin_select" on public.agent_execution_audit_log;
create policy "agent_execution_audit_log_admin_select"
  on public.agent_execution_audit_log for select to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));

drop policy if exists "agent_execution_audit_log_admin_insert" on public.agent_execution_audit_log;
create policy "agent_execution_audit_log_admin_insert"
  on public.agent_execution_audit_log for insert to authenticated
  with check ((auth.jwt()->'app_metadata'->>'user_role') = 'admin');

insert into public.agent_browser_session_registry (
  system_name,
  login_url,
  purpose,
  account_owner,
  allowed_actions,
  blocked_actions,
  requires_mfa,
  notes,
  preferred_browser_profile,
  active_session_status
)
values
  (
    'HomeReach Admin',
    'https://www.home-reach.com/admin',
    'Review internal queues, draft work, check dashboards, and prepare approval-gated actions.',
    'Jason McCurry',
    array['read dashboards','prepare drafts','copy approved text','mark internal review status after human approval']::text[],
    array['bypass auth','delete records','change pricing','send outreach without approval','change payments']::text[],
    true,
    'Use only a dedicated HomeReach admin session. Do not store credentials in HomeReach.',
    'Dedicated HomeReach Windows user + dedicated Chrome profile',
    'manual_login_required'
  ),
  (
    'Gmail',
    'https://mail.google.com/',
    'Future review of inbound messages and draft-only outbound preparation.',
    'Jason McCurry',
    array['read approved threads','prepare drafts','label items after approval']::text[],
    array['send email without approval','export mailbox','change account settings','access personal unrelated mail']::text[],
    true,
    'Personal accounts must not be automated. Use dedicated business mailbox sessions only.',
    'Dedicated HomeReach Chrome profile',
    'manual_login_required'
  ),
  (
    'Facebook',
    'https://www.facebook.com/',
    'Future assisted review of business pages, messages, and draft-only responses.',
    'Jason McCurry',
    array['read approved business page context','prepare DM drafts','copy approved post text']::text[],
    array['post publicly without approval','send DMs without approval','scrape prohibited areas','change page settings']::text[],
    true,
    'Only business assets approved by admin. No personal account automation.',
    'Dedicated HomeReach Chrome profile',
    'manual_login_required'
  ),
  (
    'Stripe',
    'https://dashboard.stripe.com/',
    'Future read-only reconciliation and owner-approved payment investigation.',
    'Jason McCurry',
    array['read payment status','prepare reconciliation notes','copy invoice metadata']::text[],
    array['refund','charge','change prices','change subscriptions','export sensitive payment data']::text[],
    true,
    'Payment mutation remains manual/human-only unless a separate approved connector is built.',
    'Dedicated HomeReach Chrome profile',
    'manual_login_required'
  ),
  (
    'Twilio',
    'https://console.twilio.com/',
    'Future read-only SMS status and A2P compliance review support.',
    'Jason McCurry',
    array['read status','prepare compliance checklist','review logs']::text[],
    array['send SMS','change A2P registrations','buy numbers','change account settings']::text[],
    true,
    'No MFA bypass. SMS sends require separate human-approved compliant infrastructure.',
    'Dedicated HomeReach Chrome profile',
    'manual_login_required'
  ),
  (
    'Mailgun',
    'https://app.mailgun.com/',
    'Future read-only email deliverability and bounce review.',
    'Jason McCurry',
    array['read events','prepare deliverability notes','review domain status']::text[],
    array['send email','export suppression lists','change DNS/domain settings','expose API keys']::text[],
    true,
    'Do not expose API keys in screenshots, logs, or copied notes.',
    'Dedicated HomeReach Chrome profile',
    'manual_login_required'
  ),
  (
    'GitHub',
    'https://github.com/',
    'Future repository review, issue triage, and pull request preparation.',
    'Jason McCurry',
    array['read issues','prepare PR notes','review CI status']::text[],
    array['merge PRs','delete branches','change secrets','change repo settings without approval']::text[],
    true,
    'Prefer API/CLI connectors for repository work when available.',
    'Dedicated HomeReach Chrome profile',
    'manual_login_required'
  ),
  (
    'Vercel',
    'https://vercel.com/',
    'Future deployment status review and environment checklist preparation.',
    'Jason McCurry',
    array['read deployment status','prepare rollback checklist','review logs']::text[],
    array['deploy','rollback','change env vars','change domains','expose secrets without approval']::text[],
    true,
    'Use Vercel connector/CLI for deployment when available. Browser use is review-only by default.',
    'Dedicated HomeReach Chrome profile',
    'manual_login_required'
  ),
  (
    'Supabase',
    'https://supabase.com/dashboard',
    'Future database dashboard review and migration checklist preparation.',
    'Jason McCurry',
    array['read project status','prepare SQL review notes','inspect logs']::text[],
    array['run SQL','change RLS','delete data','export sensitive data','expose service keys without approval']::text[],
    true,
    'No direct browser SQL execution unless separately approved for a specific migration.',
    'Dedicated HomeReach Chrome profile',
    'manual_login_required'
  ),
  (
    'GoDaddy',
    'https://www.godaddy.com/',
    'Future domain/DNS review and checklist preparation.',
    'Jason McCurry',
    array['read DNS records','prepare DNS change checklist']::text[],
    array['change DNS','transfer domains','buy products','change account settings without approval']::text[],
    true,
    'DNS changes remain manual approval only.',
    'Dedicated HomeReach Chrome profile',
    'manual_login_required'
  ),
  (
    'SAM.gov',
    'https://sam.gov/',
    'Future opportunity review and draft-only bid preparation support.',
    'Jason McCurry',
    array['read public opportunities','prepare bid/no-bid checklist','draft response package notes']::text[],
    array['submit bids','certify compliance','sign representations','change entity settings']::text[],
    true,
    'SAM.gov submissions, certifications, and representations remain human-only.',
    'Dedicated HomeReach Chrome profile',
    'manual_login_required'
  ),
  (
    'supplier websites',
    null,
    'Future supplier price review and procurement checklist preparation.',
    'Jason McCurry',
    array['read approved supplier pages','prepare price comparison notes','draft reorder checklist']::text[],
    array['place orders','change vendor accounts','enter payment details','commit spend']::text[],
    true,
    'Procurement agents may recommend; they must not buy, switch vendors, or commit spend.',
    'Dedicated HomeReach Chrome profile',
    'manual_login_required'
  )
on conflict (system_name) do update
set
  login_url = excluded.login_url,
  purpose = excluded.purpose,
  account_owner = excluded.account_owner,
  allowed_actions = excluded.allowed_actions,
  blocked_actions = excluded.blocked_actions,
  requires_mfa = excluded.requires_mfa,
  notes = excluded.notes,
  preferred_browser_profile = excluded.preferred_browser_profile,
  updated_at = now();
