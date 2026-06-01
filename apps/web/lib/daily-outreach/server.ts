import { createServiceClient } from "@/lib/supabase/service";
import { syncRevenueApprovalLedger } from "@/lib/approvals/revenue-approval-ledger";
import {
  buildOutreachDrafts,
  buildSenderOutreachDrafts,
  buildSocialPosts,
  DAILY_OUTREACH_SENDER_PROFILES,
  DEFAULT_DAILY_OUTREACH_CONTROLS,
  leadSourceForDraft,
  normalizePriority,
  rewriteSocialContent,
  scheduleForSender,
  suggestedActionType,
  visualForSenderDraft,
} from "./drafts";
import type {
  DailyOutreachBusinessLine,
  DailyOutreachCampaignControl,
  DailyOutreachCampaignType,
  DailyOutreachPayload,
  DailyOutreachReply,
  DailyOutreachSenderControl,
  DailyOutreachSenderKey,
  DailyOutreachStats,
  DailyOutreachTask,
  DailySocialPost,
  OutreachEmailTemplate,
  OutreachActivity,
  OutreachCategory,
} from "./types";

type SupabaseService = ReturnType<typeof createServiceClient>;

type SourceProspect = {
  source_table?: string | null;
  source_id?: string | null;
  prospect_id?: string | null;
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
  city?: string | null;
  county?: string | null;
  state?: string | null;
  source?: string | null;
  assigned_sender?: DailyOutreachSenderKey | null;
  priority?: string | null;
  notes?: string | null;
  last_contacted_at?: string | null;
  follow_up_date?: string | null;
};

type SenderControlRow = DailyOutreachSenderControl & {
  id: string;
  updated_by?: string | null;
};

type ApprovalQueueRow = {
  id: string;
  status?: string | null;
  metadata?: Record<string, unknown> | null;
};

type OutreachSystemControls = {
  all_paused?: boolean | null;
  email_paused?: boolean | null;
  outreach_test_mode?: boolean | null;
  manual_approval_mode?: boolean | null;
  email_domain_authentication_verified?: boolean | null;
  postmark_sender_signatures_verified?: boolean | null;
};

type OutreachProspectRow = SourceProspect & {
  id: string;
  owner_contact_name?: string | null;
};

type SalesLeadRow = {
  id: string;
  business_name?: string | null;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  facebook_url?: string | null;
  category?: string | null;
  priority?: string | null;
  notes?: string | null;
  last_contacted_at?: string | null;
  next_follow_up_at?: string | null;
  score?: number | null;
  buying_signal?: boolean | null;
  email_status?: string | null;
};

type PoliticalAgentRow = {
  id: string;
  current_task?: string | null;
  status?: string | null;
  last_action?: string | null;
  last_run_at?: string | null;
};

type CampaignCandidateRow = {
  id: string;
  candidate_name?: string | null;
  campaign_name?: string | null;
  office_sought?: string | null;
  race_level?: string | null;
  county?: string | null;
  city?: string | null;
  state?: string | null;
  campaign_website?: string | null;
  campaign_email?: string | null;
  campaign_phone?: string | null;
  facebook_url?: string | null;
  messenger_url?: string | null;
  campaign_manager_name?: string | null;
  campaign_manager_email?: string | null;
  source_url?: string | null;
  source_type?: string | null;
  priority_score?: number | null;
  status?: string | null;
  last_contacted_at?: string | null;
  next_follow_up_at?: string | null;
  do_not_contact?: boolean | null;
  do_not_email?: boolean | null;
};

type GovContractRow = {
  id: string;
  title?: string | null;
  agency?: string | null;
  source_url?: string | null;
  fit_status?: string | null;
  fit_score?: number | null;
  response_deadline?: string | null;
  recommended_next_action?: string | null;
  created_at?: string | null;
};

export type OutreachImportRow = {
  outreach_date?: string | null;
  category?: string | null;
  business_name?: string | null;
  campaign_name?: string | null;
  contact_name?: string | null;
  industry?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  facebook_url?: string | null;
  messenger_url?: string | null;
  action_type?: string | null;
  priority?: string | null;
  status?: string | null;
  email_subject?: string | null;
  email_body?: string | null;
  sms_body?: string | null;
  dm_body?: string | null;
  notes?: string | null;
  follow_up_date?: string | null;
};

function normalizeCategory(value?: string | null): OutreachCategory {
  const clean = (value ?? "").trim().toLowerCase();
  if (clean.includes("procurement") || clean.includes("supplify")) return "Procurement / Supplify";
  if (clean.includes("supplyfy")) return "Procurement / Supplify";
  if (clean.includes("political")) return "Political Outreach";
  if (clean.includes("government") || clean.includes("contract") || clean.includes("sam")) return "Government Contracting";
  return "Targeted Campaign";
}

function campaignTypeForCategory(category: OutreachCategory): DailyOutreachCampaignType {
  if (category === "Political Outreach") return "political";
  if (category === "Procurement / Supplify") return "supplyfy";
  if (category === "Targeted Campaign") return "targeted_mailing";
  if (category === "Government Contracting") return "government_contracting";
  return "unknown";
}

function activeCampaignControl(
  controls: DailyOutreachCampaignControl[],
  category: OutreachCategory
): DailyOutreachCampaignControl | null {
  const campaignType = campaignTypeForCategory(category);
  if (campaignType !== "political" && campaignType !== "supplyfy") return null;
  return controls.find((control) => control.campaign_type === campaignType) ?? null;
}

function normalizeCampaignType(value?: string | null): DailyOutreachCampaignType {
  const clean = (value ?? "").trim().toLowerCase();
  if (clean === "political" || clean.includes("political")) return "political";
  if (clean === "supplyfy" || clean.includes("supplyfy") || clean.includes("supplify") || clean.includes("procurement")) return "supplyfy";
  if (clean.includes("government") || clean.includes("contract")) return "government_contracting";
  if (clean.includes("mail") || clean.includes("target")) return "targeted_mailing";
  return "unknown";
}

function normalizeImportText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function isSuppressedEmailStatus(value?: string | null) {
  return ["bounced_permanent", "complained", "unsubscribed"].includes(String(value ?? "").toLowerCase());
}

function imageTokenForVisual(visual: { url: string; alt: string }) {
  return `[[image:${visual.url}|${visual.alt}]]`;
}

function replaceDraftImageToken(body: string | null | undefined, visual: { url: string; alt: string }) {
  const token = imageTokenForVisual(visual);
  const current = body ?? "";
  if (/\[\[image:[^\]\r\n]+(?:\|[^\]\r\n]*)?\]\]/.test(current)) {
    return current.replace(/\[\[image:[^\]\r\n]+(?:\|[^\]\r\n]*)?\]\]/, token);
  }
  return `${current.trim()}\n\n${token}`.trim();
}

function taskWithCurrentVisual(task: DailyOutreachTask): DailyOutreachTask {
  if (!task.sender_key || !task.email_body) return task;
  const sequence = task.daily_sequence ?? 1;
  const seed = `${task.outreach_date}:${task.sender_key}:${task.business_name || task.campaign_name || "your organization"}:${sequence}`;
  const visual = visualForSenderDraft({
    senderKey: task.sender_key,
    date: task.outreach_date,
    sequence,
    category: task.category,
    businessName: task.business_name,
    campaignName: task.campaign_name,
    contactName: task.contact_name,
    industry: task.industry,
    sourceId: task.source_id,
    sourceTable: task.source_table,
    city: task.city,
    county: task.county,
    state: task.state,
  }, `${seed}:visual`);

  const emailBody = replaceDraftImageToken(task.email_body, visual);
  if (
    task.visual_url === visual.url &&
    task.visual_alt === visual.alt &&
    task.visual_type === visual.type &&
    task.email_body === emailBody
  ) {
    return task;
  }

  return {
    ...task,
    email_body: emailBody,
    visual_url: visual.url,
    visual_alt: visual.alt,
    visual_type: visual.type,
  };
}

export function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function dateRangeForExport(rangeKey: string, now = new Date()) {
  const end = new Date(now);
  end.setUTCHours(23, 59, 59, 999);

  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);

  if (rangeKey === "week") {
    start.setDate(start.getDate() - 6);
  } else if (rangeKey === "month") {
    start.setDate(start.getDate() - 29);
  }

  return {
    key: rangeKey === "week" || rangeKey === "month" ? rangeKey : "today",
    startDate: todayKey(start),
    endDate: todayKey(end),
  };
}

function defaultControlForSender(senderKey: DailyOutreachSenderKey): DailyOutreachSenderControl {
  const control = DEFAULT_DAILY_OUTREACH_CONTROLS.find((item) => item.sender_key === senderKey);
  if (!control) throw new Error(`Unknown daily outreach sender: ${senderKey}`);
  return { ...control };
}

