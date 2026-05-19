-- 096_gov_contracts_command_center.sql
-- Additive, admin-only Government Contracts command center foundation.
-- Phase 1: opportunity ingestion, scoring metadata, manual workflow, bid-room scaffolding,
-- audit logs, and subcontractor network tables. No autonomous bid submission.

create extension if not exists pgcrypto;

create table if not exists public.gov_contract_opportunities (
  id uuid primary key default gen_random_uuid(),
  source_system text not null default 'sam.gov',
  source_id text not null,
  source_url text,
  title text not null,
  agency text,
  department text,
  office text,
  solicitation_number text,
  notice_type text,
  base_notice_type text,
  posted_date date,
  response_deadline timestamptz,
  questions_deadline timestamptz,
  site_visit_at timestamptz,
  naics_code text,
  psc_code text,
  set_aside_code text,
  set_aside_description text,
  place_of_performance jsonb not null default '{}'::jsonb,
  estimated_value_cents bigint,
  award_amount_cents bigint,
  active boolean not null default true,
  pipeline_status text not null default 'new'
    check (pipeline_status in ('new','reviewing','strong_fit','need_subcontractor','bid_prep','awaiting_approval','submitted','awarded','lost','no_bid','archived')),
  fit_status text not null default 'possible_fit'
    check (fit_status in ('strong_fit','possible_fit','weak_fit','no_bid')),
  fit_score integer not null default 0 check (fit_score between 0 and 100),
  risk_score integer not null default 0 check (risk_score between 0 and 100),
  urgency_score integer not null default 0 check (urgency_score between 0 and 100),
  score_breakdown jsonb not null default '{}'::jsonb,
  recommended_next_action text,
  scoring_reason text,
  ai_summary jsonb not null default '{}'::jsonb,
  attachments jsonb not null default '[]'::jsonb,
  amendments jsonb not null default '[]'::jsonb,
  raw_source jsonb not null default '{}'::jsonb,
  sync_status text not null default 'synced' check (sync_status in ('synced','updated','failed','archived')),
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_system, source_id)
);

create table if not exists public.gov_contract_sync_runs (
  id uuid primary key default gen_random_uuid(),
  source_system text not null default 'sam.gov',
  status text not null default 'running' check (status in ('running','synced','updated','partial','failed')),
  query jsonb not null default '{}'::jsonb,
  records_seen integer not null default 0,
  records_upserted integer not null default 0,
  records_failed integer not null default 0,
  message text,
  error jsonb,
  raw_response jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.gov_contract_bid_rooms (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.gov_contract_opportunities(id) on delete cascade,
  go_no_go_status text not null default 'pending'
    check (go_no_go_status in ('pending','go','no_go','needs_more_info')),
  submission_readiness_score integer not null default 0 check (submission_readiness_score between 0 and 100),
  compliance_checklist jsonb not null default '[]'::jsonb,
  required_forms jsonb not null default '[]'::jsonb,
  pricing_worksheet jsonb not null default '{}'::jsonb,
  proposal_draft jsonb not null default '{}'::jsonb,
  internal_notes text,
  risk_assessment jsonb not null default '{}'::jsonb,
  approval_status text not null default 'not_requested'
    check (approval_status in ('not_requested','pending','approved','rejected','needs_changes')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (opportunity_id)
);

create table if not exists public.gov_contract_subcontractors (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  service_category text,
  trade text,
  geography_served jsonb not null default '[]'::jsonb,
  certifications jsonb not null default '[]'::jsonb,
  insurance_status text,
  bonding_capacity text,
  past_performance text,
  contact_name text,
  contact_email text,
  contact_phone text,
  reliability_score integer not null default 50 check (reliability_score between 0 and 100),
  pricing_history jsonb not null default '[]'::jsonb,
  notes text,
  document_status jsonb not null default '{}'::jsonb,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gov_contract_subcontractor_matches (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.gov_contract_opportunities(id) on delete cascade,
  subcontractor_id uuid not null references public.gov_contract_subcontractors(id) on delete cascade,
  match_score integer not null default 0 check (match_score between 0 and 100),
  quote_status text not null default 'not_requested'
    check (quote_status in ('not_requested','requested','received','declined','selected','rejected')),
  availability_status text,
  quote_amount_cents bigint,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (opportunity_id, subcontractor_id)
);

create table if not exists public.gov_contract_approval_events (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid references public.gov_contract_opportunities(id) on delete cascade,
  approval_type text not null
    check (approval_type in ('go_no_go','pricing','certification','subcontractor_commitment','proposal','submission','award_acceptance','outreach')),
  status text not null default 'pending' check (status in ('pending','approved','rejected','revoked')),
  requested_by uuid,
  decided_by uuid,
  decision_notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create table if not exists public.gov_contract_audit_logs (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid references public.gov_contract_opportunities(id) on delete set null,
  event_type text not null,
  actor_id uuid,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists gov_contract_opps_due_idx on public.gov_contract_opportunities(response_deadline);
create index if not exists gov_contract_opps_fit_idx on public.gov_contract_opportunities(fit_status, fit_score desc);
create index if not exists gov_contract_opps_pipeline_idx on public.gov_contract_opportunities(pipeline_status);
create index if not exists gov_contract_opps_naics_idx on public.gov_contract_opportunities(naics_code);
create index if not exists gov_contract_opps_source_idx on public.gov_contract_opportunities(source_system, source_id);
create index if not exists gov_contract_audit_opportunity_idx on public.gov_contract_audit_logs(opportunity_id, created_at desc);

alter table public.gov_contract_opportunities enable row level security;
alter table public.gov_contract_sync_runs enable row level security;
alter table public.gov_contract_bid_rooms enable row level security;
alter table public.gov_contract_subcontractors enable row level security;
alter table public.gov_contract_subcontractor_matches enable row level security;
alter table public.gov_contract_approval_events enable row level security;
alter table public.gov_contract_audit_logs enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'gov_contract_opportunities',
    'gov_contract_sync_runs',
    'gov_contract_bid_rooms',
    'gov_contract_subcontractors',
    'gov_contract_subcontractor_matches',
    'gov_contract_approval_events',
    'gov_contract_audit_logs'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', table_name || '_admin_all', table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using ((auth.jwt() -> ''app_metadata'' ->> ''user_role'') = ''admin'') with check ((auth.jwt() -> ''app_metadata'' ->> ''user_role'') = ''admin'')',
      table_name || '_admin_all',
      table_name
    );
  end loop;
end $$;
