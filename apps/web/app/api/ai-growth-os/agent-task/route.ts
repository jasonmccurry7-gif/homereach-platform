import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/api-guards";
import { createServiceClient } from "@/lib/supabase/service";

type JsonRecord = Record<string, unknown>;

const VALID_TASK_TYPES = new Set([
  "content_draft",
  "google_post",
  "review_request",
  "campaign_concept",
  "visibility_plan",
  "assistant_setup",
  "canva_brief",
]);

const AGENT_BY_TASK_TYPE: Record<string, string> = {
  content_draft: "Social Content Agent",
  google_post: "Local SEO Authority Agent",
  review_request: "Review Agent",
  campaign_concept: "Content Strategy Agent",
  visibility_plan: "Local SEO Authority Agent",
  assistant_setup: "Outreach Agent",
  canva_brief: "Design Brief Agent",
};

const EXPECTED_OUTPUT_BY_TASK_TYPE: Record<string, string> = {
  content_draft: "Approval-ready local social content draft with CTA, channel, reuse idea, and safety notes.",
  google_post: "Approval-ready Google Business Profile post draft with local context and posting guardrails.",
  review_request: "Approval-ready review request message with consent, timing, and review-link requirements.",
  campaign_concept: "Approval-ready campaign concept that can support postcard, social, and follow-up workflows.",
  visibility_plan: "Local visibility action plan with scorecard context, next fixes, and owner approval steps.",
  assistant_setup: "AI Web Assistant setup task with knowledge base, lead questions, and escalation rules.",
  canva_brief: "Canva-ready design brief for reviewed content or campaign creative.",
};

const APPROVAL_REQUIREMENTS = [
  "Human approval required before publishing, sending, scheduling, or exporting public content.",
  "No outbound SMS/email, Google profile update, social post, ad, payment action, or campaign launch occurs from this endpoint.",
  "Political, payment, procurement, legal, and compliance-sensitive actions require separate human review.",
];

