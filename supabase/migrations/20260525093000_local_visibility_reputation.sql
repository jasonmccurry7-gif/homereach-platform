-- HomeReach Local Visibility + Reputation foundation
--
-- Additive, approval-first tables for Local SEO, Google Business Profile,
-- review requests, reputation alerts, listing checks, recommendations, and
-- visibility scans. These tables do not publish replies, alter listings, send
-- review requests, or change public profiles without an approved workflow.

create extension if not exists pgcrypto;

create table if not exists public.local_visibility_businesses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  business_id uuid,
  owner_id uuid references public.profiles(id) on delete set null,
  business_name text not null,
  website text,
  phone text,
  address text,
  city text,
  state text,
  postal_code text,
  category text,
  google_business_profile_url text,
  google_place_id text,
  primary_contact_name text,
  primary_contact_email text,
  package_tier text not null default 'starter_visibility'
    check (package_tier in ('starter_visibility','growth_reputation','local_dominance','custom')),
  status text not null default 'lead'
    check (status in ('lead','scan_complete','onboarding','active','paused','churned','archived')),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists local_visibility_businesses_status_idx
  on public.local_visibility_businesses (status, updated_at desc);
create index if not exists local_visibility_businesses_owner_idx
  on public.local_visibility_businesses (owner_id, updated_at desc)
  where owner_id is not null;

