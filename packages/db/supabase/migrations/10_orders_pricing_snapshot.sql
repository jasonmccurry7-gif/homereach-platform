-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 10_orders_pricing_snapshot.sql
-- Adds pricing_snapshot_json (JSONB) to orders.
--
-- Stores the immutable PricingSnapshot written at checkout time.
-- This is the audit trail: what was the customer actually charged and why.
--
-- Column is nullable because orders created before Task 20 won't have a snapshot.
-- The webhook handler (checkout.session.completed) writes this value when the
-- Stripe session includes a pricingSnapshot in metadata.
--
-- Run after: any migration that creates the orders table.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE orders
  ADD COLUMN pricing_snapshot_json JSONB;

COMMENT ON COLUMN orders.pricing_snapshot_json IS
  'Immutable PricingSnapshot written at checkout time. '
  'Contains: pricingProfileId, finalPriceCents, discountsApplied, isFoundingPrice, snapshotAt. '
  'NULL for orders created before Task 20 deployment. '
  'Source of truth for: what was charged, at what rate, under what discount conditions. '
  'Never update this after it is written.';

-- Index for querying orders by founding status (e.g. admin reporting)
CREATE INDEX idx_orders_is_founding
  ON orders ((pricing_snapshot_json->>'isFoundingPrice'))
  WHERE pricing_snapshot_json IS NOT NULL;

COMMIT;
