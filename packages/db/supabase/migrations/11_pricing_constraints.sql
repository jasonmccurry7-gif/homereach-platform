-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 11_pricing_constraints.sql
-- Phase 2: Idempotent broader unique constraint on pricing_profiles
-- Phase 3: Name uniqueness constraint (required for idempotent seed upsert)
--
-- Run after: 04_pricing_profiles.sql, 05_discount_rules.sql
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── Phase 2: Broader unique active index ──────────────────────────────────────
--
-- The existing idx_pp_unique_spot_profile enforces uniqueness only where
-- spot_type IS NOT NULL (spot products). This adds the spec-required broader
-- index that covers ALL product types.
--
-- IMPORTANT: In PostgreSQL, NULL != NULL in unique index comparisons.
-- This means multiple (addon, NULL, monthly) rows — e.g., "Yard Signs 10" and
-- "Yard Signs 20" — do NOT violate this constraint because their spot_type NULLs
-- are treated as distinct values. The index effectively enforces uniqueness only
-- for rows where spot_type IS NOT NULL, which is identical in outcome to the
-- existing partial index. Both constraints are kept: one documents the requirement
-- explicitly, the other serves as the enforcement guard.
--
CREATE UNIQUE INDEX IF NOT EXISTS pricing_profiles_unique_active
  ON pricing_profiles (product_type, spot_type, billing_interval)
  WHERE is_active = TRUE;

-- ── Phase 3: Name uniqueness constraint ──────────────────────────────────────
--
-- Required as the conflict target for idempotent seed upserts (migration 13).
-- Profile names are already unique across all seed data. This constraint
-- formalizes and enforces that invariant.
--
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pricing_profiles_name_unique'
      AND conrelid = 'pricing_profiles'::regclass
  ) THEN
    ALTER TABLE pricing_profiles
      ADD CONSTRAINT pricing_profiles_name_unique UNIQUE (name);
  END IF;
END $$;

-- ── Discount rules name constraint (required for migration 13 upserts) ────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'discount_rules_name_unique'
      AND conrelid = 'discount_rules'::regclass
  ) THEN
    ALTER TABLE discount_rules
      ADD CONSTRAINT discount_rules_name_unique UNIQUE (name);
  END IF;
END $$;

COMMIT;
