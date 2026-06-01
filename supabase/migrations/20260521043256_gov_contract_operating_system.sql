-- Government Contract Operating System
-- Adds OS-level intelligence tables and bid-room snapshots for profitable,
-- executable, human-approved government contracting workflows.

alter table public.gov_contract_bid_rooms
  add column if not exists lifecycle_plan jsonb not null default '[]'::jsonb,
  add column if not exists agency_intelligence jsonb not null default '{}'::jsonb,
  add column if not exists award_intelligence jsonb not null default '{}'::jsonb,
  add column if not exists proposal_workspace jsonb not null default '{}'::jsonb,
  add column if not exists financial_risk_model jsonb not null default '{}'::jsonb,
  add column if not exists past_performance_plan jsonb not null default '[]'::jsonb,
  add column if not exists teaming_plan jsonb not null default '{}'::jsonb,
  add column if not exists recompete_plan jsonb not null default '[]'::jsonb,
  add column if not exists government_crm_plan jsonb not null default '[]'::jsonb,
  add column if not exists operating_model jsonb not null default '{}'::jsonb;

create table if not exists public.gov_contract_agency_profiles (
  id uuid primary key default gen_random_uuid(),
  agency_key text not null unique,
  agency_name text not null,
  office text,
  spending_trends jsonb not null default '{}'::jsonb,
  common_naics jsonb not null default '[]'::jsonb,
  incumbent_patterns jsonb not null default '[]'::jsonb,
  small_business_tendencies text,
  evaluation_patterns jsonb not null default '[]'::jsonb,
  procurement_speed text,
  contract_size_range text,
  ai_guidance jsonb not null default '[]'::jsonb,
  source text not null default 'generated',
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gov_contract_award_history (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid references public.gov_contract_opportunities(id) on delete set null,
  agency_name text not null,
  solicitation_number text,
  incumbent_vendor text,
  awardee text,
  award_amount_cents bigint,
  award_date date,
  period_of_performance text,
  recompete_estimate_at timestamptz,
  source_url text,
  intelligence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gov_contract_past_performance (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  project_name text not null,
  customer text,
  agency text,
  scope text,
  value_cents bigint,
  duration text,
  kpis jsonb not null default '[]'::jsonb,
  outcomes jsonb not null default '[]'::jsonb,
  reference_contacts jsonb not null default '[]'::jsonb,
  deliverables jsonb not null default '[]'::jsonb,
  subcontractors_used jsonb not null default '[]'::jsonb,
  performance_rating text,
  lessons_learned text,
  reusable_narrative text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gov_contract_teaming_relationships (
  id uuid primary key default gen_random_uuid(),
  bid_room_id uuid references public.gov_contract_bid_rooms(id) on delete cascade,
  opportunity_id uuid references public.gov_contract_opportunities(id) on delete cascade,
  partner_id uuid references public.gov_contract_subcontractors(id) on delete set null,
  relationship_type text not null default 'subcontractor',
  role_summary text,
  stage text not null default 'identified',
  agreement_status text not null default 'not_started',
  compliance_status text not null default 'needs_review',
  human_approval_required boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gov_contract_financial_risk_models (
  id uuid primary key default gen_random_uuid(),
  bid_room_id uuid references public.gov_contract_bid_rooms(id) on delete cascade,
  opportunity_id uuid references public.gov_contract_opportunities(id) on delete cascade,
  status text not null default 'draft',
  upfront_cash_need_cents bigint not null default 0,
  payroll_burden_cents bigint not null default 0,
  subcontractor_float_cents bigint not null default 0,
  estimated_payment_gap_days integer not null default 30,
  burn_rate_cents bigint not null default 0,
  working_capital_stress_score integer not null default 0,
  warnings jsonb not null default '[]'::jsonb,
  assumptions jsonb not null default '{}'::jsonb,
  human_approval_required boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gov_contract_recompete_tracking (
  id uuid primary key default gen_random_uuid(),
  award_id uuid references public.gov_contract_awards(id) on delete cascade,
  opportunity_id uuid references public.gov_contract_opportunities(id) on delete set null,
  agency_name text,
  incumbent_vendor text,
  current_contract_number text,
  expected_recompete_at timestamptz,
  prepositioning_start_at timestamptz,
  relationship_actions jsonb not null default '[]'::jsonb,
  status text not null default 'monitoring',
  ai_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gov_contract_contacts (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid references public.gov_contract_opportunities(id) on delete set null,
  bid_room_id uuid references public.gov_contract_bid_rooms(id) on delete cascade,
  contact_type text not null default 'agency',
  name text,
  title text,
  agency text,
  organization text,
  email text,
  phone text,
  website text,
  relationship_stage text not null default 'identified',
  last_contacted_at timestamptz,
  next_action text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gov_contract_proposal_sections (
  id uuid primary key default gen_random_uuid(),
  bid_room_id uuid references public.gov_contract_bid_rooms(id) on delete cascade,
  opportunity_id uuid references public.gov_contract_opportunities(id) on delete cascade,
  section_key text not null,
  title text not null,
  status text not null default 'missing',
  owner text,
  draft_content text,
  source_references jsonb not null default '[]'::jsonb,
  ai_notes jsonb not null default '[]'::jsonb,
  human_approval_required boolean not null default true,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gov_contract_agency_profiles_key_idx
  on public.gov_contract_agency_profiles (agency_key);
create index if not exists gov_contract_award_history_agency_idx
  on public.gov_contract_award_history (agency_name, award_date desc);
create index if not exists gov_contract_past_performance_agency_idx
  on public.gov_contract_past_performance (agency, value_cents desc);
create index if not exists gov_contract_teaming_bid_room_idx
  on public.gov_contract_teaming_relationships (bid_room_id, stage);
create index if not exists gov_contract_financial_risk_bid_room_idx
  on public.gov_contract_financial_risk_models (bid_room_id, status);
create index if not exists gov_contract_recompete_expected_idx
  on public.gov_contract_recompete_tracking (expected_recompete_at, status);
create index if not exists gov_contract_contacts_bid_room_idx
  on public.gov_contract_contacts (bid_room_id, contact_type, relationship_stage);
create index if not exists gov_contract_proposal_sections_bid_room_idx
  on public.gov_contract_proposal_sections (bid_room_id, status);

alter table public.gov_contract_agency_profiles enable row level security;
alter table public.gov_contract_award_history enable row level security;
alter table public.gov_contract_past_performance enable row level security;
alter table public.gov_contract_teaming_relationships enable row level security;
alter table public.gov_contract_financial_risk_models enable row level security;
alter table public.gov_contract_recompete_tracking enable row level security;
alter table public.gov_contract_contacts enable row level security;
alter table public.gov_contract_proposal_sections enable row level security;

do $$
declare
  tbl text;
  pol text;
begin
  foreach tbl in array array[
    'gov_contract_agency_profiles',
    'gov_contract_award_history',
    'gov_contract_past_performance',
    'gov_contract_teaming_relationships',
    'gov_contract_financial_risk_models',
    'gov_contract_recompete_tracking',
    'gov_contract_contacts',
    'gov_contract_proposal_sections'
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

comment on table public.gov_contract_financial_risk_models is
  'Government contract cash-flow and margin stress model. Used to prevent profitable-looking bids from becoming working-capital traps.';
comment on table public.gov_contract_agency_profiles is
  'Agency intelligence profiles for spending trends, incumbent patterns, evaluation signals, and strategic guidance.';
comment on table public.gov_contract_past_performance is
  'Reusable past performance repository. AI may suggest matches, but may not fabricate qualifications or references.';
comment on table public.gov_contract_proposal_sections is
  'Proposal development workspace sections requiring human approval before external use.';;
