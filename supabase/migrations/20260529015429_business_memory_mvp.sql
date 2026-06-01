-- Business Memory MVP
-- Phase 3 adds the durable learning layer for HomeReach OS. It stores what
-- happened, what worked, what was ignored, and what should improve future
-- recommendations. It does not add predictive AI, ad API launch, autonomous
-- actions, external scraping, or future phase automations.

create extension if not exists pgcrypto;

create table if not exists public.business_memory_profiles (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.profiles(id) on delete set null,
  client_email text,
  business_name text not null,
  industry text,
  services jsonb not null default '[]'::jsonb,
  business_size text,
  service_radius_miles numeric(8,2),
  website text,
  markets_served jsonb not null default '[]'::jsonb,
  primary_goals jsonb not null default '[]'::jsonb,
  preferred_campaign_types jsonb not null default '[]'::jsonb,
  preferred_communication_method text,
  primary_cities jsonb not null default '[]'::jsonb,
  primary_zip_codes jsonb not null default '[]'::jsonb,
  primary_counties jsonb not null default '[]'::jsonb,
  preferred_offers jsonb not null default '[]'::jsonb,
  preferred_budgets jsonb not null default '{}'::jsonb,
  source text not null default 'business_memory_mvp',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists business_memory_profiles_client_key
  on public.business_memory_profiles (
    coalesce(client_id::text, ''),
    lower(coalesce(client_email, '')),
    lower(business_name)
  );
create index if not exists business_memory_profiles_search_idx
  on public.business_memory_profiles (lower(business_name), lower(coalesce(client_email, '')), updated_at desc);

create table if not exists public.business_memory_geographies (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.business_memory_profiles(id) on delete cascade,
  geography_type text not null check (geography_type in (
    'target_area',
    'zip_code',
    'city',
    'county',
    'neighborhood',
    'jobsite_area',
    'competitor_area',
    'political_area',
    'direct_mail_area',
    'digital_area',
    'service_area',
    'custom_area'
  )),
  name text not null,
  value text,
  address text,
  radius_miles numeric(8,2),
  performance_status text not null default 'unknown' check (performance_status in ('unknown','best','worst','watch','active')),
  performance_score integer not null default 0 check (performance_score >= 0 and performance_score <= 100),
  notes text,
  source_table text,
  source_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists business_memory_geographies_profile_idx
  on public.business_memory_geographies (profile_id, geography_type, performance_score desc, updated_at desc);
create unique index if not exists business_memory_geographies_source_key
  on public.business_memory_geographies (profile_id, coalesce(source_table, ''), coalesce(source_id, ''), geography_type, lower(name))
  where source_table is not null and source_id is not null;

create table if not exists public.business_memory_campaigns (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.business_memory_profiles(id) on delete cascade,
  campaign_type text not null,
  campaign_name text not null,
  launch_date date,
  budget_cents integer not null default 0,
  status text not null default 'unknown',
  assets_used jsonb not null default '[]'::jsonb,
  target_geography text,
  direct_mail_used boolean not null default false,
  digital_used boolean not null default false,
  political_used boolean not null default false,
  review_used boolean not null default false,
  referral_used boolean not null default false,
  performance_notes text,
  source_table text,
  source_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists business_memory_campaigns_profile_idx
  on public.business_memory_campaigns (profile_id, campaign_type, status, updated_at desc);
create unique index if not exists business_memory_campaigns_source_key
  on public.business_memory_campaigns (profile_id, coalesce(source_table, ''), coalesce(source_id, ''))
  where source_table is not null and source_id is not null;

create table if not exists public.business_memory_campaign_results (
  id uuid primary key default gen_random_uuid(),
  campaign_memory_id uuid not null references public.business_memory_campaigns(id) on delete cascade,
  profile_id uuid not null references public.business_memory_profiles(id) on delete cascade,
  reporting_period_start date,
  reporting_period_end date,
  impressions integer not null default 0,
  reach integer not null default 0,
  clicks integer not null default 0,
  leads integer not null default 0,
  calls integer not null default 0,
  forms integer not null default 0,
  qr_scans integer not null default 0,
  spend_cents integer not null default 0,
  cost_per_lead_cents integer not null default 0,
  cost_per_click_cents integer not null default 0,
  client_feedback text,
  internal_notes text,
  success_rating integer not null default 0 check (success_rating >= 0 and success_rating <= 100),
  source_table text,
  source_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists business_memory_campaign_results_profile_idx
  on public.business_memory_campaign_results (profile_id, success_rating desc, reporting_period_end desc);
create unique index if not exists business_memory_campaign_results_source_key
  on public.business_memory_campaign_results (campaign_memory_id, coalesce(source_table, ''), coalesce(source_id, ''))
  where source_table is not null and source_id is not null;

create table if not exists public.business_memory_opportunities (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.business_memory_profiles(id) on delete cascade,
  opportunity_type text not null,
  opportunity_reason text,
  opportunity_status text not null default 'new',
  accepted boolean not null default false,
  rejected boolean not null default false,
  dismissed boolean not null default false,
  completed boolean not null default false,
  estimated_value_cents integer not null default 0,
  actual_value_cents integer not null default 0,
  date_created timestamptz not null default now(),
  date_closed timestamptz,
  source_table text,
  source_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists business_memory_opportunities_profile_idx
  on public.business_memory_opportunities (profile_id, opportunity_type, opportunity_status, date_created desc);
create unique index if not exists business_memory_opportunities_source_key
  on public.business_memory_opportunities (profile_id, coalesce(source_table, ''), coalesce(source_id, ''))
  where source_table is not null and source_id is not null;

create table if not exists public.business_memory_offers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.business_memory_profiles(id) on delete cascade,
  offer_text text not null,
  offer_type text,
  campaign_performance text,
  acceptance_rate numeric(5,2),
  lead_quality_notes text,
  revenue_notes text,
  performance_status text not null default 'unknown' check (performance_status in ('unknown','best','worst','watch','active')),
  source_table text,
  source_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists business_memory_offers_profile_idx
  on public.business_memory_offers (profile_id, performance_status, updated_at desc);
create unique index if not exists business_memory_offers_source_key
  on public.business_memory_offers (profile_id, coalesce(source_table, ''), coalesce(source_id, ''), lower(offer_text))
  where source_table is not null and source_id is not null;

create table if not exists public.business_memory_suppliers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.business_memory_profiles(id) on delete cascade,
  supplier_name text not null,
  category text,
  supplier_history jsonb not null default '[]'::jsonb,
  vendor_notes text,
  pricing_history jsonb not null default '[]'::jsonb,
  source_table text,
  source_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists business_memory_suppliers_profile_idx
  on public.business_memory_suppliers (profile_id, lower(supplier_name), updated_at desc);
create unique index if not exists business_memory_suppliers_source_key
  on public.business_memory_suppliers (profile_id, coalesce(source_table, ''), coalesce(source_id, ''), lower(supplier_name))
  where source_table is not null and source_id is not null;

create table if not exists public.business_memory_savings (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.business_memory_profiles(id) on delete cascade,
  opportunity_name text not null,
  category text,
  estimated_savings_cents integer not null default 0,
  actual_savings_cents integer not null default 0,
  accepted boolean not null default false,
  rejected boolean not null default false,
  recurring_savings boolean not null default false,
  one_time_savings boolean not null default false,
  status text not null default 'new',
  source_table text,
  source_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists business_memory_savings_profile_idx
  on public.business_memory_savings (profile_id, status, estimated_savings_cents desc, updated_at desc);
create unique index if not exists business_memory_savings_source_key
  on public.business_memory_savings (profile_id, coalesce(source_table, ''), coalesce(source_id, ''))
  where source_table is not null and source_id is not null;

create table if not exists public.business_memory_reputation (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.business_memory_profiles(id) on delete cascade,
  memory_type text not null check (memory_type in ('review_campaign','review_request','referral_campaign','testimonial','feedback')),
  reviews_requested integer not null default 0,
  reviews_received integer not null default 0,
  referrals_generated integer not null default 0,
  testimonial text,
  client_feedback text,
  source_table text,
  source_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists business_memory_reputation_profile_idx
  on public.business_memory_reputation (profile_id, memory_type, updated_at desc);
create unique index if not exists business_memory_reputation_source_key
  on public.business_memory_reputation (profile_id, coalesce(source_table, ''), coalesce(source_id, ''), memory_type)
  where source_table is not null and source_id is not null;

create table if not exists public.business_memory_growth (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.business_memory_profiles(id) on delete cascade,
  growth_type text not null,
  description text not null,
  new_zip_codes jsonb not null default '[]'::jsonb,
  new_cities jsonb not null default '[]'::jsonb,
  new_services jsonb not null default '[]'::jsonb,
  new_campaign_types jsonb not null default '[]'::jsonb,
  new_markets jsonb not null default '[]'::jsonb,
  new_political_opportunities jsonb not null default '[]'::jsonb,
  new_revenue_streams jsonb not null default '[]'::jsonb,
  status text not null default 'new',
  source_table text,
  source_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists business_memory_growth_profile_idx
  on public.business_memory_growth (profile_id, growth_type, status, updated_at desc);
create unique index if not exists business_memory_growth_source_key
  on public.business_memory_growth (profile_id, coalesce(source_table, ''), coalesce(source_id, ''), growth_type)
  where source_table is not null and source_id is not null;

create table if not exists public.business_memory_ai_coo (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.business_memory_profiles(id) on delete cascade,
  recommendation_id uuid references public.ai_coo_recommendations(id) on delete set null,
  recommendation_type text not null,
  category text,
  status text not null default 'new',
  accepted boolean not null default false,
  rejected boolean not null default false,
  dismissed boolean not null default false,
  completed boolean not null default false,
  estimated_value_cents integer not null default 0,
  success_rating integer not null default 0 check (success_rating >= 0 and success_rating <= 100),
  reason text,
  source_table text,
  source_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists business_memory_ai_coo_profile_idx
  on public.business_memory_ai_coo (profile_id, category, status, updated_at desc);
create unique index if not exists business_memory_ai_coo_source_key
  on public.business_memory_ai_coo (profile_id, coalesce(source_table, ''), coalesce(source_id, ''))
  where source_table is not null and source_id is not null;

create table if not exists public.business_memory_timeline (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.business_memory_profiles(id) on delete cascade,
  event_type text not null,
  title text not null,
  description text,
  event_date timestamptz not null default now(),
  related_table text,
  related_id text,
  impact_cents integer not null default 0,
  status text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists business_memory_timeline_profile_idx
  on public.business_memory_timeline (profile_id, event_date desc, event_type);
create unique index if not exists business_memory_timeline_source_key
  on public.business_memory_timeline (profile_id, coalesce(related_table, ''), coalesce(related_id, ''), event_type)
  where related_table is not null and related_id is not null;

create table if not exists public.business_memory_insights (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.business_memory_profiles(id) on delete cascade,
  insight_type text not null,
  title text not null,
  value_text text,
  value_cents integer not null default 0,
  confidence_score integer not null default 0 check (confidence_score >= 0 and confidence_score <= 100),
  supporting_data jsonb not null default '{}'::jsonb,
  recommended_action text,
  status text not null default 'active' check (status in ('active','archived')),
  generated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists business_memory_insights_profile_idx
  on public.business_memory_insights (profile_id, status, confidence_score desc, generated_at desc);
create unique index if not exists business_memory_insights_type_key
  on public.business_memory_insights (profile_id, insight_type);

create table if not exists public.business_memory_scores (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.business_memory_profiles(id) on delete cascade,
  memory_completeness_score integer not null default 0 check (memory_completeness_score >= 0 and memory_completeness_score <= 100),
  business_profile_score integer not null default 0 check (business_profile_score >= 0 and business_profile_score <= 100),
  campaign_history_score integer not null default 0 check (campaign_history_score >= 0 and campaign_history_score <= 100),
  opportunity_history_score integer not null default 0 check (opportunity_history_score >= 0 and opportunity_history_score <= 100),
  geography_data_score integer not null default 0 check (geography_data_score >= 0 and geography_data_score <= 100),
  supplier_data_score integer not null default 0 check (supplier_data_score >= 0 and supplier_data_score <= 100),
  reputation_data_score integer not null default 0 check (reputation_data_score >= 0 and reputation_data_score <= 100),
  recommendation_data_score integer not null default 0 check (recommendation_data_score >= 0 and recommendation_data_score <= 100),
  missing_areas jsonb not null default '[]'::jsonb,
  recommended_data_to_collect jsonb not null default '[]'::jsonb,
  calculated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id)
);

alter table public.business_memory_profiles enable row level security;
alter table public.business_memory_geographies enable row level security;
alter table public.business_memory_campaigns enable row level security;
alter table public.business_memory_campaign_results enable row level security;
alter table public.business_memory_opportunities enable row level security;
alter table public.business_memory_offers enable row level security;
alter table public.business_memory_suppliers enable row level security;
alter table public.business_memory_savings enable row level security;
alter table public.business_memory_reputation enable row level security;
alter table public.business_memory_growth enable row level security;
alter table public.business_memory_ai_coo enable row level security;
alter table public.business_memory_timeline enable row level security;
alter table public.business_memory_insights enable row level security;
alter table public.business_memory_scores enable row level security;

grant select, insert, update, delete on
  public.business_memory_profiles,
  public.business_memory_geographies,
  public.business_memory_campaigns,
  public.business_memory_campaign_results,
  public.business_memory_opportunities,
  public.business_memory_offers,
  public.business_memory_suppliers,
  public.business_memory_savings,
  public.business_memory_reputation,
  public.business_memory_growth,
  public.business_memory_ai_coo,
  public.business_memory_timeline,
  public.business_memory_insights,
  public.business_memory_scores
to authenticated;

grant all on
  public.business_memory_profiles,
  public.business_memory_geographies,
  public.business_memory_campaigns,
  public.business_memory_campaign_results,
  public.business_memory_opportunities,
  public.business_memory_offers,
  public.business_memory_suppliers,
  public.business_memory_savings,
  public.business_memory_reputation,
  public.business_memory_growth,
  public.business_memory_ai_coo,
  public.business_memory_timeline,
  public.business_memory_insights,
  public.business_memory_scores
to service_role;

drop policy if exists business_memory_profiles_service on public.business_memory_profiles;
create policy business_memory_profiles_service
  on public.business_memory_profiles for all to service_role
  using (true) with check (true);

drop policy if exists business_memory_profiles_admin_all on public.business_memory_profiles;
create policy business_memory_profiles_admin_all
  on public.business_memory_profiles for all to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'))
  with check ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));

drop policy if exists business_memory_profiles_client_select on public.business_memory_profiles;
create policy business_memory_profiles_client_select
  on public.business_memory_profiles for select to authenticated
  using (
    client_id = auth.uid()
    or lower(client_email) = lower(coalesce(auth.jwt()->>'email', ''))
  );

drop policy if exists business_memory_geographies_service on public.business_memory_geographies;
create policy business_memory_geographies_service
  on public.business_memory_geographies for all to service_role
  using (true) with check (true);

drop policy if exists business_memory_geographies_admin_all on public.business_memory_geographies;
create policy business_memory_geographies_admin_all
  on public.business_memory_geographies for all to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'))
  with check ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));

drop policy if exists business_memory_geographies_client_select on public.business_memory_geographies;
create policy business_memory_geographies_client_select
  on public.business_memory_geographies for select to authenticated
  using (exists (
    select 1 from public.business_memory_profiles p
    where p.id = profile_id
      and (p.client_id = auth.uid() or lower(p.client_email) = lower(coalesce(auth.jwt()->>'email', '')))
  ));

drop policy if exists business_memory_campaigns_service on public.business_memory_campaigns;
create policy business_memory_campaigns_service
  on public.business_memory_campaigns for all to service_role
  using (true) with check (true);

drop policy if exists business_memory_campaigns_admin_all on public.business_memory_campaigns;
create policy business_memory_campaigns_admin_all
  on public.business_memory_campaigns for all to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'))
  with check ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));

drop policy if exists business_memory_campaigns_client_select on public.business_memory_campaigns;
create policy business_memory_campaigns_client_select
  on public.business_memory_campaigns for select to authenticated
  using (exists (
    select 1 from public.business_memory_profiles p
    where p.id = profile_id
      and (p.client_id = auth.uid() or lower(p.client_email) = lower(coalesce(auth.jwt()->>'email', '')))
  ));

drop policy if exists business_memory_campaign_results_service on public.business_memory_campaign_results;
create policy business_memory_campaign_results_service
  on public.business_memory_campaign_results for all to service_role
  using (true) with check (true);

drop policy if exists business_memory_campaign_results_admin_all on public.business_memory_campaign_results;
create policy business_memory_campaign_results_admin_all
  on public.business_memory_campaign_results for all to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'))
  with check ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));

drop policy if exists business_memory_campaign_results_client_select on public.business_memory_campaign_results;
create policy business_memory_campaign_results_client_select
  on public.business_memory_campaign_results for select to authenticated
  using (exists (
    select 1 from public.business_memory_profiles p
    where p.id = profile_id
      and (p.client_id = auth.uid() or lower(p.client_email) = lower(coalesce(auth.jwt()->>'email', '')))
  ));

drop policy if exists business_memory_opportunities_service on public.business_memory_opportunities;
create policy business_memory_opportunities_service
  on public.business_memory_opportunities for all to service_role
  using (true) with check (true);

drop policy if exists business_memory_opportunities_admin_all on public.business_memory_opportunities;
create policy business_memory_opportunities_admin_all
  on public.business_memory_opportunities for all to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'))
  with check ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));

