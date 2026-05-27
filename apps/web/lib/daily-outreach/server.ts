import { createServiceClient } from "@/lib/supabase/service";
import {
  buildOutreachDrafts,
  buildSocialPosts,
  DAILY_OUTREACH_TARGETS,
  normalizePriority,
  OUTREACH_CATEGORIES,
  rewriteSocialContent,
  suggestedActionType,
} from "./drafts";
import type {
  DailyOutreachPayload,
  DailyOutreachStats,
  DailyOutreachTask,
  DailySocialPost,
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
  priority?: string | null;
  notes?: string | null;
  last_contacted_at?: string | null;
  follow_up_date?: string | null;
};

type OutreachProspectRow = SourceProspect & { id: string };

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
};

type PoliticalAgentRow = {
  id: string;
  current_task?: string | null;
  status?: string | null;
  last_action?: string | null;
  last_run_at?: string | null;
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

export function calculateDailyStats(
  tasks: DailyOutreachTask[],
  socialPosts: DailySocialPost[],
  activity: OutreachActivity[],
  date: string
): DailyOutreachStats {
  const todayActivity = activity.filter((item) => item.outreach_date === date);
  const completedTasks = tasks.filter((task) => task.completed || task.status === "completed");

  return {
    todayTasks: tasks.length,
    completedToday: completedTasks.length,
    remainingToday: Math.max(0, tasks.length - completedTasks.length),
    emailsSent: todayActivity.filter((item) => item.activity_type === "email_draft_opened").length,
    textsSent: todayActivity.filter((item) => item.activity_type === "sms_draft_opened").length,
    dmsCompleted: todayActivity.filter((item) => item.activity_type === "dm_copied").length,
    followUpsDue: tasks.filter((task) => task.follow_up_date && task.status !== "completed").length,
    responsesReceived: tasks.filter((task) => task.response_received).length,
    groupPostsCompleted: socialPosts.filter((post) => post.posted && post.post_type.toLowerCase().includes("group")).length,
    facebookPostsCompleted: socialPosts.filter((post) => post.posted).length,
  };
}

export async function fetchDailyOutreach(date = todayKey()): Promise<DailyOutreachPayload> {
  const db = createServiceClient();
  const [{ data: tasks }, { data: socialPosts }, { data: activity }] = await Promise.all([
    db
      .from("daily_outreach_tasks")
      .select("*")
      .eq("outreach_date", date)
      .order("completed", { ascending: true })
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
  ]);

  const typedTasks = (tasks ?? []) as DailyOutreachTask[];
  const typedSocialPosts = (socialPosts ?? []) as DailySocialPost[];
  const typedActivity = (activity ?? []) as OutreachActivity[];

  return {
    date,
    stats: calculateDailyStats(typedTasks, typedSocialPosts, typedActivity, date),
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

async function loadConfiguredProspects(db: SupabaseService, category: OutreachCategory, limit: number) {
  const { data, error } = await db
    .from("outreach_prospects")
    .select("*")
    .eq("category", category)
    .in("status", ["available", "follow_up", "queued", "contacted"])
    .order("follow_up_date", { ascending: true, nullsFirst: true })
    .order("last_contacted_at", { ascending: true, nullsFirst: true })
    .limit(limit * 3);

  if (error) return [];

  return ((data ?? []) as OutreachProspectRow[]).map((row) => ({
    prospect_id: row.id,
    source_table: row.source_table,
    source_id: row.source_id,
    category,
    business_name: row.business_name,
    campaign_name: row.campaign_name,
    contact_name: row.contact_name,
    industry: row.industry,
    phone: row.phone,
    email: row.email,
    website: row.website,
    facebook_url: row.facebook_url,
    messenger_url: row.messenger_url,
    priority: row.priority,
    notes: row.notes,
    last_contacted_at: row.last_contacted_at,
    follow_up_date: row.follow_up_date,
  })) satisfies SourceProspect[];
}

async function loadSalesProspects(db: SupabaseService, category: OutreachCategory, limit: number) {
  const categoryFilter =
    category === "Procurement / Supplify"
      ? "Restaurant & Food,Bakery,Restaurant,Food,HVAC,Roofing,Landscaping,Contractors"
      : "Roofing,HVAC,Landscaping,Plumbing,Home Services,Contractors,Remodeling,Pressure Washing";

  let query = db
    .from("sales_leads")
    .select("id,business_name,contact_name,email,phone,website,facebook_url,category,priority,notes,last_contacted_at,next_follow_up_at,score,buying_signal")
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
    ((data ?? []) as SalesLeadRow[]).map((row) => ({
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

function taskFromProspect(prospect: SourceProspect, date: string) {
  const drafts = buildOutreachDrafts({
    category: prospect.category,
    businessName: prospect.business_name,
    campaignName: prospect.campaign_name,
    contactName: prospect.contact_name,
    industry: prospect.industry,
  });

  return {
    outreach_date: date,
    prospect_id: prospect.prospect_id ?? null,
    source_table: prospect.source_table ?? null,
    source_id: prospect.source_id ?? null,
    category: prospect.category,
    business_name: prospect.business_name ?? null,
    campaign_name: prospect.campaign_name ?? null,
    contact_name: prospect.contact_name ?? null,
    industry: prospect.industry ?? null,
    phone: prospect.phone ?? null,
    email: prospect.email ?? null,
    website: prospect.website ?? null,
    facebook_url: prospect.facebook_url ?? null,
    messenger_url: prospect.messenger_url ?? null,
    action_type: suggestedActionType(prospect.category, Boolean(prospect.email), Boolean(prospect.phone)),
    priority: normalizePriority(prospect.priority),
    status: "pending",
    email_subject: drafts.emailSubject,
    email_body: drafts.emailBody,
    sms_body: drafts.smsBody,
    dm_body: drafts.dmBody,
    notes: prospect.notes ?? null,
    follow_up_date: prospect.follow_up_date ?? null,
  };
}

export async function generateDailyOutreach(date = todayKey(), actorId?: string | null) {
  const db = createServiceClient();
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

  const prospectGroups = await Promise.all(
    OUTREACH_CATEGORIES.map(async (category) => {
      const target = DAILY_OUTREACH_TARGETS[category];
      const configured = await loadConfiguredProspects(db, category, target);
      if (configured.length >= target) return rotateProspects(configured, target);
      if (category === "Targeted Campaign" || category === "Procurement / Supplify") {
        const sales = await loadSalesProspects(db, category, target - configured.length);
        return rotateProspects([...configured, ...sales], target);
      }
      if (category === "Political Outreach") {
        const political = await loadPoliticalProspects(db, target - configured.length);
        return rotateProspects([...configured, ...political], target);
      }
      const gov = await loadGovContractTasks(db, target - configured.length);
      return rotateProspects([...configured, ...gov], target);
    })
  );

  const taskRows = prospectGroups.flat().map((prospect) => taskFromProspect(prospect, date));
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
    metadata: { task_count: taskRows.length, social_post_count: socialRows.length },
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
  const allowed = ["status", "notes", "follow_up_date", "response_received"];
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

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function tableHtml(title: string, headers: string[], rows: unknown[][]) {
  const head = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("");
  const body = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
    .join("");
  return `<h2>${escapeHtml(title)}</h2><table border="1"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
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

  const workbook = `<!doctype html>
<html>
<head><meta charset="utf-8"><title>HomeReach Daily Outreach Export</title></head>
<body>
${tableHtml("Completed Tasks", ["Date", "Category", "Name", "Action", "Priority", "Completed At", "Notes"], taskRows.filter((task) => task.completed).map((task) => [
    task.outreach_date,
    task.category,
    task.business_name || task.campaign_name,
    task.action_type,
    task.priority,
    task.completed_at,
    task.notes,
  ]))}
${tableHtml("Incomplete Tasks", ["Date", "Category", "Name", "Action", "Priority", "Status", "Follow Up", "Notes"], taskRows.filter((task) => !task.completed).map((task) => [
    task.outreach_date,
    task.category,
    task.business_name || task.campaign_name,
    task.action_type,
    task.priority,
    task.status,
    task.follow_up_date,
    task.notes,
  ]))}
${tableHtml("Activity History", ["Date", "Type", "Channel", "Category", "Summary", "Created At"], activityRows.map((item) => [
    item.outreach_date,
    item.activity_type,
    item.channel,
    item.category,
    item.summary,
    item.created_at,
  ]))}
${tableHtml("Social Posts", ["Date", "Category", "Post Type", "Audience", "Status", "Posted", "Notes"], postRows.map((post) => [
    post.outreach_date,
    post.category,
    post.post_type,
    post.audience,
    post.status,
    post.posted ? "yes" : "no",
    post.notes,
  ]))}
${tableHtml("Follow Ups", ["Date", "Category", "Name", "Follow Up Date", "Status", "Notes"], taskRows.filter((task) => task.follow_up_date).map((task) => [
    task.outreach_date,
    task.category,
    task.business_name || task.campaign_name,
    task.follow_up_date,
    task.status,
    task.notes,
  ]))}
${tableHtml("Responses Received", ["Date", "Category", "Name", "Status", "Notes"], taskRows.filter((task) => task.response_received).map((task) => [
    task.outreach_date,
    task.category,
    task.business_name || task.campaign_name,
    task.status,
    task.notes,
  ]))}
</body>
</html>`;

  return { workbook, range };
}