function mergeSenderControls(rows?: SenderControlRow[] | null): DailyOutreachSenderControl[] {
  const byKey = new Map<DailyOutreachSenderKey, DailyOutreachSenderControl>();
  for (const control of DEFAULT_DAILY_OUTREACH_CONTROLS) {
    byKey.set(control.sender_key, { ...control });
  }
  for (const row of rows ?? []) {
    const key = row.sender_key;
    if (key && byKey.has(key)) {
      byKey.set(key, {
        ...byKey.get(key)!,
        ...row,
        daily_cap: Math.max(0, Math.min(5, Number(row.daily_cap ?? byKey.get(key)!.daily_cap))),
        min_spacing_minutes: Math.max(45, Number(row.min_spacing_minutes ?? 45)),
        business_start_minutes: Number(row.business_start_minutes ?? 510),
        business_end_minutes: Number(row.business_end_minutes ?? 990),
        manual_approval_required: row.manual_approval_required !== false,
        paused: Boolean(row.paused),
      });
    }
  }
  return Array.from(byKey.values());
}

async function fetchSenderControls(db: SupabaseService, date = todayKey()): Promise<DailyOutreachSenderControl[]> {
  const { data, error } = await db
    .from("daily_outreach_sender_controls")
    .select("*")
    .order("sender_key", { ascending: true });

  if (error) throw error;

  const controls = mergeSenderControls(data as SenderControlRow[]);
  const { data: tasks } = await db
    .from("daily_outreach_tasks")
    .select("sender_key,send_status,approval_status")
    .eq("outreach_date", date);

  const rows = (tasks ?? []) as Array<{
    sender_key?: DailyOutreachSenderKey | null;
    send_status?: string | null;
    approval_status?: string | null;
  }>;

  return controls.map((control) => {
    const senderRows = rows.filter((row) => row.sender_key === control.sender_key);
    return {
      ...control,
      emails_planned_today: senderRows.length,
      emails_sent_today: senderRows.filter((row) => row.send_status === "sent").length,
      emails_pending_review: senderRows.filter((row) =>
        ["needs_review", "queued_for_review", "draft"].includes(String(row.approval_status ?? "draft"))
      ).length,
      emails_approved_today: senderRows.filter((row) => row.approval_status === "approved").length,
    };
  });
}

async function upsertDefaultSenderControls(db: SupabaseService) {
  const rows = DEFAULT_DAILY_OUTREACH_CONTROLS.map((control) => ({
    sender_key: control.sender_key,
    sender_name: control.sender_name,
    sender_email: control.sender_email,
    business_line: control.business_line,
    daily_cap: control.daily_cap,
    paused: control.paused,
    manual_approval_required: control.manual_approval_required,
    min_spacing_minutes: control.min_spacing_minutes,
    business_start_minutes: control.business_start_minutes,
    business_end_minutes: control.business_end_minutes,
    timezone: control.timezone,
  }));

  await db
    .from("daily_outreach_sender_controls")
    .upsert(rows, { onConflict: "sender_key", ignoreDuplicates: true });
}

const DEFAULT_CAMPAIGN_CONTROLS: DailyOutreachCampaignControl[] = [
  {
    campaign_type: "political",
    display_name: "Political postcard campaigns",
    daily_cap: 5,
    paused: false,
    manual_approval_required: true,
    sunday_sending_enabled: false,
    business_start_minutes: 510,
    business_end_minutes: 990,
    min_spacing_minutes: 45,
    timezone: "America/New_York",
  },
  {
    campaign_type: "supplyfy",
    display_name: "Supplify restaurants and bakeries",
    daily_cap: 10,
    paused: false,
    manual_approval_required: true,
    sunday_sending_enabled: false,
    business_start_minutes: 510,
    business_end_minutes: 990,
    min_spacing_minutes: 45,
    timezone: "America/New_York",
  },
];

function mergeCampaignControls(
  rows?: Array<DailyOutreachCampaignControl & { id?: string | null }> | null
): DailyOutreachCampaignControl[] {
  const byType = new Map(DEFAULT_CAMPAIGN_CONTROLS.map((control) => [control.campaign_type, { ...control }]));
  for (const row of rows ?? []) {
    if (row.campaign_type === "political" || row.campaign_type === "supplyfy") {
      byType.set(row.campaign_type, {
        ...byType.get(row.campaign_type)!,
        ...row,
        daily_cap: Math.max(0, Math.min(30, Number(row.daily_cap ?? byType.get(row.campaign_type)!.daily_cap))),
        min_spacing_minutes: Math.max(45, Number(row.min_spacing_minutes ?? 45)),
        business_start_minutes: Number(row.business_start_minutes ?? 510),
        business_end_minutes: Number(row.business_end_minutes ?? 990),
        manual_approval_required: row.manual_approval_required !== false,
        sunday_sending_enabled: Boolean(row.sunday_sending_enabled),
        paused: Boolean(row.paused),
      });
    }
  }
  return Array.from(byType.values());
}

async function upsertDefaultCampaignControls(db: SupabaseService) {
  const rows = DEFAULT_CAMPAIGN_CONTROLS.map((control) => ({
    campaign_type: control.campaign_type,
    display_name: control.display_name,
    daily_cap: control.daily_cap,
    paused: control.paused,
    manual_approval_required: control.manual_approval_required,
    sunday_sending_enabled: control.sunday_sending_enabled,
    business_start_minutes: control.business_start_minutes,
    business_end_minutes: control.business_end_minutes,
    min_spacing_minutes: control.min_spacing_minutes,
    timezone: control.timezone,
  }));

  await db
    .from("daily_outreach_campaign_controls")
    .upsert(rows, { onConflict: "campaign_type", ignoreDuplicates: true });
}

async function fetchCampaignControls(db: SupabaseService, date = todayKey()): Promise<DailyOutreachCampaignControl[]> {
  const { data, error } = await db
    .from("daily_outreach_campaign_controls")
    .select("*")
    .order("campaign_type", { ascending: true });

  if (error) throw error;
  const controls = mergeCampaignControls(data as DailyOutreachCampaignControl[]);
  const { data: tasks } = await db
    .from("daily_outreach_tasks")
    .select("campaign_type,send_status")
    .eq("outreach_date", date);

  const rows = (tasks ?? []) as Array<{
    campaign_type?: DailyOutreachCampaignType | null;
    send_status?: string | null;
  }>;

  return controls.map((control) => {
    const campaignRows = rows.filter((row) => row.campaign_type === control.campaign_type);
    const sent = campaignRows.filter((row) => row.send_status === "sent").length;
    const failed = campaignRows.filter((row) => row.send_status === "failed").length;
    return {
      ...control,
      emails_planned_today: campaignRows.length,
      emails_sent_today: sent,
      emails_remaining_today: Math.max(0, control.daily_cap - sent),
      emails_failed_today: failed,
    };
  });
}

async function fetchTemplates(db: SupabaseService): Promise<OutreachEmailTemplate[]> {
  const { data, error } = await db
    .from("outreach_email_templates")
    .select("*")
    .eq("is_active", true)
    .order("campaign_type", { ascending: true })
    .order("template_key", { ascending: true });
  if (error) return [];
  return (data ?? []) as OutreachEmailTemplate[];
}

async function fetchReplies(db: SupabaseService): Promise<DailyOutreachReply[]> {
  const { data, error } = await db
    .from("daily_outreach_replies")
    .select("*")
    .in("status", ["open", "assigned", "snoozed"])
    .order("received_at", { ascending: false })
    .limit(25);
  if (error) return [];
  return (data ?? []) as DailyOutreachReply[];
}

export function calculateDailyStats(
  tasks: DailyOutreachTask[],
  socialPosts: DailySocialPost[],
  activity: OutreachActivity[],
  date: string,
  campaignControls: DailyOutreachCampaignControl[] = [],
  replies: DailyOutreachReply[] = []
): DailyOutreachStats {
  const todayActivity = activity.filter((item) => item.outreach_date === date);
  const completedTasks = tasks.filter((task) => task.completed || task.status === "completed");
  const emailTasks = tasks.filter((task) => task.email);
  const sentEmailTasks = emailTasks.filter((task) => task.send_status === "sent" || task.delivery_status === "sent");

  return {
    todayTasks: tasks.length,
    completedToday: completedTasks.length,
    remainingToday: Math.max(0, tasks.length - completedTasks.length),
    emailDraftsOpened: todayActivity.filter((item) => item.activity_type === "email_draft_opened").length,
    emailsSent: sentEmailTasks.length,
    emailsScheduled: emailTasks.filter((task) => Boolean(task.scheduled_send_at)).length,
    emailsPendingApproval: emailTasks.filter((task) =>
      ["needs_review", "queued_for_review", "draft"].includes(String(task.approval_status ?? "draft"))
    ).length,
    emailsApproved: emailTasks.filter((task) => task.approval_status === "approved").length,
    textsSent: todayActivity.filter((item) => item.activity_type === "sms_draft_opened").length,
    dmsCompleted: todayActivity.filter((item) => item.activity_type === "dm_copied").length,
    followUpsDue: tasks.filter((task) => task.follow_up_date && task.status !== "completed").length,
    responsesReceived: tasks.filter((task) => task.response_received).length,
    groupPostsCompleted: socialPosts.filter((post) => post.posted && post.post_type.toLowerCase().includes("group")).length,
    facebookPostsCompleted: socialPosts.filter((post) => post.posted).length,
    totalEmailsScheduledToday: emailTasks.filter((task) => Boolean(task.scheduled_send_at)).length,
    totalEmailsRemainingToday: emailTasks.filter((task) => !["sent", "failed"].includes(String(task.send_status ?? "draft"))).length,
    politicalEmailsSent: sentEmailTasks.filter((task) => task.campaign_type === "political" || task.category === "Political Outreach").length,
    supplyfyEmailsSent: sentEmailTasks.filter((task) => task.campaign_type === "supplyfy" || task.category === "Procurement / Supplify").length,
    failedSends: emailTasks.filter((task) => task.send_status === "failed" || task.delivery_status === "failed").length,
    pausedCampaigns: campaignControls.filter((control) => control.paused).length,
    repliesReceived: replies.length,
  };
}

