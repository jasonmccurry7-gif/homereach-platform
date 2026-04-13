-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 24: Launch Hardening
-- Dedup resolution center, quarantine system, FB truth layer,
-- automation safety rules, agent pause controls, send log enhancement
-- ─────────────────────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════════════════
-- A. DEDUP RESOLUTION TABLE
-- ═══════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  CREATE TYPE dedup_resolution AS ENUM ('pending', 'merged', 'kept_separate', 'reviewed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE dedup_confidence AS ENUM ('high', 'medium', 'low');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tracks every detected duplicate pair and the resolution decision
CREATE TABLE IF NOT EXISTS crm_dedup_clusters (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_id     UUID NOT NULL REFERENCES sales_leads(id) ON DELETE CASCADE,
  duplicate_id     UUID NOT NULL REFERENCES sales_leads(id) ON DELETE CASCADE,
  match_reason     TEXT NOT NULL,   -- 'phone_exact', 'email_exact', 'name_city', 'website'
  confidence       dedup_confidence NOT NULL DEFAULT 'high',
  resolution       dedup_resolution NOT NULL DEFAULT 'pending',
  resolved_by      UUID REFERENCES profiles(id),
  resolved_at      TIMESTAMPTZ,
  merge_notes      TEXT,
  auto_detected    BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(canonical_id, duplicate_id)
);

CREATE INDEX IF NOT EXISTS idx_dedup_canonical  ON crm_dedup_clusters(canonical_id);
CREATE INDEX IF NOT EXISTS idx_dedup_duplicate  ON crm_dedup_clusters(duplicate_id);
CREATE INDEX IF NOT EXISTS idx_dedup_resolution ON crm_dedup_clusters(resolution);

-- RPC: Merge duplicate into canonical (reassigns all events/notes/tasks)
CREATE OR REPLACE FUNCTION merge_duplicate_lead(
  p_canonical_id UUID,
  p_duplicate_id UUID,
  p_resolved_by  UUID DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Reassign sales_events
  UPDATE sales_events SET lead_id = p_canonical_id WHERE lead_id = p_duplicate_id;
  -- Reassign crm_outreach_events
  UPDATE crm_outreach_events SET lead_id = p_canonical_id WHERE lead_id = p_duplicate_id;
  -- Reassign crm_notes
  UPDATE crm_notes SET lead_id = p_canonical_id WHERE lead_id = p_duplicate_id;
  -- Reassign crm_tasks
  UPDATE crm_tasks SET lead_id = p_canonical_id WHERE lead_id = p_duplicate_id;
  -- Reassign crm_assignments
  UPDATE crm_assignments SET lead_id = p_canonical_id WHERE lead_id = p_duplicate_id;
  -- Reassign auto_enrollments (delete duplicate enrollment if already exists on canonical)
  DELETE FROM auto_enrollments ae
  WHERE ae.lead_id = p_duplicate_id
    AND EXISTS (
      SELECT 1 FROM auto_enrollments ae2
      WHERE ae2.lead_id = p_canonical_id AND ae2.sequence_id = ae.sequence_id
    );
  UPDATE auto_enrollments SET lead_id = p_canonical_id WHERE lead_id = p_duplicate_id;
  -- Aggregate counters onto canonical
  UPDATE sales_leads sl
  SET
    total_messages_sent = sl.total_messages_sent + dup.total_messages_sent,
    total_replies       = sl.total_replies + dup.total_replies
  FROM sales_leads dup
  WHERE sl.id = p_canonical_id AND dup.id = p_duplicate_id;
  -- Mark duplicate as suppressed
  UPDATE sales_leads
  SET
    pipeline_stage = 'suppressed',
    is_duplicate   = true,
    duplicate_of_id = p_canonical_id,
    status         = 'suppressed'
  WHERE id = p_duplicate_id;
  -- Mark cluster resolved
  UPDATE crm_dedup_clusters
  SET resolution  = 'merged',
      resolved_by = p_resolved_by,
      resolved_at = now()
  WHERE canonical_id = p_canonical_id AND duplicate_id = p_duplicate_id;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- B. QUARANTINE SYSTEM
-- ═══════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  CREATE TYPE quarantine_reason AS ENUM (
    'no_phone_no_email',
    'invalid_phone',
    'invalid_email',
    'bounced',
    'spam_complaint',
    'manual'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add quarantine columns to sales_leads
ALTER TABLE sales_leads
  ADD COLUMN IF NOT EXISTS is_quarantined      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS quarantine_reason   TEXT,
  ADD COLUMN IF NOT EXISTS quarantined_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS quarantine_reviewed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS quarantine_note     TEXT;

CREATE INDEX IF NOT EXISTS idx_leads_quarantine ON sales_leads(is_quarantined) WHERE is_quarantined = true;

-- Populate quarantine for leads with no phone AND no email
UPDATE sales_leads
SET
  is_quarantined    = true,
  quarantine_reason = 'no_phone_no_email',
  quarantined_at    = now()
WHERE
  (phone IS NULL OR phone = '')
  AND (email IS NULL OR email = '')
  AND is_quarantined = false
  AND do_not_contact = false;

-- RPC: Restore quarantined lead
CREATE OR REPLACE FUNCTION restore_from_quarantine(
  p_lead_id    UUID,
  p_restored_by UUID DEFAULT NULL,
  p_note        TEXT DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE sales_leads
  SET
    is_quarantined      = false,
    quarantine_reviewed = true,
    quarantine_note     = COALESCE(p_note, quarantine_note)
  WHERE id = p_lead_id;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- C. FACEBOOK OUTREACH TRUTH LAYER
-- ═══════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  CREATE TYPE fb_outreach_status AS ENUM (
    'draft_generated',  -- message created but never sent
    'queued',           -- in send queue
    'sent',             -- delivered to FB Messenger
    'failed',           -- send attempt failed
    'never_sent'        -- legacy Replit "generated" — confirmed undelivered
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add explicit FB status to crm_outreach_events
ALTER TABLE crm_outreach_events
  ADD COLUMN IF NOT EXISTS fb_outreach_status fb_outreach_status,
  ADD COLUMN IF NOT EXISTS counts_as_activity  BOOLEAN GENERATED ALWAYS AS (
    CASE
      WHEN channel = 'facebook' AND fb_actually_sent = false THEN false
      WHEN channel = 'facebook' AND fb_outreach_status IN ('draft_generated','never_sent') THEN false
      ELSE true
    END
  ) STORED;

-- Backfill: mark all existing fb_actually_sent=false rows as never_sent
UPDATE crm_outreach_events
SET fb_outreach_status = 'never_sent'
WHERE channel = 'facebook' AND fb_actually_sent = false AND fb_outreach_status IS NULL;

-- Backfill: mark all existing fb_actually_sent=true rows as sent
UPDATE crm_outreach_events
SET fb_outreach_status = 'sent'
WHERE channel = 'facebook' AND fb_actually_sent = true AND fb_outreach_status IS NULL;

-- Backfill non-FB rows
UPDATE crm_outreach_events
SET fb_outreach_status = 'sent'
WHERE channel != 'facebook' AND fb_outreach_status IS NULL;

-- Add fb_outreach_status to auto_send_log (for new FB sends)
ALTER TABLE auto_send_log
  ADD COLUMN IF NOT EXISTS delivered_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS replied_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fb_msg_status   fb_outreach_status;

CREATE INDEX IF NOT EXISTS idx_outreach_fb_status ON crm_outreach_events(fb_outreach_status) WHERE channel = 'facebook';

-- ═══════════════════════════════════════════════════════════════════════════
-- D. AGENT ACCOUNTABILITY — OVERDUE FOLLOW-UPS VIEW
-- ═══════════════════════════════════════════════════════════════════════════

-- View: per-agent leads with overdue follow-ups
CREATE OR REPLACE VIEW v_overdue_followups AS
SELECT
  sl.id              AS lead_id,
  sl.business_name,
  sl.city,
  sl.category,
  sl.pipeline_stage,
  sl.next_follow_up_at,
  sl.assigned_agent_id,
  p.full_name        AS agent_name,
  EXTRACT(EPOCH FROM (now() - sl.next_follow_up_at)) / 3600 AS hours_overdue
FROM sales_leads sl
LEFT JOIN profiles p ON p.id = sl.assigned_agent_id
WHERE
  sl.next_follow_up_at < now()
  AND sl.pipeline_stage NOT IN ('closed_won','closed_lost','suppressed')
  AND sl.do_not_contact = false
  AND sl.is_quarantined = false;

-- View: agent activity summary (real activity only — no FB drafts)
CREATE OR REPLACE VIEW v_agent_real_activity AS
SELECT
  se.agent_id,
  p.full_name,
  COUNT(*) FILTER (WHERE se.action_type IN ('sms_sent','email_sent','fb_message_sent','follow_up_sent'))
    AS real_messages_sent,
  COUNT(*) FILTER (WHERE se.action_type IN ('reply_received','fb_reply_received'))
    AS replies_received,
  COUNT(*) FILTER (WHERE se.action_type = 'follow_up_sent')
    AS follow_ups_sent,
  COUNT(*) FILTER (WHERE se.action_type = 'deal_closed')
    AS deals_closed,
  COALESCE(SUM(se.revenue_cents) FILTER (WHERE se.action_type = 'deal_closed'), 0)
    AS revenue_cents,
  MIN(se.created_at) AS first_activity_at,
  MAX(se.created_at) AS last_activity_at
FROM sales_events se
LEFT JOIN profiles p ON p.id = se.agent_id
GROUP BY se.agent_id, p.full_name;

-- ═══════════════════════════════════════════════════════════════════════════
-- E. AUTOMATION SAFETY RULES
-- ═══════════════════════════════════════════════════════════════════════════

-- Add pause + dry-run controls to sequences
ALTER TABLE auto_sequences
  ADD COLUMN IF NOT EXISTS paused_by   UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS paused_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pause_reason TEXT;

-- Agent-level pause table
CREATE TABLE IF NOT EXISTS agent_pause_controls (
  agent_id    UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  paused      BOOLEAN NOT NULL DEFAULT false,
  paused_by   UUID REFERENCES profiles(id),
  paused_at   TIMESTAMPTZ,
  reason      TEXT
);

-- Global pause flag (single-row control)
CREATE TABLE IF NOT EXISTS system_controls (
  id              INT PRIMARY KEY DEFAULT 1,
  all_paused      BOOLEAN NOT NULL DEFAULT false,
  paused_by       UUID REFERENCES profiles(id),
  paused_at       TIMESTAMPTZ,
  pause_reason    TEXT,
  CHECK (id = 1)
);
INSERT INTO system_controls (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Enhanced: enroll_lead_in_sequence now checks quarantine + global pause
CREATE OR REPLACE FUNCTION enroll_lead_in_sequence(
  p_lead_id     UUID,
  p_sequence_id UUID,
  p_agent_id    UUID DEFAULT NULL,
  p_dry_run     BOOLEAN DEFAULT false
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_lead          RECORD;
  v_seq           RECORD;
  v_sys           RECORD;
  v_enrollment_id UUID;
  v_first_delay   INT;
  v_errors        TEXT[] := '{}';
BEGIN
  -- Load lead
  SELECT * INTO v_lead FROM sales_leads WHERE id = p_lead_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'lead_not_found'); END IF;

  -- Load sequence
  SELECT * INTO v_seq FROM auto_sequences WHERE id = p_sequence_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'sequence_not_found'); END IF;

  -- Global pause check
  SELECT * INTO v_sys FROM system_controls WHERE id = 1;
  IF v_sys.all_paused THEN
    v_errors := array_append(v_errors, 'system_paused: ' || COALESCE(v_sys.pause_reason, 'no reason'));
  END IF;

  -- Sequence paused
  IF v_seq.status = 'paused' THEN
    v_errors := array_append(v_errors, 'sequence_paused');
  END IF;

  -- DNC check
  IF v_lead.do_not_contact THEN
    v_errors := array_append(v_errors, 'do_not_contact');
  END IF;

  -- Quarantine check
  IF v_lead.is_quarantined THEN
    v_errors := array_append(v_errors, 'quarantined: ' || COALESCE(v_lead.quarantine_reason, 'no_contact_info'));
  END IF;

  -- SMS opt-out
  IF v_seq.channel = 'sms' AND v_lead.sms_opt_out THEN
    v_errors := array_append(v_errors, 'sms_opt_out');
  END IF;

  -- Channel contact info check
  IF v_seq.channel = 'sms' AND (v_lead.phone IS NULL OR v_lead.phone = '') THEN
    v_errors := array_append(v_errors, 'no_phone_for_sms');
  END IF;
  IF v_seq.channel = 'email' AND (v_lead.email IS NULL OR v_lead.email = '') THEN
    v_errors := array_append(v_errors, 'no_email_for_email');
  END IF;

  -- Suppression list check
  IF EXISTS (
    SELECT 1 FROM crm_suppression_list csl
    WHERE (csl.phone = v_lead.phone AND v_lead.phone IS NOT NULL)
       OR (csl.email = v_lead.email AND v_lead.email IS NOT NULL)
  ) THEN
    v_errors := array_append(v_errors, 'on_suppression_list');
  END IF;

  -- If dry run or errors exist, return without enrolling
  IF p_dry_run OR array_length(v_errors, 1) > 0 THEN
    RETURN jsonb_build_object(
      'ok',     array_length(v_errors, 1) IS NULL,
      'dry_run', p_dry_run,
      'errors', to_jsonb(v_errors),
      'lead',   v_lead.business_name
    );
  END IF;

  -- Get delay of first step
  SELECT delay_hours INTO v_first_delay
  FROM auto_sequence_steps
  WHERE sequence_id = p_sequence_id AND step_number = 1;

  -- Enroll
  INSERT INTO auto_enrollments (sequence_id, lead_id, agent_id, status, current_step, enrolled_at, next_send_at)
  VALUES (
    p_sequence_id, p_lead_id, p_agent_id, 'active', 1,
    now(), now() + (COALESCE(v_first_delay, 0) * INTERVAL '1 hour')
  )
  ON CONFLICT (sequence_id, lead_id)
  DO UPDATE SET
    status       = 'active',
    current_step = 1,
    enrolled_at  = now(),
    stopped_at   = NULL,
    stop_reason  = NULL,
    next_send_at = now() + (COALESCE(v_first_delay, 0) * INTERVAL '1 hour')
  RETURNING id INTO v_enrollment_id;

  RETURN jsonb_build_object('ok', true, 'enrollment_id', v_enrollment_id, 'errors', '[]'::jsonb);
END;
$$;

-- Enhanced stop-on-reply trigger: also checks global/agent pause
CREATE OR REPLACE FUNCTION stop_enrollments_on_reply()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.action_type IN ('reply_received', 'fb_reply_received') THEN
    UPDATE auto_enrollments
    SET
      status      = 'stopped',
      stopped_at  = now(),
      stop_reason = 'reply_received'
    WHERE
      lead_id = NEW.lead_id
      AND status = 'active';
  END IF;
  RETURN NEW;
END;
$$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS trg_stop_on_reply ON sales_events;
CREATE TRIGGER trg_stop_on_reply
  AFTER INSERT ON sales_events
  FOR EACH ROW EXECUTE FUNCTION stop_enrollments_on_reply();

-- ═══════════════════════════════════════════════════════════════════════════
-- F. LAUNCH READINESS VIEW
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW v_launch_readiness AS
WITH checks AS (
  -- Check 1: Pending duplicates
  SELECT 'pending_duplicates' AS check_name,
    COUNT(*) AS value,
    CASE WHEN COUNT(*) = 0 THEN 'pass' ELSE 'warn' END AS status,
    'Duplicate pairs not yet resolved' AS description
  FROM crm_dedup_clusters WHERE resolution = 'pending'

  UNION ALL

  -- Check 2: Quarantined leads
  SELECT 'quarantined_leads',
    COUNT(*),
    CASE WHEN COUNT(*) = 0 THEN 'pass' ELSE 'warn' END,
    'Leads with no contact info'
  FROM sales_leads WHERE is_quarantined = true AND quarantine_reviewed = false

  UNION ALL

  -- Check 3: Never-sent FB messages
  SELECT 'fb_never_sent',
    COUNT(*),
    CASE WHEN COUNT(*) = 0 THEN 'pass' ELSE 'warn' END,
    'FB messages generated but never delivered'
  FROM crm_outreach_events WHERE channel = 'facebook' AND fb_actually_sent = false

  UNION ALL

  -- Check 4: System paused
  SELECT 'system_paused',
    CASE WHEN all_paused THEN 1 ELSE 0 END,
    CASE WHEN all_paused THEN 'warn' ELSE 'pass' END,
    'Global automation pause is active'
  FROM system_controls WHERE id = 1

  UNION ALL

  -- Check 5: Active sequences exist
  SELECT 'active_sequences',
    COUNT(*),
    CASE WHEN COUNT(*) > 0 THEN 'pass' ELSE 'fail' END,
    'Sequences ready to send'
  FROM auto_sequences WHERE status = 'active'

  UNION ALL

  -- Check 6: Leads with contact info available
  SELECT 'actionable_leads',
    COUNT(*),
    CASE WHEN COUNT(*) > 0 THEN 'pass' ELSE 'fail' END,
    'Leads with phone or email, not DNC/quarantined'
  FROM sales_leads
  WHERE (phone IS NOT NULL OR email IS NOT NULL)
    AND do_not_contact = false
    AND is_quarantined = false
    AND pipeline_stage NOT IN ('suppressed','closed_won','closed_lost')

  UNION ALL

  -- Check 7: DNC coverage (any DNC exists)
  SELECT 'dnc_list_configured',
    COUNT(*),
    CASE WHEN COUNT(*) >= 0 THEN 'pass' ELSE 'fail' END,
    'DNC system is operational'
  FROM sales_leads WHERE do_not_contact = true

  UNION ALL

  -- Check 8: Stop-on-reply trigger
  SELECT 'stop_on_reply_trigger',
    COUNT(*),
    CASE WHEN COUNT(*) > 0 THEN 'pass' ELSE 'fail' END,
    'Stop-on-reply trigger is installed'
  FROM pg_trigger WHERE tgname = 'trg_stop_on_reply'
)
SELECT * FROM checks;

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE crm_dedup_clusters    ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_pause_controls  ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_controls       ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dedup_auth_read"     ON crm_dedup_clusters   FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "dedup_admin_write"   ON crm_dedup_clusters   FOR ALL    USING ((auth.jwt()->'app_metadata'->>'user_role') = 'admin');
CREATE POLICY "dedup_service"       ON crm_dedup_clusters   FOR ALL    USING (auth.role() = 'service_role');

CREATE POLICY "pause_admin_all"     ON agent_pause_controls FOR ALL    USING ((auth.jwt()->'app_metadata'->>'user_role') = 'admin');
CREATE POLICY "pause_service"       ON agent_pause_controls FOR ALL    USING (auth.role() = 'service_role');

CREATE POLICY "sysctrl_admin_all"   ON system_controls      FOR ALL    USING ((auth.jwt()->'app_metadata'->>'user_role') = 'admin');
CREATE POLICY "sysctrl_service"     ON system_controls      FOR ALL    USING (auth.role() = 'service_role');
CREATE POLICY "sysctrl_auth_read"   ON system_controls      FOR SELECT USING (auth.uid() IS NOT NULL);
