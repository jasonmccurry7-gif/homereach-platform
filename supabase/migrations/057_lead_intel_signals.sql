-- ─────────────────────────────────────────────────────────────────────────────
-- HomeReach Migration 057 — Lead Intelligence: Signal Scoring
--
-- Adds three additive columns to the EXISTING leads table:
--   • signal_score             — int 0..20, computed by the scorer
--   • signal_tier              — 'high' | 'medium' | 'low' | null
--   • signal_score_computed_at — timestamp of last scoring run
--
-- Does NOT modify existing columns. Does NOT change any RLS.
-- Gated at runtime by ENABLE_LEAD_INTEL. Safe to apply before the flag flips on.
--
-- SAFE TO RE-RUN.
-- ─────────────────────────────────────────────────────────────────────────────

-- Add columns additively — defensive `add if not exists` guards against
-- any drift between what this migration assumes and the live schema.
alter table leads add column if not exists signal_score             int;
alter table leads add column if not exists signal_tier              text
  check (signal_tier is null or signal_tier in ('high','medium','low'));
alter table leads add column if not exists signal_score_computed_at timestamptz;

-- Partial index: only the high-tier rows get indexed (small subset).
create index if not exists leads_signal_tier_high_idx
  on leads (signal_tier, signal_score desc)
  where signal_tier = 'high';

-- Full-index for score ranking (supports 'top N by score' queries).
create index if not exists leads_signal_score_idx
  on leads (signal_score desc)
  where signal_score is not null;