export async function fetchDailyOutreach(date = todayKey()): Promise<DailyOutreachPayload> {
  const db = createServiceClient();
  const [
    { data: tasks },
    { data: socialPosts },
    { data: activity },
    senderControls,
    campaignControls,
    templates,
    replies,
  ] = await Promise.all([
    db
      .from("daily_outreach_tasks")
      .select("*")
      .eq("outreach_date", date)
      .order("completed", { ascending: true })
      .order("scheduled_send_at", { ascending: true, nullsFirst: false })
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true }),
    db
      .from("daily_social_posts")
      .select("*")
      .eq("outreach_date", date)
      .order("created_at", { ascending: true }),
    db
      .from("outreach_activity_log")
      .select("*")
      .gte("outreach_date", dateRangeForExport("week").startDate)
      .lte("outreach_date", date)
      .order("created_at", { ascending: false })
      .limit(150),
    fetchSenderControls(db, date),
    fetchCampaignControls(db, date),
    fetchTemplates(db),
    fetchReplies(db),
  ]);

  const typedTasks = ((tasks ?? []) as DailyOutreachTask[]).map(taskWithCurrentVisual);
  const typedSocialPosts = (socialPosts ?? []) as DailySocialPost[];
  const typedActivity = (activity ?? []) as OutreachActivity[];

  return {
    date,
    stats: calculateDailyStats(typedTasks, typedSocialPosts, typedActivity, date, campaignControls, replies),
    senderControls,
    campaignControls,
    templates,
    replies,
    tasks: typedTasks,
    socialPosts: typedSocialPosts,
    activity: typedActivity,
  };
}

function rotateProspects(items: SourceProspect[], limit: number) {
  const priorityScore: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 };
  return items
    .slice()
    .sort((a, b) => {
      const aFollow = a.follow_up_date ? 0 : 1;
      const bFollow = b.follow_up_date ? 0 : 1;
      if (aFollow !== bFollow) return aFollow - bFollow;

      const aContact = a.last_contacted_at ? new Date(a.last_contacted_at).getTime() : 0;
      const bContact = b.last_contacted_at ? new Date(b.last_contacted_at).getTime() : 0;
      if (aContact !== bContact) return aContact - bContact;

      return (priorityScore[b.priority ?? "medium"] ?? 2) - (priorityScore[a.priority ?? "medium"] ?? 2);
    })
    .slice(0, limit);
}

function sourceKey(prospect: SourceProspect) {
  const email = (prospect.email ?? "").trim().toLowerCase();
  const phone = (prospect.phone ?? "").replace(/\D/g, "");
  const source = `${prospect.source_table ?? ""}:${prospect.source_id ?? prospect.prospect_id ?? ""}`;
  const name = (prospect.business_name || prospect.campaign_name || "").trim().toLowerCase();
  return [email, phone, source, name].filter(Boolean).join("|") || JSON.stringify(prospect);
}

function uniqueProspects(prospects: SourceProspect[], used: Set<string>, limit: number) {
  const selected: SourceProspect[] = [];
  for (const prospect of prospects) {
    const key = sourceKey(prospect);
    if (used.has(key)) continue;
    used.add(key);
    selected.push(prospect);
    if (selected.length >= limit) break;
  }
  return selected;
}

async function loadRecentOutreachKeys(db: SupabaseService, date: string, days = 14) {
  const targetDate = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(targetDate.getTime())) return new Set<string>();

  const startDate = new Date(targetDate);
  startDate.setUTCDate(startDate.getUTCDate() - days);
  const startKey = todayKey(startDate);

  const { data, error } = await db
    .from("daily_outreach_tasks")
    .select("source_table,source_id,prospect_id,business_name,campaign_name,email,phone")
    .gte("outreach_date", startKey)
    .lt("outreach_date", date)
    .limit(1000);

  if (error || !data?.length) return new Set<string>();

  return new Set(
    data
      .map((row) =>
        sourceKey({
          category: "Targeted Campaign",
          ...(row as Partial<SourceProspect>),
        })
      )
      .filter(Boolean)
  );
}

async function loadConfiguredProspects(db: SupabaseService, category: OutreachCategory, limit: number) {
  const { data, error } = await db
    .from("outreach_prospects")
    .select("*")
    .eq("category", category)
    .is("opted_out_at", null)
    .in("status", ["available", "follow_up", "queued", "contacted"])
    .order("follow_up_date", { ascending: true, nullsFirst: true })
    .order("last_contacted_at", { ascending: true, nullsFirst: true })
    .limit(limit * 3);

  if (error) return [];

  return ((data ?? []) as OutreachProspectRow[]).map((row) => ({
    prospect_id: row.id,
    source_table: row.source_table ?? "outreach_prospects",
    source_id: row.source_id,
    category,
    business_name: row.business_name,
    campaign_name: row.campaign_name,
    contact_name: row.contact_name ?? row.owner_contact_name,
    industry: row.industry,
    phone: row.phone,
    email: row.email,
    website: row.website,
    facebook_url: row.facebook_url,
    messenger_url: row.messenger_url,
    city: row.city,
    county: row.county,
    state: row.state,
    source: row.source,
    assigned_sender: row.assigned_sender,
    priority: row.priority,
    notes: row.notes,
    last_contacted_at: row.last_contacted_at,
    follow_up_date: row.follow_up_date,
  })) satisfies SourceProspect[];
}

async function loadSalesProspects(db: SupabaseService, category: OutreachCategory, limit: number) {
  const categoryFilter =
    category === "Procurement / Supplify"
      ? "Restaurant & Food,Bakery,Restaurant,Food,Pizza,Cafe,Coffee,Food Service,Catering"
      : "Roofing,HVAC,Landscaping,Plumbing,Home Services,Contractors,Remodeling,Pressure Washing";

  let query = db
    .from("sales_leads")
    .select("id,business_name,contact_name,email,phone,website,facebook_url,category,priority,notes,last_contacted_at,next_follow_up_at,score,buying_signal,email_status")
    .eq("do_not_contact", false)
    .eq("sms_opt_out", false)
    .not("status", "in", "(closed,dead)")
    .order("next_follow_up_at", { ascending: true, nullsFirst: true })
    .order("last_contacted_at", { ascending: true, nullsFirst: true })
    .order("score", { ascending: false })
    .limit(limit * 6);

  if (category === "Procurement / Supplify") {
    query = query.or(categoryFilter.split(",").map((item) => `category.ilike.%${item}%`).join(","));
  }

  const { data, error } = await query;
  if (error) return [];

  return rotateProspects(
    ((data ?? []) as SalesLeadRow[]).filter((row) => !isSuppressedEmailStatus(row.email_status)).map((row) => ({
      source_table: "sales_leads",
      source_id: row.id,
      category,
      business_name: row.business_name,
      contact_name: row.contact_name,
      industry: row.category,
      phone: row.phone,
      email: row.email,
      website: row.website,
      facebook_url: row.facebook_url,
      messenger_url: row.facebook_url ? row.facebook_url.replace("facebook.com/", "m.me/") : null,
      priority: row.buying_signal ? "high" : row.priority,
      notes: row.notes,
      last_contacted_at: row.last_contacted_at,
      follow_up_date: row.next_follow_up_at?.slice?.(0, 10) ?? null,
    })),
    limit
  );
}

