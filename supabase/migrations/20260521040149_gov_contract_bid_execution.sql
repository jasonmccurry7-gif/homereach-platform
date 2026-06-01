-- HomeReach Migration 097 - Government Contract Bid Execution
--
-- Purpose:
--   * Extend the existing SAM.gov/government-contract module into a bid
--     execution and subcontractor fulfillment workspace.
--   * Preserve existing gov_contract_* tables and add only missing workflow
--     records needed for bid/no-bid, pricing, compliance, submission, and
--     post-award execution.
--   * Keep final bid submission, pricing approval, certification claims, and
--     subcontractor commitments behind human approval.

create extension if not exists pgcrypto;

alter table public.gov_contract_opportunities
  add column if not exists owner_id uuid,
  add column if not exists response_method text,
  add column if not exists contract_type text,
  add column if not exists required_documents jsonb not null default '[]'::jsonb,
  add column if not exists submission_instructions jsonb not null default '{}'::jsonb,
  add column if not exists incumbent_vendor text,
  add column if not exists saved_at timestamptz,
  add column if not exists evaluated_at timestamptz,
  add column if not exists started_bid_at timestamptz;

alter table public.gov_contract_bid_rooms
  add column if not exists owner_id uuid,
  add column if not exists bid_stage text not null default 'discovered',
  add column if not exists estimated_value_cents bigint,
  add column if not exists win_probability integer not null default 0,
  add column if not exists profit_target_percent numeric(6,2) not null default 22,
  add column if not exists bid_decision jsonb not null default '{}'::jsonb,
  add column if not exists requirement_snapshot jsonb not null default '[]'::jsonb,
  add column if not exists document_plan jsonb not null default '[]'::jsonb,
  add column if not exists subcontractor_plan jsonb not null default '{}'::jsonb,
  add column if not exists submission_plan jsonb not null default '{}'::jsonb,
  add column if not exists post_award_plan jsonb not null default '{}'::jsonb,
  add column if not exists ai_bid_assistant jsonb not null default '{}'::jsonb,
  add column if not exists export_package jsonb not null default '{}'::jsonb,
  add column if not exists final_approval_at timestamptz,
  add column if not exists submitted_at timestamptz,
  add column if not exists award_status text not null default 'not_awarded',
  add column if not exists contract_number text,
  add column if not exists period_of_performance jsonb not null default '{}'::jsonb,
  add column if not exists actual_cost_cents bigint,
  add column if not exists forecast_profit_cents bigint;