drop policy if exists business_memory_opportunities_client_select on public.business_memory_opportunities;
create policy business_memory_opportunities_client_select
  on public.business_memory_opportunities for select to authenticated
  using (exists (
    select 1 from public.business_memory_profiles p
    where p.id = profile_id
      and (p.client_id = auth.uid() or lower(p.client_email) = lower(coalesce(auth.jwt()->>'email', '')))
  ));

drop policy if exists business_memory_offers_service on public.business_memory_offers;
create policy business_memory_offers_service
  on public.business_memory_offers for all to service_role
  using (true) with check (true);

drop policy if exists business_memory_offers_admin_all on public.business_memory_offers;
create policy business_memory_offers_admin_all
  on public.business_memory_offers for all to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'))
  with check ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));

drop policy if exists business_memory_offers_client_select on public.business_memory_offers;
create policy business_memory_offers_client_select
  on public.business_memory_offers for select to authenticated
  using (exists (
    select 1 from public.business_memory_profiles p
    where p.id = profile_id
      and (p.client_id = auth.uid() or lower(p.client_email) = lower(coalesce(auth.jwt()->>'email', '')))
  ));

drop policy if exists business_memory_suppliers_service on public.business_memory_suppliers;
create policy business_memory_suppliers_service
  on public.business_memory_suppliers for all to service_role
  using (true) with check (true);

