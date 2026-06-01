-- Agent Connector Policy Layer
-- Additive safety layer for future API/browser/computer-use integrations.
-- This migration stores connection metadata, tool permissions, approved action
-- intents, and execution attempts. It does not store passwords, API keys, MFA
-- codes, browser cookies, OAuth refresh tokens, or private secrets.

create table if not exists public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  system_name text not null check (length(trim(system_name)) > 0),
  provider text not null check (length(trim(provider)) > 0),
  connection_type text not null default 'manual_browser' check (
    connection_type in (
      'oauth',
      'api_reference',
      'manual_browser',
      'webhook',
      'mcp',
      'native_connector',
      'none'
    )
  ),
  status text not null default 'not_configured' check (
    status in (
      'not_configured',
      'pending',
      'active',
      'expired',
      'revoked',
      'error',
      'archived'
    )
  ),
  account_label text,
  external_account_id text,
  allowed_scopes_json jsonb not null default '[]'::jsonb,
  blocked_scopes_json jsonb not null default '[]'::jsonb,
  credential_reference text,
  last_verified_at timestamptz,
  last_error text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint integration_connections_scopes_are_arrays check (
    jsonb_typeof(allowed_scopes_json) = 'array'
    and jsonb_typeof(blocked_scopes_json) = 'array'
  ),
  constraint integration_connections_no_inline_secret_reference check (
    credential_reference is null
    or (
      credential_reference !~* '(password|api[_-]?key|secret|mfa|refresh[_-]?token|access[_-]?token|session|cookie)'
      and credential_reference !~* '^(sk-|pk_live_|xox[baprs]-|ya29\\.|gh[pousr]_)'
    )
  )
);

comment on table public.integration_connections is
  'Metadata for external system connections. Secrets live only in managed provider vaults, never in this table.';
comment on column public.integration_connections.credential_reference is
  'Opaque vault/provider reference only. Do not store raw passwords, OAuth tokens, API keys, MFA codes, cookies, or secrets.';

create unique index if not exists integration_connections_unique_idx
  on public.integration_connections (
    coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(system_name),
    lower(provider),
    coalesce(external_account_id, '')
  );
create index if not exists integration_connections_status_idx
  on public.integration_connections (status, system_name, updated_at desc);
create index if not exists integration_connections_tenant_idx
  on public.integration_connections (tenant_id, status, updated_at desc);

create table if not exists public.agent_tool_permissions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  agent_key text not null check (length(trim(agent_key)) > 0),
  tool_key text not null check (length(trim(tool_key)) > 0),
  target_system text not null check (length(trim(target_system)) > 0),
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
  requires_human_approval boolean not null default true,
  max_estimated_cost numeric(12,2) not null default 0 check (max_estimated_cost >= 0),
  allowed_actions_json jsonb not null default '[]'::jsonb,
  blocked_actions_json jsonb not null default '[]'::jsonb,
  risk_level text not null default 'medium' check (risk_level in ('low','medium','high','critical')),
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agent_tool_permissions_actions_are_arrays check (
    jsonb_typeof(allowed_actions_json) = 'array'
    and jsonb_typeof(blocked_actions_json) = 'array'
  ),
  constraint agent_tool_permissions_sensitive_requires_approval check (
    permission_scope in ('read_only','draft_only','prepare_only')
    or requires_human_approval = true
  )
);

comment on table public.agent_tool_permissions is
  'Admin-governed permission registry for agent tools and external systems.';

create unique index if not exists agent_tool_permissions_unique_idx
  on public.agent_tool_permissions (
    coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(agent_key),
    lower(tool_key),
    lower(target_system)
  );
create index if not exists agent_tool_permissions_active_idx
  on public.agent_tool_permissions (active, permission_scope, risk_level, updated_at desc);
create index if not exists agent_tool_permissions_target_idx
  on public.agent_tool_permissions (target_system, permission_scope, active);

