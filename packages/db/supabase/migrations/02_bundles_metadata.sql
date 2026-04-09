-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 02: Add metadata column to bundles
--
-- This column drives the scarcity system on the intake funnel:
--   { spotType: "anchor"|"front"|"back", maxSpots: 1|3|6,
--     features: string[], badgeText?: string, highlight?: boolean }
--
-- Run in Supabase SQL Editor or via pnpm db:migrate.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.bundles
  ADD COLUMN IF NOT EXISTS metadata jsonb;

-- Backfill existing seed bundles with their metadata
-- (slug-based so it's safe to re-run)

-- Anchor (premium): 1 spot, highest visibility
UPDATE public.bundles
SET metadata = '{"spotType":"anchor","maxSpots":1,"highlight":true,"badgeText":"1 spot left","features":["Front cover placement","Largest ad format","Category exclusive","QR code tracking","2,500 homes/month"]}'::jsonb
WHERE slug LIKE '%-anchor';

-- Front Feature: 3 spots
UPDATE public.bundles
SET metadata = '{"spotType":"front","maxSpots":3,"highlight":false,"features":["Front page placement","Standard ad format","Category exclusive","QR code tracking","2,500 homes/month"]}'::jsonb
WHERE slug LIKE '%-front-feature';

-- Back Feature: 6 spots
UPDATE public.bundles
SET metadata = '{"spotType":"back","maxSpots":6,"highlight":false,"features":["Back page placement","Standard ad format","Category exclusive","QR code tracking","2,500 homes/month"]}'::jsonb
WHERE slug LIKE '%-back-feature';