drop policy if exists business_memory_suppliers_admin_all on public.business_memory_suppliers;
create policy business_memory_suppliers_admin_all
  on public.business_memory_suppliers for all to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'))
  with check ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));

drop policy if exists business_memory_suppliers_client_select on public.business_memory_suppliers;
create policy business_memory_suppliers_client_select
  on public.business_memory_suppliers for select to authenticated
  using (exists (
    select 1 from public.business_memory_profiles p
    where p.id = profile_id
      and (p.client_id = auth.uid() or lower(p.client_email) = lower(coalesce(auth.jwt()->>'email', '')))
  ));

drop policy if exists business_memory_savings_service on public.business_memory_savings;
create policy business_memory_savings_service
  on public.business_memory_savings for all to service_role
  using (true) with check (true);

drop policy if exists business_memory_savings_admin_all on public.business_memory_savings;
create policy business_memory_savings_admin_all
  on public.business_memory_savings for all to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'))
  with check ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));

drop policy if exists business_memory_savings_client_select on public.business_memory_savings;
create policy business_memory_savings_client_select
  on public.business_memory_savings for select to authenticated
  using (exists (
    select 1 from public.business_memory_profiles p
    where p.id = profile_id
      and (p.client_id = auth.uid() or lower(p.client_email) = lower(coalesce(auth.jwt()->>'email', '')))
  ));