async function loadPoliticalProspects(db: SupabaseService, limit: number) {
  const { data: candidates, error: candidateError } = await db
    .from("campaign_candidates")
    .select("id,candidate_name,office_sought,race_level,county,city,state,campaign_website,campaign_email,campaign_phone,facebook_url,messenger_url,campaign_manager_name,campaign_manager_email,source_url,source_type,priority_score,status,last_contacted_at,next_follow_up_at,do_not_contact,do_not_email")
    .eq("do_not_contact", false)
    .eq("do_not_email", false)
    .or("campaign_email.not.is.null,campaign_manager_email.not.is.null")
    .order("next_follow_up_at", { ascending: true, nullsFirst: true })
    .order("last_contacted_at", { ascending: true, nullsFirst: true })
    .order("priority_score", { ascending: false, nullsFirst: false })
    .limit(limit * 3);

  if (!candidateError && candidates?.length) {
    return rotateProspects(
      (candidates as CampaignCandidateRow[]).map((row) => {
        const email = row.campaign_manager_email || row.campaign_email;
        const campaignName = row.candidate_name
          ? `${row.candidate_name}${row.office_sought ? ` for ${row.office_sought}` : ""}`
          : "Political campaign";
        return {
          source_table: "campaign_candidates",
          source_id: row.id,
          category: "Political Outreach" as const,
          business_name: row.campaign_manager_name || null,
          campaign_name: campaignName,
          contact_name: row.campaign_manager_name || row.candidate_name,
          industry: row.office_sought || row.race_level || "Political campaign",
          phone: row.campaign_phone,
          email,
          website: row.campaign_website || row.source_url,
          facebook_url: row.facebook_url,
          messenger_url: row.messenger_url,
          city: row.city,
          county: row.county,
          state: row.state,
          source: row.source_type || "campaign_candidates",
          priority: (row.priority_score ?? 0) >= 75 ? "high" : "medium",
          notes: "Public campaign contact record. Use geography, timing, cost, creative, and execution only.",
          last_contacted_at: row.last_contacted_at,
          follow_up_date: row.next_follow_up_at?.slice?.(0, 10) ?? null,
        };
      }),
      limit
    );
  }

  const { data, error } = await db
    .from("political_candidate_agents")
    .select("id,current_task,status,last_action,last_run_at,candidate_id,campaign_id")
    .not("status", "in", "(approved,production_ready,archived)")
    .order("last_run_at", { ascending: true, nullsFirst: true })
    .limit(limit);

  if (error || !data?.length) return [];

  return (data as PoliticalAgentRow[]).map((row, index) => ({
    source_table: "political_candidate_agents",
    source_id: row.id,
    category: "Political Outreach" as const,
    campaign_name: `Political campaign follow-up ${index + 1}`,
    industry: "Political mail",
    action_type: "planning_follow_up",
    priority: row.status === "blocked" ? "high" : "medium",
    notes: row.current_task || row.last_action || "Review political mail execution next action.",
    last_contacted_at: row.last_run_at,
  }));
}

async function loadGovContractTasks(db: SupabaseService, limit: number) {
  const { data, error } = await db
    .from("gov_contract_opportunities")
    .select("id,title,agency,source_url,fit_status,fit_score,pipeline_status,response_deadline,recommended_next_action,created_at")
    .in("pipeline_status", ["new", "reviewing", "strong_fit", "need_subcontractor", "bid_prep", "awaiting_approval"])
    .order("response_deadline", { ascending: true, nullsFirst: false })
    .order("fit_score", { ascending: false })
    .limit(limit);

  if (error || !data?.length) return [];

  return (data as GovContractRow[]).map((row) => ({
    source_table: "gov_contract_opportunities",
    source_id: row.id,
    category: "Government Contracting" as const,
    business_name: row.agency,
    campaign_name: row.title,
    industry: "Government contracting",
    website: row.source_url,
    action_type: "bid_no_bid_review",
    priority: row.fit_status === "strong_fit" || (row.fit_score ?? 0) >= 75 ? "high" : "medium",
    notes: row.recommended_next_action || "Review fit, deadline, requirements, and bid/no-bid next action.",
    follow_up_date: row.response_deadline?.slice?.(0, 10) ?? null,
    last_contacted_at: row.created_at,
  }));
}

function taskFromProspect(
  prospect: SourceProspect,
  date: string,
  senderKey?: DailyOutreachSenderKey,
  sequence = 1,
  control?: DailyOutreachSenderControl,
  campaignControl?: DailyOutreachCampaignControl | null
) {
  const profile = senderKey ? DAILY_OUTREACH_SENDER_PROFILES[senderKey] : null;
  const drafts = senderKey ? buildSenderOutreachDrafts({
    senderKey,
    date,
    sequence,
    category: prospect.category,
    businessName: prospect.business_name,
    campaignName: prospect.campaign_name,
    contactName: prospect.contact_name,
    industry: prospect.industry,
    sourceId: prospect.source_id,
    sourceTable: prospect.source_table,
    city: prospect.city,
    county: prospect.county,
    state: prospect.state,
  }) : buildOutreachDrafts({
    category: prospect.category,
    businessName: prospect.business_name,
    campaignName: prospect.campaign_name,
    contactName: prospect.contact_name,
    industry: prospect.industry,
  });
  const scheduledSendAt = senderKey
    ? scheduleForSender(date, senderKey, sequence, {
        dailyCap: control?.daily_cap ?? profile?.dailyCap,
        businessStartMinutes: campaignControl?.business_start_minutes ?? control?.business_start_minutes,
        businessEndMinutes: campaignControl?.business_end_minutes ?? control?.business_end_minutes,
        minSpacingMinutes: campaignControl?.min_spacing_minutes ?? control?.min_spacing_minutes,
        timezone: campaignControl?.timezone ?? control?.timezone,
      })
    : null;
  const senderControl = senderKey ? control ?? defaultControlForSender(senderKey) : null;
  const campaignType = campaignTypeForCategory(prospect.category);
  const visual =
    "visual" in drafts && drafts.visual && typeof drafts.visual === "object"
      ? (drafts.visual as { url?: string; alt?: string; type?: string })
      : null;
  const senderFields = drafts as Partial<{
    subjectVariantKey: string;
    ctaVariantKey: string;
    introVariantKey: string;
    signatureVariantKey: string;
    householdDensityEstimate: string;
    neighborhoodExample: string;
  }>;

  return {
    outreach_date: date,
    prospect_id: prospect.prospect_id ?? null,
    source_table: prospect.source_table ?? null,
    source_id: prospect.source_id ?? null,
    category: prospect.category,
    campaign_type: campaignType,
    business_name: prospect.business_name ?? null,
    campaign_name: prospect.campaign_name ?? null,
    contact_name: prospect.contact_name ?? null,
    industry: prospect.industry ?? null,
    phone: prospect.phone ?? null,
    email: prospect.email ?? null,
    website: prospect.website ?? null,
    facebook_url: prospect.facebook_url ?? null,
    messenger_url: prospect.messenger_url ?? null,
    city: prospect.city ?? null,
    county: prospect.county ?? null,
    state: prospect.state ?? null,
    source: prospect.source ?? null,
    action_type: suggestedActionType(prospect.category, Boolean(prospect.email), Boolean(prospect.phone)),
    priority: normalizePriority(prospect.priority),
    status: "pending",
    email_subject: drafts.emailSubject,
    email_body: drafts.emailBody,
    sms_body: drafts.smsBody,
    dm_body: drafts.dmBody,
    notes: prospect.notes ?? null,
    follow_up_date: prospect.follow_up_date ?? null,
    sender_key: senderKey ?? null,
    sender_name: senderControl?.sender_name ?? profile?.senderName ?? null,
    sender_email: senderControl?.sender_email ?? profile?.senderEmail ?? null,
    scheduled_send_at: scheduledSendAt,
    send_status: prospect.email ? "draft" : "no_email",
    approval_status: prospect.email ? "needs_review" : "not_required",
    visual_url: visual?.url ?? null,
    visual_alt: visual?.alt ?? null,
    visual_type: visual?.type ?? null,
    subject_variant_key: senderFields.subjectVariantKey ?? null,
    cta_variant_key: senderFields.ctaVariantKey ?? null,
    intro_variant_key: senderFields.introVariantKey ?? null,
    signature_variant_key: senderFields.signatureVariantKey ?? null,
    daily_sequence: senderKey ? sequence : null,
    household_density_estimate: senderFields.householdDensityEstimate ?? null,
    neighborhood_example: senderFields.neighborhoodExample ?? null,
    lead_source: leadSourceForDraft({ sourceTable: prospect.source_table }),
    delivery_status: prospect.email ? "not_sent" : null,
    send_attempts: 0,
    manual_approval_required: campaignControl?.manual_approval_required ?? senderControl?.manual_approval_required ?? true,
  };
}

