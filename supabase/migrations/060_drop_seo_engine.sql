-- ============================================================================
-- HomeReach SEO Engine v1 - Rollback Migration
-- ============================================================================
-- Drops every object created by 059_seo_pages.sql. Safe to re-run (uses
-- IF EXISTS on every statement). No impact on any other table, function,
-- or policy.
--
-- Only apply this if something in the SEO engine has gone wrong badly enough
-- that flag-flipping (ENABLE_SEO_ENGINE=) and archive-ing individual pages
-- is not sufficient.
-- ============================================================================

drop trigger if exists seo_pages_version_on_update on public.seo_pages;

drop function if exists public.seo_pages_version_capture();
drop function if exists public.seo_pages_quality_check(uuid);
drop function if exists public.seo_pages_inventory_ok(uuid, uuid);

drop policy if exists seo_pages_service_read_published on public.seo_pages;
drop policy if exists seo_pages_admin_all on public.seo_pages;
drop policy if exists seo_page_versions_admin_all on public.seo_page_versions;

drop table if exists public.seo_page_versions;
drop table if exists public.seo_pages;
