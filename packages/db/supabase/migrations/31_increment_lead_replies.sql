-- ============================================================================
-- 31_increment_lead_replies.sql
-- Add increment_lead_replies RPC called by sales/event route on reply receipt
-- Safe to run multiple times
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_lead_replies(lead_uuid UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE sales_leads
  SET total_replies  = COALESCE(total_replies, 0) + 1,
      last_reply_at  = NOW(),
      updated_at     = NOW()
  WHERE id = lead_uuid;
END;
$$;

GRANT EXECUTE ON FUNCTION increment_lead_replies TO service_role, authenticated;

-- Verify
SELECT 'increment_lead_replies' as fn,
       EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'increment_lead_replies') as ok;
