-- Growth Intelligence Engine MVP
-- Phase 6 adds the AI Growth Strategist layer. It converts internal records,
-- admin-entered local intelligence, campaign history, Business Memory, Cost
-- Control, and Reputation signals into approval-led growth opportunities.
-- It does not scrape private platforms, infer sensitive traits, infer
-- individual political beliefs, auto-message prospects, guarantee outcomes,
-- or launch campaigns without human approval.

create extension if not exists pgcrypto;

create table if not exists public.growth_intelligence_admin_entries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  entry_type text not null check (entry_type in (
    'competitor',
    'local_event',
    'neighborhood',
    'development',
    'seasonal_opportunity',
    'political_race',
    'local_business_category',
    'storm_weather_note',
    'community_opportunity',
    'referral_target',
    'partnership_target'
  )),
  location text,
  client_fit text,
  notes text,
  estimated_opportunity_cents integer not null default 0,
  priority integer not null default 50 check (priority >= 0 and priority <= 100),
  status text not null default 'active' check (status in ('active','needs_review','matched','archived','dismissed','expired')),
  industry_fit text[] not null default '{}'::text[],
  geography_fit text[] not null default '{}'::text[],
  client_fit_tags text[] not null default '{}'::text[],
  campaign_type_fit text[] not null default '{}'::text[],
  budget_fit text,
  urgency text not null default 'medium' check (urgency in ('low','medium','high','urgent')),
  created_by text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists growth_intelligence_admin_entries_status_idx
  on public.growth_intelligence_admin_entries (status, entry_type, priority desc, updated_at desc);
create index if not exists growth_intelligence_admin_entries_industry_idx
  on public.growth_intelligence_admin_entries using gin (industry_fit);
create index if not exists growth_intelligence_admin_entries_geography_idx
  on public.growth_intelligence_admin_entries using gin (geography_fit);

create table if not exists public.growth_intelligence_sources (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in (
    'internal_record',
    'admin_entry',
    'business_memory',
    'market_capture',
    'direct_mail',
    'political',
    'cost_control',
    'reputation',
    'manual_observation'
  )),
  source_table text,
  source_id text,
  label text not null,
  client_id uuid references public.profiles(id) on delete set null,
  client_email text,
  business_memory_profile_id uuid references public.business_memory_profiles(id) on delete set null,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists growth_intelligence_sources_client_idx
  on public.growth_intelligence_sources (client_id, source_type, updated_at desc);
create unique index if not exists growth_intelligence_sources_source_key
  on public.growth_intelligence_sources (
    coalesce(client_id::text, ''),
    lower(coalesce(client_email, '')),
    coalesce(source_table, ''),
    coalesce(source_id, ''),
    source_type
  )
  where source_table is not null and source_id is not null;