create table if not exists public.external_action_intents (
  id uuid primary key default gen_random_uuid(),
  mini_app_id uuid references public.agent_mini_apps(id) on delete set null,
  execution_queue_id uuid references public.agent_execution_queue(id) on delete set null,
  tenant_id uuid,
  intent_type text not null check (length(trim(intent_type)) > 0),
  target_system text not null check (length(trim(target_system)) > 0),
  target_identifier text,
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
  approved_payload_json jsonb not null default '{}'::jsonb,
  approval_event_id uuid references public.agent_mini_app_events(id) on delete set null,
  status text not null default 'approved' check (
    status in (
      'draft',
      'approval_required',
      'approved',
      'queued',
      'running',
      'completed',
      'failed',
      'cancelled',
      'manual_takeover_needed',
      'archived'
    )
  ),
  provider_result_json jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint external_action_intents_payload_is_object check (
    jsonb_typeof(approved_payload_json) = 'object'
    and jsonb_typeof(provider_result_json) = 'object'
  ),
  constraint external_action_intents_sensitive_scope_has_approval check (
    permission_scope in ('read_only','draft_only','prepare_only')
    or approval_event_id is not null
  )
);

comment on table public.external_action_intents is
  'Durable record of what a human approved before any external execution worker acts.';

create index if not exists external_action_intents_mini_app_idx
  on public.external_action_intents (mini_app_id, status, created_at desc);
create index if not exists external_action_intents_queue_idx
  on public.external_action_intents (execution_queue_id, status, created_at desc);
create index if not exists external_action_intents_target_idx
  on public.external_action_intents (target_system, permission_scope, status, updated_at desc);
create index if not exists external_action_intents_payload_gin_idx
  on public.external_action_intents using gin (approved_payload_json);

create table if not exists public.agent_execution_attempts (
  id uuid primary key default gen_random_uuid(),
  execution_queue_id uuid not null references public.agent_execution_queue(id) on delete cascade,
  attempt_number integer not null default 1 check (attempt_number > 0),
  status text not null default 'queued' check (
    status in (
      'queued',
      'running',
      'completed',
      'failed',
      'cancelled',
      'manual_takeover_needed'
    )
  ),
  started_at timestamptz,
  completed_at timestamptz,
  actor_type text not null default 'worker' check (actor_type in ('user','agent','system','worker')),
  tool_key text,
  idempotency_key text,
  request_summary text,
  response_summary text,
  screenshot_before_url text,
  screenshot_after_url text,
  log_json jsonb not null default '[]'::jsonb,
  failure_reason text,
  created_at timestamptz not null default now(),
  constraint agent_execution_attempts_log_is_array check (jsonb_typeof(log_json) = 'array')
);

comment on table public.agent_execution_attempts is
  'Per-attempt execution ledger. Store summaries and references, not raw secrets or private session data.';

create unique index if not exists agent_execution_attempts_attempt_number_idx
  on public.agent_execution_attempts (execution_queue_id, attempt_number);
create unique index if not exists agent_execution_attempts_idempotency_idx
  on public.agent_execution_attempts (idempotency_key)
  where idempotency_key is not null;
create index if not exists agent_execution_attempts_status_idx
  on public.agent_execution_attempts (status, created_at desc);

alter table public.integration_connections enable row level security;
alter table public.agent_tool_permissions enable row level security;
alter table public.external_action_intents enable row level security;
alter table public.agent_execution_attempts enable row level security;

grant select, insert, update on public.integration_connections to authenticated;
grant select, insert, update on public.agent_tool_permissions to authenticated;
grant select, insert, update on public.external_action_intents to authenticated;
grant select, insert, update on public.agent_execution_attempts to authenticated;
grant all on
  public.integration_connections,
  public.agent_tool_permissions,
  public.external_action_intents,
  public.agent_execution_attempts
to service_role;

drop policy if exists "integration_connections_service" on public.integration_connections;
create policy "integration_connections_service"
  on public.integration_connections for all to service_role
  using (true) with check (true);

