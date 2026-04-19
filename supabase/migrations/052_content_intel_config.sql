-- ─────────────────────────────────────────────────────────────────────────────
-- HomeReach Migration 052 — Content Intelligence: Config Tables
--
-- NEW tables, all prefixed `ci_`. Does NOT modify any table from 001..051.
-- Gated at runtime by ENABLE_CONTENT_INTEL; safe to apply before the flag
-- is flipped on.
--
-- SAFE TO RE-RUN: uses `create table if not exists` and `on conflict` seeds.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── ci_category_topics: per-category YouTube search terms ────────────────────
create table if not exists ci_category_topics (
  id               uuid primary key default gen_random_uuid(),
  category         text not null,
  search_term      text not null,
  priority_score   int  not null default 3 check (priority_score between 1 and 5),
  active_flag      boolean not null default true,
  created_at       timestamptz not null default now(),
  unique (category, search_term)
);
create index if not exists ci_category_topics_cat_idx on ci_category_topics (category, active_flag);

-- ── ci_trusted_channels: forced-include channels with trust weighting ────────
-- NOTE: `category` defaults to '*' (meaning "all categories") so we can use a
--       plain composite unique constraint instead of an expression-based one.
create table if not exists ci_trusted_channels (
  id               uuid primary key default gen_random_uuid(),
  channel_name     text not null,
  channel_id       text,                    -- YouTube UC... id; resolvable later
  category         text not null default '*', -- '*' = applies to all categories
  trust_score      int  not null default 3 check (trust_score between 1 and 5),
  force_include    boolean not null default false,
  translate_saas   boolean not null default false, -- Dan Martell flavor
  notes            text,
  created_at       timestamptz not null default now(),
  unique (channel_name, category)
);
create index if not exists ci_trusted_channels_force_idx on ci_trusted_channels (force_include) where force_include = true;

-- ── ci_ingestion_rules: global pipeline knobs (single row pattern) ───────────
create table if not exists ci_ingestion_rules (
  id                    text primary key,
  min_recency_days      int  not null default 60 check (min_recency_days between 30 and 90),
  max_videos_per_cat    int  not null default 3  check (max_videos_per_cat between 2 and 3),
  min_relevance_score   numeric(3,1) not null default 3.5,
  require_transcript    boolean not null default true,
  daily_video_cap       int  not null default 15,
  exclude_keywords      text[] not null default array[
    'compilation','top 10','reaction','prank','shorts compilation','funniest'
  ],
  updated_at            timestamptz not null default now()
);

-- ── ci_theme_performance_memory: learned weights per (category, theme) ───────
create table if not exists ci_theme_performance_memory (
  id              uuid primary key default gen_random_uuid(),
  category        text not null,
  theme           text not null,
  usage_count     int  not null default 0,
  win_count       int  not null default 0,
  fail_count      int  not null default 0,
  avg_apex_score  numeric(4,2),
  weight          numeric(4,2) not null default 1.0,
  last_seen_at    timestamptz,
  created_at      timestamptz not null default now(),
  unique (category, theme)
);
create index if not exists ci_theme_perf_weight_idx on ci_theme_performance_memory (category, weight desc);

-- ── RLS: admin-only read/write (service-role bypasses RLS) ───────────────────
alter table ci_category_topics         enable row level security;
alter table ci_trusted_channels        enable row level security;
alter table ci_ingestion_rules         enable row level security;
alter table ci_theme_performance_memory enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'ci_category_topics','ci_trusted_channels','ci_ingestion_rules','ci_theme_performance_memory'
  ]
  loop
    execute format('drop policy if exists %I_admin_all on %I', t, t);
    execute format(
      'create policy %I_admin_all on %I for all
         using (exists (select 1 from profiles where id = auth.uid() and role = ''admin''))
         with check (exists (select 1 from profiles where id = auth.uid() and role = ''admin''))',
      t, t
    );
  end loop;
end$$;

-- ── Seeds ────────────────────────────────────────────────────────────────────

-- Default ingestion rules (single row, id='default')
insert into ci_ingestion_rules (id) values ('default')
on conflict (id) do nothing;

-- Dan Martell forced-include + SaaS→services translation
insert into ci_trusted_channels (channel_name, channel_id, category, trust_score, force_include, translate_saas, notes)
values
  ('Dan Martell',         null, '*', 5, true, true, 'Force include each run; translate SaaS insights to local-services context'),
  ('Dan Martell (guest)', null, '*', 4, true, true, 'Podcast/guest appearances where Dan Martell is featured')
on conflict (channel_name, category) do nothing;

-- 6 HomeReach service verticals × ~5 search terms each (rotated by pipeline)
insert into ci_category_topics (category, search_term, priority_score) values
  -- pressure washing
  ('pressure_washing', 'pressure washing sales script',            5),
  ('pressure_washing', 'pressure washing pricing guide 2026',      5),
  ('pressure_washing', 'pressure washing upsell techniques',       4),
  ('pressure_washing', 'pressure washing lead generation',         4),
  ('pressure_washing', 'pressure washing closing objections',      4),
  -- lawn care
  ('lawn_care',        'lawn care sales pitch door to door',       5),
  ('lawn_care',        'lawn care pricing strategy',               5),
  ('lawn_care',        'lawn care customer retention',             4),
  ('lawn_care',        'lawn care lead magnet',                    4),
  ('lawn_care',        'lawn care referral program',               4),
  -- window cleaning
  ('window_cleaning',  'window cleaning sales script',             5),
  ('window_cleaning',  'window cleaning pricing',                  5),
  ('window_cleaning',  'window cleaning lead generation',          4),
  ('window_cleaning',  'window cleaning upsell',                   4),
  ('window_cleaning',  'window cleaning close rate',               3),
  -- gutter cleaning
  ('gutter_cleaning',  'gutter cleaning sales pitch',              5),
  ('gutter_cleaning',  'gutter cleaning pricing model',            5),
  ('gutter_cleaning',  'gutter cleaning leads facebook',           4),
  ('gutter_cleaning',  'gutter cleaning upsell roof',              4),
  ('gutter_cleaning',  'gutter cleaning customer acquisition',     3),
  -- pest control
  ('pest_control',     'pest control sales script',                5),
  ('pest_control',     'pest control recurring revenue',           5),
  ('pest_control',     'pest control door to door tips',           4),
  ('pest_control',     'pest control pricing strategy',            4),
  ('pest_control',     'pest control retention',                   4),
  -- roofing
  ('roofing',          'roofing sales pitch storm',                5),
  ('roofing',          'roofing lead generation 2026',             5),
  ('roofing',          'roofing closing techniques',               4),
  ('roofing',          'roofing door knocking script',             4),
  ('roofing',          'roofing insurance claim process',          4)
on conflict (category, search_term) do nothing;
