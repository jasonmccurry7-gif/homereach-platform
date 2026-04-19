-- ─────────────────────────────────────────────────────────────────────────────
-- HomeReach Migration 053 — Content Intelligence: Pipeline Tables
--
-- Stores: ingestion queue → insights → downstream execution artifacts
-- (actions / scripts / offers / automations / enhancements) + learned patterns.
--
-- All tables `ci_`-prefixed. Admin-only RLS.
-- SAFE TO RE-RUN.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── ci_ingestion_queue: one row per YouTube video ever fetched ───────────────
create table if not exists ci_ingestion_queue (
  video_id           text primary key,            -- YouTube video id (dedup)
  title              text not null,
  description        text,
  channel_id         text,
  channel_name       text,
  category           text not null,
  published_at       timestamptz,
  relevance_score    numeric(3,1),                -- 1..5, from scorer
  channel_trust      int,                          -- 1..5 from ci_trusted_channels
  transcript         text,
  transcript_source  text,                         -- 'supadata' | 'yt_captions' | null
  status             text not null default 'pending'
                     check (status in ('pending','scored','transcribed','processed','skipped','failed')),
  skip_reason        text,
  is_forced_include  boolean not null default false,
  created_at         timestamptz not null default now(),
  processed_at       timestamptz
);
create index if not exists ci_iq_status_idx   on ci_ingestion_queue (status, created_at desc);
create index if not exists ci_iq_category_idx on ci_ingestion_queue (category, created_at desc);

-- ── ci_insights: atomic tactical takeaways extracted from transcripts ────────
create table if not exists ci_insights (
  id                uuid primary key default gen_random_uuid(),
  source_video_id   text not null references ci_ingestion_queue(video_id) on delete cascade,
  category          text not null,
  theme             text,                         -- canonical theme tag (sales/offer/retention/…)
  insight_text      text not null,
  rationale         text,
  -- APEX scoring (1..5 each, total 4..20; threshold ≥15 in filter)
  revenue_score     int check (revenue_score   between 1 and 5),
  speed_score       int check (speed_score     between 1 and 5),
  ease_score        int check (ease_score      between 1 and 5),
  advantage_score   int check (advantage_score between 1 and 5),
  apex_score        int generated always as
                      (coalesce(revenue_score,0)+coalesce(speed_score,0)+
                       coalesce(ease_score,0)+coalesce(advantage_score,0)) stored,
  is_translated     boolean not null default false, -- true = came from Dan Martell translator
  status            text not null default 'pending'
                    check (status in ('pending','approved','rejected','archived')),
  created_at        timestamptz not null default now()
);
create index if not exists ci_insights_cat_score_idx on ci_insights (category, apex_score desc);
create index if not exists ci_insights_status_idx    on ci_insights (status, created_at desc);

-- ── ci_actions: 1..3-step tactical actions ────────────────────────────────────
create table if not exists ci_actions (
  id             uuid primary key default gen_random_uuid(),
  insight_id     uuid references ci_insights(id) on delete set null,
  category       text not null,
  title          text not null,
  steps          jsonb not null,                  -- ["step 1", "step 2", ...]
  status         text not null default 'pending'
                 check (status in ('pending','win','neutral','failed','archived')),
  shown_count    int not null default 0,
  created_at     timestamptz not null default now()
);
create index if not exists ci_actions_status_idx on ci_actions (status, created_at desc);

-- ── ci_scripts: ready-to-send DM / SMS / Email / Call copy ───────────────────
create table if not exists ci_scripts (
  id             uuid primary key default gen_random_uuid(),
  insight_id     uuid references ci_insights(id) on delete set null,
  category       text not null,
  channel        text not null check (channel in ('dm','sms','email','call')),
  title          text not null,
  body           text not null,
  status         text not null default 'pending'
                 check (status in ('pending','win','neutral','failed','archived')),
  shown_count    int not null default 0,
  created_at     timestamptz not null default now()
);
create index if not exists ci_scripts_status_idx on ci_scripts (status, created_at desc);

-- ── ci_offers: improvement + supporting script ───────────────────────────────
create table if not exists ci_offers (
  id             uuid primary key default gen_random_uuid(),
  insight_id     uuid references ci_insights(id) on delete set null,
  category       text not null,
  title          text not null,
  improvement    text not null,
  supporting_script text,
  status         text not null default 'pending'
                 check (status in ('pending','win','neutral','failed','archived')),
  created_at     timestamptz not null default now()
);

-- ── ci_automations: trigger + action pairs (recommendations only) ────────────
create table if not exists ci_automations (
  id             uuid primary key default gen_random_uuid(),
  insight_id     uuid references ci_insights(id) on delete set null,
  category       text not null,
  title          text not null,
  trigger_desc   text not null,
  action_desc    text not null,
  status         text not null default 'pending'
                 check (status in ('pending','approved','rejected','archived')),
  created_at     timestamptz not null default now()
);

-- ── ci_enhancements: additive-only system suggestions ────────────────────────
create table if not exists ci_enhancements (
  id             uuid primary key default gen_random_uuid(),
  insight_id     uuid references ci_insights(id) on delete set null,
  category       text not null,
  title          text not null,
  description    text not null,
  kind           text not null check (kind in ('micro','system','strategic')),
  status         text not null default 'pending'
                 check (status in ('pending','approved','rejected','archived')),
  created_at     timestamptz not null default now()
);

-- ── ci_patterns: promoted winning themes used by the learning system ─────────
create table if not exists ci_patterns (
  id             uuid primary key default gen_random_uuid(),
  category       text not null,
  pattern        text not null,
  source_count   int not null default 1,
  win_count      int not null default 0,
  weight         numeric(4,2) not null default 1.0,
  created_at     timestamptz not null default now(),
  last_win_at    timestamptz,
  unique (category, pattern)
);

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table ci_ingestion_queue enable row level security;
alter table ci_insights         enable row level security;
alter table ci_actions          enable row level security;
alter table ci_scripts          enable row level security;
alter table ci_offers           enable row level security;
alter table ci_automations      enable row level security;
alter table ci_enhancements     enable row level security;
alter table ci_patterns         enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'ci_ingestion_queue','ci_insights','ci_actions','ci_scripts',
    'ci_offers','ci_automations','ci_enhancements','ci_patterns'
  ]
  loop
    execute format('drop policy if exists %I_admin_all on %I', t, t);
    execute format(
      'create policy %I_admin_all on %I for all
         using (exists (select 1 from profiles where id = auth.uid() and role = ''admin''))
         with check (exists (select 1 from profiles where id = auth.uid() and role = ''admin''))',
      t, t
    );
    -- Additionally allow authenticated agents to SELECT approved/pending execution artifacts
    if t in ('ci_actions','ci_scripts','ci_offers') then
      execute format('drop policy if exists %I_agent_read on %I', t, t);
      execute format(
        'create policy %I_agent_read on %I for select
           using (status in (''pending'',''win'',''neutral''))',
        t, t
      );
    end if;
  end loop;
end$$;