drop policy if exists "integration_connections_admin_select" on public.integration_connections;
create policy "integration_connections_admin_select"
  on public.integration_connections for select to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') = 'admin');

drop policy if exists "integration_connections_admin_write" on public.integration_connections;
create policy "integration_connections_admin_write"
  on public.integration_connections for all to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') = 'admin')
  with check ((auth.jwt()->'app_metadata'->>'user_role') = 'admin');

drop policy if exists "agent_tool_permissions_service" on public.agent_tool_permissions;
create policy "agent_tool_permissions_service"
  on public.agent_tool_permissions for all to service_role
  using (true) with check (true);

drop policy if exists "agent_tool_permissions_admin_select" on public.agent_tool_permissions;
create policy "agent_tool_permissions_admin_select"
  on public.agent_tool_permissions for select to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') = 'admin');

drop policy if exists "agent_tool_permissions_admin_write" on public.agent_tool_permissions;
create policy "agent_tool_permissions_admin_write"
  on public.agent_tool_permissions for all to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') = 'admin')
  with check ((auth.jwt()->'app_metadata'->>'user_role') = 'admin');

drop policy if exists "external_action_intents_service" on public.external_action_intents;
create policy "external_action_intents_service"
  on public.external_action_intents for all to service_role
  using (true) with check (true);

drop policy if exists "external_action_intents_admin_select" on public.external_action_intents;
create policy "external_action_intents_admin_select"
  on public.external_action_intents for select to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') = 'admin');

drop policy if exists "external_action_intents_admin_write" on public.external_action_intents;
create policy "external_action_intents_admin_write"
  on public.external_action_intents for all to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') = 'admin')
  with check ((auth.jwt()->'app_metadata'->>'user_role') = 'admin');

drop policy if exists "agent_execution_attempts_service" on public.agent_execution_attempts;
create policy "agent_execution_attempts_service"
  on public.agent_execution_attempts for all to service_role
  using (true) with check (true);

drop policy if exists "agent_execution_attempts_admin_select" on public.agent_execution_attempts;
create policy "agent_execution_attempts_admin_select"
  on public.agent_execution_attempts for select to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') = 'admin');

drop policy if exists "agent_execution_attempts_admin_write" on public.agent_execution_attempts;
create policy "agent_execution_attempts_admin_write"
  on public.agent_execution_attempts for all to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') = 'admin')
  with check ((auth.jwt()->'app_metadata'->>'user_role') = 'admin');

insert into public.integration_connections (
  system_name,
  provider,
  connection_type,
  status,
  account_label,
  allowed_scopes_json,
  blocked_scopes_json
)
select *
from (
  values
    ('Gmail', 'google', 'oauth', 'not_configured', 'HomeReach business mailbox', '["read_threads","create_drafts"]'::jsonb, '["send_without_approval","store_oauth_tokens_in_database"]'::jsonb),
    ('Microsoft Outlook', 'microsoft_graph', 'oauth', 'not_configured', 'HomeReach business mailbox', '["read_messages","create_drafts"]'::jsonb, '["send_without_approval","store_oauth_tokens_in_database"]'::jsonb),
    ('Twilio', 'twilio', 'api_reference', 'not_configured', 'HomeReach messaging service', '["read_delivery_status","prepare_sms","send_after_approval"]'::jsonb, '["send_without_approval","ignore_opt_outs","store_api_keys_in_database"]'::jsonb),
    ('Stripe', 'stripe', 'api_reference', 'not_configured', 'HomeReach payments', '["read_payment_status","prepare_checkout"]'::jsonb, '["charge_without_approval","refund_without_approval","change_pricing_without_approval","store_api_keys_in_database"]'::jsonb),
    ('SAM.gov', 'sam_gov', 'api_reference', 'not_configured', 'Public opportunity research', '["search_opportunities","read_opportunity_details"]'::jsonb, '["submit_bid","certify_compliance","bind_company"]'::jsonb),
    ('GitHub', 'github', 'native_connector', 'not_configured', 'HomeReach codebase', '["read_repos","prepare_branch","inspect_ci"]'::jsonb, '["merge_without_review","publish_secrets"]'::jsonb),
    ('Vercel', 'vercel', 'native_connector', 'not_configured', 'HomeReach deployments', '["read_deployments","inspect_logs","prepare_domain_change"]'::jsonb, '["promote_without_approval","change_env_without_approval","delete_project"]'::jsonb),
    ('GoDaddy', 'godaddy', 'api_reference', 'not_configured', 'Domain registrar', '["read_domains","read_dns"]'::jsonb, '["buy_domain_without_approval","change_dns_without_approval","transfer_domain"]'::jsonb),
    ('Google Business Profile', 'google_business_profile', 'oauth', 'not_configured', 'Local SEO profiles', '["read_locations","prepare_posts","prepare_review_replies"]'::jsonb, '["publish_without_approval","change_business_info_without_approval"]'::jsonb),
    ('Browser / Computer Use', 'operator', 'manual_browser', 'not_configured', 'Dedicated HomeReach browser profile', '["read_only","draft_only","prepare_only"]'::jsonb, '["send","submit","purchase","delete","export_sensitive_data","change_account_settings"]'::jsonb)
) as seed(system_name, provider, connection_type, status, account_label, allowed_scopes_json, blocked_scopes_json)
where not exists (
  select 1
  from public.integration_connections existing
  where lower(existing.system_name) = lower(seed.system_name)
    and lower(existing.provider) = lower(seed.provider)
);

