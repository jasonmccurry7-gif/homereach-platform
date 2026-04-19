-- ─────────────────────────────────────────────────────────────────────────────
-- HomeReach Migration 055 — Content Intelligence: Source Priority + Competitors
--
-- PART A: Extends ci_trusted_channels with: channel_url, specialty, last_used,
--         performance_score (1-10, learned), active_flag.
-- PART B: Adds ci_competitor_sources + ci_competitor_insights for
--         competitor intelligence ingestion (YouTube-only in V1).
--
-- ALL CHANGES ARE ADDITIVE. Existing columns and data are untouched.
-- SAFE TO RE-RUN.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── PART A: extend ci_trusted_channels ───────────────────────────────────────
alter table ci_trusted_channels add column if not exists channel_url       text;
alter table ci_trusted_channels add column if not exists specialty         text;        -- 'sales', 'ads', 'retention', 'pricing', etc.
alter table ci_trusted_channels add column if not exists last_used         timestamptz;
alter table ci_trusted_channels add column if not exists performance_score numeric(3,1) not null default 5.0
  check (performance_score between 1.0 and 10.0);
alter table ci_trusted_channels add column if not exists active_flag       boolean not null default true;

create index if not exists ci_trusted_channels_perf_idx
  on ci_trusted_channels (active_flag, performance_score desc);

-- ── PART B: ci_competitor_sources ────────────────────────────────────────────
create table if not exists ci_competitor_sources (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  category            text not null default '*',
  competitor_type     text check (competitor_type in
                        ('agency','software','brand','franchise','direct_mail','lead_gen','other')),
  content_source      text[] not null default array['youtube'],  -- 'youtube' | 'blog' | 'ads' (future)
  youtube_channel_id  text,
  youtube_handle      text,                                       -- e.g. '@SomeCompetitor'
  blog_url            text,                                       -- V2 when scraper lands
  priority_score      int  not null default 5 check (priority_score between 1 and 10),
  performance_score   numeric(3,1) not null default 5.0 check (performance_score between 1.0 and 10.0),
  active_flag         boolean not null default true,
  notes               text,
  last_ingested_at    timestamptz,
  created_at          timestamptz not null default now(),
  unique (name, category)
);
create index if not exists ci_competitor_sources_active_idx
  on ci_competitor_sources (active_flag, priority_score desc);

-- ── PART B: ci_competitor_insights ───────────────────────────────────────────
create table if not exists ci_competitor_insights (
  id               uuid primary key default gen_random_uuid(),
  competitor_id    uuid references ci_competitor_sources(id) on delete cascade,
  competitor_name  text not null,  -- denormalized for easy display
  category         text not null,
  insight_type     text not null check (insight_type in
                     ('offer','messaging','funnel','pricing','positioning','tactic')),
  insight_text     text not null,
  rationale        text,
  source_url       text,
  source_video_id  text references ci_ingestion_queue(video_id) on delete set null,
  revenue_score    int check (revenue_score   between 1 and 5),
  speed_score      int check (speed_score     between 1 and 5),
  ease_score       int check (ease_score      between 1 and 5),
  advantage_score  int check (advantage_score between 1 and 5),
  apex_score       int generated always as
                     (coalesce(revenue_score,0)+coalesce(speed_score,0)+
                      coalesce(ease_score,0)+coalesce(advantage_score,0)) stored,
  status           text not null default 'pending'
                   check (status in ('pending','approved','rejected','archived')),
  created_at       timestamptz not null default now()
);
create index if not exists ci_competitor_insights_apex_idx
  on ci_competitor_insights (apex_score desc, created_at desc);
create index if not exists ci_competitor_insights_cat_idx
  on ci_competitor_insights (category, created_at desc);

-- ── RLS: admin-only (service-role bypasses) ──────────────────────────────────
alter table ci_competitor_sources  enable row level security;
alter table ci_competitor_insights enable row level security;

drop policy if exists ci_competitor_sources_admin_all on ci_competitor_sources;
create policy ci_competitor_sources_admin_all on ci_competitor_sources for all
  using  (exists (select 1 from profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

drop policy if exists ci_competitor_insights_admin_all on ci_competitor_insights;
create policy ci_competitor_insights_admin_all on ci_competitor_insights for all
  using  (exists (select 1 from profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
