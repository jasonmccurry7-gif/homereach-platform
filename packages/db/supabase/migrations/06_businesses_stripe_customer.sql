-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 06_businesses_stripe_customer.sql
-- Adds stripe_customer_id to businesses.
-- One business = one Stripe customer (Task 20 requirement).
--
-- Run after: any migration that creates the businesses table (00 or 01)
-- Safe to run independently of 04 and 05.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE businesses
  ADD COLUMN stripe_customer_id TEXT UNIQUE;

CREATE INDEX idx_businesses_stripe_customer
  ON businesses (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

COMMENT ON COLUMN businesses.stripe_customer_id IS
  'Stripe Customer ID. Authoritative Stripe customer reference for this business. '
  'Created on first subscription checkout. All subscription sessions use this ID. '
  'orders.stripe_customer_id is now deprecated in favour of this column.';

COMMIT;
