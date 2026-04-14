-- Agent registry: all 16 agents with their roles, triggers, capabilities, status
-- These are autonomous software components, not human users.

CREATE TABLE IF NOT EXISTS agent_registry (
  id TEXT PRIMARY KEY,  -- e.g. 'apex', 'kaizen', 'echo'
  name TEXT NOT NULL,
  layer TEXT NOT NULL,  -- 'executive', 'growth', 'outreach', 'operations', 'intelligence'
  role TEXT NOT NULL,
  description TEXT,
  triggers JSONB NOT NULL DEFAULT '[]',  -- what events activate this agent
  capabilities JSONB NOT NULL DEFAULT '[]',  -- what it can do
  connected_systems JSONB NOT NULL DEFAULT '[]',  -- supabase, twilio, mailgun, stripe, etc.
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  completion_pct INTEGER NOT NULL DEFAULT 0 CHECK (completion_pct BETWEEN 0 AND 100),
  last_run_at TIMESTAMPTZ,
  last_run_status TEXT,  -- 'success', 'error', 'skipped'
  run_count_today INTEGER NOT NULL DEFAULT 0,
  run_count_total INTEGER NOT NULL DEFAULT 0,
  config JSONB NOT NULL DEFAULT '{}',  -- agent-specific configuration
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Agent run log for audit trail and performance tracking
CREATE TABLE IF NOT EXISTS agent_run_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL REFERENCES agent_registry(id),
  run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL,  -- 'success', 'error', 'skipped', 'partial'
  actions_taken INTEGER NOT NULL DEFAULT 0,
  leads_processed INTEGER DEFAULT 0,
  messages_sent INTEGER DEFAULT 0,
  revenue_influenced_cents INTEGER DEFAULT 0,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'
);

