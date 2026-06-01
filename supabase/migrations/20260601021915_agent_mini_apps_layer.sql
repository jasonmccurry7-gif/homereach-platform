-- Agent-Native Mini Apps Layer
-- Additive decision-and-approval layer for agent-generated work.
-- This migration does not send outreach, place orders, submit bids, store
-- browser credentials, store API keys, store MFA codes, or execute external work.

create table if not exists public.agent_mini_apps (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  mini_app_type text not null check (
    mini_app_type in (
      'outreach_approval',
      'political_plan',
      'route_density',
      'procurement_savings',
      'samgov_bid',
      'website_build',
      'generic_task'
    )
  ),
  title text not null check (length(trim(title)) > 0),
  description text not null default '',
  source_agent text not null default 'Orchestrator Agent',
  related_module text not null default 'ai_workforce',
  related_business_id uuid references public.businesses(id) on delete set null,
  related_contact_id uuid references public.outreach_contacts(id) on delete set null,
  related_campaign_id uuid,
  related_client_id uuid references public.profiles(id) on delete set null,
  status text not null default 'generated' check (
    status in (
      'generated',
      'needs_review',
      'edited',
      'approved',
      'scheduled',
      'executed',
      'rejected',
      'archived',
      'failed',
      'sent_to_execution_queue'
    )
  ),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  confidence_score numeric(5,2) not null default 0 check (confidence_score >= 0 and confidence_score <= 100),
  risk_level text not null default 'medium' check (risk_level in ('low','medium','high','critical')),
  approval_required boolean not null default true,
  estimated_revenue numeric(12,2) not null default 0,
  estimated_savings numeric(12,2) not null default 0,
  estimated_cost numeric(12,2) not null default 0,
  recommended_action text not null default '',
  payload_json jsonb not null default '{}'::jsonb,
  edited_payload_json jsonb,
  decision text check (
    decision is null or decision in (
      'approved',
      'rejected',
      'archived',
      'scheduled',
      'executed',
      'sent_to_execution_queue',
      'needs_revision'
    )
  ),
  decision_reason text,
  assigned_user_id uuid references public.profiles(id) on delete set null,
  due_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists agent_mini_apps_today_stack_idx
  on public.agent_mini_apps (status, priority, due_at, updated_at desc);
create index if not exists agent_mini_apps_type_idx
  on public.agent_mini_apps (mini_app_type, status, updated_at desc);
create index if not exists agent_mini_apps_risk_idx
  on public.agent_mini_apps (risk_level, approval_required, updated_at desc);
create index if not exists agent_mini_apps_assigned_idx
  on public.agent_mini_apps (assigned_user_id, status, due_at);
create index if not exists agent_mini_apps_related_module_idx
  on public.agent_mini_apps (related_module, status, updated_at desc);
create index if not exists agent_mini_apps_payload_gin_idx
  on public.agent_mini_apps using gin (payload_json);

create table if not exists public.agent_mini_app_events (
  id uuid primary key default gen_random_uuid(),
  mini_app_id uuid not null references public.agent_mini_apps(id),
  event_type text not null check (
    event_type in (
      'created',
      'viewed',
      'edited',
      'approved',
      'rejected',
      'archived',
      'scheduled',
      'executed',
      'failed',
      'assigned',
      'sent_to_execution_queue',
      'manual_takeover_requested'
    )
  ),
  previous_status text,
  new_status text,
  actor_user_id uuid references public.profiles(id) on delete set null,
  actor_type text not null default 'user' check (actor_type in ('user','agent','system')),
  event_summary text not null default '',
  event_payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists agent_mini_app_events_mini_app_idx
  on public.agent_mini_app_events (mini_app_id, created_at desc);
create index if not exists agent_mini_app_events_type_idx
  on public.agent_mini_app_events (event_type, created_at desc);

create or replace function public.prevent_agent_mini_app_events_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'agent_mini_app_events is immutable; append a new event instead';
end;
$$;

drop trigger if exists prevent_agent_mini_app_events_mutation_trigger on public.agent_mini_app_events;
create trigger prevent_agent_mini_app_events_mutation_trigger
  before update or delete on public.agent_mini_app_events
  for each row execute function public.prevent_agent_mini_app_events_mutation();

revoke execute on function public.prevent_agent_mini_app_events_mutation() from public, anon, authenticated;

alter table public.agent_mini_apps enable row level security;
alter table public.agent_mini_app_events enable row level security;

grant select, insert, update on public.agent_mini_apps to authenticated;
grant select, insert on public.agent_mini_app_events to authenticated;
grant all on public.agent_mini_apps, public.agent_mini_app_events to service_role;

drop policy if exists "agent_mini_apps_service" on public.agent_mini_apps;
create policy "agent_mini_apps_service"
  on public.agent_mini_apps for all to service_role
  using (true) with check (true);

drop policy if exists "agent_mini_apps_admin_or_assigned_select" on public.agent_mini_apps;
create policy "agent_mini_apps_admin_or_assigned_select"
  on public.agent_mini_apps for select to authenticated
  using (
    (auth.jwt()->'app_metadata'->>'user_role') = 'admin'
    or assigned_user_id = (select auth.uid())
    or created_by = (select auth.uid())
  );

drop policy if exists "agent_mini_apps_admin_or_assigned_write" on public.agent_mini_apps;
create policy "agent_mini_apps_admin_or_assigned_write"
  on public.agent_mini_apps for update to authenticated
  using (
    (auth.jwt()->'app_metadata'->>'user_role') = 'admin'
    or assigned_user_id = (select auth.uid())
    or created_by = (select auth.uid())
  )
  with check (
    (auth.jwt()->'app_metadata'->>'user_role') = 'admin'
    or assigned_user_id = (select auth.uid())
    or created_by = (select auth.uid())
  );

drop policy if exists "agent_mini_apps_admin_insert" on public.agent_mini_apps;
create policy "agent_mini_apps_admin_insert"
  on public.agent_mini_apps for insert to authenticated
  with check ((auth.jwt()->'app_metadata'->>'user_role') = 'admin');

drop policy if exists "agent_mini_app_events_service" on public.agent_mini_app_events;
create policy "agent_mini_app_events_service"
  on public.agent_mini_app_events for all to service_role
  using (true) with check (true);

drop policy if exists "agent_mini_app_events_admin_or_assigned_select" on public.agent_mini_app_events;
create policy "agent_mini_app_events_admin_or_assigned_select"
  on public.agent_mini_app_events for select to authenticated
  using (
    exists (
      select 1
      from public.agent_mini_apps app
      where app.id = agent_mini_app_events.mini_app_id
        and (
          (auth.jwt()->'app_metadata'->>'user_role') = 'admin'
          or app.assigned_user_id = (select auth.uid())
          or app.created_by = (select auth.uid())
        )
    )
  );

drop policy if exists "agent_mini_app_events_admin_or_assigned_insert" on public.agent_mini_app_events;
create policy "agent_mini_app_events_admin_or_assigned_insert"
  on public.agent_mini_app_events for insert to authenticated
  with check (
    exists (
      select 1
      from public.agent_mini_apps app
      where app.id = agent_mini_app_events.mini_app_id
        and (
          (auth.jwt()->'app_metadata'->>'user_role') = 'admin'
          or app.assigned_user_id = (select auth.uid())
          or app.created_by = (select auth.uid())
        )
    )
  );

-- Ensure the future execution-readiness layer exists even if an earlier
-- deployment has not applied the standalone execution readiness migration yet.
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

grant select, insert, update on public.agent_execution_queue to authenticated;
grant select on public.agent_browser_session_registry to authenticated;
grant select, insert on public.agent_execution_audit_log to authenticated;
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

-- Extend the existing execution-readiness layer instead of replacing it.
alter table public.agent_execution_queue
  add column if not exists tenant_id uuid,
  add column if not exists execution_log_json jsonb not null default '[]'::jsonb;

alter table public.agent_execution_queue
  drop constraint if exists agent_execution_queue_status_check;

alter table public.agent_execution_queue
  add constraint agent_execution_queue_status_check
  check (
    status in (
      'pending_approval',
      'queued',
      'approved',
      'dry_run_ready',
      'running',
      'completed',
      'failed',
      'paused',
      'rejected',
      'cancelled',
      'manual_takeover_required',
      'manual_takeover_needed',
      'executed_manually'
    )
  );

create index if not exists agent_execution_queue_tenant_idx
  on public.agent_execution_queue (tenant_id, status, updated_at desc);

alter table public.agent_browser_session_registry
  add column if not exists allowed_actions_json jsonb not null default '[]'::jsonb,
  add column if not exists blocked_actions_json jsonb not null default '[]'::jsonb;

update public.agent_browser_session_registry
set
  allowed_actions_json = to_jsonb(allowed_actions),
  blocked_actions_json = to_jsonb(blocked_actions),
  updated_at = now()
where
  (allowed_actions_json = '[]'::jsonb and coalesce(array_length(allowed_actions, 1), 0) > 0)
  or (blocked_actions_json = '[]'::jsonb and coalesce(array_length(blocked_actions, 1), 0) > 0);

insert into public.agent_browser_session_registry (
  system_name,
  login_url,
  purpose,
  account_owner,
  allowed_actions,
  blocked_actions,
  allowed_actions_json,
  blocked_actions_json,
  requires_mfa,
  preferred_browser_profile,
  active_session_status,
  notes
)
values
  (
    'HomeReach Admin',
    'https://www.home-reach.com/admin',
    'Review internal queues, draft work, check dashboards, and prepare approval-gated actions.',
    'Jason McCurry',
    array['read dashboards','prepare drafts','copy approved text','mark internal review status after human approval']::text[],
    array['bypass auth','delete records','change pricing','send outreach without approval','change payments']::text[],
    to_jsonb(array['read dashboards','prepare drafts','copy approved text','mark internal review status after human approval']::text[]),
    to_jsonb(array['bypass auth','delete records','change pricing','send outreach without approval','change payments']::text[]),
    true,
    'Dedicated HomeReach Windows user + dedicated Chrome profile',
    'manual_login_required',
    'Use only a dedicated HomeReach admin session. Do not store credentials in HomeReach.'
  ),
  (
    'Gmail',
    'https://mail.google.com/',
    'Future review of inbound messages and draft-only outbound preparation.',
    'Jason McCurry',
    array['read approved threads','prepare drafts','label items after approval']::text[],
    array['send email without approval','export mailbox','change account settings','access unrelated personal mail']::text[],
    to_jsonb(array['read approved threads','prepare drafts','label items after approval']::text[]),
    to_jsonb(array['send email without approval','export mailbox','change account settings','access unrelated personal mail']::text[]),
    true,
    'Dedicated HomeReach Chrome profile',
    'manual_login_required',
    'Use dedicated business mailbox sessions only.'
  ),
  (
    'Facebook',
    'https://www.facebook.com/',
    'Future assisted review of business pages, messages, and draft-only responses.',
    'Jason McCurry',
    array['read approved business page context','prepare DM drafts','copy approved post text']::text[],
    array['post publicly without approval','send DMs without approval','scrape prohibited areas','change page settings']::text[],
    to_jsonb(array['read approved business page context','prepare DM drafts','copy approved post text']::text[]),
    to_jsonb(array['post publicly without approval','send DMs without approval','scrape prohibited areas','change page settings']::text[]),
    true,
    'Dedicated HomeReach Chrome profile',
    'manual_login_required',
    'Only business assets approved by admin. No personal account automation.'
  ),
  (
    'Stripe',
    'https://dashboard.stripe.com/',
    'Future read-only reconciliation and owner-approved payment investigation.',
    'Jason McCurry',
    array['read payment status','prepare reconciliation notes','copy invoice metadata']::text[],
    array['refund','charge','change prices','change subscriptions','export sensitive payment data']::text[],
    to_jsonb(array['read payment status','prepare reconciliation notes','copy invoice metadata']::text[]),
    to_jsonb(array['refund','charge','change prices','change subscriptions','export sensitive payment data']::text[]),
    true,
    'Dedicated HomeReach Chrome profile',
    'manual_login_required',
    'Payment mutation remains manual/human-only unless a separate approved connector is built.'
  ),
  (
    'Twilio',
    'https://console.twilio.com/',
    'Future read-only SMS status and A2P compliance review support.',
    'Jason McCurry',
    array['read status','prepare compliance checklist','review logs']::text[],
    array['send SMS','change A2P registrations','buy numbers','change account settings']::text[],
    to_jsonb(array['read status','prepare compliance checklist','review logs']::text[]),
    to_jsonb(array['send SMS','change A2P registrations','buy numbers','change account settings']::text[]),
    true,
    'Dedicated HomeReach Chrome profile',
    'manual_login_required',
    'No MFA bypass. SMS sends require separate human-approved compliant infrastructure.'
  ),
  (
    'Mailgun',
    'https://app.mailgun.com/',
    'Future read-only email deliverability and bounce review.',
    'Jason McCurry',
    array['read events','prepare deliverability notes','review domain status']::text[],
    array['send email','export suppression lists','change DNS/domain settings','expose API keys']::text[],
    to_jsonb(array['read events','prepare deliverability notes','review domain status']::text[]),
    to_jsonb(array['send email','export suppression lists','change DNS/domain settings','expose API keys']::text[]),
    true,
    'Dedicated HomeReach Chrome profile',
    'manual_login_required',
    'Do not expose API keys in screenshots, logs, or copied notes.'
  ),
  (
    'GitHub',
    'https://github.com/',
    'Future repository review, issue triage, and pull request preparation.',
    'Jason McCurry',
    array['read issues','prepare PR notes','review CI status']::text[],
    array['merge PRs','delete branches','change secrets','change repo settings without approval']::text[],
    to_jsonb(array['read issues','prepare PR notes','review CI status']::text[]),
    to_jsonb(array['merge PRs','delete branches','change secrets','change repo settings without approval']::text[]),
    true,
    'Dedicated HomeReach Chrome profile',
    'manual_login_required',
    'Prefer API/CLI connectors for repository work when available.'
  ),
  (
    'Vercel',
    'https://vercel.com/',
    'Future deployment status review and environment checklist preparation.',
    'Jason McCurry',
    array['read deployment status','prepare rollback checklist','review logs']::text[],
    array['deploy','rollback','change env vars','change domains','expose secrets without approval']::text[],
    to_jsonb(array['read deployment status','prepare rollback checklist','review logs']::text[]),
    to_jsonb(array['deploy','rollback','change env vars','change domains','expose secrets without approval']::text[]),
    true,
    'Dedicated HomeReach Chrome profile',
    'manual_login_required',
    'Use Vercel connector/CLI for deployment when available. Browser use is review-only by default.'
  ),
  (
    'Supabase',
    'https://supabase.com/dashboard',
    'Future database dashboard review and migration checklist preparation.',
    'Jason McCurry',
    array['read project status','prepare SQL review notes','inspect logs']::text[],
    array['run SQL','change RLS','delete data','export sensitive data','expose service keys without approval']::text[],
    to_jsonb(array['read project status','prepare SQL review notes','inspect logs']::text[]),
    to_jsonb(array['run SQL','change RLS','delete data','export sensitive data','expose service keys without approval']::text[]),
    true,
    'Dedicated HomeReach Chrome profile',
    'manual_login_required',
    'No direct browser SQL execution unless separately approved for a specific migration.'
  ),
  (
    'GoDaddy',
    'https://www.godaddy.com/',
    'Future domain/DNS review and checklist preparation.',
    'Jason McCurry',
    array['read DNS records','prepare DNS change checklist']::text[],
    array['change DNS','transfer domains','buy products','change account settings without approval']::text[],
    to_jsonb(array['read DNS records','prepare DNS change checklist']::text[]),
    to_jsonb(array['change DNS','transfer domains','buy products','change account settings without approval']::text[]),
    true,
    'Dedicated HomeReach Chrome profile',
    'manual_login_required',
    'DNS changes remain manual approval only.'
  ),
  (
    'SAM.gov',
    'https://sam.gov/',
    'Future opportunity review and draft-only bid preparation support.',
    'Jason McCurry',
    array['read public opportunities','prepare bid/no-bid checklist','draft response package notes']::text[],
    array['submit bids','certify compliance','sign representations','change entity settings']::text[],
    to_jsonb(array['read public opportunities','prepare bid/no-bid checklist','draft response package notes']::text[]),
    to_jsonb(array['submit bids','certify compliance','sign representations','change entity settings']::text[]),
    true,
    'Dedicated HomeReach Chrome profile',
    'manual_login_required',
    'SAM.gov submissions, certifications, and representations remain human-only.'
  ),
  (
    'supplier websites',
    null,
    'Future supplier price review and procurement checklist preparation.',
    'Jason McCurry',
    array['read approved supplier pages','prepare price comparison notes','draft reorder checklist']::text[],
    array['place orders','change vendor accounts','enter payment details','commit spend']::text[],
    to_jsonb(array['read approved supplier pages','prepare price comparison notes','draft reorder checklist']::text[]),
    to_jsonb(array['place orders','change vendor accounts','enter payment details','commit spend']::text[]),
    true,
    'Dedicated HomeReach Chrome profile',
    'manual_login_required',
    'Procurement agents may recommend; they must not buy, switch vendors, or commit spend.'
  )
on conflict (system_name) do update
set
  login_url = excluded.login_url,
  purpose = excluded.purpose,
  account_owner = excluded.account_owner,
  allowed_actions = excluded.allowed_actions,
  blocked_actions = excluded.blocked_actions,
  allowed_actions_json = excluded.allowed_actions_json,
  blocked_actions_json = excluded.blocked_actions_json,
  requires_mfa = excluded.requires_mfa,
  preferred_browser_profile = excluded.preferred_browser_profile,
  notes = excluded.notes,
  updated_at = now();

create or replace view public.browser_session_registry
with (security_invoker = true)
as
select
  id,
  system_name,
  login_url,
  purpose,
  account_owner,
  case
    when jsonb_array_length(allowed_actions_json) > 0 then allowed_actions_json
    else to_jsonb(allowed_actions)
  end as allowed_actions_json,
  case
    when jsonb_array_length(blocked_actions_json) > 0 then blocked_actions_json
    else to_jsonb(blocked_actions)
  end as blocked_actions_json,
  requires_mfa,
  preferred_browser_profile,
  active_session_status,
  notes,
  created_at,
  updated_at
from public.agent_browser_session_registry;

grant select on public.browser_session_registry to authenticated;

-- Demo rows for local review and fallback-free product validation.
insert into public.agent_mini_apps (
  mini_app_type,
  title,
  description,
  source_agent,
  related_module,
  status,
  priority,
  confidence_score,
  risk_level,
  approval_required,
  estimated_revenue,
  estimated_savings,
  estimated_cost,
  recommended_action,
  payload_json,
  due_at
)
select
  'outreach_approval',
  'Approve email to Oak Ridge Roofing',
  'Review a one-to-one executive email draft before any outreach leaves HomeReach.',
  'Outreach Agent',
  'outreach-command',
  'needs_review',
  'urgent',
  86,
  'medium',
  true,
  4200,
  0,
  0,
  'Approve the revised email, then queue for manual send review.',
  jsonb_build_object(
    'channel','email',
    'recipient_name','Megan Wallace',
    'recipient_email','megan@example.com',
    'recipient_phone',null,
    'business_name','Oak Ridge Roofing',
    'campaign_name','Spring storm route density',
    'subject','Storm-season route around Oak Ridge',
    'message_body','Megan, I mapped a compact storm-season route around Oak Ridge that could keep your crew visible without a broad ad spend. If it looks useful, I can send the route, mail cost, and geofence option for review.',
    'previous_touch_summary','Website inquiry requested pricing for targeted roofing mail after hail events.',
    'suggested_follow_up_date',(now() + interval '2 days')::text,
    'call_to_action','Review route and quote',
    'compliance_warning','Do not send until the recipient, claims, sender identity, and opt-out/permission context are reviewed.',
    'personalization_notes','References storm-season visibility and route control rather than generic postcard language.',
    'inputs_used',jsonb_build_array('CRM lead note','Route density SOP','Approved sender persona: Jason'),
    'sources_referenced',jsonb_build_array('AI Assets outreach SOP','AGENTS.md approval gate'),
    'approval_status','needs_review',
    'next_action','Human review, edit if needed, then queue approved send task.',
    'related_entity','Oak Ridge Roofing',
    'destination','Communication ledger and future execution queue'
  ),
  now() + interval '2 hours'
where not exists (
  select 1 from public.agent_mini_apps where title = 'Approve email to Oak Ridge Roofing'
);

insert into public.agent_mini_apps (
  mini_app_type,
  title,
  description,
  source_agent,
  related_module,
  status,
  priority,
  confidence_score,
  risk_level,
  approval_required,
  estimated_revenue,
  estimated_savings,
  estimated_cost,
  recommended_action,
  payload_json,
  due_at
)
select
  'outreach_approval',
  'Review SMS follow-up for Lakeside Lawn',
  'Approve or revise a short SMS follow-up before any message is sent.',
  'Follow-Up Agent',
  'outreach-command',
  'needs_review',
  'high',
  78,
  'high',
  true,
  1800,
  0,
  0,
  'Edit for brevity, then schedule only if SMS permission is confirmed.',
  jsonb_build_object(
    'channel','sms',
    'recipient_name','Tom Avery',
    'recipient_email',null,
    'recipient_phone','+15555550118',
    'business_name','Lakeside Lawn Care',
    'campaign_name','Neighborhood spring cleanups',
    'subject',null,
    'message_body','Tom, this is Josh with HomeReach. I have the Lakeside spring cleanup route ready if you want the quick cost and timing today. Reply STOP to opt out.',
    'previous_touch_summary','Asked for a low-pressure follow-up after reviewing shared postcard options.',
    'suggested_follow_up_date',(now() + interval '1 day')::text,
    'call_to_action','Confirm interest in route cost',
    'compliance_warning','SMS requires confirmed permission and STOP/HELP handling before send.',
    'personalization_notes','Short Josh-style message focused on one next step.',
    'inputs_used',jsonb_build_array('Prior inquiry','SMS compliance checklist','Josh sender persona'),
    'sources_referenced',jsonb_build_array('AI Assets SMS SOP','AGENTS.md outbound approval gate'),
    'approval_status','needs_review',
    'next_action','Verify permission, approve, then schedule or queue manual send.',
    'related_entity','Lakeside Lawn Care',
    'destination','Communication ledger and future execution queue'
  ),
  now() + interval '4 hours'
where not exists (
  select 1 from public.agent_mini_apps where title = 'Review SMS follow-up for Lakeside Lawn'
);

insert into public.agent_mini_apps (
  mini_app_type,
  title,
  description,
  source_agent,
  related_module,
  status,
  priority,
  confidence_score,
  risk_level,
  approval_required,
  estimated_revenue,
  estimated_savings,
  estimated_cost,
  recommended_action,
  payload_json,
  due_at
)
select
  'political_plan',
  'Approve city council campaign plan',
  'Review a neutral geofence-first political mail execution plan before proposal creation.',
  'Political Campaign Agent',
  'political',
  'needs_review',
  'urgent',
  82,
  'critical',
  true,
  12500,
  0,
  6150,
  'Approve the plan structure, then generate a proposal draft.',
  jsonb_build_object(
    'candidate_name','Alex Rivera',
    'race_type','City Council',
    'geography','Franklin County, OH ward cluster',
    'election_date','2026-11-03',
    'voter_universe_summary','Campaign-provided household universe and public ward geography only; no individual ideology inference.',
    'geofence_strategy','Geofence early-vote locations and public community event zones as an awareness layer.',
    'postcard_strategy','Two postcard drops focused on name recognition, service record, and voting logistics.',
    'timeline',jsonb_build_array('Week 1: plan approval','Week 2: creative','Weeks 3-5: mail and geofence coordination'),
    'estimated_cost',6150,
    'estimated_revenue',12500,
    'creative_options',jsonb_build_array('Operational leadership','Neighborhood visibility','Voting logistics reminder'),
    'proposal_summary','Geofence-first plan with postcards as a high-recall companion channel.',
    'compliance_notes','No voter belief inference, no individual political scoring, all claims require campaign approval.',
    'inputs_used',jsonb_build_array('Campaign-provided geography','Political SOP','Public race context'),
    'sources_referenced',jsonb_build_array('AGENTS.md political rules','AI Assets political examples'),
    'approval_status','needs_review',
    'next_action','Human approval before proposal, outreach, or creative use.',
    'related_entity','Alex Rivera campaign',
    'destination','Political module and proposal queue'
  ),
  now() + interval '90 minutes'
where not exists (
  select 1 from public.agent_mini_apps where title = 'Approve city council campaign plan'
);

insert into public.agent_mini_apps (
  mini_app_type,
  title,
  description,
  source_agent,
  related_module,
  status,
  priority,
  confidence_score,
  risk_level,
  approval_required,
  estimated_revenue,
  estimated_savings,
  estimated_cost,
  recommended_action,
  payload_json,
  due_at
)
select
  'route_density',
  'Review HVAC route density quote',
  'Review a targeted route for a local HVAC prospect before quote and creative generation.',
  'Prospecting Agent',
  'targeted-campaigns',
  'generated',
  'high',
  74,
  'medium',
  true,
  3600,
  0,
  1185,
  'Move to review and generate a client-facing quote.',
  jsonb_build_object(
    'business_name','Summit HVAC',
    'service_type','HVAC tune-ups',
    'target_area','Westerville neighborhoods near older housing stock',
    'route_id','RD-WESTERVILLE-HVAC-01',
    'map_placeholder','Route polygon pending map render.',
    'household_count',1850,
    'estimated_cost',1185,
    'estimated_lead_range','8-18 inquiries',
    'recommended_offer','Pre-season tune-up plus priority booking',
    'postcard_plan','One oversized postcard drop with clear service-area proof.',
    'geofence_plan','Light geofence around route households and competitor-adjacent search behavior where compliant.',
    'client_facing_summary','Compact route designed to create visible repetition without broad-market waste.',
    'inputs_used',jsonb_build_array('Route density SOP','Service category fit','Cost assumptions'),
    'sources_referenced',jsonb_build_array('AI Assets route density examples','AGENTS.md approval gate'),
    'approval_status','generated',
    'next_action','Review assumptions, then generate quote.',
    'related_entity','Summit HVAC',
    'destination','Targeted campaigns quote workflow'
  ),
  now() + interval '6 hours'
where not exists (
  select 1 from public.agent_mini_apps where title = 'Review HVAC route density quote'
);

insert into public.agent_mini_apps (
  mini_app_type,
  title,
  description,
  source_agent,
  related_module,
  status,
  priority,
  confidence_score,
  risk_level,
  approval_required,
  estimated_revenue,
  estimated_savings,
  estimated_cost,
  recommended_action,
  payload_json,
  due_at
)
select
  'procurement_savings',
  'Approve bakery packaging reorder review',
  'Review supplier comparison and reorder timing before any vendor action.',
  'Procurement/Supplyfy Agent',
  'procurement',
  'needs_review',
  'normal',
  88,
  'medium',
  true,
  0,
  420,
  0,
  'Approve savings review for owner discussion; do not place order.',
  jsonb_build_object(
    'business_name','North Market Bakery',
    'current_supplier','Local Restaurant Supply',
    'recommended_supplier','Supplyfy preferred packaging vendor',
    'item_comparisons',jsonb_build_array(
      jsonb_build_object('item','9x9 bakery boxes','current_unit_cost',0.74,'recommended_unit_cost',0.61,'monthly_quantity',900),
      jsonb_build_object('item','Kraft pastry bags','current_unit_cost',0.18,'recommended_unit_cost',0.14,'monthly_quantity',1400)
    ),
    'estimated_savings',420,
    'reorder_timing','Next reorder window: 7-10 days',
    'recommended_quantity','One-month quantity only until quality is verified.',
    'quality_risk_notes','Validate box stiffness and bag grease resistance before switching.',
    'savings_summary','Potential monthly savings without committing spend or switching vendors automatically.',
    'approval_notes','Owner approval required before vendor contact, order, or spend commitment.',
    'inputs_used',jsonb_build_array('Procurement intake','Supplier comparison SOP','Owner reorder timing'),
    'sources_referenced',jsonb_build_array('AGENTS.md procurement rules','AI Assets procurement examples'),
    'approval_status','needs_review',
    'next_action','Human review and owner discussion only.',
    'related_entity','North Market Bakery',
    'destination','Procurement savings queue'
  ),
  now() + interval '1 day'
where not exists (
  select 1 from public.agent_mini_apps where title = 'Approve bakery packaging reorder review'
);

insert into public.agent_mini_apps (
  mini_app_type,
  title,
  description,
  source_agent,
  related_module,
  status,
  priority,
  confidence_score,
  risk_level,
  approval_required,
  estimated_revenue,
  estimated_savings,
  estimated_cost,
  recommended_action,
  payload_json,
  due_at
)
select
  'samgov_bid',
  'Bid/no-bid review for facilities mailer opportunity',
  'Review SAM.gov fit and compliance requirements before bid drafting.',
  'SAM.gov Contract Agent',
  'gov-contracts',
  'needs_review',
  'urgent',
  69,
  'critical',
  true,
  48000,
  0,
  0,
  'Approve research only, then find subcontractor gaps before any bid draft.',
  jsonb_build_object(
    'opportunity_title','Regional facilities notification mailer support',
    'agency','General Services Administration',
    'notice_id','SAM-DEMO-2026-001',
    'deadline',(now() + interval '9 days')::date::text,
    'fit_score',69,
    'revenue_potential',48000,
    'bid_no_bid_recommendation','Research further before bid decision',
    'required_documents',jsonb_build_array('Capability statement','Pricing worksheet','Past performance notes','Compliance checklist'),
    'subcontractor_match','Print/mail production partner likely required.',
    'compliance_requirements','Do not certify qualifications, submit, or bind HomeReach without human/legal review.',
    'next_steps',jsonb_build_array('Verify NAICS fit','Confirm print partner','Draft compliance matrix'),
    'inputs_used',jsonb_build_array('SAM.gov opportunity fields','GovCon SOP','HomeReach capability notes'),
    'sources_referenced',jsonb_build_array('AGENTS.md SAM.gov rules','AI Assets SAM.gov examples'),
    'approval_status','needs_review',
    'next_action','Approve research and subcontractor search only.',
    'related_entity','SAM-DEMO-2026-001',
    'destination','Gov Contracts approvals'
  ),
  now() + interval '3 hours'
where not exists (
  select 1 from public.agent_mini_apps where title = 'Bid/no-bid review for facilities mailer opportunity'
);

insert into public.agent_mini_apps (
  mini_app_type,
  title,
  description,
  source_agent,
  related_module,
  status,
  priority,
  confidence_score,
  risk_level,
  approval_required,
  estimated_revenue,
  estimated_savings,
  estimated_cost,
  recommended_action,
  payload_json,
  due_at
)
select
  'website_build',
  'Approve website build prompt for Riverbend Concrete',
  'Review intake, payment, missing assets, and Codex build prompt before moving website work forward.',
  'Creative Copy Agent',
  'websites',
  'needs_review',
  'normal',
  81,
  'medium',
  true,
  2400,
  0,
  650,
  'Request missing photos before approving build prompt.',
  jsonb_build_object(
    'business_name','Riverbend Concrete',
    'owner_name','Dana Brooks',
    'domain_status','Domain connected; DNS launch check pending.',
    'payment_status','Deposit paid; monthly plan not activated.',
    'requested_pages',jsonb_build_array('Home','Services','Driveways','Patios','Contact'),
    'intake_completeness','82%',
    'missing_assets',jsonb_build_array('Crew photo','Before/after driveway photos','Final service-area list'),
    'build_cost',650,
    'monthly_plan','Growth site care plan',
    'codex_build_prompt_preview','Build a practical local concrete contractor site focused on quote requests, service-area confidence, and photo proof. Do not publish until launch checklist is approved.',
    'launch_checklist',jsonb_build_array('Confirm payment','Confirm domain DNS','Collect missing photos','QA mobile forms','Human launch approval'),
    'inputs_used',jsonb_build_array('Website intake','Payment status note','Approved website SOP'),
    'sources_referenced',jsonb_build_array('AGENTS.md approval gate','AI Assets website examples'),
    'approval_status','needs_review',
    'next_action','Request missing information or approve build prompt for draft-only work.',
    'related_entity','Riverbend Concrete',
    'destination','Website management queue'
  ),
  now() + interval '5 hours'
where not exists (
  select 1 from public.agent_mini_apps where title = 'Approve website build prompt for Riverbend Concrete'
);

insert into public.agent_mini_app_events (
  mini_app_id,
  event_type,
  previous_status,
  new_status,
  actor_type,
  event_summary,
  event_payload_json
)
select
  app.id,
  'created',
  null,
  app.status,
  'system',
  'Seed mini app created for Agent-Native Mini Apps Layer review.',
  jsonb_build_object('source','migration','approval_required',app.approval_required)
from public.agent_mini_apps app
where app.title in (
  'Approve email to Oak Ridge Roofing',
  'Review SMS follow-up for Lakeside Lawn',
  'Approve city council campaign plan',
  'Review HVAC route density quote',
  'Approve bakery packaging reorder review',
  'Bid/no-bid review for facilities mailer opportunity',
  'Approve website build prompt for Riverbend Concrete'
)
and not exists (
  select 1
  from public.agent_mini_app_events event
  where event.mini_app_id = app.id
    and event.event_type = 'created'
);
