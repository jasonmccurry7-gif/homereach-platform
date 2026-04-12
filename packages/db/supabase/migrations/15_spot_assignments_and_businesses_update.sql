-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 15 — spot_assignments + businesses.supabase_user_id
--
-- This is the root blocker for the entire revenue activation path.
-- Run this in Supabase SQL Editor FIRST, before any other Phase 1 work.
--
-- What this creates:
--   1. spot_assignments  — the inventory table for shared postcard spots
--   2. spot_assignment_status_enum — lifecycle states for a spot
--   3. UNIQUE partial index — enforces one active/pending business per city+category
--   4. businesses.supabase_user_id column — links business to Supabase auth user
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Spot assignment status enum ───────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE spot_assignment_status AS ENUM (
    'pending',    -- spot reserved at checkout start, payment not yet confirmed
    'active',     -- subscription paid and active
    'paused',     -- payment failed, grace period
    'churned',    -- subscription cancelled or lapsed — spot released
    'cancelled'   -- abandoned checkout or admin-cancelled — spot released
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── 2. Spot type enum (matches @homereach/types SpotType) ────────────────────

DO $$ BEGIN
  CREATE TYPE spot_type AS ENUM (
    'anchor',        -- main featured spot (most prominent)
    'front_feature', -- front of card feature position
    'back_feature',  -- back of card feature position
    'full_card'      -- exclusive full card (only one per mailing)
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── 3. spot_assignments table ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS spot_assignments (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Which business owns this spot
  business_id            UUID REFERENCES businesses(id) ON DELETE RESTRICT,

  -- Which market + category (both required — drives exclusivity index)
  city_id                UUID NOT NULL REFERENCES cities(id) ON DELETE RESTRICT,
  category_id            UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,

  -- What kind of spot was purchased
  spot_type              spot_type NOT NULL DEFAULT 'anchor',

  -- Lifecycle
  status                 spot_assignment_status NOT NULL DEFAULT 'pending',

  -- Stripe subscription identifiers (set when subscription.created fires)
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id     TEXT,

  -- Commitment tracking
  -- Set to activated_at + 90 days when subscription.created fires
  commitment_ends_at     TIMESTAMPTZ,
  activated_at           TIMESTAMPTZ,

  -- Churn tracking
  released_at            TIMESTAMPTZ,

  -- Pricing audit trail (cents)
  monthly_value_cents    INTEGER NOT NULL DEFAULT 0,

  -- Timestamps
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 4. Category exclusivity index ────────────────────────────────────────────
-- CRITICAL: This partial unique index makes double-booking physically impossible.
-- Only one pending or active spot_assignment can exist per city + category.
-- Churned and cancelled records are excluded — they allow re-selling the slot.

CREATE UNIQUE INDEX IF NOT EXISTS spot_assignments_city_category_exclusive
  ON spot_assignments (city_id, category_id)
  WHERE status IN ('pending', 'active');

-- ── 5. Supporting indexes ─────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_spot_assignments_business_id
  ON spot_assignments (business_id);

CREATE INDEX IF NOT EXISTS idx_spot_assignments_stripe_subscription_id
  ON spot_assignments (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_spot_assignments_status
  ON spot_assignments (status);

CREATE INDEX IF NOT EXISTS idx_spot_assignments_city_status
  ON spot_assignments (city_id, status);

-- ── 6. Add FK constraint to order_items.spot_assignment_id ───────────────────
-- The column was added in a prior migration with a comment noting the FK would
-- be added here once spot_assignments exists.

ALTER TABLE order_items
  ADD CONSTRAINT fk_order_items_spot_assignment
  FOREIGN KEY (spot_assignment_id)
  REFERENCES spot_assignments(id)
  ON DELETE SET NULL;

-- ── 7. businesses.supabase_user_id ───────────────────────────────────────────
-- Stores the Supabase auth user ID for the business owner after invite is accepted.
-- Set by the subscription.created webhook after calling inviteUserByEmail.

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS supabase_user_id TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_businesses_supabase_user_id
  ON businesses (supabase_user_id)
  WHERE supabase_user_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- Verification queries (run these after migration to confirm):
--
--   SELECT column_name FROM information_schema.columns
--     WHERE table_name = 'spot_assignments' ORDER BY ordinal_position;
--
--   SELECT indexname FROM pg_indexes WHERE tablename = 'spot_assignments';
--
--   SELECT column_name FROM information_schema.columns
--     WHERE table_name = 'businesses' AND column_name = 'supabase_user_id';
-- ─────────────────────────────────────────────────────────────────────────────
