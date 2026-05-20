-- ─────────────────────────────────────────────────────────────────────────────
-- HomeReach Migration 056 — Content Intelligence: Market Signals
--
-- Adds:
--   • ci_market_signals — storm / seasonal / trend rows from NOAA (V1) and
--                         future seasonal/permit sources.
--   • ci_ingestion_rules.service_states — list of state codes to poll NOAA for.
--
-- All additive. Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Extend ingestion rules with service states ───────────────────────────────
alter table ci_ingestion_rules
  add column if not exists service_states text[] not null default array['OH'];

-- ── ci_market_signals: observed external demand triggers ─────────────────────
create table if not exists ci_market_signals (
  id                uuid primary key default gen_random_uuid(),
  signal_type       text not null check (signal_type in
                      ('storm','seasonal','permit','trend')),
  category          text not null,          -- affected HomeReach category
  location          text,                    -- e.g. 'OH' or 'Wayne County, OH'
  severity          text,                    -- NOAA severity: Minor/Moderate/Severe/Extreme
  intensity_score   int not null default 3 check (intensity_score between 1 and 5),
  headline          text not null,
  description       text,
  source            text not null,          -- 'noaa' | 'seasonal_calendar' | ...
  source_id         text,                    -- external id for dedup
  effective_at      timestamptz,             -- when the real-world event starts
  expires_at        timestamptz,             -- when it stops being relevant
  raw               jsonb,                   -- raw payload for audit
  created_at        timestamptz not null default now(),
  unique (source, source_id)
);
create index if not exists ci_market_signals_active_idx
  on ci_market_signals (category, expires_at desc);
create index if not exists ci_market_signals_type_idx
  on ci_market_signals (signal_type, created_at desc);

-- ── RLS: admin-only (service-role bypasses) ──────────────────────────────────
alter table ci_market_signals enable row level security;

drop policy if exists ci_market_signals_admin_all on ci_market_signals;
create policy ci_market_signals_admin_all on ci_market_signals for all
  using  (exists (select 1 from profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- Agents can SELECT active (non-expired) signals — useful for dashboards
drop policy if exists ci_market_signals_agent_read on ci_market_signals;
create policy ci_market_signals_agent_read on ci_market_signals for select
  using (expires_at is null or expires_at > now());