export async function generateDailyOutreach(date = todayKey(), actorId?: string | null) {
  const db = createServiceClient();
  await upsertDefaultSenderControls(db);
  await upsertDefaultCampaignControls(db);
  const { data: existing } = await db
    .from("daily_outreach_tasks")
    .select("id")
    .eq("outreach_date", date)
    .limit(1);

  if (existing?.length) {
    await logOutreachActivity(db, {
      actorId,
      outreachDate: date,
      activityType: "generate_skipped_existing_plan",
      summary: "Existing daily outreach plan returned without duplicating tasks.",
    });
    return fetchDailyOutreach(date);
  }

  const senderControls = await fetchSenderControls(db, date);
  const campaignControls = await fetchCampaignControls(db, date);
  const controlsBySender = new Map(senderControls.map((control) => [control.sender_key, control]));
  const campaignCounts = new Map<DailyOutreachCampaignType, number>();
  const used = await loadRecentOutreachKeys(db, date);
  const taskRows: Record<string, unknown>[] = [];

  for (const senderKey of Object.keys(DAILY_OUTREACH_SENDER_PROFILES) as DailyOutreachSenderKey[]) {
    const profile = DAILY_OUTREACH_SENDER_PROFILES[senderKey];
    const control = controlsBySender.get(senderKey) ?? defaultControlForSender(senderKey);
    const campaignControl = activeCampaignControl(campaignControls, profile.category);
    const campaignType = campaignTypeForCategory(profile.category);
    const campaignUsed = campaignCounts.get(campaignType) ?? 0;
    const campaignRemaining = campaignControl
      ? Math.max(0, Number(campaignControl.daily_cap ?? 5) - campaignUsed)
      : Number.POSITIVE_INFINITY;
    const target = control.paused || campaignControl?.paused
      ? 0
      : Math.min(
          profile.dailyCap,
          Math.max(0, Number(control.daily_cap ?? profile.dailyCap)),
          campaignRemaining
        );
    if (target <= 0) continue;

    const configured = await loadConfiguredProspects(db, profile.category, target * 2);
    let prospects = uniqueProspects(rotateProspects(configured, target * 2), used, target);

    if (prospects.length < target) {
      const needed = target - prospects.length;
      if (profile.category === "Targeted Campaign" || profile.category === "Procurement / Supplify") {
        const sales = await loadSalesProspects(db, profile.category, needed * 3);
        prospects = [
          ...prospects,
          ...uniqueProspects(rotateProspects(sales, needed * 3), used, needed),
        ];
      } else if (profile.category === "Political Outreach") {
        const political = await loadPoliticalProspects(db, needed * 2);
        prospects = [
          ...prospects,
          ...uniqueProspects(rotateProspects(political, needed * 2), used, needed),
        ];
      } else {
        const gov = await loadGovContractTasks(db, needed);
        prospects = [
          ...prospects,
          ...uniqueProspects(rotateProspects(gov, needed), used, needed),
        ];
      }
    }

    taskRows.push(
      ...prospects.slice(0, target).map((prospect, index) =>
        taskFromProspect(prospect, date, senderKey, campaignUsed + index + 1, control, activeCampaignControl(campaignControls, prospect.category))
      )
    );
    campaignCounts.set(campaignType, campaignUsed + Math.min(target, prospects.length));
  }

  const socialRows = buildSocialPosts(date);

  const [{ error: taskError }, { error: socialError }] = await Promise.all([
    taskRows.length
      ? db.from("daily_outreach_tasks").insert(taskRows)
      : Promise.resolve({ error: null }),
    db.from("daily_social_posts").insert(socialRows),
  ]);

  if (taskError) throw taskError;
  if (socialError) throw socialError;

  await logOutreachActivity(db, {
    actorId,
    outreachDate: date,
    activityType: "daily_plan_generated",
    summary: `Generated ${taskRows.length} outreach tasks and ${socialRows.length} social drafts.`,
    metadata: {
      task_count: taskRows.length,
      social_post_count: socialRows.length,
      sender_count: senderControls.length,
      sender_caps: senderControls.map((control) => ({
        sender_key: control.sender_key,
        daily_cap: control.daily_cap,
        paused: control.paused,
        manual_approval_required: control.manual_approval_required,
      })),
      campaign_caps: campaignControls.map((control) => ({
        campaign_type: control.campaign_type,
        daily_cap: control.daily_cap,
        paused: control.paused,
        manual_approval_required: control.manual_approval_required,
      })),
    },
  });

  return fetchDailyOutreach(date);
}

export async function logOutreachActivity(
  db: SupabaseService,
  args: {
    actorId?: string | null;
    outreachDate?: string;
    taskId?: string | null;
    socialPostId?: string | null;
    prospectId?: string | null;
    category?: string | null;
    activityType: string;
    channel?: string | null;
    status?: string;
    summary?: string | null;
    metadata?: Record<string, unknown>;
  }
) {
  await db.from("outreach_activity_log").insert({
    outreach_date: args.outreachDate ?? todayKey(),
    task_id: args.taskId ?? null,
    social_post_id: args.socialPostId ?? null,
    prospect_id: args.prospectId ?? null,
    actor_id: args.actorId ?? null,
    category: args.category ?? null,
    activity_type: args.activityType,
    channel: args.channel ?? null,
    status: args.status ?? "logged",
    summary: args.summary ?? null,
    metadata: args.metadata ?? {},
  });
}

function businessLineForTask(task: DailyOutreachTask): DailyOutreachBusinessLine {
  if (task.sender_key) return DAILY_OUTREACH_SENDER_PROFILES[task.sender_key]?.businessLine ?? "unknown";
  if (task.category === "Targeted Campaign") return "targeted_mailing";
  if (task.category === "Procurement / Supplify") return "inventory_procurement";
  if (task.category === "Political Outreach") return "political";
  return "unknown";
}

function metadataForApproval(task: DailyOutreachTask, status: "needs_review" | "approved") {
  const manualSendOnly = task.manual_approval_required !== false;
  return {
    source_system: "daily_outreach_tasks",
    source_id: task.id,
    daily_outreach_task_id: task.id,
    prospect_source_table: task.source_table,
    prospect_source_id: task.source_id,
    source_table: task.source_table,
    source_record_id: task.source_id,
    outreach_date: task.outreach_date,
    sender_key: task.sender_key,
    sender_email: task.sender_email,
    sender_name: task.sender_name,
    from_email: task.sender_email,
    to_email: task.email,
    contact_email: task.email,
    contact_name: task.contact_name,
    display_name: task.business_name || task.campaign_name,
    organization_name: task.business_name || task.campaign_name,
    subject: task.email_subject,
    category: task.category,
    campaign_type: task.campaign_type ?? campaignTypeForCategory(task.category),
    business_line: businessLineForTask(task),
    visual_url: task.visual_url,
    visual_alt: task.visual_alt,
    visual_type: task.visual_type,
    political_options_image_url: (task.campaign_type ?? campaignTypeForCategory(task.category)) === "political"
      ? task.visual_url
      : null,
    cta_variant_key: task.cta_variant_key,
    subject_variant_key: task.subject_variant_key,
    intro_variant_key: task.intro_variant_key,
    signature_variant_key: task.signature_variant_key,
    household_density_estimate: task.household_density_estimate,
    neighborhood_example: task.neighborhood_example,
    source_notes:
      (task.campaign_type ?? campaignTypeForCategory(task.category)) === "targeted_mailing"
        ? "Route density and neighborhood examples are illustrative planning placeholders until reviewed against a real route map."
        : null,
    lead_source: task.lead_source,
    scheduled_send_at: task.scheduled_send_at,
    approval_status: status,
    human_approval_required: true,
    auto_send_enabled: status === "approved" && !manualSendOnly,
    auto_send_disabled: manualSendOnly,
    requires_manual_send: manualSendOnly,
    manual_send_only: manualSendOnly,
    messaging_diversity_required: true,
    duplicate_copy_block_required: true,
  };
}

export async function updateDailyOutreachSenderControl(
  senderKey: DailyOutreachSenderKey,
  patch: Record<string, unknown>,
  actorId?: string | null
) {
  const db = createServiceClient();
  await upsertDefaultSenderControls(db);
  const current = defaultControlForSender(senderKey);
  const update: Record<string, unknown> = {
    sender_key: senderKey,
    sender_name: current.sender_name,
    sender_email: current.sender_email,
    business_line: current.business_line,
    updated_at: new Date().toISOString(),
    updated_by: actorId ?? null,
  };

  if ("paused" in patch) update.paused = Boolean(patch.paused);
  if ("manual_approval_required" in patch) update.manual_approval_required = patch.manual_approval_required !== false;
  if ("daily_cap" in patch) {
    const cap = Number(patch.daily_cap);
    update.daily_cap = Number.isFinite(cap) ? Math.max(0, Math.min(5, Math.floor(cap))) : current.daily_cap;
  }
  if ("business_start_minutes" in patch) {
    const start = Number(patch.business_start_minutes);
    if (Number.isFinite(start)) update.business_start_minutes = Math.max(0, Math.min(1439, Math.floor(start)));
  }
  if ("business_end_minutes" in patch) {
    const end = Number(patch.business_end_minutes);
    if (Number.isFinite(end)) update.business_end_minutes = Math.max(0, Math.min(1439, Math.floor(end)));
  }

  const { data, error } = await db
    .from("daily_outreach_sender_controls")
    .upsert(update, { onConflict: "sender_key" })
    .select("*")
    .single();
  if (error) throw error;

  await logOutreachActivity(db, {
    actorId,
    activityType: "daily_outreach_sender_control_updated",
    channel: "email",
    category: "Daily Outreach",
    summary: `Updated ${current.sender_email} daily outreach sender controls.`,
    metadata: { sender_key: senderKey, patch: update },
  });

  return data as DailyOutreachSenderControl;
}

