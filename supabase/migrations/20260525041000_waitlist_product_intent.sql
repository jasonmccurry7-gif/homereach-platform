-- Add product intent tracking for product-specific waitlist funnels.
-- Rollback:
--   alter table public.waitlist_entries drop column if exists product_intent;

alter table public.waitlist_entries
  add column if not exists product_intent text;
create index if not exists waitlist_entries_product_intent_idx
  on public.waitlist_entries (product_intent);
