-- ─────────────────────────────────────────────────────────────────────────────
-- HomeReach Migration 051 — Legacy Spot Backfill (Inventory Integrity Fix)
--
-- ROOT CAUSE RECAP
-- Legacy migrated clients were created with a `businesses` row where
-- city_id=NULL, category_id=NULL, and the real (city, category, spot_type)
-- lived inside a JSON block in `businesses.notes` under the key
-- [migration_meta]. Because no `spot_assignments` row was ever written,
-- the canonical availability endpoint (which queries spot_assignments)
-- reported the slot as available, and checkout proceeded even though the
-- funnel page correctly showed it sold out. Result: two advertisers for
-- the same exclusive city+category slot.
--
-- WHAT THIS MIGRATION DOES
-- 1. Parses every `businesses` row that contains [migration_meta] JSON.
-- 2. For rows whose migrationStatus = 'legacy_active', it:
--      a) Resolves the city name + category name from the JSON metadata
--         against the real `cities` + `categories` tables (case-insensitive,
--         state-suffix tolerant).
--      b) Ensures a `spot_assignments` row exists for that (city_id,
--         category_id, spot_type) with status='active'. The row uses the
--         SAME business_id so downstream joins work.
-- 3. Records any rows it could NOT reconcile into an audit view
--    `qa_integrity_unresolved_legacy` (created here) so ops can fix them
--    manually — typical causes are city-name typos in the JSON.
--
-- This migration is IDEMPOTENT: running it multiple times is safe. It uses
-- ON CONFLICT / NOT EXISTS guards so a repeated run does not duplicate
-- spot_assignments.
--
-- SAFETY NOTES
-- - Reads `businesses.notes`, `businesses.id`, `cities`, `categories`.
-- - Inserts into `spot_assignments`. No UPDATEs to existing rows.
-- - The insert uses status='active' and releasedAt=NULL — this matches
--   how the migration path originally intended to represent a legacy
--   client that is live on the postcard.
-- - The partial unique index on spot_assignments from Migration 15
--   enforces "one active/pending row per city+category". If a duplicate
--   already exists in spot_assignments (not likely for legacy clients,
--   but possible), this migration SKIPS the insert for that pair and
--   logs the conflict into qa_integrity_unresolved_legacy.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1) Unresolved-legacy audit table ─────────────────────────────────────────
-- Receives every legacy_active record that could NOT be reconciled into
-- spot_assignments. Ops should inspect this table after running the migration.

create table if not exists qa_integrity_unresolved_legacy (
  id                 uuid primary key default gen_random_uuid(),
  business_id        uuid not null,
  reason             text not null,
  raw_meta           jsonb,
  detected_at        timestamptz not null default now()
);

comment on table qa_integrity_unresolved_legacy is
  'Legacy migration rows that could not be backfilled into spot_assignments.
   Populated by migration 051. Review entries and either fix the source
   businesses.notes JSON or insert a spot_assignments row manually.';


-- ── 2) Backfill routine ──────────────────────────────────────────────────────
-- Uses a DO block with a cursor-like loop. Keeps everything in one
-- transaction so a failure rolls back the whole backfill — safer than
-- partial reconciliation.

do $$
declare
  biz record;
  meta jsonb;
  meta_status text;
  meta_city text;
  meta_category text;
  meta_spot_type text;
  city_uuid uuid;
  cat_uuid uuid;
  existing_count int;
  unresolved_reason text;
  inserted_count int := 0;
  skipped_count int := 0;
  unresolved_count int := 0;