export async function POST(request: Request) {
  const guard = await requireRole(["admin", "client"]);
  if (!guard.ok) return guard.response;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      {
        error: "AI Workforce persistence is not configured.",
        safeMode: true,
        approvalRequired: true,
      },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as JsonRecord;
  const taskType = normalizeTaskType(body.taskType);
  if (!taskType) {
    return NextResponse.json({ error: "Unsupported AI Growth OS task type." }, { status: 400 });
  }

  const content = trimToLength(stringValue(body.content) ?? "", 6000);
  if (content.length < 20) {
    return NextResponse.json({ error: "Draft content is required before queueing an agent task." }, { status: 400 });
  }

  const title = trimToLength(stringValue(body.title) ?? defaultTitle(taskType), 180);
  const businessName = trimToLength(stringValue(body.businessName) ?? "Local business", 120);
  const city = trimToLength(stringValue(body.city) ?? "", 80);
  const services = trimToLength(stringValue(body.services) ?? "", 240);
  const customers = trimToLength(stringValue(body.customers) ?? "", 240);
  const channel = trimToLength(stringValue(body.channel) ?? "HomeReach Growth Center", 120);
  const cta = trimToLength(stringValue(body.cta) ?? "", 200);
  const reuseIdea = trimToLength(stringValue(body.reuseIdea) ?? "", 500);
  const approvalNote = trimToLength(stringValue(body.approvalNote) ?? "Human approval required.", 500);
  const requestedAgent = stringValue(body.agentName);
  const assignedAgent = requestedAgent && isAllowedGrowthAgent(requestedAgent)
    ? requestedAgent
    : AGENT_BY_TASK_TYPE[taskType];
  const taskPublicId = `GROWTH-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  const userId = guard.user?.id ?? null;
  const now = new Date().toISOString();

  const metadata = {
    source: "ai_growth_os",
    taskType,
    businessName,
    city,
    services,
    customers,
    channel,
    cta,
    reuseIdea,
    approvalNote,
    approvalRequirements: APPROVAL_REQUIREMENTS,
    noAutonomousAction: true,
  };

  const db = createServiceClient();

  try {
    const { data: output, error: outputError } = await db
      .from("ai_outputs")
      .insert({
        title,
        agent_name: assignedAgent,
        workflow: "AI Local Growth OS",
        output_type: taskType,
        content,
        data_sources: [
          "AGENTS.md",
          "AI Growth OS onboarding input",
          "Local Visibility module",
          "AI Web Assistant module",
          "Content Review approval layer",
        ],
        prompt_sop_name: "AI Local Growth OS approval-first content SOP",
        chain_name: "AI Local Growth OS Agent Chain",
        approval_status: "needs_review",
        verification_status: "pending",
        status: "active",
        owner_user_id: userId,
        notes: "Created from AI Growth OS. Draft only; human approval required before use.",
        metadata,
      })
      .select("id,title,agent_name,workflow")
      .single();

    if (outputError) throw outputError;

    const { data: task, error: taskError } = await db
      .from("ai_workforce_tasks")
      .insert({
        task_id: taskPublicId,
        workflow_name: "AI Local Growth OS",
        requestor: "AI Growth Center",
        assigned_agent: assignedAgent,
        priority: priorityForTask(taskType),
        status: "awaiting_approval",
        input_path: "/growth-center",
        input_data: {
          ...metadata,
          outputId: output.id,
        },
        expected_output: EXPECTED_OUTPUT_BY_TASK_TYPE[taskType],
        dependencies: dependenciesForTask(taskType),
        approval_required: true,
        related_client: businessName,
        output_id: output.id,
        owner_user_id: userId,
        created_at: now,
        updated_at: now,
      })
      .select("id,task_id,assigned_agent")
      .single();

    if (taskError) throw taskError;

    const { error: logError } = await db.from("ai_workforce_activity_logs").insert({
      task_id: task.id,
      task_public_id: task.task_id,
      agent_name: task.assigned_agent,
      event_type: "growth_os_task_queued",
      status: "awaiting_approval",
      summary: `AI Growth OS queued "${title}" for ${task.assigned_agent}.`,
      details: {
        taskType,
        outputId: output.id,
        channel,
        noAutonomousAction: true,
        approvalRequirements: APPROVAL_REQUIREMENTS,
      },
      approval_status: "needs_review",
      related_output_id: output.id,
      created_by: userId,
    });

    if (logError) throw logError;

    return NextResponse.json({
      ok: true,
      taskId: task.task_id,
      outputId: output.id,
      assignedAgent: task.assigned_agent,
      approvalRequired: true,
      nextAction: "Review in AI Workforce or Content Review before any public use.",
    });
  } catch (error) {
    const message = errorMessage(error);
    if (/does not exist|Could not find|relation|schema cache/i.test(message)) {
      return NextResponse.json(
        {
          error: message,
          migration: "Run the AI Assets and AI Workforce migrations before queueing Growth OS tasks.",
          safeMode: true,
          approvalRequired: true,
        },
        { status: 503 },
      );
    }

    return NextResponse.json({ error: message, safeMode: true, approvalRequired: true }, { status: 500 });
  }
}

function normalizeTaskType(value: unknown) {
  const taskType = String(value ?? "content_draft").trim();
  return VALID_TASK_TYPES.has(taskType) ? taskType : null;
}

function defaultTitle(taskType: string) {
  return `${taskType.replaceAll("_", " ")} draft`;
}

function priorityForTask(taskType: string) {
  if (taskType === "review_request" || taskType === "assistant_setup" || taskType === "visibility_plan") return "high";
  return "medium";
}

function dependenciesForTask(taskType: string) {
  const shared = ["AGENTS.md approval rules", "AI Assets business context", "Human review"];
  if (taskType === "google_post") return [...shared, "Google Business Profile integration or manual posting workflow"];
  if (taskType === "review_request") return [...shared, "Review link confirmation", "SMS/email opt-in if outbound"];
  if (taskType === "assistant_setup") return [...shared, "AI Web Assistant knowledge base", "Escalation rules"];
  if (taskType === "campaign_concept") return [...shared, "Campaign budget approval", "Creative proof approval"];
  if (taskType === "canva_brief") return [...shared, "Canva connection if live export is requested"];
  return shared;
}

function isAllowedGrowthAgent(agentName: string) {
  return [
    "Social Content Agent",
    "Local SEO Authority Agent",
    "Review Agent",
    "Content Strategy Agent",
    "Design Brief Agent",
    "Outreach Agent",
    "Orchestrator Agent",
  ].includes(agentName);
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function trimToLength(value: string, max: number) {
  return value.trim().slice(0, max);
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const record = error as JsonRecord;
    const parts = [
      stringValue(record.message),
      stringValue(record.details),
      stringValue(record.hint),
      stringValue(record.code) ? `code ${String(record.code)}` : null,
    ].filter(Boolean);
    if (parts.length > 0) return parts.join(" ");
  }
  return "AI Growth OS agent task failed.";
}
