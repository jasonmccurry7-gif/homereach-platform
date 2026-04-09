-- ─────────────────────────────────────────────────────────────────────────────
-- RLS for marketing_campaigns and campaign_metrics (Phase 3)
-- Run in Supabase SQL Editor after running migration 00_.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── marketing_campaigns ───────────────────────────────────────────────────────

ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;

-- Business owners see only their own campaigns
CREATE POLICY "marketing_campaigns: owner read"
  ON public.marketing_campaigns FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

-- Admins can do everything
CREATE POLICY "marketing_campaigns: admin full"
  ON public.marketing_campaigns
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- Only the system (service role, used in webhook) can insert/update
-- Regular users cannot create or modify campaigns directly
CREATE POLICY "marketing_campaigns: service insert"
  ON public.marketing_campaigns FOR INSERT
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- ── campaign_metrics ──────────────────────────────────────────────────────────

ALTER TABLE public.campaign_metrics ENABLE ROW LEVEL SECURITY;

-- Business owners can read metrics for their campaigns
CREATE POLICY "campaign_metrics: owner read"
  ON public.campaign_metrics FOR SELECT
  USING (
    campaign_id IN (
      SELECT mc.id
      FROM public.marketing_campaigns mc
      JOIN public.businesses b ON mc.business_id = b.id
      WHERE b.owner_id = auth.uid()
    )
  );

-- Admins can do everything
CREATE POLICY "campaign_metrics: admin full"
  ON public.campaign_metrics
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- Seed a test metric row (run manually to test dashboard charts)
-- Replace <campaign_id> with the actual UUID from marketing_campaigns table.
-- ─────────────────────────────────────────────────────────────────────────────

-- INSERT INTO public.campaign_metrics (
--   campaign_id, period_start, period_end,
--   impressions, mailpieces, qr_scans, phone_leads, form_leads, total_leads
-- ) VALUES (
--   '<campaign_id>',
--   now() - interval '30 days',
--   now(),
--   2500, 2500, 0, 0, 0, 0
-- );