export async function updateDailyOutreachCampaignControl(
  campaignType: "political" | "supplyfy",
  patch: Record<string, unknown>,
  actorId?: string | null
) {
  const db = createServiceClient();
  await upsertDefaultCampaignControls(db);
  const current = DEFAULT_CAMPAIGN_CONTROLS.find((control) => control.campaign_type === campaignType)!;
  const update: Record<string, unknown> = {
    campaign_type: campaignType,
    display_name: current.display_name,
    updated_at: new Date().toISOString(),
    updated_by: actorId ?? null,
  };

  if ("paused" in patch) update.paused = Boolean(patch.paused);
  if ("manual_approval_required" in patch) update.manual_approval_required = patch.manual_approval_required !== false;
  if ("sunday_sending_enabled" in patch) update.sunday_sending_enabled = Boolean(patch.sunday_sending_enabled);
  if ("daily_cap" in patch) {
    const cap = Number(patch.daily_cap);
    update.daily_cap = Number.isFinite(cap) ? Math.max(0, Math.min(30, Math.floor(cap))) : current.daily_cap;
  }
  if ("business_start_minutes" in patch) {
    const start = Number(patch.business_start_minutes);
    if (Number.isFinite(start)) update.business_start_minutes = Math.max(0, Math.min(1439, Math.floor(start)));
  }
  if ("business_end_minutes" in patch) {
    const end = Number(patch.business_end_minutes);
    if (Number.isFinite(end)) update.business_end_minutes = Math.max(0, Math.min(1439, Math.floor(end)));
  }
  if ("min_spacing_minutes" in patch) {
    const spacing = Number(patch.min_spacing_minutes);
    if (Number.isFinite(spacing)) update.min_spacing_minutes = Math.max(45, Math.min(240, Math.floor(spacing)));
  }

  const { data, error } = await db
    .from("daily_outreach_campaign_controls")
    .upsert(update, { onConflict: "campaign_type" })
    .select("*")
    .single();
  if (error) throw error;

  await logOutreachActivity(db, {
    actorId,
    activityType: "daily_outreach_campaign_control_updated",
    channel: "email",
    category: campaignType === "political" ? "Political Outreach" : "Procurement / Supplify",
    summary: `Updated ${campaignType} campaign-level outreach controls.`,
    metadata: { campaign_type: campaignType, patch: update },
  });

  return data as DailyOutreachCampaignControl;
}

export async function updateOutreachEmailTemplate(
  id: string,
  patch: Record<string, unknown>,
  actorId?: string | null
) {
  const db = createServiceClient();
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    updated_by: actorId ?? null,
  };
  if (typeof patch.subject === "string") update.subject = patch.subject.slice(0, 240);
  if (typeof patch.body === "string") update.body = patch.body.slice(0, 8000);
  if (typeof patch.display_name === "string") update.display_name = patch.display_name.slice(0, 160);
  if (typeof patch.is_active === "boolean") update.is_active = patch.is_active;

  const { data, error } = await db
    .from("outreach_email_templates")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;

  await logOutreachActivity(db, {
    actorId,
    activityType: "outreach_email_template_updated",
    channel: "email",
    category: data.campaign_type === "political" ? "Political Outreach" : "Procurement / Supplify",
    summary: `Updated ${data.display_name} template.`,
    metadata: { template_id: id, template_key: data.template_key },
  });

  return data as OutreachEmailTemplate;
}

export async function addManualOutreachProspect(
  row: Record<string, unknown>,
  actorId?: string | null
) {
  const db = createServiceClient();
  const campaignType = normalizeCampaignType(String(row.campaign_type ?? row.category ?? ""));
  const category: OutreachCategory =
    campaignType === "political"
      ? "Political Outreach"
      : campaignType === "supplyfy"
        ? "Procurement / Supplify"
        : normalizeCategory(String(row.category ?? ""));
  const clean = (value: unknown) => {
    const text = typeof value === "string" ? value.trim() : "";
    return text ? text : null;
  };
  const email = clean(row.email)?.toLowerCase() ?? null;

  const insert = {
    category,
    campaign_type: campaignType === "unknown" ? campaignTypeForCategory(category) : campaignType,
    business_name: clean(row.business_name),
    campaign_name: clean(row.campaign_name),
    contact_name: clean(row.contact_name),
    owner_contact_name: clean(row.owner_contact_name) ?? clean(row.contact_name),
    industry: clean(row.industry) ?? clean(row.business_type),
    business_type: clean(row.business_type) ?? clean(row.industry),
    email,
    phone: clean(row.phone),
    website: clean(row.website),
    facebook_url: clean(row.facebook_url),
    messenger_url: clean(row.messenger_url),
    city: clean(row.city),
    county: clean(row.county),
    state: clean(row.state),
    source: clean(row.source) ?? "manual_admin_entry",
    assigned_sender: clean(row.assigned_sender),
    status: "available",
    priority: normalizePriority(clean(row.priority)),
    notes: clean(row.notes),
  };

  const { data, error } = await db
    .from("outreach_prospects")
    .insert(insert)
    .select("*")
    .single();
  if (error) throw error;

  await logOutreachActivity(db, {
    actorId,
    activityType: "manual_outreach_prospect_added",
    category,
    channel: "email",
    prospectId: data.id,
    summary: `Added ${insert.business_name || insert.campaign_name || email || "manual prospect"} to the Outreach Command Center.`,
    metadata: { campaign_type: insert.campaign_type, assigned_sender: insert.assigned_sender },
  });

  return data;
}