create table if not exists public.gov_contract_bid_requirements (
  id uuid primary key default gen_random_uuid(),
  bid_room_id uuid references public.gov_contract_bid_rooms(id) on delete cascade,
  opportunity_id uuid references public.gov_contract_opportunities(id) on delete cascade,
  requirement_type text not null default 'general',
  title text not null,
  detail text,
  source_location text,
  priority text not null default 'medium',
  status text not null default 'needs_review',
  due_at timestamptz,
  owner_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gov_contract_bid_documents (
  id uuid primary key default gen_random_uuid(),
  bid_room_id uuid references public.gov_contract_bid_rooms(id) on delete cascade,
  opportunity_id uuid references public.gov_contract_opportunities(id) on delete cascade,
  document_type text not null,
  title text not null,
  status text not null default 'missing',
  storage_path text,
  external_url text,
  required boolean not null default true,
  source text not null default 'manual',
  reviewed_by uuid,
  reviewed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gov_contract_bid_pricing_models (
  id uuid primary key default gen_random_uuid(),
  bid_room_id uuid references public.gov_contract_bid_rooms(id) on delete cascade,
  opportunity_id uuid references public.gov_contract_opportunities(id) on delete cascade,
  status text not null default 'draft',
  direct_costs jsonb not null default '{}'::jsonb,
  indirect_costs jsonb not null default '{}'::jsonb,
  risk_adders jsonb not null default '{}'::jsonb,
  margin_targets jsonb not null default '{}'::jsonb,
  minimum_safe_bid_cents bigint,
  aggressive_bid_cents bigint,
  recommended_bid_cents bigint,
  premium_bid_cents bigint,
  expected_gross_profit_cents bigint,
  expected_net_profit_cents bigint,
  risk_adjusted_margin_percent numeric(7,2),
  underpricing_warning text,
  recommendation text,
  approved_by uuid,
  approved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gov_contract_bid_tasks (
  id uuid primary key default gen_random_uuid(),
  bid_room_id uuid references public.gov_contract_bid_rooms(id) on delete cascade,
  opportunity_id uuid references public.gov_contract_opportunities(id) on delete cascade,
  title text not null,
  task_type text not null default 'workflow',
  status text not null default 'pending',
  priority text not null default 'medium',
  due_at timestamptz,
  assigned_to uuid,
  ai_notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gov_contract_compliance_matrix_items (
  id uuid primary key default gen_random_uuid(),
  bid_room_id uuid references public.gov_contract_bid_rooms(id) on delete cascade,
  opportunity_id uuid references public.gov_contract_opportunities(id) on delete cascade,
  requirement_id uuid references public.gov_contract_bid_requirements(id) on delete set null,
  requirement text not null,
  source_reference text,
  response_location text,
  status text not null default 'needs_review',
  risk_level text not null default 'medium',
  human_review_required boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gov_contract_subcontractor_quotes (
  id uuid primary key default gen_random_uuid(),
  bid_room_id uuid references public.gov_contract_bid_rooms(id) on delete cascade,
  opportunity_id uuid references public.gov_contract_opportunities(id) on delete cascade,
  subcontractor_id uuid references public.gov_contract_subcontractors(id) on delete set null,
  work_category text not null,
  status text not null default 'identified',
  quote_amount_cents bigint,
  quote_due_at timestamptz,
  quote_received_at timestamptz,
  scope_summary text,
  requested_pricing_format text,
  insurance_required boolean not null default true,
  compliance_status text not null default 'needs_review',
  human_approval_required boolean not null default true,
  selected boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gov_contract_subcontractor_documents (
  id uuid primary key default gen_random_uuid(),
  subcontractor_id uuid references public.gov_contract_subcontractors(id) on delete cascade,
  quote_id uuid references public.gov_contract_subcontractor_quotes(id) on delete cascade,
  bid_room_id uuid references public.gov_contract_bid_rooms(id) on delete cascade,
  document_type text not null,
  title text not null,
  status text not null default 'missing',
  storage_path text,
  external_url text,
  expires_at timestamptz,
  verified_by uuid,
  verified_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gov_contract_submission_packages (
  id uuid primary key default gen_random_uuid(),
  bid_room_id uuid references public.gov_contract_bid_rooms(id) on delete cascade,
  opportunity_id uuid references public.gov_contract_opportunities(id) on delete cascade,
  status text not null default 'draft',
  package_name text not null default 'Response package',
  submission_method text,
  deadline_at timestamptz,
  approval_status text not null default 'not_requested',
  checklist jsonb not null default '[]'::jsonb,
  files jsonb not null default '[]'::jsonb,
  export_metadata jsonb not null default '{}'::jsonb,
  approved_by uuid,
  approved_at timestamptz,
  submitted_by uuid,
  submitted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gov_contract_awards (
  id uuid primary key default gen_random_uuid(),
  bid_room_id uuid references public.gov_contract_bid_rooms(id) on delete cascade,
  opportunity_id uuid references public.gov_contract_opportunities(id) on delete cascade,
  status text not null default 'pending',
  award_notice_url text,
  contract_number text,
  award_amount_cents bigint,
  period_of_performance jsonb not null default '{}'::jsonb,
  notice_to_proceed_at timestamptz,
  invoice_schedule jsonb not null default '[]'::jsonb,
  payment_status text not null default 'not_started',
  forecast_margin_percent numeric(7,2),
  actual_margin_percent numeric(7,2),
  closeout_status text not null default 'not_started',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gov_contract_fulfillment_milestones (
  id uuid primary key default gen_random_uuid(),
  award_id uuid references public.gov_contract_awards(id) on delete cascade,
  bid_room_id uuid references public.gov_contract_bid_rooms(id) on delete cascade,
  opportunity_id uuid references public.gov_contract_opportunities(id) on delete cascade,
  title text not null,
  milestone_type text not null default 'delivery',
  status text not null default 'pending',
  due_at timestamptz,
  completed_at timestamptz,
  owner_id uuid,
  forecast_cost_cents bigint,
  actual_cost_cents bigint,
  risk_level text not null default 'medium',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gov_contract_communications (
  id uuid primary key default gen_random_uuid(),
  bid_room_id uuid references public.gov_contract_bid_rooms(id) on delete cascade,
  opportunity_id uuid references public.gov_contract_opportunities(id) on delete cascade,
  subcontractor_id uuid references public.gov_contract_subcontractors(id) on delete set null,
  channel text not null default 'email',
  direction text not null default 'outbound',
  status text not null default 'draft',
  subject text,
  body text,
  related_to text,
  human_approval_required boolean not null default true,
  approved_by uuid,
  approved_at timestamptz,
  sent_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.gov_contract_subcontractors
  add column if not exists website text,
  add column if not exists license_status text,
  add column if not exists payment_terms text,
  add column if not exists pipeline_stage text not null default 'identified',
  add column if not exists equipment jsonb not null default '[]'::jsonb,
  add column if not exists quote_history jsonb not null default '[]'::jsonb,
  add column if not exists performance_notes text,
  add column if not exists contract_documents jsonb not null default '[]'::jsonb,
  add column if not exists w9_status text not null default 'missing',
  add column if not exists capability_statement_status text not null default 'missing';

create index if not exists gov_contract_bid_rooms_opportunity_idx
  on public.gov_contract_bid_rooms (opportunity_id);
create index if not exists gov_contract_bid_requirements_bid_room_idx
  on public.gov_contract_bid_requirements (bid_room_id, status);
create index if not exists gov_contract_bid_documents_bid_room_idx
  on public.gov_contract_bid_documents (bid_room_id, status);
create index if not exists gov_contract_bid_pricing_models_bid_room_idx
  on public.gov_contract_bid_pricing_models (bid_room_id, status);
create index if not exists gov_contract_bid_tasks_bid_room_idx
  on public.gov_contract_bid_tasks (bid_room_id, status, due_at);
create index if not exists gov_contract_compliance_matrix_bid_room_idx
  on public.gov_contract_compliance_matrix_items (bid_room_id, status, risk_level);
create index if not exists gov_contract_subcontractor_quotes_bid_room_idx
  on public.gov_contract_subcontractor_quotes (bid_room_id, status);
create index if not exists gov_contract_submission_packages_bid_room_idx
  on public.gov_contract_submission_packages (bid_room_id, status);
create index if not exists gov_contract_awards_bid_room_idx
  on public.gov_contract_awards (bid_room_id, status);
create index if not exists gov_contract_fulfillment_milestones_bid_room_idx
  on public.gov_contract_fulfillment_milestones (bid_room_id, status, due_at);
create index if not exists gov_contract_communications_bid_room_idx
  on public.gov_contract_communications (bid_room_id, status, created_at desc);

alter table public.gov_contract_bid_requirements enable row level security;
alter table public.gov_contract_bid_documents enable row level security;
alter table public.gov_contract_bid_pricing_models enable row level security;
alter table public.gov_contract_bid_tasks enable row level security;
alter table public.gov_contract_compliance_matrix_items enable row level security;
alter table public.gov_contract_subcontractor_quotes enable row level security;
alter table public.gov_contract_subcontractor_documents enable row level security;
alter table public.gov_contract_submission_packages enable row level security;
alter table public.gov_contract_awards enable row level security;
alter table public.gov_contract_fulfillment_milestones enable row level security;
alter table public.gov_contract_communications enable row level security;

do $$
declare
  tbl text;
  pol text;
begin
  foreach tbl in array array[
    'gov_contract_bid_requirements',
    'gov_contract_bid_documents',
    'gov_contract_bid_pricing_models',
    'gov_contract_bid_tasks',
    'gov_contract_compliance_matrix_items',
    'gov_contract_subcontractor_quotes',
    'gov_contract_subcontractor_documents',
    'gov_contract_submission_packages',
    'gov_contract_awards',
    'gov_contract_fulfillment_milestones',
    'gov_contract_communications'
  ]
  loop
    pol := tbl || '_admin_all';
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = tbl
        and policyname = pol
    ) then
      execute format(
        'create policy %I on public.%I for all to authenticated using (((auth.jwt() -> %L) ->> %L) = %L) with check (((auth.jwt() -> %L) ->> %L) = %L)',
        pol,
        tbl,
        'app_metadata',
        'user_role',
        'admin',
        'app_metadata',
        'user_role',
        'admin'
      );
    end if;
  end loop;
end;
$$;

comment on table public.gov_contract_bid_pricing_models is
  'Government contract pricing model with direct, indirect, risk, and margin logic. Final pricing requires human approval.';
comment on table public.gov_contract_compliance_matrix_items is
  'Compliance matrix items mapping solicitation requirements to response locations and human review state.';
comment on table public.gov_contract_submission_packages is
  'Export/submission package checklist. The platform does not autonomously submit government bids.';
comment on table public.gov_contract_fulfillment_milestones is
  'Post-award fulfillment milestones for awarded government contract execution.';;
