-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 04_pricing_profiles.sql
-- Creates the pricing_profiles table — root pricing authority for all billing.
--
-- Run after: 00, 01, 02, 03
-- Run before: 05_discount_rules.sql, 09_bundles_pricing_profile.sql
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── Enums ──────────────────────────────────────────────────────────────────

CREATE TYPE pricing_product_type AS ENUM (
  'spot',
  'addon',
  'automation',
  'bundle',
  'campaign',
  'setup_fee'
);

-- spot_type: defined here. Task 1 must check for existence before creating its own.
-- Use DO block guard in Task 1 migration: DO $$ BEGIN CREATE TYPE spot_type AS ENUM ...
-- EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TYPE spot_type AS ENUM (
  'anchor',
  'front_feature',
  'back_feature',
  'full_card'
);

CREATE TYPE billing_interval AS ENUM (
  'monthly',
  'one_time',
  'per_unit',
  'per_drop'
);

-- ── Table ──────────────────────────────────────────────────────────────────

CREATE TABLE pricing_profiles (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                     TEXT        NOT NULL,
  product_type             pricing_product_type NOT NULL,
  spot_type                spot_type,            -- NULL for non-spot products
  billing_interval         billing_interval NOT NULL,

  -- Amounts (US cents — never fractional)
  base_price_cents         INTEGER     NOT NULL DEFAULT 0 CHECK (base_price_cents >= 0),
  compare_at_price_cents   INTEGER     CHECK (compare_at_price_cents >= 0),
  founding_price_cents     INTEGER     CHECK (founding_price_cents >= 0),

  -- Per-unit pricing range (campaigns only)
  per_unit_price_cents_min INTEGER     CHECK (per_unit_price_cents_min >= 0),
  per_unit_price_cents_max INTEGER     CHECK (per_unit_price_cents_max >= 0),

  -- Quantity constraints
  min_quantity             INTEGER     CHECK (min_quantity > 0),
  max_quantity             INTEGER,

  -- Subscription term minimum (months)
  min_commitment_months    INTEGER     CHECK (min_commitment_months > 0),

  -- Mailer homes per drop — drives marketingCampaigns.homes_per_drop
  homes_per_drop           INTEGER     CHECK (homes_per_drop > 0),

  -- Self-referencing FK: automation monthly → its setup_fee profile
  setup_fee_profile_id     UUID        REFERENCES pricing_profiles(id) ON DELETE SET NULL,

  is_active                BOOLEAN     NOT NULL DEFAULT TRUE,
  effective_from           TIMESTAMPTZ,
  effective_until          TIMESTAMPTZ,
  metadata                 JSONB,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ────────────────────────────────────────────────────────────────

-- Standard lookup indexes
CREATE INDEX idx_pp_product_type      ON pricing_profiles (product_type);
CREATE INDEX idx_pp_billing_interval  ON pricing_profiles (billing_interval);
CREATE INDEX idx_pp_spot_type         ON pricing_profiles (spot_type) WHERE spot_type IS NOT NULL;
CREATE INDEX idx_pp_is_active         ON pricing_profiles (is_active)  WHERE is_active = TRUE;
CREATE INDEX idx_pp_setup_fee_profile ON pricing_profiles (setup_fee_profile_id)
  WHERE setup_fee_profile_id IS NOT NULL;

-- CRITICAL: Partial unique index to ensure deterministic resolution.
-- Only one active profile per (product_type, spot_type, billing_interval).
-- Inactive profiles are excluded — historical records are preserved.
-- Spot profiles: unique on (product_type, spot_type, billing_interval) WHERE spot_type IS NOT NULL
CREATE UNIQUE INDEX idx_pp_unique_spot_profile
  ON pricing_profiles (product_type, spot_type, billing_interval)
  WHERE is_active = TRUE AND spot_type IS NOT NULL;

-- Non-spot profiles: unique on (product_type, billing_interval) WHERE spot_type IS NULL AND name matters
-- We use name as part of the key for non-spot products because multiple addons/automations
-- can share the same product_type+billing_interval (e.g., Yard Signs 10 vs Yard Signs 20 are
-- both addon+monthly — differentiated by name).
-- For spot profiles the unique index above is sufficient.

-- ── Auto-update trigger ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_pricing_profiles_updated_at
  BEFORE UPDATE ON pricing_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Seed: All pricing profiles ─────────────────────────────────────────────
-- Insert all active pricing profiles for the HomeReach pricing model.
-- Amounts in US cents. Spot founding/standard pairs included.

-- CORE SPOTS — Monthly subscription
INSERT INTO pricing_profiles
  (name, product_type, spot_type, billing_interval, base_price_cents, founding_price_cents, compare_at_price_cents)
VALUES
  ('Global — Back Spot Monthly',   'spot', 'back_feature',  'monthly', 27500, 20000, 27500),
  ('Global — Front Spot Monthly',  'spot', 'front_feature', 'monthly', 35000, 25000, 35000),
  ('Global — Anchor Monthly',      'spot', 'anchor',        'monthly', 90000, 60000, 90000),
  ('Global — Full Card Monthly',   'spot', 'full_card',     'monthly', 350000, 250000, 350000);

-- ADD-ONS
INSERT INTO pricing_profiles
  (name, product_type, billing_interval, base_price_cents)
VALUES
  ('Yard Signs — 10 Signs Monthly', 'addon', 'monthly',  30000),
  ('Yard Signs — 20 Signs Monthly', 'addon', 'monthly',  55000),
  ('Flyers — 2500 Qty',             'addon', 'one_time', 50000),
  ('Flyers — 5000 Qty',             'addon', 'one_time', 90000),
  ('Business Cards — 1000 Qty',     'addon', 'one_time', 25000),
  ('Premium Design',                'addon', 'one_time', 15000);

-- MAGNET + CALENDAR (with min commitment months)
INSERT INTO pricing_profiles
  (name, product_type, billing_interval, base_price_cents, min_commitment_months)
VALUES
  ('Magnet — Monthly (6 Mo Min)',   'addon', 'monthly', 30000, 6),
  ('Calendar — Monthly (12 Mo Min)', 'addon', 'monthly', 7500, 12);

-- AUTOMATION — Setup fees first (so IDs exist for FK linkage below)
INSERT INTO pricing_profiles
  (name, product_type, billing_interval, base_price_cents)
VALUES
  ('Lead Capture — Setup Fee',          'setup_fee', 'one_time', 15000),
  ('Lead Conversion — Setup Fee',       'setup_fee', 'one_time', 30000),
  ('Revenue Automation — Setup Fee',    'setup_fee', 'one_time', 50000);

-- AUTOMATION — Monthly subscriptions (linked to setup fees)
INSERT INTO pricing_profiles
  (name, product_type, billing_interval, base_price_cents, setup_fee_profile_id)
VALUES
  ('Lead Capture — Monthly',       'automation', 'monthly', 15000,
    (SELECT id FROM pricing_profiles WHERE name = 'Lead Capture — Setup Fee')),
  ('Lead Conversion — Monthly',    'automation', 'monthly', 30000,
    (SELECT id FROM pricing_profiles WHERE name = 'Lead Conversion — Setup Fee')),
  ('Revenue Automation — Monthly', 'automation', 'monthly', 50000,
    (SELECT id FROM pricing_profiles WHERE name = 'Revenue Automation — Setup Fee'));

-- TARGETED CAMPAIGNS — Per-unit pricing
INSERT INTO pricing_profiles
  (name, product_type, billing_interval, base_price_cents, per_unit_price_cents_min, per_unit_price_cents_max, min_quantity)
VALUES
  ('Campaign — Standard',   'campaign', 'per_unit', 0, 70,  85,  2500),
  ('Campaign — Premium',    'campaign', 'per_unit', 0, 85,  110, 2500),
  ('Campaign — Saturation', 'campaign', 'per_unit', 0, 65,  75,  2500);

-- CAMPAIGN SETUP FEE
INSERT INTO pricing_profiles
  (name, product_type, billing_interval, base_price_cents)
VALUES
  ('Campaign — Standard Setup Fee', 'campaign', 'one_time', 25000);

-- BUNDLES — Monthly subscription
INSERT INTO pricing_profiles
  (name, product_type, billing_interval, base_price_cents)
VALUES
  ('Bundle — Starter Monthly',    'bundle', 'monthly',  40000),
  ('Bundle — Growth Monthly',     'bundle', 'monthly',  60000),
  ('Bundle — Authority Monthly',  'bundle', 'monthly',  90000),
  ('Bundle — Ambassador Monthly', 'bundle', 'monthly', 300000);

COMMIT;
