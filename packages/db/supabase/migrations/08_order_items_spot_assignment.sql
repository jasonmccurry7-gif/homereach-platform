-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 08_order_items_spot_assignment.sql
-- Adds spot_assignment_id to order_items WITHOUT FK constraint.
--
-- The FK constraint is intentionally omitted here because the spot_assignments
-- table does not exist until Task 1 runs. The constraint will be added by the
-- Task 1 migration after spot_assignments is created.
--
-- Run after: any migration that creates the order_items table.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE order_items
  ADD COLUMN spot_assignment_id UUID;

COMMENT ON COLUMN order_items.spot_assignment_id IS
  'UUID of the spot_assignment this line item corresponds to. '
  'FK constraint (REFERENCES spot_assignments(id)) is STAGED — '
  'added by Task 1 migration after spot_assignments table is created. '
  'NULL for order items created before Task 1 was deployed.';

-- NOTE: FK to add in Task 1 migration:
-- ALTER TABLE order_items
--   ADD CONSTRAINT fk_order_items_spot_assignment
--   FOREIGN KEY (spot_assignment_id) REFERENCES spot_assignments(id) ON DELETE SET NULL;

COMMIT;
