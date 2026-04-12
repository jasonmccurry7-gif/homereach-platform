-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 09_bundles_pricing_profile.sql
-- Adds pricing_profile_id FK to bundles and links existing bundles to profiles.
--
-- Run after: 04_pricing_profiles.sql (pricing_profiles table must exist)
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE bundles
  ADD COLUMN pricing_profile_id UUID REFERENCES pricing_profiles(id) ON DELETE SET NULL;

CREATE INDEX idx_bundles_pricing_profile
  ON bundles (pricing_profile_id)
  WHERE pricing_profile_id IS NOT NULL;

-- ── Link existing bundles to their pricing profiles ─────────────────────────
-- Matches by bundle slug to pricing profile name.
-- New pricing model amounts (replacing legacy $997/$597/$297 seed prices).

UPDATE bundles SET pricing_profile_id = (
  SELECT id FROM pricing_profiles WHERE name = 'Bundle — Starter Monthly' AND is_active = TRUE LIMIT 1
) WHERE slug = 'starter';

UPDATE bundles SET pricing_profile_id = (
  SELECT id FROM pricing_profiles WHERE name = 'Bundle — Growth Monthly' AND is_active = TRUE LIMIT 1
) WHERE slug = 'growth';

UPDATE bundles SET pricing_profile_id = (
  SELECT id FROM pricing_profiles WHERE name = 'Bundle — Authority Monthly' AND is_active = TRUE LIMIT 1
) WHERE slug = 'authority';

UPDATE bundles SET pricing_profile_id = (
  SELECT id FROM pricing_profiles WHERE name = 'Bundle — Ambassador Monthly' AND is_active = TRUE LIMIT 1
) WHERE slug = 'ambassador';

-- ── Update bundles.price to reflect new pricing model ──────────────────────
-- bundles.price is now DISPLAY ONLY but must match the pricing profile
-- to avoid confusing the admin UI until full pricing engine is integrated.
-- Legacy values: $997/$597/$297 → New values: $900/$350/$275 (standard rates).
-- NOTE: The founding cohort prices ($600/$250/$200) are in pricing_profiles.
--       bundles.price shows the standard (non-founding) price for display.

UPDATE bundles SET price = '400.00'  WHERE slug = 'starter';
UPDATE bundles SET price = '600.00'  WHERE slug = 'growth';
UPDATE bundles SET price = '900.00'  WHERE slug = 'authority';
UPDATE bundles SET price = '3000.00' WHERE slug = 'ambassador';

COMMENT ON COLUMN bundles.pricing_profile_id IS
  'Links this bundle to its pricing_profiles record. '
  'When set, pricing engine uses this profile price for billing (not bundles.price). '
  'bundles.price is DISPLAY ONLY after Task 20.';

COMMIT;
