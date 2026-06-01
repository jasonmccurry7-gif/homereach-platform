-- HomeReach AI Assets Command Center
-- Additive operating layer for reusable business context, SOP prompts, source
-- assets, agent profiles, prompt chains, AI outputs, verification, and reviews.

create table if not exists public.ai_business_context (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'HomeReach Master Business Context',
  category text not null default 'master',
  company_overview text not null default '',
  offers text not null default '',
  pricing text not null default '',
  target_customers text not null default '',
  brand_voice text not null default '',
  sales_positioning text not null default '',
  compliance_rules text not null default '',
  political_mail_rules text not null default '',
  procurement_dashboard_rules text not null default '',
  shared_postcard_rules text not null default '',
  targeted_campaign_rules text not null default '',
  sam_gov_rules text not null default '',
  human_approval_requirements text not null default '',
  tags text[] not null default '{}',
  status text not null default 'active' check (status in ('active','inactive','draft','archived')),
  owner_user_id uuid references public.profiles(id) on delete set null,
  last_reviewed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_prompt_sops (
  id uuid primary key default gen_random_uuid(),
  prompt_name text not null,
  category text not null,
  purpose text not null default '',
  required_inputs text[] not null default '{}',
  prompt_text text not null default '',
  output_format text not null default '',
  approval_requirement text not null default 'Human approval required before customer-facing or high-stakes use.',
  tags text[] not null default '{}',
  status text not null default 'active' check (status in ('active','inactive','draft','archived')),
  owner_user_id uuid references public.profiles(id) on delete set null,
  related_workflow text,
  related_offer text,
  last_reviewed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_data_sources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  description text not null default '',
  content text not null default '',
  tags text[] not null default '{}',
  related_workflow text,
  related_offer text,
  quality_rating integer not null default 3 check (quality_rating between 1 and 5),
  status text not null default 'active' check (status in ('active','inactive','draft','archived')),
  owner_user_id uuid references public.profiles(id) on delete set null,
  last_reviewed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_agent_profiles (
  id uuid primary key default gen_random_uuid(),
  agent_name text not null,
  mission text not null default '',
  allowed_actions text[] not null default '{}',
  disallowed_actions text[] not null default '{}',
  required_data_sources text[] not null default '{}',
  required_prompt_sops text[] not null default '{}',
  approval_rules text not null default '',
  compliance_rules text not null default '',
  escalation_rules text not null default '',
  output_format text not null default '',
  tone_rules text not null default '',
  success_metrics text[] not null default '{}',
  status text not null default 'active' check (status in ('active','inactive','draft','archived')),
  owner_user_id uuid references public.profiles(id) on delete set null,
  last_reviewed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_prompt_chains (
  id uuid primary key default gen_random_uuid(),
  chain_name text not null,
  category text not null,
  purpose text not null default '',
  required_inputs text[] not null default '{}',
  source_assets text[] not null default '{}',
  approval_points text[] not null default '{}',
  run_status text not null default 'ready' check (run_status in ('ready','running','waiting_approval','complete','blocked','draft')),
  status text not null default 'active' check (status in ('active','inactive','draft','archived')),
  owner_user_id uuid references public.profiles(id) on delete set null,
  last_reviewed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_prompt_chain_steps (
  id uuid primary key default gen_random_uuid(),
  chain_id uuid not null references public.ai_prompt_chains(id) on delete cascade,
  step_order integer not null default 1,
  step_name text not null,
  required_inputs text[] not null default '{}',
  source_assets text[] not null default '{}',
  output_summary text not null default '',
  approval_required boolean not null default true,
  run_status text not null default 'ready' check (run_status in ('ready','running','waiting_approval','complete','blocked','draft')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (chain_id, step_order)
);

create table if not exists public.ai_outputs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  agent_name text,
  workflow text,
  output_type text not null default 'draft',
  content text not null default '',
  data_sources text[] not null default '{}',
  prompt_sop_name text,
  chain_name text,
  prompt_sop_id uuid references public.ai_prompt_sops(id) on delete set null,
  agent_profile_id uuid references public.ai_agent_profiles(id) on delete set null,
  chain_id uuid references public.ai_prompt_chains(id) on delete set null,
  chain_step_id uuid references public.ai_prompt_chain_steps(id) on delete set null,
  approval_status text not null default 'needs_review' check (approval_status in ('draft','needs_review','approved','rejected','revision_needed','sent','archived')),
  verification_status text not null default 'pending' check (verification_status in ('pending','verified','failed','needs_review')),
  winning_output boolean not null default false,
  status text not null default 'active' check (status in ('active','inactive','draft','archived')),
  owner_user_id uuid references public.profiles(id) on delete set null,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_verification_checks (
  id uuid primary key default gen_random_uuid(),
  output_id uuid references public.ai_outputs(id) on delete cascade,
  label text not null,
  category text not null default 'general',
  status text not null default 'not_started' check (status in ('not_started','verified','failed','needs_review')),
  required boolean not null default true,
  completed_by uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_output_reviews (
  id uuid primary key default gen_random_uuid(),
  output_id uuid references public.ai_outputs(id) on delete cascade,
  reviewer_user_id uuid references public.profiles(id) on delete set null,
  review_status text not null default 'needs_review' check (review_status in ('needs_review','approved','rejected','revision_needed','archived')),
  review_notes text,
  checklist jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_business_context_status_idx on public.ai_business_context (status, updated_at desc);
create index if not exists ai_prompt_sops_category_idx on public.ai_prompt_sops (category, status);
create unique index if not exists ai_prompt_sops_prompt_name_idx on public.ai_prompt_sops (prompt_name);
create index if not exists ai_prompt_sops_updated_idx on public.ai_prompt_sops (updated_at desc);
create index if not exists ai_data_sources_category_idx on public.ai_data_sources (category, status);
create index if not exists ai_agent_profiles_status_idx on public.ai_agent_profiles (status, agent_name);
create index if not exists ai_prompt_chains_category_idx on public.ai_prompt_chains (category, status);
create index if not exists ai_prompt_chain_steps_chain_idx on public.ai_prompt_chain_steps (chain_id, step_order);
create index if not exists ai_outputs_review_idx on public.ai_outputs (approval_status, created_at desc);
create index if not exists ai_outputs_agent_idx on public.ai_outputs (agent_name, created_at desc);
create index if not exists ai_verification_checks_output_idx on public.ai_verification_checks (output_id, required);
create index if not exists ai_output_reviews_output_idx on public.ai_output_reviews (output_id, created_at desc);

alter table public.ai_business_context enable row level security;
alter table public.ai_prompt_sops enable row level security;
alter table public.ai_data_sources enable row level security;
alter table public.ai_agent_profiles enable row level security;
alter table public.ai_prompt_chains enable row level security;
alter table public.ai_prompt_chain_steps enable row level security;
alter table public.ai_outputs enable row level security;
alter table public.ai_verification_checks enable row level security;
alter table public.ai_output_reviews enable row level security;

grant select, insert, update, delete on
  public.ai_business_context,
  public.ai_prompt_sops,
  public.ai_data_sources,
  public.ai_agent_profiles,
  public.ai_prompt_chains,
  public.ai_prompt_chain_steps,
  public.ai_outputs,
  public.ai_verification_checks,
  public.ai_output_reviews
to authenticated;

grant all on
  public.ai_business_context,
  public.ai_prompt_sops,
  public.ai_data_sources,
  public.ai_agent_profiles,
  public.ai_prompt_chains,
  public.ai_prompt_chain_steps,
  public.ai_outputs,
  public.ai_verification_checks,
  public.ai_output_reviews
to service_role;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'ai_business_context',
    'ai_prompt_sops',
    'ai_data_sources',
    'ai_agent_profiles',
    'ai_prompt_chains',
    'ai_prompt_chain_steps',
    'ai_outputs',
    'ai_verification_checks',
    'ai_output_reviews'
  ]
  loop
    execute format('drop policy if exists "%s_service" on public.%I', table_name, table_name);
    execute format('create policy "%s_service" on public.%I for all to service_role using (true) with check (true)', table_name, table_name);

    execute format('drop policy if exists "%s_admin_select" on public.%I', table_name, table_name);
    execute format(
      'create policy "%s_admin_select" on public.%I for select to authenticated using ((auth.jwt()->''app_metadata''->>''user_role'') in (''admin'',''sales_agent''))',
      table_name,
      table_name
    );

    execute format('drop policy if exists "%s_admin_write" on public.%I', table_name, table_name);
    execute format(
      'create policy "%s_admin_write" on public.%I for all to authenticated using ((auth.jwt()->''app_metadata''->>''user_role'') = ''admin'') with check ((auth.jwt()->''app_metadata''->>''user_role'') = ''admin'')',
      table_name,
      table_name
    );
  end loop;
end $$;

insert into public.ai_business_context (
  title,
  category,
  company_overview,
  offers,
  pricing,
  target_customers,
  brand_voice,
  sales_positioning,
  compliance_rules,
  political_mail_rules,
  procurement_dashboard_rules,
  shared_postcard_rules,
  targeted_campaign_rules,
  sam_gov_rules,
  human_approval_requirements,
  tags,
  status
)
select
  'HomeReach Master Business Context',
  'master',
  'HomeReach helps local businesses, campaigns, and organizations win locally through premium direct mail, targeted campaigns, AI-assisted follow-up, procurement savings intelligence, SEO, and government contract support.',
  'Shared postcards, targeted neighborhood campaigns, political mail, procurement/inventory savings intelligence, AI website assistant, reputation/review support, local SEO, SAM.gov/government contract operating support, creative/proposal assets.',
  'Keep pricing factual and tied to the current approved offer. Do not invent discounts, guarantees, or campaign ROI. Payment, Stripe, subscriptions, and proposal terms require human approval before customer-facing use.',
  'Local service businesses, contractors, restaurants, professional services, political campaigns, county parties, local organizations, procurement-sensitive small businesses, and government-contracting operators.',
  'Premium, practical, calm, direct, human, confident, operationally intelligent, local-business friendly. Avoid hype, jargon, and robotic AI phrasing.',
  'Postcards are the wedge, but HomeReach is an AI-powered growth and operations execution platform. Lead with outcomes: visibility, customers, savings, follow-up, simpler execution, and less owner stress.',
  'No unsupported claims, no misleading ROI, no legal/compliance guarantees, no autonomous payments, no high-volume outreach without approval, no political targeting based on individual beliefs.',
  'Use geographic and operational planning only. Do not infer individual political beliefs, create ideology scores, or use prohibited persuasion scoring. Public political messaging and mail creative require human approval.',
  'Prioritize savings, simplicity, landed cost, vendor reliability, delivery visibility, receiving speed, invoice mismatch detection, and owner approval before spend commitments.',
  'Preserve category exclusivity logic, available spots, payment flow, and intake flow. Keep messaging simple and local.',
  'Use route/geography/household planning, maps, proposal-ready visuals, and approved pricing. Do not overpromise response rates.',
  'Assist bid/no-bid, pricing, compliance checklists, proposal organization, subcontractor planning, and post-award execution. Never submit bids or certify compliance autonomously.',
  'Human approval is required for pricing changes, political/public messaging, mass outreach, legal/compliance-sensitive claims, SAM.gov submissions, customer guarantees, payment actions, and vendor/spend commitments.',
  array['master-context','approval-required','brand-voice','compliance'],
  'active'
where not exists (select 1 from public.ai_business_context where title = 'HomeReach Master Business Context');

insert into public.ai_verification_checks (label, category, status, required, notes)
select *
from (values
  ('Facts verified', 'accuracy', 'not_started', true, 'Confirm names, dates, URLs, geography, and operational details.'),
  ('Numbers verified', 'accuracy', 'not_started', true, 'Confirm counts, savings, pricing, dates, routes, and delivery claims.'),
  ('Pricing verified', 'revenue', 'not_started', true, 'Use only approved offer/pricing data.'),
  ('Claims verified', 'compliance', 'not_started', true, 'No unsupported guarantees, ROI claims, or compliance claims.'),
  ('Legal/compliance reviewed', 'compliance', 'not_started', true, 'Route legal-sensitive content to human review.'),
  ('Political targeting rules followed', 'political', 'not_started', true, 'No prohibited voter profiles or belief inference.'),
  ('No prohibited persuasion scoring', 'political', 'not_started', true, 'Use geography/campaign operations only.'),
  ('No voter belief inference', 'political', 'not_started', true, 'Do not infer ideology or beliefs about individuals.'),
  ('No unsupported guarantees', 'sales', 'not_started', true, 'Avoid guaranteed leads, rankings, savings, or wins.'),
  ('No misleading ROI claims', 'sales', 'not_started', true, 'Use estimates carefully and label assumptions.'),
  ('Brand tone reviewed', 'brand', 'not_started', true, 'Premium, clear, human, and simple.'),
  ('Human approval completed', 'approval', 'not_started', true, 'Required before high-stakes or customer-facing use.')
) as seed(label, category, status, required, notes)
where not exists (
  select 1 from public.ai_verification_checks c
  where c.output_id is null and c.label = seed.label
);
;
