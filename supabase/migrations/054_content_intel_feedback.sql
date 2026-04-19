-- ─────────────────────────────────────────────────────────────────────────────
-- HomeReach Migration 054 — Content Intelligence: Feedback & Learning
--
-- Records outcome events (win/neutral/fail) against any ci_ artifact and the
-- resulting weight deltas applied to channels / themes / topics.
--
-- This is the closed-loop layer. Pipeline consults ci_theme_performance_memory
-- and ci_trusted_channels.trust_score, both of which get nudged by the rollups
-- computed from this table.
--
-- SAFE TO RE-RUN.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── ci_outcome_events: every time an agent acts on an item ───────────────────
create table if not exists ci_outcome_events (
  id             uuid primary key default gen_random_uuid(),
  item_type      text not null check (item_type in
                   ('action','script','offer','automation','enhancement','insight')),
  item_id        uuid not null,
  outcome        text not null check (outcome in ('pending','win','neutral','failed')),
  agent_id       uuid,           -- nullable for admin-originated marks
  notes          text,
  created_at     timestamptz not null default now()
);
create index if not exists ci_outcome_item_idx on ci_outcome_events (item_type, item_id);
create index if not exists ci_outcome_recent_idx on ci_outcome_events (created_at desc);

-- ── ci_weight_deltas: append-only audit of learning adjustments ──────────────
create table if not exists ci_weight_deltas (
  id             uuid primary key default gen_random_uuid(),
  target_type    text not null check (target_type in ('channel','theme','topic','pattern')),
  target_key     text not null,  -- e.g. channel_name, "category::theme", or topic search_term
  delta          numeric(4,2) not null,
  reason         text not null,
  source_event_id uuid references ci_outcome_events(id) on delete set null,
  applied_at     timestamptz not null default now()
);
create index if not exists ci_weight_deltas_target_idx on ci_weight_deltas (target_type, target_key, applied_at desc);

-- ── Convenience view: rolled-up win/fail rates per item ──────────────────────
create or replace view ci_outcome_rollup as
select
  item_type,
  item_id,
  count(*) filter (where outcome = 'win')     as wins,
  count(*) filter (where outcome = 'neutral') as neutrals,
  count(*) filter (where outcome = 'failed')  as failures,
  count(*)                                    as total,
  max(created_at)                             as last_event_at
from ci_outcome_events
group by item_type, item_id;

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table ci_outcome_events enable row level security;
alter table ci_weight_deltas  enable row level security;

drop policy if exists ci_outcome_events_admin_all on ci_outcome_events;
create policy ci_outcome_events_admin_all on ci_outcome_events for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- Agents can insert their own outcome events (feedback from dashboard cards)
drop policy if exists ci_outcome_events_agent_insert on ci_outcome_events;
create policy ci_outcome_events_agent_insert on ci_outcome_events for insert
  with check (agent_id = auth.uid() or
              exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

drop policy if exists ci_weight_deltas_admin_all on ci_weight_deltas;
create policy ci_weight_deltas_admin_all on ci_weight_deltas for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