drop policy if exists business_memory_reputation_service on public.business_memory_reputation;
create policy business_memory_reputation_service
  on public.business_memory_reputation for all to service_role
  using (true) with check (true);

drop policy if exists business_memory_reputation_admin_all on public.business_memory_reputation;
create policy business_memory_reputation_admin_all
  on public.business_memory_reputation for all to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'))
  with check ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));

drop policy if exists business_memory_reputation_client_select on public.business_memory_reputation;
create policy business_memory_reputation_client_select
  on public.business_memory_reputation for select to authenticated
  using (exists (
    select 1 from public.business_memory_profiles p
    where p.id = profile_id
      and (p.client_id = auth.uid() or lower(p.client_email) = lower(coalesce(auth.jwt()->>'email', '')))
  ));

drop policy if exists business_memory_growth_service on public.business_memory_growth;
create policy business_memory_growth_service
  on public.business_memory_growth for all to service_role
  using (true) with check (true);

drop policy if exists business_memory_growth_admin_all on public.business_memory_growth;
create policy business_memory_growth_admin_all
  on public.business_memory_growth for all to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'))
  with check ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));

drop policy if exists business_memory_growth_client_select on public.business_memory_growth;
create policy business_memory_growth_client_select
  on public.business_memory_growth for select to authenticated
  using (exists (
    select 1 from public.business_memory_profiles p
    where p.id = profile_id
      and (p.client_id = auth.uid() or lower(p.client_email) = lower(coalesce(auth.jwt()->>'email', '')))
  ));

