export type OutreachCategory =
  | "Targeted Campaign"
  | "Procurement / Supplify"
  | "Political Outreach"
  | "Government Contracting";

export type OutreachPriority = "low" | "medium" | "high" | "urgent";

export type DailyOutreachSenderKey = "heather" | "josh" | "chelsi" | "jason";

export type DailyOutreachBusinessLine =
  | "targeted_mailing"
  | "inventory_procurement"
  | "political"
  | "unknown";

export type DailyOutreachCampaignType =
  | "political"
  | "supplyfy"
  | "targeted_mailing"
  | "government_contracting"
  | "unknown";

export type DailyOutreachSenderControl = {
  id?: string;
  sender_key: DailyOutreachSenderKey;
  sender_name: string;
  sender_email: string;
  business_line: DailyOutreachBusinessLine;
  daily_cap: number;
  paused: boolean;
  manual_approval_required: boolean;
  min_spacing_minutes: number;
  business_start_minutes: number;
  business_end_minutes: number;
  timezone: string;
  emails_planned_today?: number;
  emails_sent_today?: number;
  emails_pending_review?: number;
  emails_approved_today?: number;
  created_at?: string | null;
  updated_at?: string | null;
};

export type DailyOutreachCampaignControl = {
  id?: string;
  campaign_type: Extract<DailyOutreachCampaignType, "political" | "supplyfy">;
  display_name: string;
  daily_cap: number;
  paused: boolean;
  manual_approval_required: boolean;
  sunday_sending_enabled: boolean;
  business_start_minutes: number;
  business_end_minutes: number;
  min_spacing_minutes: number;
  timezone: string;
  emails_planned_today?: number;
  emails_sent_today?: number;
  emails_remaining_today?: number;
  emails_failed_today?: number;
  created_at?: string | null;
  updated_at?: string | null;
};

export type OutreachEmailTemplate = {
  id: string;
  campaign_type: Extract<DailyOutreachCampaignType, "political" | "supplyfy">;
  template_key: string;
  display_name: string;
  subject: string;
  body: string;
  variables: string[];
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

export type DailyOutreachReply = {
  id: string;
  prospect_id?: string | null;
  task_id?: string | null;
  campaign_type: DailyOutreachCampaignType;
  sender_email?: string | null;
  from_email?: string | null;
  from_name?: string | null;
  business_or_campaign_name?: string | null;
  original_subject?: string | null;
  reply_preview?: string | null;
  sentiment: "interested" | "maybe_later" | "not_interested" | "needs_follow_up" | "bad_contact";
  status: "open" | "assigned" | "completed" | "snoozed";
  recommended_next_action?: string | null;
  received_at: string;
  created_at?: string | null;
  updated_at?: string | null;
};

export type DailyOutreachTask = {
  id: string;
  outreach_date: string;
  prospect_id?: string | null;
  source_table?: string | null;
  source_id?: string | null;
  category: OutreachCategory;
  campaign_type?: DailyOutreachCampaignType | null;
  business_name?: string | null;
  campaign_name?: string | null;
  contact_name?: string | null;
  industry?: string | null;
  vertical?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  facebook_url?: string | null;
  messenger_url?: string | null;
  city?: string | null;
  county?: string | null;
  state?: string | null;
  source?: string | null;
  recommended_offer?: string | null;
  outreach_priority_score?: number | null;
  score_label?: string | null;
  today_suggested_action?: string | null;
  call_script?: string | null;
  outcome_status?: string | null;
  last_action_at?: string | null;
  action_type: string;
  priority: OutreachPriority;
  status: string;
  email_subject?: string | null;
  email_body?: string | null;
  sms_body?: string | null;
  dm_body?: string | null;
  notes?: string | null;
  completed: boolean;
  completed_at?: string | null;
  completed_by?: string | null;
  follow_up_date?: string | null;
  response_received: boolean;
  sender_key?: DailyOutreachSenderKey | null;
  sender_name?: string | null;
  sender_email?: string | null;
  scheduled_send_at?: string | null;
  send_status?: string | null;
  approval_status?: string | null;
  approval_queue_id?: string | null;
  approved_at?: string | null;
  approved_by?: string | null;
  visual_url?: string | null;
  visual_alt?: string | null;
  visual_type?: string | null;
  subject_variant_key?: string | null;
  cta_variant_key?: string | null;
  intro_variant_key?: string | null;
  signature_variant_key?: string | null;
  daily_sequence?: number | null;
  household_density_estimate?: string | null;
  neighborhood_example?: string | null;
  lead_source?: string | null;
  delivery_status?: string | null;
  opened_at?: string | null;
  replied_at?: string | null;
  bounced_at?: string | null;
  provider_message_id?: string | null;
  last_error?: string | null;
  send_attempts?: number | null;
  manual_approval_required?: boolean | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at?: string | null;
};

export type DailySocialPost = {
  id: string;
  outreach_date: string;
  category: string;
  post_type: string;
  audience?: string | null;
  content: string;
  short_content?: string | null;
  status: string;
  posted: boolean;
  posted_at?: string | null;
  posted_by?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at?: string | null;
};

export type OutreachActivity = {
  id: string;
  outreach_date: string;
  task_id?: string | null;
  social_post_id?: string | null;
  prospect_id?: string | null;
  actor_id?: string | null;
  category?: string | null;
  activity_type: string;
  channel?: string | null;
  status: string;
  summary?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
};

export type DailyOutreachStats = {
  todayTasks: number;
  completedToday: number;
  remainingToday: number;
  emailDraftsOpened: number;
  emailsSent: number;
  emailsScheduled: number;
  emailsPendingApproval: number;
  emailsApproved: number;
  textsSent: number;
  dmsCompleted: number;
  followUpsDue: number;
  responsesReceived: number;
  groupPostsCompleted: number;
  facebookPostsCompleted: number;
  totalEmailsScheduledToday: number;
  totalEmailsRemainingToday: number;
  politicalEmailsSent: number;
  supplyfyEmailsSent: number;
  failedSends: number;
  pausedCampaigns: number;
  repliesReceived: number;
};

export type DailyOutreachPayload = {
  date: string;
  stats: DailyOutreachStats;
  senderControls: DailyOutreachSenderControl[];
  campaignControls: DailyOutreachCampaignControl[];
  templates: OutreachEmailTemplate[];
  replies: DailyOutreachReply[];
  tasks: DailyOutreachTask[];
  socialPosts: DailySocialPost[];
  activity: OutreachActivity[];
};
