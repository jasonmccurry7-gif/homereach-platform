-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 12_discount_eligibility.sql
-- Phase 4: Fix Starter bundle price (migration 09 incorrectly set $400 → correct is $275)
-- Phase 5: Add server-side discount eligibility columns to businesses and cities
--
-- Run after: 09_bundles_pricing_profile.sql, 11_pricing_constraints.sql
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── Phase 4: Correct Starter bundle price ─────────────────────────────────────
--
-- Locked pricing model (Task 20):
--   Back/Starter  → $275/month standard  ($200 founding)
--   Front/Growth  → $600/month standard  ($350 founding — NOT corrected here, was OK)
--   Anchor/Authority → $900/month
--   Ambassador    → $3000/month
--
-- Migration 09 incorrectly set 'Bundle — Starter Monthly' to $400 ($40,000 cents).
-- The locked model requires $275 ($27,500 cents).
--
UPDATE pricing_profiles
  SET base_price_cents = 27500,
      updated_at       = NOW()
  WHERE name = 'Bundle — Starter Monthly'
    AND base_price_cents != 27500;

-- bundles.price (display only) must match the pricing profile base price
UPDATE bundles
  SET price = '275.00'
  WHERE slug = 'starter'
    AND price::numeric != 275.00;

-- ── Phase 5: Military verification flag on businesses ─────────────────────────
--
-- Admin-controlled. Set to TRUE only after verifying proof of service.
-- When TRUE, the military discount rule (discount_rules) fires at checkout.
-- Client CANNOT set this — checkout route reads it from the DB.
--
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS is_military BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS military_verified_at TIMESTAMPTZ;

COMMENT ON COLUMN businesses.is_military IS
  'Admin-set. TRUE if the business owner is a verified active duty, veteran, or military spouse. '
  'When TRUE, military discount applies at checkout. '
  'NEVER trust a client-sent is_military flag — always read from this column.';

COMMENT ON COLUMN businesses.military_verified_at IS
  'Timestamp when military status was manually verified by a HomeReach admin. '
  'NULL means not yet verified (is_military should also be FALSE).';

CREATE INDEX IF NOT EXISTS idx_businesses_is_military
  ON businesses (is_military)
  WHERE is_military = TRUE;

-- ── Phase 5: Founding cohort flag on cities ───────────────────────────────────
--
-- When TRUE, all new businesses in this city qualify for founding_price_cents.
-- Admin sets this to FALSE when the founding cohort is full.
-- Checkout route reads this column — client CANNOT claim founding status.
--
ALTER TABLE cities
  ADD COLUMN IF NOT EXISTS founding_eligible BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN cities.founding_eligible IS
  'When TRUE, businesses signing up in this city receive founding_price_cents rates. '
  'Set to FALSE once the founding cohort is full. '
  'Checkout route reads this value — client isFounding param is IGNORED.';

CREATE INDEX IF NOT EXISTS idx_cities_founding_eligible
  ON cities (founding_eligible)
  WHERE founding_eligible = TRUE;

COMMIT;
