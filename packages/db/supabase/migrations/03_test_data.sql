-- ─────────────────────────────────────────────────────────────────────────────
-- TEST DATA — Run this in Supabase SQL Editor AFTER:
--   1. You have signed up at /signup (creates your auth.users + profiles row)
--   2. You have run the main seed (cities, categories, bundles)
--
-- BEFORE running: replace YOUR_USER_ID below with your actual user ID.
-- Find it in: Supabase dashboard → Authentication → Users → copy the UUID.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Step 0: Set your user ID ─────────────────────────────────────────────────
-- Replace this with your real UUID from Supabase Auth → Users
DO $$
DECLARE
  v_user_id       uuid := 'YOUR_USER_ID_HERE';  -- <-- REPLACE THIS
  v_city_id       uuid;
  v_category_id   uuid;
  v_bundle_id     uuid;
  v_business_id   uuid;
  v_order_id      uuid;
  v_campaign_id   uuid;
  v_period_start  timestamptz := now() - interval '30 days';
  v_period_end    timestamptz := now();
BEGIN

  -- ── Step 1: Get seeded city, category, bundle ───────────────────────────────
  SELECT id INTO v_city_id     FROM public.cities      WHERE slug = 'austin-tx'    LIMIT 1;
  SELECT id INTO v_category_id FROM public.categories  WHERE slug = 'home-services' LIMIT 1;
  SELECT id INTO v_bundle_id   FROM public.bundles     WHERE slug = 'anchor'        LIMIT 1;

  IF v_city_id IS NULL     THEN RAISE EXCEPTION 'City not found — run the main seed first'; END IF;
  IF v_category_id IS NULL THEN RAISE EXCEPTION 'Category not found — run the main seed first'; END IF;
  IF v_bundle_id IS NULL   THEN RAISE EXCEPTION 'Bundle not found — run the main seed first'; END IF;

  -- ── Step 2: Update your profile to link to Austin + Home Services ────────────
  UPDATE public.profiles
  SET full_name = 'Jason McCurry'
  WHERE id = v_user_id;

  -- ── Step 3: Create a business owned by your user ─────────────────────────────
  INSERT INTO public.businesses (owner_id, name, category_id, city_id, phone, email, status)
  VALUES (
    v_user_id,
    'HomeReach Demo Business',
    v_category_id,
    v_city_id,
    '+1 (512) 555-0100',
    'demo@homereach.com',
    'active'
  )
  RETURNING id INTO v_business_id;

  -- ── Step 4: Create a paid order ──────────────────────────────────────────────
  INSERT INTO public.orders (business_id, bundle_id, status, subtotal, total, paid_at)
  VALUES (
    v_business_id,
    v_bundle_id,
    'paid',
    997.00,
    997.00,
    now()
  )
  RETURNING id INTO v_order_id;

  -- ── Step 5: Create the marketing campaign ────────────────────────────────────
  INSERT INTO public.marketing_campaigns (
    business_id, order_id, city_id, category_id, bundle_id,
    status, start_date, next_drop_date, renewal_date,
    total_drops, drops_completed, homes_per_drop
  )
  VALUES (
    v_business_id,
    v_order_id,
    v_city_id,
    v_category_id,
    v_bundle_id,
    'active',
    now(),
    now() + interval '14 days',
    now() + interval '30 days',
    1,
    1,
    2500
  )
  RETURNING id INTO v_campaign_id;

  -- ── Step 6: Insert realistic campaign metrics ─────────────────────────────────
  INSERT INTO public.campaign_metrics (
    campaign_id, period_start, period_end,
    impressions, mailpieces, qr_scans,
    phone_leads, form_leads, total_leads
  )
  VALUES (
    v_campaign_id,
    v_period_start,
    v_period_end,
    2500, 2500, 18,
    6, 4, 28
  );

  RAISE NOTICE '✅ Done!';
  RAISE NOTICE '   user_id:     %', v_user_id;
  RAISE NOTICE '   business_id: %', v_business_id;
  RAISE NOTICE '   order_id:    %', v_order_id;
  RAISE NOTICE '   campaign_id: %', v_campaign_id;
  RAISE NOTICE '   Metrics: 2500 impressions · 28 engagements · 1.12%% conversion';

END $$;
