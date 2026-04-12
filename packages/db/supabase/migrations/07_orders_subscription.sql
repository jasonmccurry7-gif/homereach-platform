-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 07_orders_subscription.sql
-- Adds stripe_subscription_id to orders.
-- Links a subscription order to its recurring Stripe Subscription.
--
-- Run after: any migration that creates the orders table.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE orders
  ADD COLUMN stripe_subscription_id TEXT UNIQUE;

CREATE INDEX idx_orders_stripe_subscription
  ON orders (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

COMMENT ON COLUMN orders.stripe_subscription_id IS
  'Stripe Subscription ID. Set when a mode:subscription checkout completes. '
  'One order per subscription. invoice.paid events are correlated via this ID. '
  'NULL for one-time (mode:payment) orders.';

COMMIT;
