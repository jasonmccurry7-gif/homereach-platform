-- HomeReach SEO Success Connectors
-- Additive measurement layer for the existing SEO Command Center.
-- This does not replace seo_pages, sitemaps, authority registry, GA4, or GSC.

create table if not exists public.seo_connector_statuses (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  label text not null,
  provider text not null default 'manual',
  status text not null default 'needs_credentials' check (
    status in ('connected','ready','needs_credentials','needs_data','warning','error','paused')
  ),
  last_sync_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  freshness_hours integer not null default 24,
  row_count integer not null default 0,
  configured_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.seo_search_console_daily (
  id uuid primary key default gen_random_uuid(),
  report_date date not null,
  page_path text not null,
  query text not null default '',
  country text not null default '',
  device text not null default '',
  clicks integer not null default 0,
  impressions integer not null default 0,
  ctr numeric(10,6) not null default 0,
  position numeric(10,2),
  source text not null default 'google_search_console',
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (report_date, page_path, query, country, device)
);
create table if not exists public.seo_page_analytics_daily (
  id uuid primary key default gen_random_uuid(),
  report_date date not null,
  page_path text not null,
  source text not null default 'organic',
  medium text not null default 'organic',
  sessions integer not null default 0,
  users_count integer not null default 0,
  engaged_sessions integer not null default 0,
  conversions integer not null default 0,
  leads integer not null default 0,
  proposals integer not null default 0,
  calls integer not null default 0,
  revenue_cents integer not null default 0,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (report_date, page_path, source, medium)
);
create table if not exists public.seo_rank_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null default current_date,
  page_path text not null,
  keyword text not null,
  location text not null default 'United States',
  device text not null default 'desktop',
  rank_position integer,
  previous_position integer,
  search_engine text not null default 'google',
  provider text not null default 'manual',
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (snapshot_date, page_path, keyword, location, device, search_engine)
);
create table if not exists public.seo_backlink_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null default current_date,
  page_path text not null default '',
  referring_domain text not null,
  source_url text not null,
  target_url text not null,
  domain_rating numeric(8,2),
  anchor_text text,
  first_seen date,
  last_seen date,
  link_status text not null default 'active' check (link_status in ('active','lost','nofollow','redirect','unknown')),
  provider text not null default 'manual',
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (snapshot_date, source_url, target_url)
);
create table if not exists public.seo_attribution_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  event_time timestamptz not null default now(),
  session_id text,
  anonymous_id text,
  user_id uuid references public.profiles(id) on delete set null,
  lead_id uuid,
  sales_lead_id uuid,
  related_record_type text,
  related_record_id uuid,
  landing_path text,
  page_path text,
  referrer text,
  source text,
  medium text,
  campaign text,
  term text,
  content text,
  seo_page_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists seo_connector_statuses_source_status_idx
  on public.seo_connector_statuses (source_key, status);
create index if not exists seo_search_console_daily_page_date_idx
  on public.seo_search_console_daily (page_path, report_date desc);
create index if not exists seo_search_console_daily_query_idx
  on public.seo_search_console_daily (query, report_date desc);
create index if not exists seo_page_analytics_daily_page_date_idx
  on public.seo_page_analytics_daily (page_path, report_date desc);
create index if not exists seo_rank_snapshots_keyword_date_idx
  on public.seo_rank_snapshots (keyword, snapshot_date desc);
create index if not exists seo_rank_snapshots_page_date_idx
  on public.seo_rank_snapshots (page_path, snapshot_date desc);
create index if not exists seo_backlink_snapshots_page_date_idx
  on public.seo_backlink_snapshots (page_path, snapshot_date desc);
create index if not exists seo_backlink_snapshots_domain_idx
  on public.seo_backlink_snapshots (referring_domain, snapshot_date desc);
create index if not exists seo_attribution_events_event_time_idx
  on public.seo_attribution_events (event_name, event_time desc);
create index if not exists seo_attribution_events_page_idx
  on public.seo_attribution_events (landing_path, page_path, event_time desc);
alter table public.seo_connector_statuses enable row level security;
alter table public.seo_search_console_daily enable row level security;
alter table public.seo_page_analytics_daily enable row level security;
alter table public.seo_rank_snapshots enable row level security;
alter table public.seo_backlink_snapshots enable row level security;
alter table public.seo_attribution_events enable row level security;
grant select, insert, update, delete on
  public.seo_connector_statuses,
  public.seo_search_console_daily,
  public.seo_page_analytics_daily,
  public.seo_rank_snapshots,
  public.seo_backlink_snapshots,
  public.seo_attribution_events
