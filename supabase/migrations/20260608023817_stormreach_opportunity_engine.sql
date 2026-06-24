-- StormReach Severe Weather Opportunity Engine.
--
-- Additive operating layer for detecting severe weather opportunities,
-- building approval-gated contractor outreach, geofence packages, postcard
-- packages, and autonomous improvement recommendations.
--
-- This migration does not send outreach, launch campaigns, order postcards,
-- change pricing, charge customers, or bypass human approvals.

create extension if not exists pgcrypto;

create table if not exists public.storm_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  event_type text not null check (event_type in (
    'hail',
    'tornado',
    'high_wind',
    'hurricane_tropical_storm',
    'flooding',
    'winter_storm_ice',
    'wildfire_smoke',
    'severe_thunderstorm',
    'derecho',
    'unknown'
  )),
  source text not null,
  source_url text,
  title text not null,
  description text not null default '',
  start_time timestamptz,
  end_time timestamptz,
  detected_at timestamptz not null default now(),
  severity_score integer not null default 0 check (severity_score between 0 and 100),
  severity_level text not null default 'Low' check (severity_level in ('Low','Moderate','High','Extreme')),
  confidence_score integer not null default 50 check (confidence_score between 0 and 100),
  geography_type text not null default 'alert_polygon',
  impacted_polygon_geojson jsonb not null default '{}'::jsonb,
  impacted_counties text[] not null default '{}',
  impacted_cities text[] not null default '{}',
  impacted_zip_codes text[] not null default '{}',
  impacted_state text,
  estimated_households integer not null default 0,
  estimated_homeowners integer not null default 0,
  recommended_industries text[] not null default '{}',
  recommended_campaigns jsonb not null default '[]'::jsonb,
  status text not null default 'detected' check (status in (
    'detected',
    'scored',
    'prospecting',
    'outreach_ready',
    'campaign_ready',
    'launched',
    'archived',
    'dismissed'
  )),
  approval_status text not null default 'needs_review' check (approval_status in (
    'draft',
    'needs_review',
    'approved',
    'rejected',
    'revision_needed',
    'not_required',
    'archived'
  )),
  source_payload jsonb not null default '{}'::jsonb,
  scoring_factors jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint storm_events_event_id_uidx unique (event_id)
);

