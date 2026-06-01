-- Hermes agent registry entry.
-- Hermes is a read-only communications traffic controller. It does not send
-- customer messages; it watches queues, replies, and provider delivery health.

INSERT INTO agent_registry (
  id,
  name,
  layer,
  role,
  description,
  triggers,
  capabilities,
  connected_systems,
  is_active,
  completion_pct,
  config
) VALUES (
  'hermes',
  'Hermes',
  'operations',
  'Communications Traffic Controller',
  'Read-only monitor for outbound queues, reply backlogs, provider webhooks, and delivery health.',
  '["every_15_minutes", "failed_send_detected", "reply_backlog_detected"]'::jsonb,
  '["monitor_outbound_queues", "monitor_reply_backlog", "monitor_delivery_webhooks", "summarize_channel_health", "flag_operator_attention"]'::jsonb,
  '["supabase", "twilio", "postmark", "mailgun", "stripe"]'::jsonb,
  true,
  35,
  '{"mode":"read_only","sends_customer_messages":false,"requires_approval_for_outbound":true}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  layer = EXCLUDED.layer,
  role = EXCLUDED.role,
  description = EXCLUDED.description,
  triggers = EXCLUDED.triggers,
  capabilities = EXCLUDED.capabilities,
  connected_systems = EXCLUDED.connected_systems,
  is_active = EXCLUDED.is_active,
  completion_pct = EXCLUDED.completion_pct,
  config = EXCLUDED.config,
  updated_at = NOW();
