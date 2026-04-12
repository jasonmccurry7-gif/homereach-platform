-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 13_idempotent_seed_upsert.sql
-- Phase 3: Full idempotent seed upsert for all pricing_profiles and discount_rules
--
-- This migration is safe to run multiple times (idempotent).
-- Uses ON CONFLICT (name) DO UPDATE to assert the canonical pricing values.
-- Any drift from manual edits is corrected on the next migration run.
--
-- Run after: 11_pricing_constraints.sql (requires name UNIQUE constraints)
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── Core Spots (monthly subscriptions) ───────────────────────────────────────

INSERT INTO pricing_profiles
  (name, product_type, spot_type, billing_interval,
   base_price_cents, founding_price_cents, compare_at_price_cents)
VALUES
  ('Global — Back Spot Monthly',   'spot', 'back_feature',  'monthly',  27500,  20000,  27500),
  ('Global — Front Spot Monthly',  'spot', 'front_feature', 'monthly',  35000,  25000,  35000),
  ('Global — Anchor Monthly',      'spot', 'anchor',        'monthly',  90000,  60000,  90000),
  ('Global — Full Card Monthly',   'spot', 'full_card',     'monthly', 350000, 250000, 350000)
ON CONFLICT (name) DO UPDATE SET
  base_price_cents       = EXCLUDED.base_price_cents,
  founding_price_cents   = EXCLUDED.founding_price_cents,
  compare_at_price_cents = EXCLUDED.compare_at_price_cents,
  is_active              = TRUE,
  updated_at             = NOW();

-- ── Add-ons ───────────────────────────────────────────────────────────────────

INSERT INTO pricing_profiles
  (name, product_type, billing_interval, base_price_cents)
VALUES
  ('Yard Signs — 10 Signs Monthly',  'addon', 'monthly',  30000),
  ('Yard Signs — 20 Signs Monthly',  'addon', 'monthly',  55000),
  ('Flyers — 2500 Qty',              'addon', 'one_time', 50000),
  ('Flyers — 5000 Qty',              'addon', 'one_time', 90000),
  ('Business Cards — 1000 Qty',      'addon', 'one_time', 25000),
  ('Premium Design',                 'addon', 'one_time', 15000),
  ('Magnet — Monthly (6 Mo Min)',    'addon', 'monthly',  30000),
  ('Calendar — Monthly (12 Mo Min)', 'addon', 'monthly',   7500)
ON CONFLICT (name) DO UPDATE SET
  base_price_cents = EXCLUDED.base_price_cents,
  is_active        = TRUE,
  updated_at       = NOW();

-- ── Automation Setup Fees ─────────────────────────────────────────────────────
-- Must be inserted before the automation monthly rows (FK dependency)

INSERT INTO pricing_profiles
  (name, product_type, billing_interval, base_price_cents)
VALUES
  ('Lead Capture — Setup Fee',       'setup_fee', 'one_time', 15000),
  ('Lead Conversion — Setup Fee',    'setup_fee', 'one_time', 30000),
  ('Revenue Automation — Setup Fee', 'setup_fee', 'one_time', 50000)
ON CONFLICT (name) DO UPDATE SET
  base_price_cents = EXCLUDED.base_price_cents,
  is_active        = TRUE,
  updated_at       = NOW();

-- ── Automation Monthly Subscriptions ─────────────────────────────────────────
-- setup_fee_profile_id linked via subquery — re-asserts FK on upsert

INSERT INTO pricing_profiles
  (name, product_type, billing_interval, base_price_cents, setup_fee_profile_id)
VALUES
  (
    'Lead Capture — Monthly', 'automation', 'monthly', 15000,
    (SELECT id FROM pricing_profiles WHERE name = 'Lead Capture — Setup Fee' LIMIT 1)
  ),
  (
    'Lead Conversion — Monthly', 'automation', 'monthly', 30000,
    (SELECT id FROM pricing_profiles WHERE name = 'Lead Conversion — Setup Fee' LIMIT 1)
  ),
  (
    'Revenue Automation — Monthly', 'automation', 'monthly', 50000,
    (SELECT id FROM pricing_profiles WHERE name = 'Revenue Automation — Setup Fee' LIMIT 1)
  )