create table if not exists public.growth_intelligence_opportunities (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.profiles(id) on delete set null,
  client_email text,
  business_memory_profile_id uuid references public.business_memory_profiles(id) on delete set null,
  admin_entry_id uuid references public.growth_intelligence_admin_entries(id) on delete set null,
  opportunity_type text not null check (opportunity_type in (
    'jobsite_density_opportunity',
    'neighborhood_expansion',
    'competitor_area_opportunity',
    'service_area_expansion',
    'seasonal_campaign_opportunity',
    'event_campaign_opportunity',
    'political_geography_opportunity',
    'direct_mail_expansion',
    'digital_expansion',
    'direct_mail_digital_bundle',
    'dormant_client_reactivation',
    'dormant_geography_reactivation',
    'new_offer_opportunity',
    'referral_growth_opportunity',
    'review_growth_opportunity',
    'supplyfy_cross_sell_opportunity'
  )),
  category text not null,
  title text not null,
  why_it_matters text not null,
  recommended_action text not null,
  estimated_revenue_potential_cents integer not null default 0,
  confidence_score integer not null default 50 check (confidence_score >= 0 and confidence_score <= 100),
  priority_score integer not null default 50 check (priority_score >= 0 and priority_score <= 100),
  growth_score integer not null default 50 check (growth_score >= 0 and growth_score <= 100),
  source text not null default 'growth_intelligence_engine',
  source_table text,
  source_id text,
  status text not null default 'new_opportunity' check (status in (
    'new_opportunity',
    'needs_review',
    'recommended_to_client',
    'client_approved',
    'campaign_created',
    'in_progress',
    'completed',
    'dismissed',
    'expired'
  )),
  priority_label text not null default 'medium' check (priority_label in ('high','medium','low')),
  client_fit_summary text,
  recommended_campaign_type text not null default 'general_growth_task' check (recommended_campaign_type in (
    'market_capture',
    'direct_mail',
    'political_campaign',
    'review_campaign',
    'referral_campaign',
    'supplyfy_cross_sell',
    'general_growth_task',
    'digital_targeting',
    'direct_mail_digital_bundle'
  )),
  owner text,
  next_action text,
  notes text,
  due_at timestamptz,
  reviewed_at timestamptz,
  approved_at timestamptz,
  campaign_created_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists growth_intelligence_opportunities_client_idx
  on public.growth_intelligence_opportunities (client_id, status, priority_score desc, updated_at desc);
create index if not exists growth_intelligence_opportunities_email_idx
  on public.growth_intelligence_opportunities (lower(client_email), status, priority_score desc, updated_at desc);
create index if not exists growth_intelligence_opportunities_queue_idx
  on public.growth_intelligence_opportunities (status, priority_label, priority_score desc, updated_at desc);
create index if not exists growth_intelligence_opportunities_category_idx
  on public.growth_intelligence_opportunities (category, opportunity_type, status, updated_at desc);
create index if not exists growth_intelligence_opportunities_profile_idx
  on public.growth_intelligence_opportunities (business_memory_profile_id, status, updated_at desc);
create unique index if not exists growth_intelligence_opportunities_source_key
  on public.growth_intelligence_opportunities (
    coalesce(client_id::text, ''),
    lower(coalesce(client_email, '')),
    coalesce(source_table, ''),
    coalesce(source_id, ''),
    opportunity_type
  )
  where source_table is not null and source_id is not null;

create table if not exists public.growth_intelligence_scores (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.profiles(id) on delete set null,
  client_email text,
  business_memory_profile_id uuid references public.business_memory_profiles(id) on delete set null,
  score integer not null default 0 check (score >= 0 and score <= 100),
  color text not null default 'yellow' check (color in ('green','yellow','red')),
  revenue_potential_score integer not null default 0 check (revenue_potential_score >= 0 and revenue_potential_score <= 100),
  client_fit_score integer not null default 0 check (client_fit_score >= 0 and client_fit_score <= 100),
  timing_score integer not null default 0 check (timing_score >= 0 and timing_score <= 100),
  geography_fit_score integer not null default 0 check (geography_fit_score >= 0 and geography_fit_score <= 100),
  prior_acceptance_score integer not null default 0 check (prior_acceptance_score >= 0 and prior_acceptance_score <= 100),
  campaign_readiness_score integer not null default 0 check (campaign_readiness_score >= 0 and campaign_readiness_score <= 100),
  urgency_score integer not null default 0 check (urgency_score >= 0 and urgency_score <= 100),
  priority_label text not null default 'medium' check (priority_label in ('high','medium','low')),
  current_status text not null default 'needs_data',
  recommended_action text not null default 'Review the top growth opportunity.',
  top_opportunity_id uuid references public.growth_intelligence_opportunities(id) on delete set null,
  calculated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists growth_intelligence_scores_client_key
  on public.growth_intelligence_scores (
    coalesce(client_id::text, ''),
    lower(coalesce(client_email, ''))
  );

create table if not exists public.growth_intelligence_reports (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.profiles(id) on delete set null,
  client_email text,
  business_memory_profile_id uuid references public.business_memory_profiles(id) on delete set null,
  reporting_period_start date not null,
  reporting_period_end date not null,
  opportunities_found integer not null default 0,
  opportunities_approved integer not null default 0,
  opportunities_converted integer not null default 0,
  estimated_revenue_potential_cents integer not null default 0,
  actual_campaigns_created integer not null default 0,
  dismissed_opportunities integer not null default 0,
  top_categories jsonb not null default '[]'::jsonb,
  top_clients jsonb not null default '[]'::jsonb,
  recommended_next_actions text,
  created_by text not null default 'growth_intelligence_engine',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists growth_intelligence_reports_client_idx
  on public.growth_intelligence_reports (client_id, reporting_period_end desc);
create unique index if not exists growth_intelligence_reports_period_key
  on public.growth_intelligence_reports (
    coalesce(client_id::text, ''),
    lower(coalesce(client_email, '')),
    reporting_period_start,
    reporting_period_end
  );

create table if not exists public.growth_intelligence_client_matches (
  id uuid primary key default gen_random_uuid(),
  admin_entry_id uuid references public.growth_intelligence_admin_entries(id) on delete cascade,
  opportunity_id uuid references public.growth_intelligence_opportunities(id) on delete set null,
  client_id uuid references public.profiles(id) on delete set null,
  client_email text,
  business_memory_profile_id uuid references public.business_memory_profiles(id) on delete set null,
  match_reason text not null,
  industry_fit_score integer not null default 0 check (industry_fit_score >= 0 and industry_fit_score <= 100),
  geography_fit_score integer not null default 0 check (geography_fit_score >= 0 and geography_fit_score <= 100),
  campaign_type_fit_score integer not null default 0 check (campaign_type_fit_score >= 0 and campaign_type_fit_score <= 100),
  budget_fit_score integer not null default 0 check (budget_fit_score >= 0 and budget_fit_score <= 100),
  urgency_score integer not null default 0 check (urgency_score >= 0 and urgency_score <= 100),
  status text not null default 'matched' check (status in ('matched','reviewed','recommended','dismissed','converted')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists growth_intelligence_client_matches_entry_idx
  on public.growth_intelligence_client_matches (admin_entry_id, status, updated_at desc);
create index if not exists growth_intelligence_client_matches_client_idx
  on public.growth_intelligence_client_matches (client_id, status, updated_at desc);
create unique index if not exists growth_intelligence_client_matches_key
  on public.growth_intelligence_client_matches (
    admin_entry_id,
    coalesce(client_id::text, ''),
    lower(coalesce(client_email, ''))
  );

create table if not exists public.growth_intelligence_actions (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid references public.growth_intelligence_opportunities(id) on delete cascade,
  action_type text not null,
  label text not null,
  status text not null default 'recorded' check (status in ('recorded','queued','completed','failed')),
  actor_user_id uuid references public.profiles(id) on delete set null,
  actor_role text,
  target_campaign_type text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists growth_intelligence_actions_opportunity_idx
  on public.growth_intelligence_actions (opportunity_id, created_at desc);

create table if not exists public.growth_intelligence_drafts (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid references public.growth_intelligence_opportunities(id) on delete cascade,
  client_id uuid references public.profiles(id) on delete set null,
  client_email text,
  business_memory_profile_id uuid references public.business_memory_profiles(id) on delete set null,
  draft_type text not null check (draft_type in (
    'client_growth_email',
    'client_growth_sms',
    'client_growth_dm',
    'internal_strategy_note',
    'campaign_proposal_intro',
    'seasonal_campaign_message',
    'competitor_area_message',
    'neighborhood_expansion_message',
    'political_opportunity_message'
  )),
  label text not null,
  content text not null,
  approval_status text not null default 'draft' check (approval_status in ('draft','needs_review','approved','rejected')),
  copy_count integer not null default 0,
  last_copied_at timestamptz,
  created_by text not null default 'growth_intelligence_draft_generator',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists growth_intelligence_drafts_opportunity_idx
  on public.growth_intelligence_drafts (opportunity_id, draft_type, created_at desc);
create index if not exists growth_intelligence_drafts_client_idx
  on public.growth_intelligence_drafts (client_id, draft_type, created_at desc);
create unique index if not exists growth_intelligence_drafts_type_key
  on public.growth_intelligence_drafts (opportunity_id, draft_type);

alter table public.growth_intelligence_admin_entries enable row level security;
alter table public.growth_intelligence_sources enable row level security;
alter table public.growth_intelligence_opportunities enable row level security;
alter table public.growth_intelligence_scores enable row level security;
alter table public.growth_intelligence_reports enable row level security;
alter table public.growth_intelligence_client_matches enable row level security;
alter table public.growth_intelligence_actions enable row level security;
alter table public.growth_intelligence_drafts enable row level security;

grant select, insert, update, delete on
  public.growth_intelligence_admin_entries,
  public.growth_intelligence_sources,
  public.growth_intelligence_opportunities,
  public.growth_intelligence_scores,
  public.growth_intelligence_reports,
  public.growth_intelligence_client_matches,
  public.growth_intelligence_actions,
  public.growth_intelligence_drafts
to authenticated;

grant all on
  public.growth_intelligence_admin_entries,
  public.growth_intelligence_sources,
  public.growth_intelligence_opportunities,
  public.growth_intelligence_scores,
  public.growth_intelligence_reports,
  public.growth_intelligence_client_matches,
  public.growth_intelligence_actions,
  public.growth_intelligence_drafts
to service_role;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'growth_intelligence_admin_entries',
    'growth_intelligence_sources',
    'growth_intelligence_opportunities',
    'growth_intelligence_scores',
    'growth_intelligence_reports',
    'growth_intelligence_client_matches',
    'growth_intelligence_actions',
    'growth_intelligence_drafts'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', table_name || '_service', table_name);
    execute format(
      'create policy %I on public.%I for all to service_role using (true) with check (true)',
      table_name || '_service',
      table_name
    );

    execute format('drop policy if exists %I on public.%I', table_name || '_admin_all', table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using ((auth.jwt()->''app_metadata''->>''user_role'') in (''admin'',''sales_agent'')) with check ((auth.jwt()->''app_metadata''->>''user_role'') in (''admin'',''sales_agent''))',
      table_name || '_admin_all',
      table_name
    );
  end loop;
end $$;

drop policy if exists growth_intelligence_opportunities_client_select on public.growth_intelligence_opportunities;
create policy growth_intelligence_opportunities_client_select
  on public.growth_intelligence_opportunities for select to authenticated
  using (
    client_id = auth.uid()
    or lower(client_email) = lower(coalesce(auth.jwt()->>'email', ''))
  );

drop policy if exists growth_intelligence_scores_client_select on public.growth_intelligence_scores;
create policy growth_intelligence_scores_client_select
  on public.growth_intelligence_scores for select to authenticated
  using (
    client_id = auth.uid()
    or lower(client_email) = lower(coalesce(auth.jwt()->>'email', ''))
  );

drop policy if exists growth_intelligence_reports_client_select on public.growth_intelligence_reports;
create policy growth_intelligence_reports_client_select
  on public.growth_intelligence_reports for select to authenticated
  using (
    client_id = auth.uid()
    or lower(client_email) = lower(coalesce(auth.jwt()->>'email', ''))
  );

drop policy if exists growth_intelligence_client_matches_client_select on public.growth_intelligence_client_matches;
create policy growth_intelligence_client_matches_client_select
  on public.growth_intelligence_client_matches for select to authenticated
  using (
    client_id = auth.uid()
    or lower(client_email) = lower(coalesce(auth.jwt()->>'email', ''))
  );

drop policy if exists growth_intelligence_actions_client_select on public.growth_intelligence_actions;
create policy growth_intelligence_actions_client_select
  on public.growth_intelligence_actions for select to authenticated
  using (
    exists (
      select 1
      from public.growth_intelligence_opportunities gio
      where gio.id = growth_intelligence_actions.opportunity_id
        and (
          gio.client_id = auth.uid()
          or lower(gio.client_email) = lower(coalesce(auth.jwt()->>'email', ''))
        )
    )
  );

drop policy if exists growth_intelligence_drafts_client_select on public.growth_intelligence_drafts;
create policy growth_intelligence_drafts_client_select
  on public.growth_intelligence_drafts for select to authenticated
  using (
    client_id = auth.uid()
    or lower(client_email) = lower(coalesce(auth.jwt()->>'email', ''))
  );

comment on table public.growth_intelligence_admin_entries is
  'Phase 6 admin-entered local intelligence such as competitors, events, neighborhoods, developments, seasonal notes, and political races. Entries are advisory inputs only.';
comment on table public.growth_intelligence_opportunities is
  'Phase 6 Growth Intelligence advisory opportunities. Records surface geography, campaign, seasonal, reputation, referral, and bundle opportunities requiring human approval before execution.';
comment on table public.growth_intelligence_client_matches is
  'Client-fit records connecting admin-entered intelligence to clients by industry, geography, campaign type, budget fit, and urgency.';
comment on table public.growth_intelligence_actions is
  'Approval-led action ledger for Growth Intelligence. Create-campaign actions are workflow records only and do not launch paid ads or outreach.';
comment on table public.growth_intelligence_drafts is
  'Copyable Growth Intelligence drafts. Drafts require human approval before outbound use and must avoid guarantees, surveillance language, and sensitive targeting.';