insert into public.agent_tool_permissions (
  agent_key,
  tool_key,
  target_system,
  permission_scope,
  requires_human_approval,
  max_estimated_cost,
  allowed_actions_json,
  blocked_actions_json,
  risk_level
)
select *
from (
  values
    ('outreach_agent', 'gmail_draft', 'Gmail', 'draft_only', true, 0, '["read approved context","create draft"]'::jsonb, '["send email","mass message","bypass opt-out"]'::jsonb, 'medium'),
    ('outreach_agent', 'twilio_sms_prepare', 'Twilio', 'send_after_approval', true, 0, '["prepare sms","send approved sms"]'::jsonb, '["send without human approval","ignore STOP/HELP"]'::jsonb, 'high'),
    ('political_campaign_agent', 'proposal_prepare', 'HomeReach Admin', 'prepare_only', true, 0, '["prepare plan","generate proposal draft"]'::jsonb, '["publish political message","infer voter ideology","submit spend commitment"]'::jsonb, 'high'),
    ('procurement_agent', 'supplier_compare', 'supplier websites', 'prepare_only', true, 0, '["read supplier pages","prepare comparison"]'::jsonb, '["place order","switch vendor","commit spend"]'::jsonb, 'high'),
    ('samgov_contract_agent', 'sam_opportunity_research', 'SAM.gov', 'prepare_only', true, 0, '["search opportunities","prepare bid draft"]'::jsonb, '["submit bid","certify compliance","bind HomeReach"]'::jsonb, 'critical'),
    ('website_build_agent', 'vercel_github_prepare', 'Vercel', 'prepare_only', true, 0, '["prepare branch","inspect deployment","draft launch checklist"]'::jsonb, '["publish production","change domain","change env vars"]'::jsonb, 'high'),
    ('orchestrator_agent', 'browser_computer_use_queue', 'Browser / Computer Use', 'read_only', true, 0, '["read page","capture screenshot","prepare manual checklist"]'::jsonb, '["send","submit","purchase","delete","export sensitive data","change account settings"]'::jsonb, 'critical')
) as seed(agent_key, tool_key, target_system, permission_scope, requires_human_approval, max_estimated_cost, allowed_actions_json, blocked_actions_json, risk_level)
where not exists (
  select 1
  from public.agent_tool_permissions existing
  where lower(existing.agent_key) = lower(seed.agent_key)
    and lower(existing.tool_key) = lower(seed.tool_key)
    and lower(existing.target_system) = lower(seed.target_system)
);
