-- HomeReach AI Web Assistant foundation
--
-- Additive, approval-first tables for AI-powered front desk, lead capture,
-- routing, knowledge base, conversation summaries, alerts, and audit logs.
-- These tables do not send outbound messages, confirm appointments, publish
-- replies, change listings, or make pricing commitments without approved
-- workflows.

create extension if not exists pgcrypto;

create table if not exists public.ai_web_assistants (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  business_id uuid,
  owner_id uuid references public.profiles(id) on delete set null,
  business_name text not null,
  website_url text,
  phone text,
  business_category text not null,
  service_areas text[] not null default '{}'::text[],
  main_services text[] not null default '{}'::text[],
  hours text,
  booking_preference text,
  contact_preference text,
  assistant_name text not null,
  greeting text not null,
  tone text not null default 'Helpful, calm, local, direct, and never pushy.',
  status text not null default 'draft'
    check (status in ('draft','demo_requested','setup_review','active','paused','archived')),
  source text not null default 'manual',
  embed_key text not null unique,
  embed_allowed_domains text[] not null default '{}'::text[],
  widget_enabled boolean not null default false,
  settings jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists ai_web_assistants_status_idx
  on public.ai_web_assistants (status, updated_at desc);
create index if not exists ai_web_assistants_owner_idx
  on public.ai_web_assistants (owner_id, updated_at desc)
  where owner_id is not null;

create table if not exists public.ai_web_assistant_knowledge_items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ai_web_assistant_id uuid not null references public.ai_web_assistants(id) on delete cascade,
  item_type text not null
    check (item_type in ('business_profile','service','service_area','hours','faq','pricing_guidance','policy','guardrail','review_workflow','local_seo_insight','handoff')),
  title text not null,
  content text not null,
  source text not null default 'manual',
  approval_status text not null default 'needs_review'
    check (approval_status in ('draft','needs_review','approved','rejected','archived')),
  visibility text not null default 'assistant_only'
    check (visibility in ('assistant_only','owner_dashboard','admin_only')),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists ai_web_assistant_knowledge_items_assistant_idx
  on public.ai_web_assistant_knowledge_items (ai_web_assistant_id, item_type, approval_status);

create table if not exists public.ai_web_assistant_settings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ai_web_assistant_id uuid not null unique references public.ai_web_assistants(id) on delete cascade,
  tone text not null,
  greeting text not null,
  business_hours jsonb not null default '{}'::jsonb,
  escalation_rules jsonb not null default '[]'::jsonb,
  qualification_questions jsonb not null default '[]'::jsonb,
  appointment_rules jsonb not null default '{}'::jsonb,
  booking_rules jsonb not null default '{}'::jsonb,
  handoff_rules jsonb not null default '[]'::jsonb,
  restricted_topics jsonb not null default '[]'::jsonb,
  prompt_guardrails jsonb not null default '{}'::jsonb,
  approval_status text not null default 'needs_review'
    check (approval_status in ('draft','needs_review','approved','rejected','archived')),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.ai_web_assistant_conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ai_web_assistant_id uuid not null references public.ai_web_assistants(id) on delete cascade,
  visitor_session_id text,
  visitor_name text,
  visitor_phone text,
  visitor_email text,
  source_page text,
  service_requested text,
  urgency_level text not null default 'medium'
    check (urgency_level in ('high','medium','low','unknown')),
  status text not null default 'open'
    check (status in ('open','lead_captured','qualified','follow_up_needed','routed','closed','archived')),
  assigned_owner uuid references public.profiles(id) on delete set null,
  follow_up_needed boolean not null default false,
  ai_summary text,
  conversation_transcript jsonb not null default '[]'::jsonb,
  risk_flags jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists ai_web_assistant_conversations_assistant_idx
  on public.ai_web_assistant_conversations (ai_web_assistant_id, updated_at desc);
create index if not exists ai_web_assistant_conversations_status_idx
  on public.ai_web_assistant_conversations (status, urgency_level, updated_at desc);

create table if not exists public.ai_web_assistant_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ai_web_assistant_id uuid not null references public.ai_web_assistants(id) on delete cascade,
  conversation_id uuid references public.ai_web_assistant_conversations(id) on delete set null,
  lead_name text,
  phone text,
  email text,
  service_need text,
  location text,
  preferred_contact_method text,
  urgency_level text not null default 'medium'
    check (urgency_level in ('high','medium','low','unknown')),
  estimated_value text,
  source_page text,
  status text not null default 'new'
    check (status in ('new','qualified','follow_up_needed','contacted','booked','won','lost','archived')),
  next_action text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists ai_web_assistant_leads_status_idx
  on public.ai_web_assistant_leads (status, urgency_level, updated_at desc);

create table if not exists public.ai_web_assistant_summaries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  ai_web_assistant_id uuid not null references public.ai_web_assistants(id) on delete cascade,
  conversation_id uuid references public.ai_web_assistant_conversations(id) on delete cascade,
  summary_type text not null default 'conversation'
    check (summary_type in ('conversation','daily','weekly','lead','knowledge_gap')),
  summary text not null,
  next_actions jsonb not null default '[]'::jsonb,
  approval_status text not null default 'draft'
    check (approval_status in ('draft','needs_review','approved','sent','archived')),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists ai_web_assistant_summaries_assistant_idx
  on public.ai_web_assistant_summaries (ai_web_assistant_id, created_at desc);

create table if not exists public.ai_web_assistant_routing_rules (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ai_web_assistant_id uuid not null references public.ai_web_assistants(id) on delete cascade,
  rule_name text not null,
  trigger_type text not null
    check (trigger_type in ('service_type','urgency','business_hours','handoff_trigger','restricted_topic','keyword','manual')),
  trigger_value text not null,
  urgency_level text not null default 'medium'
    check (urgency_level in ('high','medium','low','unknown')),
  route_to text,
  instructions text not null,
  approval_required boolean not null default true,
  status text not null default 'needs_review'
    check (status in ('draft','needs_review','approved','active','paused','archived')),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists ai_web_assistant_routing_rules_assistant_idx
  on public.ai_web_assistant_routing_rules (ai_web_assistant_id, status, urgency_level);

create table if not exists public.ai_web_assistant_alerts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ai_web_assistant_id uuid not null references public.ai_web_assistants(id) on delete cascade,
  conversation_id uuid references public.ai_web_assistant_conversations(id) on delete set null,
  alert_type text not null
    check (alert_type in ('urgent_lead','missed_handoff','unanswered_question','knowledge_gap','sensitive_topic','review_opportunity','local_seo_insight','abuse_risk')),
  title text not null,
  detail text not null,
  severity text not null default 'medium'
    check (severity in ('critical','high','medium','low')),
  status text not null default 'open'
    check (status in ('open','needs_review','resolved','ignored','archived')),
  recommended_action text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists ai_web_assistant_alerts_status_idx
  on public.ai_web_assistant_alerts (status, severity, updated_at desc);

create table if not exists public.ai_web_assistant_activity_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  ai_web_assistant_id uuid references public.ai_web_assistants(id) on delete cascade,
  conversation_id uuid references public.ai_web_assistant_conversations(id) on delete set null,
  actor_type text not null default 'system'
    check (actor_type in ('system','assistant','human','api')),
  actor_id uuid references public.profiles(id) on delete set null,
  action_type text not null,
  approval_status text not null default 'draft'
    check (approval_status in ('draft','needs_review','approved','rejected','completed','blocked')),
  risk_level text not null default 'low'
    check (risk_level in ('critical','high','medium','low')),
  payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists ai_web_assistant_activity_logs_assistant_idx
  on public.ai_web_assistant_activity_logs (ai_web_assistant_id, created_at desc);

alter table public.ai_web_assistants enable row level security;
alter table public.ai_web_assistant_knowledge_items enable row level security;
alter table public.ai_web_assistant_settings enable row level security;
alter table public.ai_web_assistant_conversations enable row level security;
alter table public.ai_web_assistant_leads enable row level security;
alter table public.ai_web_assistant_summaries enable row level security;
alter table public.ai_web_assistant_routing_rules enable row level security;
alter table public.ai_web_assistant_alerts enable row level security;
alter table public.ai_web_assistant_activity_logs enable row level security;

revoke all on table
  public.ai_web_assistants,
  public.ai_web_assistant_knowledge_items,
  public.ai_web_assistant_settings,
  public.ai_web_assistant_conversations,
  public.ai_web_assistant_leads,
  public.ai_web_assistant_summaries,
  public.ai_web_assistant_routing_rules,
  public.ai_web_assistant_alerts,
  public.ai_web_assistant_activity_logs
from anon, authenticated;

grant all on table
  public.ai_web_assistants,
  public.ai_web_assistant_knowledge_items,
  public.ai_web_assistant_settings,
  public.ai_web_assistant_conversations,
  public.ai_web_assistant_leads,
  public.ai_web_assistant_summaries,
  public.ai_web_assistant_routing_rules,
  public.ai_web_assistant_alerts,
  public.ai_web_assistant_activity_logs
to service_role;

grant select on table
  public.ai_web_assistants,
  public.ai_web_assistant_knowledge_items,
  public.ai_web_assistant_settings,
  public.ai_web_assistant_conversations,
  public.ai_web_assistant_leads,
  public.ai_web_assistant_summaries,
  public.ai_web_assistant_routing_rules,
  public.ai_web_assistant_alerts,
  public.ai_web_assistant_activity_logs
to authenticated;

drop policy if exists "ai_web_assistants_service" on public.ai_web_assistants;
create policy "ai_web_assistants_service"
  on public.ai_web_assistants for all to service_role
  using (true)
  with check (true);

drop policy if exists "ai_web_assistant_knowledge_items_service" on public.ai_web_assistant_knowledge_items;
create policy "ai_web_assistant_knowledge_items_service"
  on public.ai_web_assistant_knowledge_items for all to service_role
  using (true)
  with check (true);

drop policy if exists "ai_web_assistant_settings_service" on public.ai_web_assistant_settings;
create policy "ai_web_assistant_settings_service"
  on public.ai_web_assistant_settings for all to service_role
  using (true)
  with check (true);

drop policy if exists "ai_web_assistant_conversations_service" on public.ai_web_assistant_conversations;
create policy "ai_web_assistant_conversations_service"
  on public.ai_web_assistant_conversations for all to service_role
  using (true)
  with check (true);

drop policy if exists "ai_web_assistant_leads_service" on public.ai_web_assistant_leads;
create policy "ai_web_assistant_leads_service"
  on public.ai_web_assistant_leads for all to service_role
  using (true)
  with check (true);

drop policy if exists "ai_web_assistant_summaries_service" on public.ai_web_assistant_summaries;
create policy "ai_web_assistant_summaries_service"
  on public.ai_web_assistant_summaries for all to service_role
  using (true)
  with check (true);

drop policy if exists "ai_web_assistant_routing_rules_service" on public.ai_web_assistant_routing_rules;
create policy "ai_web_assistant_routing_rules_service"
  on public.ai_web_assistant_routing_rules for all to service_role
  using (true)
  with check (true);

drop policy if exists "ai_web_assistant_alerts_service" on public.ai_web_assistant_alerts;
create policy "ai_web_assistant_alerts_service"
  on public.ai_web_assistant_alerts for all to service_role
  using (true)
  with check (true);

drop policy if exists "ai_web_assistant_activity_logs_service" on public.ai_web_assistant_activity_logs;
create policy "ai_web_assistant_activity_logs_service"
  on public.ai_web_assistant_activity_logs for all to service_role
  using (true)
  with check (true);

drop policy if exists "ai_web_assistants_admin_read" on public.ai_web_assistants;
create policy "ai_web_assistants_admin_read"
  on public.ai_web_assistants for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');

drop policy if exists "ai_web_assistant_knowledge_items_admin_read" on public.ai_web_assistant_knowledge_items;
create policy "ai_web_assistant_knowledge_items_admin_read"
  on public.ai_web_assistant_knowledge_items for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');

drop policy if exists "ai_web_assistant_settings_admin_read" on public.ai_web_assistant_settings;
create policy "ai_web_assistant_settings_admin_read"
  on public.ai_web_assistant_settings for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');

drop policy if exists "ai_web_assistant_conversations_admin_read" on public.ai_web_assistant_conversations;
create policy "ai_web_assistant_conversations_admin_read"
  on public.ai_web_assistant_conversations for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');

drop policy if exists "ai_web_assistant_leads_admin_read" on public.ai_web_assistant_leads;
create policy "ai_web_assistant_leads_admin_read"
  on public.ai_web_assistant_leads for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');

drop policy if exists "ai_web_assistant_summaries_admin_read" on public.ai_web_assistant_summaries;
create policy "ai_web_assistant_summaries_admin_read"
  on public.ai_web_assistant_summaries for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');

drop policy if exists "ai_web_assistant_routing_rules_admin_read" on public.ai_web_assistant_routing_rules;
create policy "ai_web_assistant_routing_rules_admin_read"
  on public.ai_web_assistant_routing_rules for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');

drop policy if exists "ai_web_assistant_alerts_admin_read" on public.ai_web_assistant_alerts;
create policy "ai_web_assistant_alerts_admin_read"
  on public.ai_web_assistant_alerts for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');

drop policy if exists "ai_web_assistant_activity_logs_admin_read" on public.ai_web_assistant_activity_logs;
create policy "ai_web_assistant_activity_logs_admin_read"
  on public.ai_web_assistant_activity_logs for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');
;