export async function queueDailyOutreachEmail(
  id: string,
  action: "queue_review" | "approve_send",
  actorId?: string | null
) {
  const db = createServiceClient();
  const { data: task, error } = await db
    .from("daily_outreach_tasks")
    .select("*")
    .eq("id", id)
    .maybeSingle<DailyOutreachTask>();
  if (error) throw error;
  if (!task) return null;
  if (!task.email) throw new Error("This outreach task does not have a recipient email.");
  if (!task.sender_email) throw new Error("This outreach task does not have a sender email.");
  if (!task.email_subject || !task.email_body) throw new Error("This outreach task is missing an email draft.");
  if (task.completed) throw new Error("This outreach task is already completed and cannot be re-queued.");
  if (["sent", "sending", "approved_pending_send"].includes(String(task.send_status ?? "").toLowerCase())) {
    throw new Error("This outreach email is already sent, sending, or approved for sending.");
  }
  if (["sent", "sending", "rejected"].includes(String(task.approval_status ?? "").toLowerCase())) {
    throw new Error("This approval state is terminal. Create a new draft instead of reopening it.");
  }
  if (["sent", "delivered", "bounced", "complained", "unsubscribed"].includes(String(task.delivery_status ?? "").toLowerCase())) {
    throw new Error("This delivery state is terminal. Create a new draft instead of reopening it.");
  }

  const currentTask = taskWithCurrentVisual(task);
  const senderControls = await fetchSenderControls(db, currentTask.outreach_date);
  const campaignControls = await fetchCampaignControls(db, currentTask.outreach_date);
  const { data: systemControls, error: systemControlsError } = await db
    .from("system_controls")
    .select("all_paused,email_paused,outreach_test_mode,manual_approval_mode,email_domain_authentication_verified,postmark_sender_signatures_verified")
    .eq("id", 1)
    .maybeSingle<OutreachSystemControls>();
  if (systemControlsError) throw systemControlsError;
  const currentControl = currentTask.sender_key
    ? senderControls.find((control) => control.sender_key === currentTask.sender_key)
    : null;
  const currentCampaignControl = activeCampaignControl(campaignControls, currentTask.category);
  const pausedReasons = [
    systemControls?.all_paused ? "global outbound pause" : null,
    systemControls?.email_paused ? "email channel pause" : null,
    currentControl?.paused ? `${currentControl.sender_email} is paused` : null,
    currentCampaignControl?.paused ? `${currentCampaignControl.display_name} is paused` : null,
  ].filter(Boolean) as string[];
  const senderVerified =
    systemControls?.email_domain_authentication_verified === true &&
    systemControls?.postmark_sender_signatures_verified === true;
  const manualReasons = [
    currentTask.manual_approval_required !== false ? "task was created as manual-review required" : null,
    currentControl && currentControl.manual_approval_required !== false
      ? `${currentControl.sender_email} is in manual-send mode`
      : null,
    currentCampaignControl && currentCampaignControl.manual_approval_required !== false
      ? `${currentCampaignControl.display_name} requires manual send`
      : null,
    systemControls?.manual_approval_mode === true ? "system manual approval mode is enabled" : null,
    systemControls?.outreach_test_mode === true ? "outreach test mode is enabled" : null,
    !senderVerified ? "email domain and sender signatures are not verified" : null,
  ].filter(Boolean) as string[];
  const manualApprovalRequired = manualReasons.length > 0;

  if (action === "approve_send" && pausedReasons.length > 0) {
    throw new Error(`Cannot approve this email for sending while ${pausedReasons.join(", ")}.`);
  }

  if (action === "approve_send" && manualApprovalRequired) {
    throw new Error(`Cannot auto-send this email yet: ${manualReasons.join("; ")}. Queue it for review or update controls after human approval.`);
  }

  const approvalTask = {
    ...currentTask,
    manual_approval_required: manualApprovalRequired,
  };
  const approvalStatus = action === "approve_send" ? "approved" : "needs_review";
  const now = new Date().toISOString();
  const metadata = metadataForApproval(approvalTask, approvalStatus);
  const approvalRow = {
    thread_id: null,
    business_line: businessLineForTask(currentTask),
    channel: "email",
    status: approvalStatus,
    title: currentTask.email_subject ?? "Daily outreach email approval",
    message_body: currentTask.email_body ?? null,
    requested_by: "daily_outreach_engine",
    assigned_to: null,
    due_at: currentTask.scheduled_send_at ?? null,
    metadata: {
      ...metadata,
      queued_by: actorId ?? null,
      queued_at: now,
      approved_by: action === "approve_send" ? actorId ?? null : null,
      approved_at: action === "approve_send" ? now : null,
    },
  };

  let approval: ApprovalQueueRow | null = null;
  if (currentTask.approval_queue_id) {
    const { data: existingApproval, error: existingApprovalError } = await db
      .from("revenue_message_approval_queue")
      .select("id,status,metadata")
      .eq("id", currentTask.approval_queue_id)
      .maybeSingle<ApprovalQueueRow>();
    if (existingApprovalError) throw existingApprovalError;
    if (existingApproval) {
      const existingMetadata = existingApproval.metadata ?? {};
      if (existingMetadata.daily_outreach_task_id && existingMetadata.daily_outreach_task_id !== currentTask.id) {
        throw new Error("Linked approval queue row belongs to a different daily outreach task.");
      }
      if (["sent", "sending"].includes(String(existingApproval.status ?? "").toLowerCase())) {
        throw new Error("Linked approval queue row is already sent or sending.");
      }
    }

    const { data, error: updateError } = await db
      .from("revenue_message_approval_queue")
      .update({
        status: approvalRow.status,
        title: approvalRow.title,
        message_body: approvalRow.message_body,
        due_at: approvalRow.due_at,
        updated_at: now,
        metadata: approvalRow.metadata,
      })
      .eq("id", currentTask.approval_queue_id)
      .in("status", ["draft", "needs_review"])
      .select("id,status,metadata")
      .maybeSingle<ApprovalQueueRow>();
    if (updateError) throw updateError;
    approval = data;
    if (existingApproval && !approval) {
      throw new Error("Linked approval queue row is no longer editable.");
    }
  }

  if (!approval) {
    const { data, error: insertError } = await db
      .from("revenue_message_approval_queue")
      .insert(approvalRow)
      .select("id,status,metadata")
      .single<ApprovalQueueRow>();
    if (insertError) throw insertError;
    approval = data;
  }

  if (approval?.id) {
    const ledgerResult = await syncRevenueApprovalLedger(
      {
        id: approval.id,
        businessLine: approvalRow.business_line,
        channel: approvalRow.channel,
        status: approvalRow.status,
        title: approvalRow.title,
        messageBody: approvalRow.message_body,
        metadata: approvalRow.metadata as Record<string, unknown>,
        requestedBy: actorId ?? null,
        createdAt: now,
        updatedAt: now,
        dueAt: approvalRow.due_at,
      },
      {
        actorId: actorId ?? null,
        actorLabel: "daily_outreach_engine",
        eventType: currentTask.approval_queue_id ? "revenue_approval_updated" : "revenue_approval_created",
      },
    );
    if (!ledgerResult.ok && ledgerResult.error) {
      console.warn("[approval-ledger] daily outreach approval sync skipped:", ledgerResult.error);
    }
  }

  const { data: updatedTask, error: taskError } = await db
    .from("daily_outreach_tasks")
    .update({
      approval_queue_id: approval.id,
      approval_status: approvalStatus,
      manual_approval_required: manualApprovalRequired,
      email_body: currentTask.email_body,
      visual_url: currentTask.visual_url,
      visual_alt: currentTask.visual_alt,
      visual_type: currentTask.visual_type,
      approved_at: action === "approve_send" ? now : task.approved_at,
      approved_by: action === "approve_send" ? actorId ?? null : task.approved_by,
      send_status: action === "approve_send" ? "approved_pending_send" : "queued_for_review",
      updated_at: now,
    })
    .eq("id", id)
    .select("*")
    .single<DailyOutreachTask>();
  if (taskError) throw taskError;

  await logOutreachActivity(db, {
    actorId,
    outreachDate: currentTask.outreach_date,
    taskId: currentTask.id,
    prospectId: currentTask.prospect_id,
    category: currentTask.category,
    activityType: action === "approve_send" ? "email_approved_for_send" : "email_queued_for_review",
    channel: "email",
    status: "logged",
    summary:
      action === "approve_send"
        ? `Approved scheduled email for ${currentTask.business_name || currentTask.campaign_name || currentTask.email}.`
        : `Queued email review for ${currentTask.business_name || currentTask.campaign_name || currentTask.email}.`,
    metadata: {
      approval_queue_id: approval.id,
      approval_status: approvalStatus,
      scheduled_send_at: currentTask.scheduled_send_at,
      sender_email: currentTask.sender_email,
      visual_url: currentTask.visual_url,
      visual_type: currentTask.visual_type,
      manual_approval_required: manualApprovalRequired,
      paused_reasons: pausedReasons,
      manual_reasons: manualReasons,
    },
  });

  return {
    task: updatedTask,
    approval,
  };
}

export async function updateDailyOutreachTask(
  id: string,
  patch: Record<string, unknown>,
  actorId?: string | null
) {
  const db = createServiceClient();
  const { data: existing, error: existingError } = await db
    .from("daily_outreach_tasks")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (existingError) throw existingError;
  if (!existing) return null;

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const allowed = [
    "status",
    "notes",
    "follow_up_date",
    "response_received",
    "send_status",
    "approval_status",
    "scheduled_send_at",
    "delivery_status",
    "last_error",
  ];
  for (const key of allowed) {
    if (key in patch) update[key] = patch[key];
  }

  if (patch.completed === true) {
    update.completed = true;
    update.status = "completed";
    update.completed_at = new Date().toISOString();
    update.completed_by = actorId ?? null;
  }

  const { data, error } = await db
    .from("daily_outreach_tasks")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;

  const activityType = patch.completed === true
    ? "task_completed"
    : "task_updated";

  await logOutreachActivity(db, {
    actorId,
    outreachDate: data.outreach_date,
    taskId: id,
    prospectId: data.prospect_id,
    category: data.category,
    activityType,
    summary: patch.completed === true
      ? `Completed ${data.business_name || data.campaign_name || "outreach task"}.`
      : `Updated ${data.business_name || data.campaign_name || "outreach task"}.`,
    metadata: { patch },
  });

  if (patch.completed === true && data.prospect_id) {
    await db
      .from("outreach_prospects")
      .update({
        status: "completed",
        last_contacted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.prospect_id);
  }

  return data as DailyOutreachTask;
}

export async function logTaskAction(
  id: string,
  actionType: string,
  actorId?: string | null,
  channel?: string | null
) {
  const db = createServiceClient();
  const { data: task, error } = await db
    .from("daily_outreach_tasks")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!task) return null;

  await logOutreachActivity(db, {
    actorId,
    outreachDate: task.outreach_date,
    taskId: id,
    prospectId: task.prospect_id,
    category: task.category,
    activityType: actionType,
    channel,
    summary: `${actionType.replace(/_/g, " ")} for ${task.business_name || task.campaign_name || "daily outreach task"}.`,
  });

  return task as DailyOutreachTask;
}

export async function updateDailySocialPost(
  id: string,
  patch: Record<string, unknown>,
  actorId?: string | null
) {
  const db = createServiceClient();
  const { data: existing, error: existingError } = await db
    .from("daily_social_posts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (existingError) throw existingError;
  if (!existing) return null;

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof patch.notes === "string") update.notes = patch.notes;
  if (typeof patch.status === "string") update.status = patch.status;
  if (patch.posted === true) {
    update.posted = true;
    update.status = "posted";
    update.posted_at = new Date().toISOString();
    update.posted_by = actorId ?? null;
  }
  if (patch.rewrite_mode === "emotional" || patch.rewrite_mode === "direct" || patch.rewrite_mode === "professional") {
    update.content = rewriteSocialContent(existing.content, patch.rewrite_mode);
    update.status = "draft";
  }

  const { data, error } = await db
    .from("daily_social_posts")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;

  await logOutreachActivity(db, {
    actorId,
    outreachDate: data.outreach_date,
    socialPostId: id,
    category: data.category,
    activityType: patch.posted === true ? "post_marked_posted" : patch.rewrite_mode ? "post_rewritten" : "post_updated",
    channel: "facebook",
    summary: `${data.post_type} ${patch.posted === true ? "marked posted" : "updated"}.`,
    metadata: { patch },
  });

  return data as DailySocialPost;
}