-- Indexes for agent_run_log
CREATE INDEX IF NOT EXISTS idx_agent_run_log_agent ON agent_run_log(agent_id, run_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_run_log_status ON agent_run_log(status, run_at DESC);

-- Insert all 16 agents with full definitions
-- Using ON CONFLICT DO UPDATE to allow idempotent migrations

INSERT INTO agent_registry (
  id, name, layer, role, description,
  triggers, capabilities, connected_systems,
  is_active, completion_pct, config
) VALUES

-- EXECUTIVE LAYER (3 agents)

('apex', 'Apex CEO', 'executive', 'CEO Agent', 'System oversight and daily briefs',
  '["daily_7am", "system_error", "revenue_drop_20pct", "new_city_proposal"]'::jsonb,
  '["send_daily_brief_email", "approve_reject_changes", "monitor_all_agents", "escalate_critical_issues"]'::jsonb,
  '["supabase", "mailgun"]'::jsonb,
  true, 70, '{}'::jsonb),

('kaizen', 'Kaizen', 'executive', 'Continuous Improvement', 'System-wide optimization and performance analysis',
  '["daily_6am", "after_any_agent_run", "weekly_performance_report"]'::jsonb,
  '["analyze_agent_performance", "identify_low_conversion_sequences", "propose_template_improvements", "update_automation_sequences"]'::jsonb,
  '["supabase"]'::jsonb,
  false, 40, '{}'::jsonb),

('ledger', 'Ledger', 'executive', 'Revenue Tracking', 'Financial reporting and analytics',
  '["daily_8am", "stripe_webhook", "end_of_month"]'::jsonb,
  '["calculate_mrr", "calculate_churn_rate", "revenue_by_city", "revenue_by_category", "commission_calculations", "subscription_analytics"]'::jsonb,
  '["supabase", "stripe"]'::jsonb,
  true, 60, '{}'::jsonb),

-- OUTREACH LAYER (3 agents)

('echo', 'Echo', 'outreach', 'Outbound Messaging Engine', 'Routes SMS/email through 4 agent identities',
  '["new_lead_queued", "followup_due", "automation_sequence_step_due"]'::jsonb,
  '["send_sms_twilio_4_numbers", "send_email_mailgun_4_identities", "log_sales_events", "update_lead_status", "track_delivery"]'::jsonb,
  '["twilio", "mailgun", "supabase"]'::jsonb,
  true, 80, '{}'::jsonb),

('closer', 'Closer', 'outreach', 'Payment Conversion', 'Close hot leads and convert to payment',
  '["lead_interested", "no_payment_after_24h_interest", "followup_on_payment_link_sent"]'::jsonb,
  '["send_payment_link_sms", "send_payment_link_email", "detect_buying_signals", "escalate_to_jason"]'::jsonb,
  '["supabase", "twilio", "mailgun"]'::jsonb,
  false, 50, '{}'::jsonb),

('anchor', 'Anchor', 'outreach', 'Client Retention', 'Renewal tracking and churn prevention',
  '["subscription_nearing_90day_end", "payment_failure", "lead_went_cold"]'::jsonb,
  '["send_renewal_outreach", "detect_churn_risk", "trigger_winback_sequence", "process_payment_recovery"]'::jsonb,
  '["supabase", "twilio", "mailgun", "stripe"]'::jsonb,
  false, 40, '{}'::jsonb),

-- GROWTH LAYER (4 agents)

('prospector', 'Prospector', 'growth', 'Lead Sourcing', 'New lead discovery and sourcing',
  '["daily_5am", "city_lead_count_below_50", "weekly_scrape_cycle"]'::jsonb,
  '["trigger_serpapi_scrape", "import_leads_to_sales_leads", "dedup_check", "validate_lead_quality"]'::jsonb,
  '["supabase"]'::jsonb,
  false, 60, '{}'::jsonb),

('horizon', 'Horizon', 'growth', 'Market Expansion', 'New city identification and expansion strategy',
  '["monthly", "mrr_milestone_hit", "jason_approval_received"]'::jsonb,
  '["analyze_city_performance", "identify_expansion_opportunities", "draft_city_launch_plans", "estimate_expansion_revenue"]'::jsonb,
  '["supabase"]'::jsonb,
  false, 20, '{}'::jsonb),

('beacon', 'Beacon', 'growth', 'Social Proof', 'Testimonials and referral activation',
  '["client_active_30plus_days", "intake_completed"]'::jsonb,
  '["send_review_request_sms", "send_review_request_email", "track_testimonial_submissions", "activate_referral_program"]'::jsonb,
  '["supabase", "twilio", "mailgun"]'::jsonb,
  false, 15, '{}'::jsonb),

('scout', 'Scout', 'intelligence', 'Competitive Intelligence', 'Market research and competitor tracking',
  '["weekly", "new_competitor_detected"]'::jsonb,
  '["track_competitor_activity", "report_market_changes", "identify_market_trends", "assess_competitive_threats"]'::jsonb,
  '["supabase"]'::jsonb,
  false, 10, '{}'::jsonb),

-- OPERATIONS LAYER (3 agents)

('atlas', 'Atlas', 'operations', 'Territory Management', 'Lead routing and assignment by city',
  '["new_lead_imported", "territory_reassignment_request"]'::jsonb,
  '["assign_leads_by_city", "update_agent_territories", "report_territory_coverage", "balance_lead_load"]'::jsonb,
  '["supabase"]'::jsonb,
  true, 80, '{}'::jsonb),

('architect', 'Architect', 'operations', 'Infrastructure & Schema', 'Platform infrastructure and schema management',
  '["migration_needed", "schema_drift_detected"]'::jsonb,
  '["track_migration_status", "identify_schema_issues", "validate_data_integrity", "manage_database_growth"]'::jsonb,
  '["supabase"]'::jsonb,
  false, 30, '{}'::jsonb),

('sync', 'Sync', 'operations', 'Data Synchronization', 'Cross-system data sync and consistency',
  '["hourly", "data_mismatch_detected"]'::jsonb,
  '["sync_stripe_to_spot_assignments", "verify_outreach_data_integrity", "reconcile_lead_status", "detect_data_inconsistencies"]'::jsonb,
  '["supabase", "stripe"]'::jsonb,
  false, 25, '{}'::jsonb),

('sentinel', 'Sentinel', 'operations', 'Security & Fraud Detection', 'Security, fraud detection, and compliance',
  '["suspicious_activity_detected", "new_signup_from_flagged_region"]'::jsonb,
  '["flag_suspicious_leads", "enforce_dnc_lists", "monitor_spam_complaints", "verify_lead_authenticity"]'::jsonb,
  '["supabase"]'::jsonb,
  false, 35, '{}'::jsonb),

-- INTELLIGENCE LAYER (2 agents)

('pulse', 'Pulse', 'intelligence', 'System Health Monitoring', 'System health and error detection',
  '["every_30_minutes", "error_rate_above_5pct", "api_call_failure"]'::jsonb,
  '["check_twilio_api_health", "check_mailgun_api_health", "detect_failed_sends", "alert_jason_on_errors", "generate_health_report"]'::jsonb,
  '["supabase", "twilio", "mailgun"]'::jsonb,
  false, 30, '{}'::jsonb),

('forge', 'Forge', 'intelligence', 'Message Template Optimization', 'Content creation and template optimization',
  '["weekly", "reply_rate_below_10pct", "template_flagged_by_kaizen"]'::jsonb,
  '["analyze_reply_rates_by_template", "identify_best_performing_variants", "update_automation_templates", "generate_new_message_variants"]'::jsonb,
  '["supabase"]'::jsonb,
  false, 20, '{}'::jsonb)

ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  layer = EXCLUDED.layer,
  role = EXCLUDED.role,
  description = EXCLUDED.description,
  triggers = EXCLUDED.triggers,
  capabilities = EXCLUDED.capabilities,
  connected_systems = EXCLUDED.connected_systems,
  completion_pct = EXCLUDED.completion_pct,
  config = EXCLUDED.config,
  updated_at = NOW();

-- Enable RLS on agent_registry
ALTER TABLE agent_registry ENABLE ROW LEVEL SECURITY;

-- RLS policies: service_role has full access, authenticated users have read-only access
DROP POLICY IF EXISTS "service_role_full_access_agent_registry" ON agent_registry;
CREATE POLICY "service_role_full_access_agent_registry" ON agent_registry
  AS PERMISSIVE FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_read_only_agent_registry" ON agent_registry;
CREATE POLICY "authenticated_read_only_agent_registry" ON agent_registry
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (true);

-- Enable RLS on agent_run_log
ALTER TABLE agent_run_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_agent_run_log" ON agent_run_log;
CREATE POLICY "service_role_full_access_agent_run_log" ON agent_run_log
  AS PERMISSIVE FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_read_only_agent_run_log" ON agent_run_log;
CREATE POLICY "authenticated_read_only_agent_run_log" ON agent_run_log
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (true);
