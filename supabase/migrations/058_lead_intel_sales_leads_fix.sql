-- ─────────────────────────────────────────────────────────────────────────────
-- HomeReach Migration 058 — Lead Intelligence: Fix target table
--
-- Migration 057 mistakenly added signal_score columns to `leads` (the
-- targeted-mail intake table). The actual rich CRM leads live in
-- `sales_leads` (migration 20). This migration:
--   1. Adds signal_score / signal_tier / signal_score_computed_at to
--      `sales_leads` — the correct target.
--   2. Leaves the unused columns on `leads` as-is (dropping would require
--      dropping two indexes and isn't worth the risk; they're null-only).
--
-- All additions additive. SAFE TO RE-RUN.
-- ─────────────────────────────────────────────────────────────────────────────

alter table sales_leads add column if not exists signal_score             int;
alter table sales_leads add column if not exists signal_tier              text
  check (signal_tier is null or signal_tier in ('high','medium','low'));
alter table sales_leads add column if not exists signal_score_computed_at timestamptz;

create index if not exists sales_leads_signal_tier_high_idx
  on sales_leads (signal_tier, signal_score desc)
  where signal_tier = 'high';

create index if not exists sales_leads_signal_score_idx
  on sales_leads (signal_score desc)
  where signal_score is not null;