create table if not exists public.local_visibility_scans (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  local_visibility_business_id uuid references public.local_visibility_businesses(id) on delete set null,
  business_name text not null,
  website text,
  phone text,
  city text not null,
  state text not null,
  category text not null,
  google_business_profile_url text,
  overall_visibility_score integer not null default 0,
  trust_score integer not null default 0,
  listings_score integer not null default 0,
  review_momentum_score integer not null default 0,
  google_profile_completeness integer not null default 0,
  estimated_revenue_opportunity text,
  scorecard jsonb not null default '{}'::jsonb,
  source text not null default 'manual',
  status text not null default 'new_scan'
    check (status in ('new_scan','reviewed','proposal_sent','converted','archived')),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists local_visibility_scans_created_idx
  on public.local_visibility_scans (created_at desc);
create index if not exists local_visibility_scans_status_idx
  on public.local_visibility_scans (status, created_at desc);

create table if not exists public.local_visibility_reviews (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  local_visibility_business_id uuid references public.local_visibility_businesses(id) on delete cascade,
  source text not null default 'manual'
    check (source in ('google','facebook','yelp','manual','import')),
  external_review_id text,
  reviewer_name text,
  rating numeric,
  review_text text,
  review_url text,
  review_created_at timestamptz,
  response_status text not null default 'needs_review'
    check (response_status in ('not_needed','needs_review','draft_ready','approved','posted','sensitive','archived')),
  ai_response_draft text,
  approved_response text,
  approved_at timestamptz,
  approved_by uuid references public.profiles(id) on delete set null,
  posted_at timestamptz,
  sentiment text
    check (sentiment in ('positive','neutral','negative','mixed') or sentiment is null),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists local_visibility_reviews_business_idx
  on public.local_visibility_reviews (local_visibility_business_id, review_created_at desc);
create index if not exists local_visibility_reviews_response_idx
  on public.local_visibility_reviews (response_status, updated_at desc);

create table if not exists public.local_visibility_review_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  local_visibility_business_id uuid references public.local_visibility_businesses(id) on delete cascade,
  customer_name text,
  customer_phone text,
  customer_email text,
  channel text not null default 'email'
    check (channel in ('email','sms','qr','manual')),
  message_draft text,
  approval_status text not null default 'needs_review'
    check (approval_status in ('needs_review','approved','rejected','sent','completed','archived')),
  sent_at timestamptz,
  completed_at timestamptz,
  review_url text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists local_visibility_review_requests_status_idx
  on public.local_visibility_review_requests (approval_status, updated_at desc);

create table if not exists public.local_visibility_listing_checks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  local_visibility_business_id uuid references public.local_visibility_businesses(id) on delete cascade,
  source text not null,
  listing_url text,
  field_name text not null,
  expected_value text,
  observed_value text,
  issue_status text not null default 'needs_review'
    check (issue_status in ('ok','needs_review','correction_drafted','approved','submitted','resolved','ignored')),
  severity text not null default 'medium'
    check (severity in ('critical','high','medium','low')),
  recommended_action text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists local_visibility_listing_checks_business_idx
  on public.local_visibility_listing_checks (local_visibility_business_id, issue_status, severity);

create table if not exists public.local_visibility_recommendations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  local_visibility_business_id uuid references public.local_visibility_businesses(id) on delete cascade,
  agent_name text not null,
  recommendation_type text not null
    check (recommendation_type in ('review','listing','google_profile','local_seo','risk','insight','social_post')),
  title text not null,
  detail text not null,
  recommended_action text not null,
  expected_impact text,
  confidence numeric not null default 0.75
    check (confidence >= 0 and confidence <= 1),
  priority text not null default 'medium'
    check (priority in ('critical','high','medium','low')),
  approval_status text not null default 'needs_review'
    check (approval_status in ('needs_review','approved','rejected','completed','snoozed','archived')),
  route text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists local_visibility_recommendations_status_idx
  on public.local_visibility_recommendations (approval_status, priority, updated_at desc);

create table if not exists public.local_visibility_alerts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  local_visibility_business_id uuid references public.local_visibility_businesses(id) on delete cascade,
  alert_type text not null
    check (alert_type in ('negative_review','unanswered_review','listing_issue','profile_gap','competitor_movement','review_drop','local_seo_gap')),
  title text not null,
  detail text not null,
  severity text not null default 'medium'
    check (severity in ('critical','high','medium','low')),
  status text not null default 'open'
    check (status in ('open','needs_review','resolved','ignored','archived')),
  recommended_action text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists local_visibility_alerts_status_idx
  on public.local_visibility_alerts (status, severity, updated_at desc);

create table if not exists public.local_visibility_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  local_visibility_business_id uuid references public.local_visibility_businesses(id) on delete cascade,
  report_type text not null default 'weekly'
    check (report_type in ('daily','weekly','monthly','scan')),
  period_start date,
  period_end date,
  visibility_score integer,
  trust_score integer,
  listings_score integer,
  review_momentum_score integer,
  summary text not null,
  wins jsonb not null default '[]'::jsonb,
  risks jsonb not null default '[]'::jsonb,
  next_actions jsonb not null default '[]'::jsonb,
  approval_status text not null default 'draft'
    check (approval_status in ('draft','needs_review','approved','sent','archived')),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists local_visibility_reports_business_idx
  on public.local_visibility_reports (local_visibility_business_id, created_at desc);

alter table public.local_visibility_businesses enable row level security;
alter table public.local_visibility_scans enable row level security;
alter table public.local_visibility_reviews enable row level security;
alter table public.local_visibility_review_requests enable row level security;
alter table public.local_visibility_listing_checks enable row level security;
alter table public.local_visibility_recommendations enable row level security;
alter table public.local_visibility_alerts enable row level security;
alter table public.local_visibility_reports enable row level security;

revoke all on table
  public.local_visibility_businesses,
  public.local_visibility_scans,
  public.local_visibility_reviews,
  public.local_visibility_review_requests,
  public.local_visibility_listing_checks,
  public.local_visibility_recommendations,
  public.local_visibility_alerts,
  public.local_visibility_reports
from anon, authenticated;

grant all on table
  public.local_visibility_businesses,
  public.local_visibility_scans,
  public.local_visibility_reviews,
  public.local_visibility_review_requests,
  public.local_visibility_listing_checks,
  public.local_visibility_recommendations,
  public.local_visibility_alerts,
  public.local_visibility_reports
to service_role;

grant select on table
  public.local_visibility_businesses,
  public.local_visibility_scans,
  public.local_visibility_reviews,
  public.local_visibility_review_requests,
  public.local_visibility_listing_checks,
  public.local_visibility_recommendations,
  public.local_visibility_alerts,
  public.local_visibility_reports
to authenticated;

drop policy if exists "local_visibility_businesses_service" on public.local_visibility_businesses;
create policy "local_visibility_businesses_service"
  on public.local_visibility_businesses for all to service_role
  using (true)
  with check (true);

drop policy if exists "local_visibility_scans_service" on public.local_visibility_scans;
create policy "local_visibility_scans_service"
  on public.local_visibility_scans for all to service_role
  using (true)
  with check (true);

drop policy if exists "local_visibility_reviews_service" on public.local_visibility_reviews;
create policy "local_visibility_reviews_service"
  on public.local_visibility_reviews for all to service_role
  using (true)
  with check (true);

drop policy if exists "local_visibility_review_requests_service" on public.local_visibility_review_requests;
create policy "local_visibility_review_requests_service"
  on public.local_visibility_review_requests for all to service_role
  using (true)
  with check (true);

drop policy if exists "local_visibility_listing_checks_service" on public.local_visibility_listing_checks;
create policy "local_visibility_listing_checks_service"
  on public.local_visibility_listing_checks for all to service_role
  using (true)
  with check (true);

drop policy if exists "local_visibility_recommendations_service" on public.local_visibility_recommendations;
create policy "local_visibility_recommendations_service"
  on public.local_visibility_recommendations for all to service_role
  using (true)
  with check (true);

drop policy if exists "local_visibility_alerts_service" on public.local_visibility_alerts;
create policy "local_visibility_alerts_service"
  on public.local_visibility_alerts for all to service_role
  using (true)
  with check (true);

drop policy if exists "local_visibility_reports_service" on public.local_visibility_reports;
create policy "local_visibility_reports_service"
  on public.local_visibility_reports for all to service_role
  using (true)
  with check (true);

drop policy if exists "local_visibility_businesses_admin_read" on public.local_visibility_businesses;
create policy "local_visibility_businesses_admin_read"
  on public.local_visibility_businesses for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');

drop policy if exists "local_visibility_scans_admin_read" on public.local_visibility_scans;
create policy "local_visibility_scans_admin_read"
  on public.local_visibility_scans for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');

drop policy if exists "local_visibility_reviews_admin_read" on public.local_visibility_reviews;
create policy "local_visibility_reviews_admin_read"
  on public.local_visibility_reviews for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');

drop policy if exists "local_visibility_review_requests_admin_read" on public.local_visibility_review_requests;
create policy "local_visibility_review_requests_admin_read"
  on public.local_visibility_review_requests for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');

drop policy if exists "local_visibility_listing_checks_admin_read" on public.local_visibility_listing_checks;
create policy "local_visibility_listing_checks_admin_read"
  on public.local_visibility_listing_checks for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');

drop policy if exists "local_visibility_recommendations_admin_read" on public.local_visibility_recommendations;
create policy "local_visibility_recommendations_admin_read"
  on public.local_visibility_recommendations for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');

drop policy if exists "local_visibility_alerts_admin_read" on public.local_visibility_alerts;
create policy "local_visibility_alerts_admin_read"
  on public.local_visibility_alerts for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');

drop policy if exists "local_visibility_reports_admin_read" on public.local_visibility_reports;
create policy "local_visibility_reports_admin_read"
  on public.local_visibility_reports for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');
;
