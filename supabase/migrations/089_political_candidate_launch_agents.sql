-- HomeReach Migration 089 - Political Candidate Campaign Launch Agents
--
-- Additive launch-agent layer for the existing Political Command Center.
-- This migration does not alter intake, payment, contract, auth, messaging,
-- city/category exclusivity, or route-selection tables.
--
-- Compliance boundary:
-- - Geography, logistics, public campaign records, public election history,
--   costs, schedule, and production readiness only.
-- - No individual voter persuasion scoring.
-- - No sensitive demographic targeting.
-- - No ideology inference or turnout suppression tooling.
-- - Human approval remains required before proposals, creative, outreach, or
--   production handoff become client-facing.

do $$ begin
  create type public.political_candidate_agent_status_enum as enum (
    'idle',
    'researching',
    'research_complete',
    'planning',
    'plan_ready',
    'approved',
    'production_ready',
    'blocked',
    'error'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.political_launch_plan_status_enum as enum (
    'draft',
    'needs_review',
    'approved',
    'proposal_ready',
    'production_ready',
    'archived'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.political_candidate_agents (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.campaign_candidates(id) on delete cascade,
  campaign_id uuid references public.political_campaigns(id) on delete set null,
  agent_name text not null default 'Candidate Campaign Launch Agent',
  status public.political_candidate_agent_status_enum not null default 'idle',
  current_task text,
  last_action text,
  confidence_score integer not null default 0,
  queue_count integer not null default 0,
  compliance_status text not null default 'guardrails_active',
  human_approval_required boolean not null default true,
  last_run_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.political_candidate_research (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.political_candidate_agents(id) on delete cascade,
  candidate_id uuid not null references public.campaign_candidates(id) on delete cascade,
  campaign_id uuid references public.political_campaigns(id) on delete set null,
  status text not null default 'complete',
  candidate_summary text not null default '',
  race_summary text not null default '',
  research_json jsonb not null default '{}'::jsonb,
  missing_data jsonb not null default '[]'::jsonb,
  data_sources jsonb not null default '[]'::jsonb,
  confidence_score integer not null default 0,
  source_freshness text not null default 'unknown',
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.political_district_intelligence (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references public.campaign_candidates(id) on delete cascade,
  campaign_id uuid references public.political_campaigns(id) on delete set null,
  state text not null default 'OH',
  geography_type text not null,
  geography_value text not null,
  household_estimate integer,
  route_opportunity_summary jsonb not null default '{}'::jsonb,
  public_election_history jsonb not null default '[]'::jsonb,
  source_labels text[] not null default '{}'::text[],
  data_confidence text not null default 'estimated',
  source_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.political_mail_launch_plans (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.political_candidate_agents(id) on delete cascade,
  candidate_id uuid not null references public.campaign_candidates(id) on delete cascade,
  campaign_id uuid references public.political_campaigns(id) on delete set null,
  status public.political_launch_plan_status_enum not null default 'draft',
  plan_name text not null default 'Multi-phase postcard launch plan',
  plan_json jsonb not null default '{}'::jsonb,
  candidate_summary text not null default '',
  recommended_strategy text not null default '',
  total_households integer not null default 0,
  total_estimated_cost_cents bigint not null default 0,
  confidence_score integer not null default 0,
  compliance_notes jsonb not null default '[]'::jsonb,
  human_approved_at timestamptz,
  human_approved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.political_mail_launch_phases (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.political_mail_launch_plans(id) on delete cascade,
  phase_number integer not null,
  phase_key text not null,
  objective text not null,
  recommended_send_date date,
  delivery_window_start date,
  delivery_window_end date,
  target_geography text not null,
  household_count integer not null default 0,
  estimated_print_cost_cents bigint not null default 0,
  estimated_postage_cost_cents bigint not null default 0,
  total_estimated_cost_cents bigint not null default 0,
  message_theme text not null,
  creative_brief text not null,
  qr_recommendation text,
  compliance_notes text[] not null default '{}'::text[],
  why_this_phase_matters text not null,
  source_labels text[] not null default '{}'::text[],
  created_at timestamptz not null default now()
);

create table if not exists public.political_mail_phase_geographies (
  id uuid primary key default gen_random_uuid(),
  phase_id uuid not null references public.political_mail_launch_phases(id) on delete cascade,
  geography_type text not null,
  geography_key text not null,
  label text not null,
  household_count integer not null default 0,
  route_count integer not null default 0,
  estimated_cost_cents bigint not null default 0,
  selection_reason text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.political_agent_activity_log (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references public.political_candidate_agents(id) on delete cascade,
  candidate_id uuid references public.campaign_candidates(id) on delete cascade,
  campaign_id uuid references public.political_campaigns(id) on delete set null,
  activity_type text not null,
  status text not null default 'complete',
  message text not null,
  payload jsonb not null default '{}'::jsonb,
  actor_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.political_plan_approvals (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.political_mail_launch_plans(id) on delete cascade,
  candidate_id uuid not null references public.campaign_candidates(id) on delete cascade,
  approved_by uuid references public.profiles(id) on delete set null,
  approval_status text not null default 'approved',
  notes text,
  compliance_checklist jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists political_candidate_agents_candidate_idx
  on public.political_candidate_agents(candidate_id);
create index if not exists political_candidate_agents_campaign_idx
  on public.political_candidate_agents(campaign_id);
create index if not exists political_candidate_agents_status_idx
  on public.political_candidate_agents(status);
create index if not exists political_candidate_research_agent_idx
  on public.political_candidate_research(agent_id);
create index if not exists political_candidate_research_candidate_idx
  on public.political_candidate_research(candidate_id);
create index if not exists political_candidate_research_generated_idx
  on public.political_candidate_research(generated_at);
create index if not exists political_district_intelligence_geo_idx
  on public.political_district_intelligence(state, geography_type, geography_value);
create index if not exists political_district_intelligence_candidate_idx
  on public.political_district_intelligence(candidate_id);
create index if not exists political_mail_launch_plans_agent_idx
  on public.political_mail_launch_plans(agent_id);
create index if not exists political_mail_launch_plans_candidate_idx
  on public.political_mail_launch_plans(candidate_id);
create index if not exists political_mail_launch_plans_status_idx
  on public.political_mail_launch_plans(status);
create index if not exists political_mail_launch_phases_plan_idx
  on public.political_mail_launch_phases(plan_id);
create index if not exists political_mail_launch_phases_phase_idx
  on public.political_mail_launch_phases(plan_id, phase_number);
create index if not exists political_mail_phase_geographies_phase_idx
  on public.political_mail_phase_geographies(phase_id);
create index if not exists political_mail_phase_geographies_geo_idx
  on public.political_mail_phase_geographies(geography_type, geography_key);
create index if not exists political_agent_activity_log_agent_idx
  on public.political_agent_activity_log(agent_id);
create index if not exists political_agent_activity_log_candidate_idx
  on public.political_agent_activity_log(candidate_id);
create index if not exists political_agent_activity_log_type_idx
  on public.political_agent_activity_log(activity_type);
create index if not exists political_plan_approvals_plan_idx
  on public.political_plan_approvals(plan_id);
create index if not exists political_plan_approvals_candidate_idx
  on public.political_plan_approvals(candidate_id);

do $$
declare
  table_name text;
  table_names text[] := array[
    'political_candidate_agents',
    'political_candidate_research',
    'political_district_intelligence',
    'political_mail_launch_plans',
    'political_mail_launch_phases',
    'political_mail_phase_geographies',
    'political_agent_activity_log',
    'political_plan_approvals'
  ];
begin
  foreach table_name in array table_names loop
    execute format('alter table public.%I enable row level security', table_name);

    execute format('drop policy if exists %I on public.%I', table_name || '_admin_all', table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using ((auth.jwt() -> ''app_metadata'' ->> ''user_role'') = ''admin'') with check ((auth.jwt() -> ''app_metadata'' ->> ''user_role'') = ''admin'')',
      table_name || '_admin_all',
      table_name
    );

    execute format('drop policy if exists %I on public.%I', table_name || '_sales_read', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((auth.jwt() -> ''app_metadata'' ->> ''user_role'') in (''admin'', ''sales_agent''))',
      table_name || '_sales_read',
      table_name
    );

    execute format('drop policy if exists %I on public.%I', table_name || '_sales_write', table_name);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((auth.jwt() -> ''app_metadata'' ->> ''user_role'') in (''admin'', ''sales_agent''))',
      table_name || '_sales_write',
      table_name
    );

    execute format('drop policy if exists %I on public.%I', table_name || '_sales_update', table_name);
    execute format(
      'create policy %I on public.%I for update to authenticated using ((auth.jwt() -> ''app_metadata'' ->> ''user_role'') in (''admin'', ''sales_agent'')) with check ((auth.jwt() -> ''app_metadata'' ->> ''user_role'') in (''admin'', ''sales_agent''))',
      table_name || '_sales_update',
      table_name
    );
  end loop;
end $$;

drop trigger if exists trg_political_candidate_agents_updated_at on public.political_candidate_agents;
create trigger trg_political_candidate_agents_updated_at
  before update on public.political_candidate_agents
  for each row execute function public.tg_political_touch_updated_at();

drop trigger if exists trg_political_district_intelligence_updated_at on public.political_district_intelligence;
create trigger trg_political_district_intelligence_updated_at
  before update on public.political_district_intelligence
  for each row execute function public.tg_political_touch_updated_at();

drop trigger if exists trg_political_mail_launch_plans_updated_at on public.political_mail_launch_plans;
create trigger trg_political_mail_launch_plans_updated_at
  before update on public.political_mail_launch_plans
  for each row execute function public.tg_political_touch_updated_at();
