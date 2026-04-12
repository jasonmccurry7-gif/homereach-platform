// ─────────────────────────────────────────────────────────────────────────────
// Ingestion Types — shared across all ingestion scripts
// ─────────────────────────────────────────────────────────────────────────────

export type RawLead = {
  original_primary_id: string;
  source_table: string;
  source_system: string;
  business_name: string;
  contact_name: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  city: string;
  state: string;
  category: string;
  city_id: string;
  category_id: string;
  facebook_url: string;
  rating: string;
  reviews_count: string;
  notes: string;
  lead_status: string;
  pipeline_stage: string;
  outreach_status: string;
  priority: string;
  score: string;
  source: string;
  enrichment_status: string;
  do_not_contact: string;
  sms_opt_out: string;
  buying_signal: string;
  manual_takeover: string;
  ai_next_action: string;
  last_reply_sentiment: string;
  detected_objection: string;
  preferred_channel: string;
  conversation_status: string;
  fb_conversation_stage: string;
  total_emails_sent: string;
  total_texts_sent: string;
  total_fb_sent: string;
  total_sms_replies: string;
  total_failed: string;
  last_contacted_at: string;
  last_reply_at: string;
  any_buying_signal: string;
  created_at: string;
  updated_at: string;
};

export type RawOutreachEvent = {
  event_id: string;
  lead_id: string;
  business_name: string;
  lead_phone: string;
  lead_email: string;
  channel: string;
  direction: string;
  type: string;
  subject: string;
  message_body: string;
  status: string;
  ai_generated: string;
  buying_signal: string;
  sentiment: string;
  objection_type: string;
  got_reply: string;
  approved: string;
  approved_by: string;
  sent_at: string;
  scheduled_at: string;
  created_at: string;
};

export type RawCompany = {
  id: string;
  name: string;
  contact_name: string;
  email: string;
  phone: string;
  address: string;
  website: string;
  industry: string;
  status: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type RawRevenue = {
  contract_id: string;
  business_id: string;
  business_name: string;
  spot_id: string;
  spot_size: string;
  spot_number: string;
  city: string;
  category: string;
  monthly_value: string;
  status: string;
  start_date: string;
  end_date: string;
  signed_at: string;
};

export type DedupeCandidate = {
  record_1_id: string;
  record_2_id: string;
  match_reason: string;
  match_confidence: string;
  phone: string;
  business_name_1: string;
  business_name_2: string;
};

export type IngestionResult = {
  table: string;
  inserted: number;
  skipped: number;
  errors: number;
  duplicates_flagged: number;
  warnings: string[];
};

export type IngestionLog = {
  timestamp: string;
  phase: string;
  results: IngestionResult[];
  total_inserted: number;
  total_errors: number;
  duration_ms: number;
};
