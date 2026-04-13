-- Migration 21c: Seed companies and deals from Replit

INSERT INTO crm_companies (external_id, name, contact_name, email, phone, industry, status, notes) VALUES
  ('1', 'Tom Pozuc', 'Tom Pozuc', 'thomaspozuc.realtor@gmail.com', NULL, 'Real Estate', 'active', 'Imported from Stripe invoice FPOGMAHA-0001'),
  ('2', 'Lux Wash Pressure Washing', 'Josiah Barkman', 'luxwashpressurewashing@gmail.com', NULL, 'Home Services', 'active', 'Imported from Stripe invoice DVPS38W7-0002'),
  ('3', 'Death Doula Nicole', 'Nicole Roman Hoover', 'nicole@deathdoulanicole.com', NULL, 'Health & Wellness', 'active', 'Imported from Stripe invoice X9CROSOE-0001'),
  ('4', 'Burnt Rubber Garage', NULL, 'burntrubbergarage@gmail.com', NULL, 'Automotive', 'prospect', 'Stripe customer cus_UDr8KGnQZ88D8W — invoice pending | City: Medina'),
  ('5', 'Emilee Bobo EXP Realty', 'Emilee Bobo', 'Emileeboborealtor@gmail.com', NULL, 'Real Estate', 'prospect', 'Stripe customer cus_UD9MIn7FnMSy2w — invoice pending | City: Massillon'),
  ('6', 'All Ohio Masonry', 'Ryan Smugala', 'Allohiomasonry13@gmail.com', NULL, 'Home Services', 'prospect', 'Stripe customer cus_UD9BeZ4zAJZKub — invoice pending | City: Medina'),
  ('7', 'Haudenschild Agency', 'John Kinkopf', 'john@haudenschildagency.net', NULL, 'Financial Services', 'prospect', 'Stripe customer cus_UD96kaLT9h9tqa — invoice pending | City: Wooster'),
  ('8', 'Daniel Miller', 'Daniel Miller', 'daniel.miller.ent@gmail.com', NULL, 'Other', 'prospect', 'Stripe customer cus_UCNc7htVtl1jIG — invoice pending | City: Cuyahoga Falls'),
  ('9', 'Top Line Roofing', 'David Chupp', 'sales@toplineroofingllc.com', NULL, 'Home Services', 'prospect', 'Stripe customer cus_UBfrxfyi6cdiC2 — invoice pending | City: Medina + Wooster'),
  ('10', 'Ark Veterinary Hospital', 'Stephanie Straubhaar', 'stephaniestraubhaar@arkvethosp.com', NULL, 'Health & Wellness', 'prospect', 'Stripe customer cus_UBfgoaMNZ6Wpe8 — invoice pending | City: Wooster'),
  ('11', 'Lake Erie Pools', NULL, 'swim@lakeeriepools.com', '+14408646910', 'Home Services', 'prospect', 'Stripe customer cus_UBeonV0zTA3XX0 — invoice pending | City: Medina')
ON CONFLICT DO NOTHING;

-- Insert deals and update company MRR
INSERT INTO crm_deals (company_id, spot_id, city, monthly_value_cents, contract_months, total_value_cents, status, start_date, end_date, signed_at, notes)
SELECT
  c.id,
  d.spot_id::integer,
  d.city,
  d.mrr_cents,
  3,
  d.mrr_cents * 3,
  d.deal_status,
  d.start_date::date,
  d.end_date::date,
  d.signed_at::timestamptz,
  d.notes
FROM (VALUES
  ('1', '33', 'Cuyahoga Falls', 25750, 'active', '2026-03-26', '2026-06-26', '2026-03-27 00:00:00+00', 'Imported from Replit contract 1'),
  ('2', '6', 'Wooster', 10300, 'active', '2026-03-25', '2026-06-25', '2026-03-26 00:00:00+00', 'Imported from Replit contract 2'),
  ('3', '36', 'Cuyahoga Falls', 20000, 'active', '2026-03-21', '2026-06-21', '2026-03-25 00:00:00+00', 'Imported from Replit contract 3')
) AS d(ext_company_id, spot_id, city, mrr_cents, deal_status, start_date, end_date, signed_at, notes)
JOIN crm_companies c ON c.external_id = d.ext_company_id;

-- Update company MRR for active deals
UPDATE crm_companies c SET mrr_cents = d.mrr, status = 'active', updated_at = NOW()
FROM (
  SELECT company_id, SUM(monthly_value_cents) AS mrr FROM crm_deals WHERE status = 'active' GROUP BY company_id
) d WHERE d.company_id = c.id;