create table if not exists public.storm_event_geographies (
  id uuid primary key default gen_random_uuid(),
  storm_event_id uuid not null references public.storm_events(id) on delete cascade,
  geography_type text not null default 'area',
  label text not null,
  state text,
  county text,
  city text,
  zip_code text,
  centroid_lat numeric(10,7),
  centroid_lng numeric(10,7),
  polygon_geojson jsonb not null default '{}'::jsonb,
  estimated_households integer not null default 0,
  estimated_homeowners integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.storm_event_zip_codes (
  id uuid primary key default gen_random_uuid(),
  storm_event_id uuid not null references public.storm_events(id) on delete cascade,
  zip_code text not null,
  state text,
  city text,
  county text,
  estimated_households integer not null default 0,
  estimated_homeowners integer not null default 0,
  median_home_value_cents integer,
  damage_likelihood_score integer not null default 0 check (damage_likelihood_score between 0 and 100),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint storm_event_zip_codes_event_zip_uidx unique (storm_event_id, zip_code)
);

create table if not exists public.storm_event_industry_matches (
  id uuid primary key default gen_random_uuid(),
  storm_event_id uuid not null references public.storm_events(id) on delete cascade,
  industry text not null,
  match_score integer not null default 50 check (match_score between 0 and 100),
  reason text not null default '',
  admin_override boolean not null default false,
  status text not null default 'recommended' check (status in ('recommended','approved','rejected','archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint storm_event_industry_matches_event_industry_uidx unique (storm_event_id, industry)
);

create table if not exists public.storm_business_prospects (
  id uuid primary key default gen_random_uuid(),
  storm_event_id uuid not null references public.storm_events(id) on delete cascade,
  source_business_id uuid references public.businesses(id) on delete set null,
  source_sales_lead_id uuid references public.sales_leads(id) on delete set null,
  source_outreach_prospect_id uuid references public.outreach_prospects(id) on delete set null,
  business_name text not null,
  owner_name text,
  email text,
  phone text,
  website text,
  city text,
  state text,
  category text not null,
  source text not null default 'homereach_existing_records',
  confidence_score integer not null default 50 check (confidence_score between 0 and 100),
  distance_to_event numeric(8,2),
  prior_contact_status text,
  crm_status text not null default 'new',
  suppression_status text not null default 'unchecked' check (suppression_status in ('unchecked','clear','suppressed','unknown')),
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists storm_business_prospects_event_email_uidx
  on public.storm_business_prospects (storm_event_id, lower(email))
  where email is not null and email <> '';

create unique index if not exists storm_business_prospects_event_phone_uidx
  on public.storm_business_prospects (storm_event_id, phone)
  where phone is not null and phone <> '';

create table if not exists public.storm_marketing_packages (
  id uuid primary key default gen_random_uuid(),
  storm_event_id uuid not null references public.storm_events(id) on delete cascade,
  industry text not null,
  package_name text not null,
  package_type text not null check (package_type in (
    'geofence_only',
    'postcard_only',
    'combined_geofence_postcard',
    'emergency_first_to_market'
  )),
  status text not null default 'draft' check (status in ('draft','needs_review','approved','proposal_sent','campaign_ready','launched','archived')),
  approval_status text not null default 'needs_review' check (approval_status in ('draft','needs_review','approved','rejected','revision_needed','archived')),
  client_approval_status text not null default 'not_sent' check (client_approval_status in ('not_sent','sent','viewed','client_requested_approval','approved','declined')),
  event_summary text not null default '',
  impacted_area_map jsonb not null default '{}'::jsonb,
  estimated_households integer not null default 0,
  recommended_geofence_radius_miles numeric(6,2) not null default 5,
  recommended_postcard_quantity integer not null default 0,
  suggested_timeline text not null default '',
  suggested_budget_cents integer not null default 0,
  estimated_price_to_client_cents integer not null default 0,
  revenue_estimate_cents integer not null default 0,
  email_draft text not null default '',
  sms_draft text not null default '',
  landing_page_copy text not null default '',
  postcard_copy text not null default '',
  ad_copy text not null default '',
  proposal_token text not null default encode(gen_random_bytes(18), 'hex'),
  proposal_sent_at timestamptz,
  human_approval_required boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint storm_marketing_packages_token_uidx unique (proposal_token)
);

create table if not exists public.storm_outreach_campaigns (
  id uuid primary key default gen_random_uuid(),
  storm_event_id uuid not null references public.storm_events(id) on delete cascade,
  marketing_package_id uuid references public.storm_marketing_packages(id) on delete set null,
  industry text not null,
  sender_key text not null default 'jason' check (sender_key in ('jason','josh','chelsi','heather')),
  campaign_name text not null,
  status text not null default 'draft' check (status in ('draft','needs_review','approved','scheduled','sending','sent','paused','archived')),
  approval_status text not null default 'needs_review' check (approval_status in ('draft','needs_review','approved','rejected','revision_needed','archived')),
  subject_base text not null default '',
  human_approval_required boolean not null default true,
  scheduled_at timestamptz,
  sent_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.storm_outreach_messages (
  id uuid primary key default gen_random_uuid(),
  outreach_campaign_id uuid not null references public.storm_outreach_campaigns(id) on delete cascade,
  storm_event_id uuid not null references public.storm_events(id) on delete cascade,
  prospect_id uuid references public.storm_business_prospects(id) on delete set null,
  channel text not null default 'email' check (channel in ('email','sms','facebook_dm','manual')),
  sender_key text not null default 'jason' check (sender_key in ('jason','josh','chelsi','heather')),
  recipient_email text,
  recipient_phone text,
  subject text,
  body text not null default '',
  variant_key text not null default 'a',
  status text not null default 'draft' check (status in ('draft','needs_review','approved','scheduled','sent','failed','suppressed','archived')),
  approval_status text not null default 'needs_review' check (approval_status in ('draft','needs_review','approved','rejected','revision_needed','archived')),
  suppression_status text not null default 'unchecked' check (suppression_status in ('unchecked','clear','suppressed','unknown')),
  provider_message_id text,
  opened_at timestamptz,
  clicked_at timestamptz,
  replied_at timestamptz,
  sent_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.storm_geofence_campaigns (
  id uuid primary key default gen_random_uuid(),
  storm_event_id uuid not null references public.storm_events(id) on delete cascade,
  marketing_package_id uuid references public.storm_marketing_packages(id) on delete set null,
  client_business_name text,
  industry text not null,
  status text not null default 'draft' check (status in ('draft','needs_review','ready_for_export','ready_for_external_setup','launched','archived')),
  approval_status text not null default 'needs_review' check (approval_status in ('draft','needs_review','approved','rejected','revision_needed','archived')),
  polygon_geojson jsonb not null default '{}'::jsonb,
  selected_zip_codes text[] not null default '{}',
  radius_miles numeric(6,2) not null default 5,
  excluded_areas_geojson jsonb not null default '[]'::jsonb,
  estimated_audience_size integer not null default 0,
  export_geojson jsonb not null default '{}'::jsonb,
  export_zip_csv text not null default '',
  campaign_brief text not null default '',
  external_platform_status text not null default 'not_started',
  human_approval_required boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.storm_postcard_campaigns (
  id uuid primary key default gen_random_uuid(),
  storm_event_id uuid not null references public.storm_events(id) on delete cascade,
  marketing_package_id uuid references public.storm_marketing_packages(id) on delete set null,
  client_business_name text,
  industry text not null,
  offer text,
  cta text,
  qr_code_url text,
  landing_page_url text,
  headline text not null default '',
  body text not null default '',
  image_direction text not null default '',
  mail_quantity integer not null default 0,
  estimated_print_postage_cost_cents integer not null default 0,
  estimated_price_to_client_cents integer not null default 0,
  campaign_timeline text not null default '',
  status text not null default 'draft' check (status in ('draft','needs_review','approved','production_ready','ordered','archived')),
  approval_status text not null default 'needs_review' check (approval_status in ('draft','needs_review','approved','rejected','revision_needed','archived')),
  human_approval_required boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.storm_agent_improvements (
  id uuid primary key default gen_random_uuid(),
  storm_event_id uuid references public.storm_events(id) on delete set null,
  recommendation_type text not null,
  title text not null,
  description text not null default '',
  priority text not null default 'medium' check (priority in ('low','medium','high','critical')),
  status text not null default 'open' check (status in ('open','needs_review','approved','rejected','implemented','archived')),
  source text not null default 'stormreach_strategist',
  confidence_score integer not null default 50 check (confidence_score between 0 and 100),
  approval_status text not null default 'needs_review' check (approval_status in ('draft','needs_review','approved','rejected','revision_needed','not_required','archived')),
  recommended_by text not null default 'StormReach Strategist',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.storm_system_metrics (
  id uuid primary key default gen_random_uuid(),
  metric_date date not null default current_date,
  period text not null default 'daily' check (period in ('hourly','daily','weekly','monthly')),
  events_detected integer not null default 0,
  high_value_events integer not null default 0,
  prospects_generated integer not null default 0,
  emails_drafted integer not null default 0,
  emails_approved integer not null default 0,
  emails_sent integer not null default 0,
  opens integer not null default 0,
  clicks integer not null default 0,
  replies integer not null default 0,
  booked_calls integer not null default 0,
  campaigns_sold integer not null default 0,
  geofence_campaigns_launched integer not null default 0,
  postcards_sold integer not null default 0,
  revenue_cents integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint storm_system_metrics_date_period_uidx unique (metric_date, period)
);

create table if not exists public.storm_suppression_matches (
  id uuid primary key default gen_random_uuid(),
  storm_event_id uuid references public.storm_events(id) on delete cascade,
  prospect_id uuid references public.storm_business_prospects(id) on delete cascade,
  outreach_message_id uuid references public.storm_outreach_messages(id) on delete cascade,
  channel text not null default 'email',
  contact_email text,
  contact_phone text,
  suppression_source text not null default 'outreach_suppression_list',
  reason text not null default '',
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.storm_provider_runs (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null,
  run_type text not null default 'ingest',
  status text not null default 'started' check (status in ('started','completed','failed','skipped')),
  events_seen integer not null default 0,
  events_upserted integer not null default 0,
  errors text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.storm_audit_logs (
  id uuid primary key default gen_random_uuid(),
  storm_event_id uuid references public.storm_events(id) on delete set null,
  related_table text,
  related_id text,
  actor_user_id uuid references public.profiles(id) on delete set null,
  actor_label text,
  action text not null,
  status text not null default 'logged',
  summary text not null default '',
  details jsonb not null default '{}'::jsonb,
  approval_status text not null default 'not_required',
  created_at timestamptz not null default now()
);

create index if not exists storm_events_status_idx
  on public.storm_events (status, severity_score desc, detected_at desc);
create index if not exists storm_events_type_state_idx
  on public.storm_events (event_type, impacted_state, detected_at desc);
create index if not exists storm_events_zip_gin_idx
  on public.storm_events using gin (impacted_zip_codes);
create index if not exists storm_event_geographies_event_idx
  on public.storm_event_geographies (storm_event_id, geography_type);
create index if not exists storm_event_zip_codes_event_idx
  on public.storm_event_zip_codes (storm_event_id, damage_likelihood_score desc);
create index if not exists storm_industry_matches_event_idx
  on public.storm_event_industry_matches (storm_event_id, match_score desc);
create index if not exists storm_business_prospects_event_idx
  on public.storm_business_prospects (storm_event_id, category, confidence_score desc);
create index if not exists storm_business_prospects_status_idx
  on public.storm_business_prospects (crm_status, suppression_status, updated_at desc);
create index if not exists storm_outreach_campaigns_event_idx
  on public.storm_outreach_campaigns (storm_event_id, status, updated_at desc);
create index if not exists storm_outreach_messages_campaign_idx
  on public.storm_outreach_messages (outreach_campaign_id, status, updated_at desc);
create index if not exists storm_marketing_packages_event_idx
  on public.storm_marketing_packages (storm_event_id, package_type, status, updated_at desc);
create index if not exists storm_geofence_campaigns_event_idx
  on public.storm_geofence_campaigns (storm_event_id, status, updated_at desc);
create index if not exists storm_postcard_campaigns_event_idx
  on public.storm_postcard_campaigns (storm_event_id, status, updated_at desc);
create index if not exists storm_agent_improvements_status_idx
  on public.storm_agent_improvements (status, priority, created_at desc);
create index if not exists storm_suppression_matches_event_idx
  on public.storm_suppression_matches (storm_event_id, active, created_at desc);
create index if not exists storm_provider_runs_provider_idx
  on public.storm_provider_runs (provider_key, status, started_at desc);
create index if not exists storm_audit_logs_event_idx
  on public.storm_audit_logs (storm_event_id, created_at desc);

alter table public.storm_events enable row level security;
alter table public.storm_event_geographies enable row level security;
alter table public.storm_event_zip_codes enable row level security;
alter table public.storm_event_industry_matches enable row level security;
alter table public.storm_business_prospects enable row level security;
alter table public.storm_outreach_campaigns enable row level security;
alter table public.storm_outreach_messages enable row level security;
alter table public.storm_marketing_packages enable row level security;
alter table public.storm_geofence_campaigns enable row level security;
alter table public.storm_postcard_campaigns enable row level security;
alter table public.storm_agent_improvements enable row level security;
alter table public.storm_system_metrics enable row level security;
alter table public.storm_suppression_matches enable row level security;
alter table public.storm_provider_runs enable row level security;
alter table public.storm_audit_logs enable row level security;

grant select, insert, update, delete on
  public.storm_events,
  public.storm_event_geographies,
  public.storm_event_zip_codes,
  public.storm_event_industry_matches,
  public.storm_business_prospects,
  public.storm_outreach_campaigns,
  public.storm_outreach_messages,
  public.storm_marketing_packages,
  public.storm_geofence_campaigns,
  public.storm_postcard_campaigns,
  public.storm_agent_improvements,
  public.storm_system_metrics,
  public.storm_suppression_matches,
  public.storm_provider_runs,
  public.storm_audit_logs
to authenticated, service_role;

do $$
declare
  table_name text;
  storm_tables text[] := array[
    'storm_events',
    'storm_event_geographies',
    'storm_event_zip_codes',
    'storm_event_industry_matches',
    'storm_business_prospects',
    'storm_outreach_campaigns',
    'storm_outreach_messages',
    'storm_marketing_packages',
    'storm_geofence_campaigns',
    'storm_postcard_campaigns',
    'storm_agent_improvements',
    'storm_system_metrics',
    'storm_suppression_matches',
    'storm_provider_runs',
    'storm_audit_logs'
  ];
begin
  foreach table_name in array storm_tables loop
    execute format('drop policy if exists %I on public.%I', table_name || '_service_all', table_name);
    execute format(
      'create policy %I on public.%I for all to service_role using (true) with check (true)',
      table_name || '_service_all',
      table_name
    );

    execute format('drop policy if exists %I on public.%I', table_name || '_admin_sales_read', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((auth.jwt() -> ''app_metadata'' ->> ''user_role'') in (''admin'',''sales_agent''))',
      table_name || '_admin_sales_read',
      table_name
    );

    execute format('drop policy if exists %I on public.%I', table_name || '_admin_write', table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using ((auth.jwt() -> ''app_metadata'' ->> ''user_role'') = ''admin'') with check ((auth.jwt() -> ''app_metadata'' ->> ''user_role'') = ''admin'')',
      table_name || '_admin_write',
      table_name
    );
  end loop;
end;
$$;

insert into public.ai_agent_profiles (
  agent_name,
  mission,
  allowed_actions,
  disallowed_actions,
  required_data_sources,
  required_prompt_sops,
  approval_rules,
  compliance_rules,
  escalation_rules,
  output_format,
  tone_rules,
  success_metrics,
  status,
  notes
)
select
  'StormReach Strategist',
  'Continuously improve severe weather opportunity detection, scoring, data quality, prospecting, geofence recommendations, postcard strategy, and approval-gated contractor outreach.',
  array[
    'Review severe weather events',
    'Recommend impacted areas and industries',
    'Draft email, postcard, landing page, and ad copy',
    'Create approval-gated tasks and recommendations',
    'Log performance insights and data quality warnings'
  ],
  array[
    'send outreach without approval',
    'launch campaigns',
    'change pricing',
    'charge customers',
    'order postcards',
    'make insurance or damage guarantees',
    'deploy code'
  ],
  array[
    'storm_events',
    'storm_business_prospects',
    'storm_marketing_packages',
    'storm_outreach_messages',
    'ai_assets',
    'approval_ledger',
    'outreach_suppression_list'
  ],
  array['StormReach Opportunity Review', 'StormReach Outreach Drafting', 'StormReach Campaign Package QA'],
  'Human approval is required before outreach sends, bulk actions, customer-facing proposal use, geofence launch, postcard ordering, pricing changes, payment actions, or external platform setup.',
  'No fearmongering, no disaster exploitation language, no unsupported damage claims, no insurance guarantees, no spam patterns, and no suppression bypass.',
  'Escalate provider failures, high/extreme events, contradictory geography, suppressed contacts, legal/compliance risk, pricing uncertainty, payment actions, and customer-facing ambiguity.',
  'Daily opportunity report, event recommendations, campaign package suggestions, data quality warnings, and approval-gated next actions.',
  'Direct, operational, human, local-business-friendly, factual, and calm.',
  array[
    'high-value events reviewed',
    'prospects generated',
    'outreach drafts approved',
    'campaigns sold',
    'revenue per event',
    'data quality warnings resolved'
  ],
  'active',
  'Seeded by StormReach migration. Autonomous recommendations are allowed; external actions remain approval-gated.'
where not exists (
  select 1 from public.ai_agent_profiles where agent_name = 'StormReach Strategist'
);

insert into public.ai_prompt_sops (
  prompt_name,
  category,
  purpose,
  required_inputs,
  prompt_text,
  output_format,
  approval_requirement,
  tags,
  related_workflow,
  related_offer,
  status,
  notes
)
select
  'StormReach Outreach Drafting',
  'stormreach',
  'Create short, human, approval-gated contractor outreach for severe weather opportunities.',
  array['weather event summary', 'impacted area', 'industry', 'prospect context', 'suppression status'],
  'Draft simple local-business outreach that mentions the weather event plainly, avoids fearmongering, avoids claiming damage exists, offers geofenced ads and postcard follow-up, and asks for a simple reply or map review.',
  'Subject, body, personalization variables, risk notes, approval status, next action.',
  'Human approval required before any outbound use.',
  array['stormreach','outreach','approval-required','geofence','postcard'],
  'StormReach',
  'Geofence marketing plus targeted postcards',
  'active',
  'Seeded by StormReach migration.'
where not exists (
  select 1 from public.ai_prompt_sops where prompt_name = 'StormReach Outreach Drafting'
);

insert into public.ai_prompt_sops (
  prompt_name,
  category,
  purpose,
  required_inputs,
  prompt_text,
  output_format,
  approval_requirement,
  tags,
  related_workflow,
  related_offer,
  status,
  notes
)
select
  'StormReach Campaign Package QA',
  'stormreach',
  'Review weather-triggered campaign packages before proposal, geofence export, postcard production, or launch.',
  array['event', 'impacted geography', 'industry', 'package', 'drafts', 'pricing'],
  'Check source support, geography, households, claims, pricing discipline, human approval status, suppression rules, and no insurance/damage guarantees.',
  'Pass/block status, issue list, required revisions, approval status, and next action.',
  'Human approval required before customer-facing, launch, payment, postcard, or platform actions.',
  array['stormreach','qa','approval-required','campaign-package'],
  'StormReach',
  'Geofence marketing plus targeted postcards',
  'active',
  'Seeded by StormReach migration.'
where not exists (
  select 1 from public.ai_prompt_sops where prompt_name = 'StormReach Campaign Package QA'
);

insert into public.ai_workforce_tasks (
  task_id,
  workflow_name,
  requestor,
  assigned_agent,
  priority,
  status,
  input_data,
  expected_output,
  dependencies,
  approval_required,
  related_campaign,
  related_opportunity
)
select
  'WF-STORMREACH-STRATEGIST-DAILY',
  'StormReach Daily Opportunity Report',
  'StormReach System',
  'StormReach Strategist',
  'high',
  'new',
  jsonb_build_object(
    'schedule', 'daily 7:00 AM local system time',
    'approval_boundary', 'recommendations only; no outreach, launch, pricing, payment, or postcard action'
  ),
  'Daily StormReach opportunity report with high-value events, prospecting gaps, campaign package recommendations, data quality warnings, and approval-gated next actions.',
  array['storm_events','storm_business_prospects','storm_marketing_packages','storm_system_metrics'],
  true,
  'StormReach',
  'Severe Weather Opportunity Engine'
where not exists (
  select 1 from public.ai_workforce_tasks where task_id = 'WF-STORMREACH-STRATEGIST-DAILY'
);

do $$
begin
  if to_regprocedure('public.agent_prevent_secret_like_storage()') is not null then
    drop trigger if exists storm_events_prevent_secret_like_storage on public.storm_events;
    create trigger storm_events_prevent_secret_like_storage
      before insert or update on public.storm_events
      for each row execute function public.agent_prevent_secret_like_storage();

    drop trigger if exists storm_business_prospects_prevent_secret_like_storage on public.storm_business_prospects;
    create trigger storm_business_prospects_prevent_secret_like_storage
      before insert or update on public.storm_business_prospects
      for each row execute function public.agent_prevent_secret_like_storage();

    drop trigger if exists storm_outreach_messages_prevent_secret_like_storage on public.storm_outreach_messages;
    create trigger storm_outreach_messages_prevent_secret_like_storage
      before insert or update on public.storm_outreach_messages
      for each row execute function public.agent_prevent_secret_like_storage();

    drop trigger if exists storm_marketing_packages_prevent_secret_like_storage on public.storm_marketing_packages;
    create trigger storm_marketing_packages_prevent_secret_like_storage
      before insert or update on public.storm_marketing_packages
      for each row execute function public.agent_prevent_secret_like_storage();

    drop trigger if exists storm_agent_improvements_prevent_secret_like_storage on public.storm_agent_improvements;
    create trigger storm_agent_improvements_prevent_secret_like_storage
      before insert or update on public.storm_agent_improvements
      for each row execute function public.agent_prevent_secret_like_storage();
  end if;
end;
$$;

comment on table public.storm_events is
  'StormReach severe weather event registry. Source attribution, confidence, scoring, approval status, and campaign readiness are tracked here.';

comment on table public.storm_business_prospects is
  'Approval-gated contractor prospects matched to storm events. Suppression and prior-contact status must be checked before outreach.';

comment on table public.storm_marketing_packages is
  'StormReach campaign package generator output for geofence, postcard, combined, and emergency first-to-market packages. No launch or payment action is implied.';

comment on table public.storm_geofence_campaigns is
  'Export-first geofence campaign builder for impacted weather areas. Direct ad platform setup remains external/manual unless future approved integrations are enabled.';

comment on table public.storm_postcard_campaigns is
  'StormReach postcard campaign builder. Human approval is required before production, export, customer send, or order placement.';

comment on table public.storm_agent_improvements is
  'StormReach Strategist recommendations and improvement log. Recommendations are advisory and approval-gated.';
