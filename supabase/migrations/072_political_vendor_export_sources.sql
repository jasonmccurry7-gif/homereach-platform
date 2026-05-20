-- ─────────────────────────────────────────────────────────────────────────────
-- HomeReach Migration 072 — Vendor Export Source Registry
--
-- Adds two vendor-export rows to political_data_sources so operator-uploaded
-- CSVs from third-party mailing vendors carry a registered provenance label.
--
-- POLICY (enforced in code review, NOT in this migration):
--   • The system NEVER scrapes vendor checkout pages.
--   • The system NEVER automates vendor logins.
--   • Vendor data enters HomeReach ONLY via operator-downloaded CSVs uploaded
--     manually through /admin/political/routes/import.
--
-- These registry rows give /admin/political/data-sources visibility into
-- vendor-supplied data and let the audit log on /admin/political/imports
-- group rows by vendor.
--
-- SAFE TO RE-RUN.
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.political_data_sources
  (source_key, display_name, publisher, homepage_url, terms_url, license_notes,
   kind, reliability_tier, refresh_cadence, enabled, notes)
values
  ('vendor_export_48hrprint',
   'Vendor Export — 48HrPrint',
   '48hourprint.com',
   'https://www.48hourprint.com/',
   'https://www.48hourprint.com/terms.html',
   'Operator-downloaded CSV from the vendor''s own UI. Operator is responsible for confirming the export is permitted under their account terms.',
   'manual', 'aggregator', 'manual', true,
   'Operator-uploaded ONLY. The system MUST NOT scrape, automate logins, or bypass checkout. Use /admin/political/routes/import with this source label when uploading CSVs the operator exported themselves.'),

  ('vendor_export_other',
   'Vendor Export — Other',
   'various',
   null,
   null,
   'Operator certifies the source is licensed/permitted. Use the import notes field to record the actual vendor name.',
   'manual', 'aggregator', 'manual', true,
   'Generic catch-all for operator-uploaded vendor CSVs from other mailing or address-data vendors. No scraping. No login automation.')
on conflict (source_key) do nothing;


-- ═════════════════════════════════════════════════════════════════════════════
-- Done — migration 072 complete.
-- ═════════════════════════════════════════════════════════════════════════════
