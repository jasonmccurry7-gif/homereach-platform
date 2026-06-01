import { createServiceClient } from "@/lib/supabase/service";
import { logOutreachActivity, todayKey } from "./server";
import type { DailyOutreachTask } from "./types";

export const TARGETED_PLAN_TYPE = "daily_targeted_outreach";

export type TargetedOutcomeStatus =
  | "New"
  | "Contacted"
  | "Follow-Up Due"
  | "Interested"
  | "Needs Quote"
  | "Proposal Sent"
  | "Won"
  | "Lost"
  | "Not a Fit";

export type TargetedPlanPayload = {
  date: string;
  stats: {
    newProspects: number;
    followUpsDue: number;
    emailsCompleted: number;
    textsCompleted: number;
    dmsCompleted: number;
    callsCompleted: number;
    interestedReplies: number;
    quotesNeeded: number;
    dailyGoal: number;
    followUpGoal: number;
    completionPercent: number;
  };
  tasks: DailyOutreachTask[];
  socialPosts: Array<{
    id: string;
    post_type: string;
    category: string;
    audience?: string | null;
    content: string;
    short_content?: string | null;
    status: string;
    posted: boolean;
  }>;
  activity: Array<{
    id: string;
    task_id?: string | null;
    activity_type: string;
    channel?: string | null;
    status: string;
    summary?: string | null;
    created_at: string;
    metadata?: Record<string, unknown> | null;
  }>;
  sourceWarning?: string | null;
};

type SourceProspect = {
  source_table: string;
  source_id: string | null;
  prospect_id?: string | null;
  business_name: string;
  contact_name?: string | null;
  industry?: string | null;
  vertical: string;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  facebook_url?: string | null;
  city?: string | null;
  state?: string | null;
  notes?: string | null;
  last_contacted_at?: string | null;
  follow_up_date?: string | null;
  status?: string | null;
  score?: number | null;
  metadata?: Record<string, unknown> | null;
};

const AUTO_VERTICALS = [
  "Dealership",
  "Used car lot",
  "Auto service center",
] as const;

const MEDICAL_VERTICALS = [
  "Dentist",
  "Orthodontist",
  "Doctor",
  "Chiropractor",
  "Med spa",
  "Pediatric dentist",
  "Cosmetic dentist",
] as const;

const OUTCOME_STATUSES: TargetedOutcomeStatus[] = [
  "New",
  "Contacted",
  "Follow-Up Due",
  "Interested",
  "Needs Quote",
  "Proposal Sent",
  "Won",
  "Lost",
  "Not a Fit",
];

function clean(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    const parsed = clean(value);
    if (parsed) return parsed;
  }
  return null;
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
}

function dateAdd(date: string, days: number) {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
}