export async function logSocialAction(
  id: string,
  actionType: string,
  actorId?: string | null
) {
  const db = createServiceClient();
  const { data: post, error } = await db
    .from("daily_social_posts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!post) return null;

  await logOutreachActivity(db, {
    actorId,
    outreachDate: post.outreach_date,
    socialPostId: id,
    category: post.category,
    activityType: actionType,
    channel: "facebook",
    summary: `${actionType.replace(/_/g, " ")} for ${post.post_type}.`,
  });

  return post as DailySocialPost;
}

export async function importDailyOutreachRows(
  rows: OutreachImportRow[],
  fallbackDate = todayKey(),
  actorId?: string | null
) {
  const db = createServiceClient();
  const limitedRows = rows.slice(0, 250);
  const normalizedRows = limitedRows
    .map((row) => {
      const category = normalizeCategory(row.category);
      const businessName = normalizeImportText(row.business_name);
      const campaignName = normalizeImportText(row.campaign_name);
      const contactName = normalizeImportText(row.contact_name);
      const industry = normalizeImportText(row.industry);
      const date = normalizeImportText(row.outreach_date) ?? fallbackDate;
      const drafts = buildOutreachDrafts({
        category,
        businessName,
        campaignName,
        contactName,
        industry,
      });

      return {
        outreach_date: date,
        category,
        campaign_type: campaignTypeForCategory(category),
        business_name: businessName,
        campaign_name: campaignName,
        contact_name: contactName,
        industry,
        phone: normalizeImportText(row.phone),
        email: normalizeImportText(row.email),
        website: normalizeImportText(row.website),
        facebook_url: normalizeImportText(row.facebook_url),
        messenger_url: normalizeImportText(row.messenger_url),
        action_type:
          normalizeImportText(row.action_type) ??
          suggestedActionType(category, Boolean(row.email), Boolean(row.phone)),
        priority: normalizePriority(row.priority),
        status: normalizeImportText(row.status) ?? "pending",
        email_subject: normalizeImportText(row.email_subject) ?? drafts.emailSubject,
        email_body: normalizeImportText(row.email_body) ?? drafts.emailBody,
        sms_body: normalizeImportText(row.sms_body) ?? drafts.smsBody,
        dm_body: normalizeImportText(row.dm_body) ?? drafts.dmBody,
        notes: normalizeImportText(row.notes),
        follow_up_date: normalizeImportText(row.follow_up_date),
      };
    })
    .filter((row) => row.business_name || row.campaign_name || row.email || row.phone);

  const dates = Array.from(new Set(normalizedRows.map((row) => row.outreach_date)));
  const { data: existing } = dates.length
    ? await db
        .from("daily_outreach_tasks")
        .select("outreach_date,business_name,campaign_name,email,phone")
        .in("outreach_date", dates)
    : { data: [] };

  const existingKeys = new Set(
    ((existing ?? []) as Array<{
      outreach_date: string;
      business_name?: string | null;
      campaign_name?: string | null;
      email?: string | null;
      phone?: string | null;
    }>).map((row) =>
      [
        row.outreach_date,
        (row.email || "").toLowerCase(),
        (row.phone || "").replace(/\D/g, ""),
        (row.business_name || row.campaign_name || "").toLowerCase(),
      ].join("|")
    )
  );

  const dedupedRows = normalizedRows.filter((row) => {
    const key = [
      row.outreach_date,
      (row.email || "").toLowerCase(),
      (row.phone || "").replace(/\D/g, ""),
      (row.business_name || row.campaign_name || "").toLowerCase(),
    ].join("|");
    if (existingKeys.has(key)) return false;
    existingKeys.add(key);
    return true;
  });

  if (dedupedRows.length > 0) {
    const { error } = await db.from("daily_outreach_tasks").insert(dedupedRows);
    if (error) throw error;
  }

  await logOutreachActivity(db, {
    actorId,
    outreachDate: fallbackDate,
    activityType: "outreach_plan_imported",
    summary: `Imported ${dedupedRows.length} outreach tasks; skipped ${normalizedRows.length - dedupedRows.length} duplicates.`,
    metadata: {
      received_rows: rows.length,
      valid_rows: normalizedRows.length,
      inserted_rows: dedupedRows.length,
      duplicate_rows: normalizedRows.length - dedupedRows.length,
    },
  });

  return {
    received: rows.length,
    valid: normalizedRows.length,
    inserted: dedupedRows.length,
    duplicates: normalizedRows.length - dedupedRows.length,
  };
}

function escapeXml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function worksheetXml(title: string, headers: string[], rows: unknown[][]) {
  const safeTitle = escapeXml(title).slice(0, 31);
  const head = headers.map((header) => `<Cell><Data ss:Type="String">${escapeXml(header)}</Data></Cell>`).join("");
  const body = rows
    .map((row) => `<Row>${row.map((cell) => `<Cell><Data ss:Type="String">${escapeXml(cell)}</Data></Cell>`).join("")}</Row>`)
    .join("");
  return `<Worksheet ss:Name="${safeTitle}"><Table><Row>${head}</Row>${body}</Table></Worksheet>`;
}

export async function buildExcelExport(rangeKey: string, actorId?: string | null) {
  const db = createServiceClient();
  const range = dateRangeForExport(rangeKey);
  const [{ data: tasks }, { data: posts }, { data: activity }] = await Promise.all([
    db
      .from("daily_outreach_tasks")
      .select("*")
      .gte("outreach_date", range.startDate)
      .lte("outreach_date", range.endDate)
      .order("outreach_date", { ascending: false }),
    db
      .from("daily_social_posts")
      .select("*")
      .gte("outreach_date", range.startDate)
      .lte("outreach_date", range.endDate)
      .order("outreach_date", { ascending: false }),
    db
      .from("outreach_activity_log")
      .select("*")
      .gte("outreach_date", range.startDate)
      .lte("outreach_date", range.endDate)
      .order("created_at", { ascending: false }),
  ]);

  const taskRows = (tasks ?? []) as DailyOutreachTask[];
  const postRows = (posts ?? []) as DailySocialPost[];
  const activityRows = (activity ?? []) as OutreachActivity[];

  await db.from("outreach_exports").insert({
    requested_by: actorId ?? null,
    range_key: range.key,
    started_on: range.startDate,
    ended_on: range.endDate,
    task_count: taskRows.length,
    social_post_count: postRows.length,
    activity_count: activityRows.length,
    export_format: "xls",
  });

  const workbook = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
${worksheetXml("Completed Tasks", ["Date", "Sender", "Category", "Name", "Action", "Priority", "Send Status", "Completed At", "Notes"], taskRows.filter((task) => task.completed).map((task) => [
    task.outreach_date,
    task.sender_email,
    task.category,
    task.business_name || task.campaign_name,
    task.action_type,
    task.priority,
    task.send_status,
    task.completed_at,
    task.notes,
  ]))}
${worksheetXml("Incomplete Tasks", ["Date", "Sender", "Scheduled", "Category", "Name", "Action", "Priority", "Status", "Approval", "Send Status", "Visual", "Follow Up", "Notes"], taskRows.filter((task) => !task.completed).map((task) => [
    task.outreach_date,
    task.sender_email,
    task.scheduled_send_at,
    task.category,
    task.business_name || task.campaign_name,
    task.action_type,
    task.priority,
    task.status,
    task.approval_status,
    task.send_status,
    task.visual_url,
    task.follow_up_date,
    task.notes,
  ]))}
${worksheetXml("Activity History", ["Date", "Type", "Channel", "Category", "Summary", "Created At"], activityRows.map((item) => [
    item.outreach_date,
    item.activity_type,
    item.channel,
    item.category,
    item.summary,
    item.created_at,
  ]))}
${worksheetXml("Social Posts", ["Date", "Category", "Post Type", "Audience", "Status", "Posted", "Notes"], postRows.map((post) => [
    post.outreach_date,
    post.category,
    post.post_type,
    post.audience,
    post.status,
    post.posted ? "yes" : "no",
    post.notes,
  ]))}
${worksheetXml("Follow Ups", ["Date", "Category", "Name", "Follow Up Date", "Status", "Notes"], taskRows.filter((task) => task.follow_up_date).map((task) => [
    task.outreach_date,
    task.category,
    task.business_name || task.campaign_name,
    task.follow_up_date,
    task.status,
    task.notes,
  ]))}
${worksheetXml("Responses Received", ["Date", "Category", "Name", "Status", "Notes"], taskRows.filter((task) => task.response_received).map((task) => [
    task.outreach_date,
    task.category,
    task.business_name || task.campaign_name,
    task.status,
    task.notes,
  ]))}
</Workbook>`;

  return { workbook, range };
}