to authenticated;
grant all on
  public.seo_connector_statuses,
  public.seo_search_console_daily,
  public.seo_page_analytics_daily,
  public.seo_rank_snapshots,
  public.seo_backlink_snapshots,
  public.seo_attribution_events
to service_role;
drop policy if exists seo_connector_statuses_service_all on public.seo_connector_statuses;
create policy seo_connector_statuses_service_all on public.seo_connector_statuses
  for all to service_role using (true) with check (true);
drop policy if exists seo_connector_statuses_admin_all on public.seo_connector_statuses;
create policy seo_connector_statuses_admin_all on public.seo_connector_statuses
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
drop policy if exists seo_search_console_daily_service_all on public.seo_search_console_daily;
create policy seo_search_console_daily_service_all on public.seo_search_console_daily
  for all to service_role using (true) with check (true);
drop policy if exists seo_search_console_daily_admin_select on public.seo_search_console_daily;
create policy seo_search_console_daily_admin_select on public.seo_search_console_daily
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','sales_agent')));
drop policy if exists seo_page_analytics_daily_service_all on public.seo_page_analytics_daily;
create policy seo_page_analytics_daily_service_all on public.seo_page_analytics_daily
  for all to service_role using (true) with check (true);
drop policy if exists seo_page_analytics_daily_admin_select on public.seo_page_analytics_daily;
create policy seo_page_analytics_daily_admin_select on public.seo_page_analytics_daily
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','sales_agent')));
drop policy if exists seo_rank_snapshots_service_all on public.seo_rank_snapshots;
create policy seo_rank_snapshots_service_all on public.seo_rank_snapshots
  for all to service_role using (true) with check (true);
drop policy if exists seo_rank_snapshots_admin_select on public.seo_rank_snapshots;
create policy seo_rank_snapshots_admin_select on public.seo_rank_snapshots
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','sales_agent')));
drop policy if exists seo_backlink_snapshots_service_all on public.seo_backlink_snapshots;
create policy seo_backlink_snapshots_service_all on public.seo_backlink_snapshots
  for all to service_role using (true) with check (true);
drop policy if exists seo_backlink_snapshots_admin_select on public.seo_backlink_snapshots;
create policy seo_backlink_snapshots_admin_select on public.seo_backlink_snapshots
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','sales_agent')));
drop policy if exists seo_attribution_events_service_all on public.seo_attribution_events;
create policy seo_attribution_events_service_all on public.seo_attribution_events
  for all to service_role using (true) with check (true);
drop policy if exists seo_attribution_events_admin_select on public.seo_attribution_events;
create policy seo_attribution_events_admin_select on public.seo_attribution_events
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','sales_agent')));
drop policy if exists seo_attribution_events_authenticated_insert on public.seo_attribution_events;
create policy seo_attribution_events_authenticated_insert on public.seo_attribution_events
  for insert to authenticated with check (true);
insert into public.seo_connector_statuses (
  source_key,
  label,
  provider,
  status,
  freshness_hours,
  metadata
)
values
  (
    'google_search_console',
    'Google Search Console',
    'google',
    'needs_credentials',
    24,
    '{"needed_for":["indexed pages","queries","impressions","clicks","ctr","average position"],"setup":"Verify home-reach.com and submit /sitemap.xml plus /image-sitemap.xml."}'::jsonb
  ),
  (
    'analytics_attribution',
    'GA4 or Server Analytics',
    'google_analytics_or_server',
    'needs_credentials',
    24,
    '{"needed_for":["organic landing page attribution","lead events","proposal events","payment events","revenue attribution"],"setup":"Connect GA4 Data API or HomeReach server-side analytics events."}'::jsonb
  ),
  (
    'backlink_referring_domains',
    'Backlink and Referring Domains',
    'ahrefs_semrush_moz_dataforseo_or_import',
    'needs_credentials',
    168,
    '{"needed_for":["authority tracking","referring domains","lost links","proof opportunities"],"setup":"Connect Ahrefs, Semrush, Moz, DataForSEO, or approved CSV import."}'::jsonb
  ),
  (
    'rank_tracker',
    'Rank Tracker',
    'serpapi_or_dataforseo',
    'needs_credentials',
    24,
    '{"needed_for":["keyword positions","page movement","priority route monitoring"],"setup":"Connect SERP_API/SERPAPI_API_KEY or DataForSEO credentials."}'::jsonb
  )
on conflict (source_key) do update set
  label = excluded.label,
  provider = excluded.provider,
  freshness_hours = excluded.freshness_hours,
  metadata = public.seo_connector_statuses.metadata || excluded.metadata,
  updated_at = now();