function stableScore(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function inferTargetedVertical(input: { businessName?: string | null; industry?: string | null }) {
  const text = `${input.businessName ?? ""} ${input.industry ?? ""}`.toLowerCase();
  if (/orthodont|invisalign/.test(text)) return "Orthodontist";
  if (/pediatric.*dent|kids.*dent|children.*dent/.test(text)) return "Pediatric dentist";
  if (/cosmetic.*dent|implant|veneers/.test(text)) return "Cosmetic dentist";
  if (/dentist|dental/.test(text)) return "Dentist";
  if (/med\s*spa|aesthetic|botox|filler|laser/.test(text)) return "Med spa";
  if (/chiro|spine|wellness/.test(text)) return "Chiropractor";
  if (/doctor|physician|medical|clinic|family practice|urgent care/.test(text)) return "Doctor";
  if (/used.*car|pre[-\s]?owned|auto sales/.test(text)) return "Used car lot";
  if (/service center|auto repair|brake|tire|oil change|collision/.test(text)) return "Auto service center";
  if (/dealer|dealership|ford|chevrolet|chevy|toyota|honda|nissan|kia|hyundai|subaru|mazda|jeep|ram|dodge|buick|gmc|cadillac|volkswagen|mercedes|bmw|audi/.test(text)) {
    return "Dealership";
  }
  return null;
}

function isAutoVertical(vertical: string) {
  return AUTO_VERTICALS.includes(vertical as (typeof AUTO_VERTICALS)[number]);
}

function isMedicalVertical(vertical: string) {
  return MEDICAL_VERTICALS.includes(vertical as (typeof MEDICAL_VERTICALS)[number]);
}

function scoreProspect(prospect: SourceProspect) {
  let score = 48;
  const reasons: string[] = [];
  const text = `${prospect.business_name} ${prospect.industry ?? ""} ${prospect.notes ?? ""}`.toLowerCase();

  if (prospect.contact_name) {
    score += 10;
    reasons.push("owner/contact available");
  }
  if (prospect.facebook_url) {
    score += 8;
    reasons.push("Facebook page visible");
  }
  if (prospect.website) score += 5;
  if (isAutoVertical(prospect.vertical)) {
    score += 10;
    reasons.push("high-value auto radius business");
  }
  if (isMedicalVertical(prospect.vertical)) {
    score += 12;
    reasons.push("high-value appointment business");
  }
  if (/service|lane|brake|tire|oil|repair/.test(text)) {
    score += 8;
    reasons.push("service department angle");
  }
  if (/cosmetic|implant|invisalign|orthodont|med\s*spa|botox|filler/.test(text)) {
    score += 10;
    reasons.push("premium treatment offer");
  }
  if (/independent|family|local|owned/.test(text)) {
    score += 6;
    reasons.push("local operator signal");
  }
  if (!prospect.website || !prospect.facebook_url) {
    score += 5;
    reasons.push("marketing presence needs review");
  }
  if (prospect.score) score += Math.min(8, Math.max(0, Math.round(prospect.score / 14)));

  const jitter = stableScore(`${prospect.business_name}:${prospect.city}:${prospect.vertical}`) % 7;
  const finalScore = Math.max(1, Math.min(100, score + jitter));
  return {
    score: finalScore,
    label: reasons.length ? reasons.slice(0, 3).join(", ") : "Needs Review",
  };
}

function recommendedOffer(vertical: string, text: string) {
  const lower = `${vertical} ${text}`.toLowerCase();
  if (isAutoVertical(vertical)) {
    if (/service|repair|brake|tire|oil/.test(lower)) return "service lane postcard campaign";
    if (/used|pre[-\s]?owned/.test(lower)) return "competitor conquest neighborhood campaign";
    return "route-density campaign around existing customer neighborhoods";
  }
  if (/orthodont|invisalign/.test(lower)) return "Invisalign/cosmetic/implant campaign";
  if (/cosmetic|implant|med\s*spa|botox|filler/.test(lower)) return "cosmetic/local authority campaign";
  if (/pediatric|family/.test(lower)) return "family neighborhood awareness campaign";
  if (/doctor|clinic|chiro/.test(lower)) return "new patient campaign";
  return "new mover campaign";
}

function suggestedAction(prospect: SourceProspect, isFollowUp = false) {
  if (isFollowUp) return "Follow up with route-density angle";
  if (prospect.email) return "Send reviewed email draft";
  if (prospect.phone) return "Call or send reviewed SMS draft";
  if (prospect.facebook_url) return "Copy Facebook DM and open page";
  return "Research contact before outreach";
}

function firstName(value?: string | null) {
  return clean(value)?.split(/\s+/)[0] ?? null;
}

function buildMessages(prospect: SourceProspect, offer: string, isFollowUp = false) {
  const contact = firstName(prospect.contact_name);
  const greeting = contact ? `Hi ${contact},` : "Hi,";
  const business = prospect.business_name;
  const city = prospect.city || "your area";
  const vertical = prospect.vertical.toLowerCase();
  const cta = "Would you like me to map out the exact neighborhoods I'd target first around your location?";
  const routeVisual = "[Insert route-density visual here]";
  const opening = isFollowUp
    ? `Quick follow-up on the neighborhood postcard idea for ${business}.`
    : `I had a quick local postcard idea for ${business}.`;

  const emailSubject = isFollowUp
    ? `Re: neighborhood map for ${business}`
    : `${business}: nearby neighborhood campaign idea`;

  return {
    emailSubject,
    emailBody: `${greeting}

${opening} For a ${vertical} business in ${city}, I would start with a simple ${offer}: the nearby streets most likely to remember the name, book an appointment, or come back for service.

HomeReach handles the postcard strategy, route planning, design direction, printing, and mail execution. The point is not to blast everyone. It is to stay visible in the neighborhoods that can actually drive appointments, service revenue, or local authority.

${routeVisual}

${cta}

Josh
HomeReach`,
    smsBody: `${contact ? `Hi ${contact}` : "Hi"}, Josh with HomeReach. I had a quick ${offer} idea for ${business} in ${city}. Want me to map the exact neighborhoods I'd target first? Reply STOP to opt out.`,
    dmBody: `${contact ? `Hi ${contact}` : "Hi"} - Josh with HomeReach. I had a simple ${offer} idea for ${business}: nearby neighborhoods, done-for-you postcards, and a route-density map before anything is mailed. Want me to map the first area I'd target?`,
    callScript: `Hi${contact ? ` ${contact}` : ""}, this is Josh with HomeReach. I am calling because I had a quick local postcard idea for ${business}. For a ${vertical} business in ${city}, I would map the nearby neighborhoods first, then show a simple postcard strategy around ${offer}. The question is simple: would it be useful if I mapped the exact streets I would target first around your location?`,
  };
}

function taskRow(prospect: SourceProspect, date: string, isFollowUp = false) {
  const offer = recommendedOffer(prospect.vertical, `${prospect.industry ?? ""} ${prospect.notes ?? ""}`);
  const score = scoreProspect(prospect);
  const messages = buildMessages(prospect, offer, isFollowUp);
  return {
    outreach_date: date,
    prospect_id: prospect.prospect_id ?? null,
    source_table: prospect.source_table,
    source_id: prospect.source_id,
    category: "Targeted Campaign",
    campaign_type: "targeted_mailing",
    business_name: prospect.business_name,
    contact_name: prospect.contact_name ?? null,
    industry: prospect.industry ?? prospect.vertical,
    vertical: prospect.vertical,
    phone: prospect.phone ?? null,
    email: prospect.email ?? null,
    website: prospect.website ?? null,
    facebook_url: prospect.facebook_url ?? null,
    messenger_url: prospect.facebook_url ? prospect.facebook_url.replace("facebook.com/", "m.me/") : null,
    city: prospect.city ?? null,
    state: prospect.state ?? null,
    action_type: isFollowUp ? "follow_up" : "targeted_outreach",
    priority: score.score >= 82 ? "urgent" : score.score >= 70 ? "high" : score.score >= 55 ? "medium" : "low",
    status: isFollowUp ? "follow_up" : "pending",
    outcome_status: isFollowUp ? "Follow-Up Due" : "New",
    email_subject: messages.emailSubject,
    email_body: messages.emailBody,
    sms_body: messages.smsBody,
    dm_body: messages.dmBody,
    call_script: messages.callScript,
    recommended_offer: offer,
    outreach_priority_score: score.score,
    score_label: score.label,
    today_suggested_action: suggestedAction(prospect, isFollowUp),
    follow_up_date: isFollowUp ? dateAdd(date, 2) : null,
    completed: false,
    response_received: false,
    lead_source: prospect.source_table,
    manual_approval_required: true,
    metadata: {
      ...(prospect.metadata ?? {}),
      plan_type: TARGETED_PLAN_TYPE,
      vertical_group: isAutoVertical(prospect.vertical) ? "auto" : "medical",
      human_review_required: true,
      no_auto_send: true,
      route_density_visual_placeholder: "Insert route-density visual here.",
      follow_up_stage: isFollowUp ? followUpStage(prospect.last_contacted_at) : null,
    },
  };
}

function sourceKey(prospect: SourceProspect) {
  return [
    prospect.source_table,
    prospect.source_id,
    prospect.email?.toLowerCase(),
    prospect.phone?.replace(/\D/g, ""),
    prospect.business_name.toLowerCase(),
  ].filter(Boolean).join("|");
}

function rotate(items: SourceProspect[], limit: number) {
  return items
    .slice()
    .sort((a, b) => {
      const aFollow = a.follow_up_date ? 0 : 1;
      const bFollow = b.follow_up_date ? 0 : 1;
      if (aFollow !== bFollow) return aFollow - bFollow;
      const aContact = a.last_contacted_at ? new Date(a.last_contacted_at).getTime() : 0;
      const bContact = b.last_contacted_at ? new Date(b.last_contacted_at).getTime() : 0;
      if (aContact !== bContact) return aContact - bContact;
      return scoreProspect(b).score - scoreProspect(a).score;
    })
    .slice(0, limit);
}

function unique(items: SourceProspect[], limit: number, used = new Set<string>()) {
  const selected: SourceProspect[] = [];
  for (const item of items) {
    const key = sourceKey(item);
    if (used.has(key)) continue;
    used.add(key);
    selected.push(item);
    if (selected.length >= limit) break;
  }
  return selected;
}

function followUpStage(lastContacted?: string | null) {
  if (!lastContacted) return "Day 2: quick bump";
  const days = Math.floor((Date.now() - new Date(lastContacted).getTime()) / 86400000);
  if (days >= 14) return "Day 14: final soft close";
  if (days >= 7) return "Day 7: offer to map neighborhoods";
  if (days >= 4) return "Day 4: send route-density angle";
  return "Day 2: quick bump";
}

async function loadConfiguredProspects(limit: number) {
  const db = createServiceClient();
  const { data, error } = await db
    .from("outreach_prospects")
    .select("*")
    .eq("category", "Targeted Campaign")
    .neq("status", "do_not_contact")
    .order("follow_up_date", { ascending: true, nullsFirst: true })
    .order("last_contacted_at", { ascending: true, nullsFirst: true })
    .limit(limit * 4);
  if (error) return [];

  return ((data ?? []) as Array<Record<string, unknown>>)
    .map((row) => {
      const vertical = firstString(row.vertical, inferTargetedVertical({
        businessName: firstString(row.business_name),
        industry: firstString(row.industry, row.business_type),
      }));
      if (!vertical || (!isAutoVertical(vertical) && !isMedicalVertical(vertical))) return null;
      return {
        source_table: "outreach_prospects",
        source_id: firstString(row.id),
        prospect_id: firstString(row.id),
        business_name: firstString(row.business_name) ?? "Local business",
        contact_name: firstString(row.contact_name, row.owner_contact_name),
        industry: firstString(row.industry, row.business_type),
        vertical,
        phone: firstString(row.phone),
        email: firstString(row.email),
        website: firstString(row.website),
        facebook_url: firstString(row.facebook_url),
        city: firstString(row.city),
        state: firstString(row.state),
        notes: firstString(row.notes),
        last_contacted_at: firstString(row.last_contacted_at),
        follow_up_date: firstString(row.follow_up_date),
        score: firstNumber(row.outreach_priority_score),
        metadata: typeof row.metadata === "object" && row.metadata ? row.metadata as Record<string, unknown> : {},
      };
    })
    .filter(Boolean) as SourceProspect[];
}

async function loadSalesLeadProspects(limit: number) {
  const db = createServiceClient();
  const { data, error } = await db
    .from("sales_leads")
    .select("id,business_name,contact_name,email,phone,city,state,category,status,source,score,priority,buying_signal,do_not_contact,sms_opt_out,last_contacted_at,next_follow_up_at,website,facebook_url,notes")
    .eq("do_not_contact", false)
    .eq("sms_opt_out", false)
    .not("status", "in", "(closed,dead,won,lost)")
    .order("next_follow_up_at", { ascending: true, nullsFirst: true })
    .order("last_contacted_at", { ascending: true, nullsFirst: true })
    .order("score", { ascending: false, nullsFirst: false })
    .limit(limit * 8);
  if (error) return [];

  return ((data ?? []) as Array<Record<string, unknown>>)
    .map((row) => {
      const vertical = inferTargetedVertical({
        businessName: firstString(row.business_name),
        industry: firstString(row.category),
      });
      if (!vertical) return null;
      return {
        source_table: "sales_leads",
        source_id: firstString(row.id),
        business_name: firstString(row.business_name) ?? "Local business",
        contact_name: firstString(row.contact_name),
        industry: firstString(row.category),
        vertical,
        phone: firstString(row.phone),
        email: firstString(row.email),
        website: firstString(row.website),
        facebook_url: firstString(row.facebook_url),
        city: firstString(row.city),
        state: firstString(row.state),
        notes: firstString(row.notes),
        last_contacted_at: firstString(row.last_contacted_at),
        follow_up_date: firstString(row.next_follow_up_at)?.slice(0, 10) ?? null,
        score: firstNumber(row.score),
        metadata: { source: firstString(row.source), priority: firstString(row.priority), buying_signal: row.buying_signal === true },
      };
    })
    .filter(Boolean) as SourceProspect[];
}

async function loadDueFollowUps(date: string) {
  const db = createServiceClient();
  const { data, error } = await db
    .from("daily_outreach_tasks")
    .select("*")
    .eq("category", "Targeted Campaign")
    .lte("follow_up_date", date)
    .not("outcome_status", "in", '("Won","Lost","Not a Fit")')
    .order("follow_up_date", { ascending: true, nullsFirst: false })
    .limit(10);
  if (error) return [];

  return ((data ?? []) as DailyOutreachTask[])
    .filter((task) => task.metadata?.plan_type === TARGETED_PLAN_TYPE)
    .map((task) => ({
      source_table: task.source_table ?? "daily_outreach_tasks",
      source_id: task.source_id ?? task.id,
      prospect_id: task.prospect_id,
      business_name: task.business_name ?? "Local business",
      contact_name: task.contact_name,
      industry: task.industry,
      vertical: task.vertical ?? inferTargetedVertical({ businessName: task.business_name, industry: task.industry }) ?? "Dentist",
      phone: task.phone,
      email: task.email,
      website: task.website,
      facebook_url: task.facebook_url,
      city: task.city,
      state: task.state,
      notes: task.notes,
      last_contacted_at: task.last_action_at ?? task.completed_at ?? task.created_at,
      follow_up_date: task.follow_up_date,
      score: task.outreach_priority_score,
      metadata: task.metadata ?? {},
    }));
}

function buildSocialPosts(date: string) {
  return [
    {
      outreach_date: date,
      category: "Targeted Campaign",
      post_type: "Facebook group post suggestion",
      audience: "Local business owners",
      content: "Local business owners: if you could put one simple offer in front of the neighborhoods closest to your best customers, what would it be? I am mapping a few local postcard examples this week for service businesses that want visibility without wasting budget.",
      short_content: "What offer would you put in front of the neighborhoods closest to your best customers?",
      status: "draft",
      posted: false,
    },
    {
      outreach_date: date,
      category: "Targeted Campaign",
      post_type: "Local vertical-specific post suggestion",
      audience: "Dealerships, dentists, doctors, and service businesses",
      content: "The best local postcard campaigns usually start smaller than people think: nearby streets, a clear appointment or service offer, and a simple route map before anything gets printed. That is especially useful for dealerships, dentists, med spas, chiropractors, and other local businesses where one new customer can matter.",
      short_content: "Start with nearby streets, a clear service offer, and a simple route map before anything gets printed.",
      status: "draft",
      posted: false,
    },
  ];
}

export async function fetchTargetedOutreachPlan(date = todayKey()): Promise<TargetedPlanPayload> {
  const db = createServiceClient();
  const [{ data: tasks }, { data: socialPosts }, { data: activity }] = await Promise.all([
    db
      .from("daily_outreach_tasks")
      .select("*")
      .eq("outreach_date", date)
      .eq("category", "Targeted Campaign")
      .order("completed", { ascending: true })
      .order("outreach_priority_score", { ascending: false, nullsFirst: false }),
    db
      .from("daily_social_posts")
      .select("id,post_type,category,audience,content,short_content,status,posted")
      .eq("outreach_date", date)
      .eq("category", "Targeted Campaign")
      .in("post_type", ["Facebook group post suggestion", "Local vertical-specific post suggestion"])
      .order("created_at", { ascending: true }),
    db
      .from("outreach_activity_log")
      .select("id,task_id,activity_type,channel,status,summary,metadata,created_at")
      .gte("outreach_date", date)
      .lte("outreach_date", date)
      .order("created_at", { ascending: false })
      .limit(80),
  ]);

  const targetedTasks = ((tasks ?? []) as DailyOutreachTask[])
    .filter((task) => task.metadata?.plan_type === TARGETED_PLAN_TYPE);
  const actionActivity = (activity ?? []) as TargetedPlanPayload["activity"];
  const completedActions = new Set(actionActivity.map((item) => `${item.task_id}:${item.activity_type}`));
  const newProspects = targetedTasks.filter((task) => task.action_type !== "follow_up").length;
  const followUpsDue = targetedTasks.filter((task) => task.action_type === "follow_up" || task.outcome_status === "Follow-Up Due").length;
  const completedCount = targetedTasks.filter((task) => task.completed).length;

  return {
    date,
    stats: {
      newProspects,
      followUpsDue,
      emailsCompleted: targetedTasks.filter((task) => completedActions.has(`${task.id}:email_sent`)).length,
      textsCompleted: targetedTasks.filter((task) => completedActions.has(`${task.id}:sms_sent`)).length,
      dmsCompleted: targetedTasks.filter((task) => completedActions.has(`${task.id}:dm_sent`)).length,
      callsCompleted: targetedTasks.filter((task) => completedActions.has(`${task.id}:called`)).length,
      interestedReplies: targetedTasks.filter((task) => task.outcome_status === "Interested").length,
      quotesNeeded: targetedTasks.filter((task) => task.outcome_status === "Needs Quote").length,
      dailyGoal: 20,
      followUpGoal: 5,
      completionPercent: targetedTasks.length ? Math.round((completedCount / targetedTasks.length) * 100) : 0,
    },
    tasks: targetedTasks,
    socialPosts: socialPosts ?? [],
    activity: actionActivity,
    sourceWarning: targetedTasks.length ? null : "No targeted plan exists for today yet. Generate the plan to pull real dealership, auto, medical, and dental prospects from existing records.",
  };
}

export async function generateTargetedOutreachPlan(date = todayKey(), actorId?: string | null) {
  const db = createServiceClient();
  const { data: existing } = await db
    .from("daily_outreach_tasks")
    .select("id,metadata")
    .eq("outreach_date", date)
    .eq("category", "Targeted Campaign")
    .limit(80);
  if ((existing ?? []).some((row: { metadata?: Record<string, unknown> | null }) => row.metadata?.plan_type === TARGETED_PLAN_TYPE)) {
    return fetchTargetedOutreachPlan(date);
  }

  const [configured, sales, dueFollowUps] = await Promise.all([
    loadConfiguredProspects(80),
    loadSalesLeadProspects(140),
    loadDueFollowUps(date),
  ]);

  const used = new Set<string>();
  const sourceProspects = [...configured, ...sales];
  const auto = unique(rotate(sourceProspects.filter((item) => isAutoVertical(item.vertical)), 30), 10, used);
  const medical = unique(rotate(sourceProspects.filter((item) => isMedicalVertical(item.vertical)), 30), 10, used);
  const followUps = unique(rotate(dueFollowUps, 12), 5, used);
  const rows = [
    ...auto.map((prospect) => taskRow(prospect, date)),
    ...medical.map((prospect) => taskRow(prospect, date)),
    ...followUps.map((prospect) => taskRow(prospect, date, true)),
  ];

  const socialRows = buildSocialPosts(date);
  const [{ error: taskError }, { error: socialError }] = await Promise.all([
    rows.length ? db.from("daily_outreach_tasks").insert(rows) : Promise.resolve({ error: null }),
    db.from("daily_social_posts").insert(socialRows),
  ]);
  if (taskError) throw taskError;
  if (socialError) throw socialError;

  await logOutreachActivity(db, {
    actorId,
    outreachDate: date,
    activityType: "daily_targeted_outreach_plan_generated",
    category: "Targeted Campaign",
    summary: `Generated ${rows.length} targeted postcard outreach tasks.`,
    metadata: {
      plan_type: TARGETED_PLAN_TYPE,
      auto_count: auto.length,
      medical_count: medical.length,
      follow_up_count: followUps.length,
      social_post_count: socialRows.length,
      manual_review_required: true,
    },
  });

  return fetchTargetedOutreachPlan(date);
}

export async function updateTargetedOutreachTask(
  taskId: string,
  patch: {
    outcome_status?: TargetedOutcomeStatus;
    notes?: string;
    follow_up_date?: string | null;
    completed?: boolean;
    activity_type?: string;
    channel?: string;
  },
  actorId?: string | null
) {
  const db = createServiceClient();
  const { data: task, error } = await db.from("daily_outreach_tasks").select("*").eq("id", taskId).maybeSingle();
  if (error) throw error;
  if (!task) return null;

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    last_action_at: new Date().toISOString(),
  };
  if (patch.outcome_status && OUTCOME_STATUSES.includes(patch.outcome_status)) {
    update.outcome_status = patch.outcome_status;
    update.status = patch.outcome_status === "Follow-Up Due" ? "follow_up" : patch.outcome_status === "Contacted" ? "in_progress" : task.status;
  }
  if ("notes" in patch) update.notes = patch.notes ?? null;
  if ("follow_up_date" in patch) {
    update.follow_up_date = patch.follow_up_date ?? null;
    if (patch.follow_up_date) update.outcome_status = "Follow-Up Due";
  }
  if (patch.completed) {
    update.completed = true;
    update.completed_at = new Date().toISOString();
    update.completed_by = actorId ?? null;
    update.status = "completed";
  }

  const { data: updated, error: updateError } = await db
    .from("daily_outreach_tasks")
    .update(update)
    .eq("id", taskId)
    .select("*")
    .single();
  if (updateError) throw updateError;

  const activityType = patch.activity_type ?? (patch.completed ? "task_completed" : "task_updated");
  await logOutreachActivity(db, {
    actorId,
    outreachDate: updated.outreach_date,
    taskId,
    prospectId: updated.prospect_id,
    category: "Targeted Campaign",
    activityType,
    channel: patch.channel,
    summary: `${activityType.replace(/_/g, " ")} for ${updated.business_name ?? "targeted outreach prospect"}.`,
    metadata: {
      plan_type: TARGETED_PLAN_TYPE,
      outcome_status: update.outcome_status ?? updated.outcome_status,
      follow_up_date: update.follow_up_date ?? updated.follow_up_date,
    },
  });

  return updated as DailyOutreachTask;
}
