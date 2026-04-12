-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 05_discount_rules.sql
-- Creates discount_rules table and seeds the two active discount rules.
--
-- Run after: 04_pricing_profiles.sql
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TYPE discount_rule_type AS ENUM (
  'military',
  'multi_spot',
  'promo_code',
  'future_reserved'
);

CREATE TABLE discount_rules (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT        NOT NULL,
  rule_type      discount_rule_type NOT NULL,
  description    TEXT        NOT NULL,
  discount_pct   NUMERIC(5,2) CHECK (discount_pct >= 0 AND discount_pct <= 100),
  discount_cents INTEGER      CHECK (discount_cents >= 0),
  conditions     JSONB       NOT NULL DEFAULT '{}',
  effect         JSONB       NOT NULL DEFAULT '{}',
  priority       INTEGER     NOT NULL DEFAULT 100,
  stackable      BOOLEAN     NOT NULL DEFAULT FALSE,
  is_active      BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dr_rule_type ON discount_rules (rule_type);
CREATE INDEX idx_dr_priority  ON discount_rules (priority);
CREATE INDEX idx_dr_is_active ON discount_rules (is_active) WHERE is_active = TRUE;

CREATE TRIGGER trg_discount_rules_updated_at
  BEFORE UPDATE ON discount_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Seed: Active discount rules ────────────────────────────────────────────

INSERT INTO discount_rules
  (name, rule_type, description, discount_pct, priority, stackable, conditions, effect)
VALUES
  (
    'Military — 10% Off',
    'military',
    'Active duty, veteran, or military spouse. 10% off the working price after founding/bundle resolution. Not stackable — stops further discount processing.',
    10.00,
    10,     -- lowest priority number = applied first
    false,  -- not stackable: military discount is the only discount that fires
    '{"requires_verified_military": true}',
    '{"discount_type": "percentage", "apply_to": "base_price", "label": "Military Discount"}'
  ),
  (
    'Multi-Spot — 10% Off Additional Spots',
    'multi_spot',
    '10% off each spot beyond the first in a single checkout session. Stackable — can combine with military on additional spots.',
    10.00,
    20,    -- applied after military (priority 10)
    true,  -- stackable: multi-spot can combine with military
    '{"min_spots_in_cart": 2}',
    '{"discount_type": "percentage", "apply_to": "additional_spots_only", "label": "Multi-Spot Discount"}'
  );

COMMIT;