ON CONFLICT (name) DO UPDATE SET
  base_price_cents     = EXCLUDED.base_price_cents,
  setup_fee_profile_id = EXCLUDED.setup_fee_profile_id,
  is_active            = TRUE,
  updated_at           = NOW();

-- ── Targeted Campaigns ────────────────────────────────────────────────────────

INSERT INTO pricing_profiles
  (name, product_type, billing_interval,
   base_price_cents, per_unit_price_cents_min, per_unit_price_cents_max, min_quantity)
VALUES
  ('Campaign — Standard',   'campaign', 'per_unit', 0,  70,  85, 2500),
  ('Campaign — Premium',    'campaign', 'per_unit', 0,  85, 110, 2500),
  ('Campaign — Saturation', 'campaign', 'per_unit', 0,  65,  75, 2500)
ON CONFLICT (name) DO UPDATE SET
  base_price_cents         = EXCLUDED.base_price_cents,
  per_unit_price_cents_min = EXCLUDED.per_unit_price_cents_min,
  per_unit_price_cents_max = EXCLUDED.per_unit_price_cents_max,
  min_quantity             = EXCLUDED.min_quantity,
  is_active                = TRUE,
  updated_at               = NOW();

INSERT INTO pricing_profiles
  (name, product_type, billing_interval, base_price_cents)
VALUES
  ('Campaign — Standard Setup Fee', 'campaign', 'one_time', 25000)
ON CONFLICT (name) DO UPDATE SET
  base_price_cents = EXCLUDED.base_price_cents,
  is_active        = TRUE,
  updated_at       = NOW();

-- ── Bundles ───────────────────────────────────────────────────────────────────
-- Starter = 27500 ($275) — corrected from erroneous $400 in migration 09

INSERT INTO pricing_profiles
  (name, product_type, billing_interval, base_price_cents)
VALUES
  ('Bundle — Starter Monthly',    'bundle', 'monthly',  27500),
  ('Bundle — Growth Monthly',     'bundle', 'monthly',  60000),
  ('Bundle — Authority Monthly',  'bundle', 'monthly',  90000),
  ('Bundle — Ambassador Monthly', 'bundle', 'monthly', 300000)
ON CONFLICT (name) DO UPDATE SET
  base_price_cents = EXCLUDED.base_price_cents,
  is_active        = TRUE,
  updated_at       = NOW();

-- ── Discount Rules ────────────────────────────────────────────────────────────

INSERT INTO discount_rules
  (name, rule_type, description, discount_pct, priority, stackable, conditions, effect)
VALUES
  (
    'Military — 10% Off',
    'military',
    'Active duty, veteran, or military spouse. 10% off the working price after founding/bundle resolution. Not stackable — stops further discount processing.',
    10.00, 10, FALSE,
    '{"requires_verified_military": true}',
    '{"discount_type": "percentage", "apply_to": "base_price", "label": "Military Discount"}'
  ),
  (
    'Multi-Spot — 10% Off Additional Spots',
    'multi_spot',
    '10% off each spot beyond the first in a single checkout session. Stackable — can combine with military on additional spots.',
    10.00, 20, TRUE,
    '{"min_spots_in_cart": 2}',
    '{"discount_type": "percentage", "apply_to": "additional_spots_only", "label": "Multi-Spot Discount"}'
  )
ON CONFLICT (name) DO UPDATE SET
  discount_pct = EXCLUDED.discount_pct,
  priority     = EXCLUDED.priority,
  stackable    = EXCLUDED.stackable,
  conditions   = EXCLUDED.conditions,
  effect       = EXCLUDED.effect,
  is_active    = TRUE,
  updated_at   = NOW();

COMMIT;