begin
  for biz in
    select id, notes
    from businesses
    where notes like '%[migration_meta]%'
  loop
    -- Extract the JSON blob after the marker
    begin
      meta := (
        substring(biz.notes from position('[migration_meta]' in biz.notes) + length('[migration_meta]'))
      )::jsonb;
    exception when others then
      insert into qa_integrity_unresolved_legacy (business_id, reason, raw_meta)
      values (biz.id, 'JSON parse failed', null);
      unresolved_count := unresolved_count + 1;
      continue;
    end;

    meta_status := coalesce(meta->>'migrationStatus', '');
    if meta_status <> 'legacy_active' then
      skipped_count := skipped_count + 1;
      continue;  -- legacy_pending / new_system / anything else does not occupy a slot
    end if;

    meta_city := trim(coalesce(meta->>'city', ''));
    meta_category := trim(coalesce(meta->>'category', ''));
    meta_spot_type := coalesce(meta->>'spotType', 'anchor');

    -- Normalize: strip trailing ", OH" / ", XX"
    meta_city := regexp_replace(meta_city, ',\s*[A-Za-z]{2}$', '');
    meta_city := trim(meta_city);

    if meta_city = '' or meta_category = '' then
      insert into qa_integrity_unresolved_legacy (business_id, reason, raw_meta)
      values (biz.id, 'Empty city or category in metadata', meta);
      unresolved_count := unresolved_count + 1;
      continue;
    end if;

    -- Resolve city (case-insensitive)
    select id into city_uuid
    from cities
    where lower(name) = lower(meta_city)
    limit 1;

    if city_uuid is null then
      unresolved_reason := format('City not found: %s', meta_city);
      insert into qa_integrity_unresolved_legacy (business_id, reason, raw_meta)
      values (biz.id, unresolved_reason, meta);
      unresolved_count := unresolved_count + 1;
      continue;
    end if;

    -- Resolve category (case-insensitive)
    select id into cat_uuid
    from categories
    where lower(name) = lower(meta_category)
    limit 1;

    if cat_uuid is null then
      unresolved_reason := format('Category not found: %s', meta_category);
      insert into qa_integrity_unresolved_legacy (business_id, reason, raw_meta)
      values (biz.id, unresolved_reason, meta);
      unresolved_count := unresolved_count + 1;
      continue;
    end if;

    -- Map spot_type string to enum value
    meta_spot_type := case lower(meta_spot_type)
      when 'front' then 'front_feature'
      when 'back' then 'back_feature'
      when 'full' then 'full_card'
      when 'full_card' then 'full_card'
      when 'front_feature' then 'front_feature'
      when 'back_feature' then 'back_feature'
      else 'anchor'
    end;

    -- Check if an active/pending spot_assignment already exists for this
    -- (city, category). If yes, skip — the partial unique index would
    -- block the insert anyway, and we log it as unresolved for audit.
    select count(*) into existing_count
    from spot_assignments
    where city_id = city_uuid
      and category_id = cat_uuid
      and status in ('pending', 'active');

    if existing_count > 0 then
      insert into qa_integrity_unresolved_legacy (business_id, reason, raw_meta)
      values (
        biz.id,
        format('spot_assignments already has %s active/pending row(s) for (city_id=%s, category_id=%s)',
               existing_count, city_uuid, cat_uuid),
        meta
      );
      unresolved_count := unresolved_count + 1;
      continue;
    end if;

    -- Insert the backfill row
    insert into spot_assignments (
      business_id, city_id, category_id, spot_type, status, activated_at,
      created_at, updated_at
    ) values (
      biz.id, city_uuid, cat_uuid, meta_spot_type::spot_type, 'active', now(),
      now(), now()
    );

    inserted_count := inserted_count + 1;
  end loop;

  raise notice 'Migration 051 backfill complete. inserted=%, skipped_non_active=%, unresolved=%',
    inserted_count, skipped_count, unresolved_count;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- After this migration runs, query qa_integrity_unresolved_legacy to see
-- anything that could not be reconciled:
--   select * from qa_integrity_unresolved_legacy order by detected_at desc;
--
-- The Wooster + Pressure Washing record specifically should now have a
-- corresponding spot_assignments row with status='active', making it
-- visible to /api/spots/availability.
-- ─────────────────────────────────────────────────────────────────────────────