drop policy if exists business_memory_ai_coo_service on public.business_memory_ai_coo;
create policy business_memory_ai_coo_service
  on public.business_memory_ai_coo for all to service_role
  using (true) with check (true);

drop policy if exists business_memory_ai_coo_admin_all on public.business_memory_ai_coo;
create policy business_memory_ai_coo_admin_all
  on public.business_memory_ai_coo for all to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'))
  with check ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));

drop policy if exists business_memory_ai_coo_client_select on public.business_memory_ai_coo;
create policy business_memory_ai_coo_client_select
  on public.business_memory_ai_coo for select to authenticated
  using (exists (
    select 1 from public.business_memory_profiles p
    where p.id = profile_id
      and (p.client_id = auth.uid() or lower(p.client_email) = lower(coalesce(auth.jwt()->>'email', '')))
  ));

drop policy if exists business_memory_timeline_service on public.business_memory_timeline;
create policy business_memory_timeline_service
  on public.business_memory_timeline for all to service_role
  using (true) with check (true);

drop policy if exists business_memory_timeline_admin_all on public.business_memory_timeline;
create policy business_memory_timeline_admin_all
  on public.business_memory_timeline for all to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'))
  with check ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));

drop policy if exists business_memory_timeline_client_select on public.business_memory_timeline;
create policy business_memory_timeline_client_select
  on public.business_memory_timeline for select to authenticated
  using (exists (
    select 1 from public.business_memory_profiles p
    where p.id = profile_id
      and (p.client_id = auth.uid() or lower(p.client_email) = lower(coalesce(auth.jwt()->>'email', '')))
  ));

