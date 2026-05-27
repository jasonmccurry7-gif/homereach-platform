export type OutreachCategory =
  | "Targeted Campaign"
  | "Procurement / Supplify"
  | "Political Outreach"
  | "Government Contracting";

export type OutreachPriority = "low" | "medium" | "high" | "urgent";

export type DailyOutreachTask = {
  id: string;
  outreach_date: string;
  prospect_id?: string | null;
  source_table?: string | null;
  source_id?: string | null;
  category: OutreachCategory;
  business_name?: string | null;
  campaign_name?: string | null;
  contact_name?: string | null;
  industry?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  facebook_url?: string | null;
  messenger_url?: string | null;
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
  emailsSent: number;
  textsSent: number;
  dmsCompleted: number;
  followUpsDue: number;
  responsesReceived: number;
  groupPostsCompleted: number;
  facebookPostsCompleted: number;
};

export type DailyOutreachPayload = {
  date: string;
  stats: DailyOutreachStats;
  tasks: DailyOutreachTask[];
  socialPosts: DailySocialPost[];
  activity: OutreachActivity[];
};