drop policy if exists business_memory_insights_service on public.business_memory_insights;
create policy business_memory_insights_service
  on public.business_memory_insights for all to service_role
  using (true) with check (true);

drop policy if exists business_memory_insights_admin_all on public.business_memory_insights;
create policy business_memory_insights_admin_all
  on public.business_memory_insights for all to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'))
  with check ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));

drop policy if exists business_memory_insights_client_select on public.business_memory_insights;
create policy business_memory_insights_client_select
  on public.business_memory_insights for select to authenticated
  using (exists (
    select 1 from public.business_memory_profiles p
    where p.id = profile_id
      and (p.client_id = auth.uid() or lower(p.client_email) = lower(coalesce(auth.jwt()->>'email', '')))
  ));

drop policy if exists business_memory_scores_service on public.business_memory_scores;
create policy business_memory_scores_service
  on public.business_memory_scores for all to service_role
  using (true) with check (true);

drop policy if exists business_memory_scores_admin_all on public.business_memory_scores;
create policy business_memory_scores_admin_all
  on public.business_memory_scores for all to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'))
  with check ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));

drop policy if exists business_memory_scores_client_select on public.business_memory_scores;
create policy business_memory_scores_client_select
  on public.business_memory_scores for select to authenticated
  using (exists (
    select 1 from public.business_memory_profiles p
    where p.id = profile_id
      and (p.client_id = auth.uid() or lower(p.client_email) = lower(coalesce(auth.jwt()->>'email', '')))
  ));
