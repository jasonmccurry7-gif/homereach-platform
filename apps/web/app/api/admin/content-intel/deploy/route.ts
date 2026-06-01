import { NextResponse, type NextRequest } from "next/server";
import { ciFlagGate, requireAdmin } from "@/lib/content-intel/guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type InsightRow = {
  id: string;
  category: string;
  theme: string | null;
  insight_text: string;
  apex_score: number | null;
  is_translated: boolean | null;
  status: string | null;
  created_at: string | null;
};
type ExistingTaskRow = {
  id: string;
  task_id: string;
  status: string | null;
  output_id: string | null;
};
type CreatedTaskRow = {
  id: string;
  task_id: string;
};
type CreatedOutputRow = {
  id: string;
  title: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  const gate = ciFlagGate();
  if (gate) return gate;

  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const insightId = readString((body as Record<string, unknown> | null)?.insightId);
  if (!insightId || !UUID_PATTERN.test(insightId)) {
    return NextResponse.json({ ok: false, error: "valid insightId is required" }, { status: 400 });
  }

  const { data: insight, error: insightError } = await admin.supa
    .from("ci_insights")
    .select("id, category, theme, insight_text, apex_score, is_translated, status, created_at")
    .eq("id", insightId)
    .maybeSingle();

  if (insightError) {
    return NextResponse.json({ ok: false, error: insightError.message }, { status: 500 });
  }

  if (!insight) {
    return NextResponse.json({ ok: false, error: "insight not found" }, { status: 404 });
  }

  const row = insight as InsightRow;
  const deployment = classifyDeployment(row);
  const taskPublicId = `CI-${row.id.slice(0, 8).toUpperCase()}`;

  const { data: existingTask, error: existingTaskError } = await admin.supa
    .from("ai_workforce_tasks")
    .select("id, task_id, status, output_id")
    .eq("task_id", taskPublicId)
    .maybeSingle();

  if (existingTaskError) {
    return NextResponse.json({ ok: false, error: existingTaskError.message }, { status: 500 });
  }

  const existing = existingTask as ExistingTaskRow | null;
  if (existing) {
    return NextResponse.json({
      ok: true,
      duplicate: true,
      taskId: existing.task_id,
      taskDbId: existing.id,
      outputId: existing.output_id ?? null,
      message: "This insight is already staged in the AI Workforce enhancement queue.",
    });
  }

  const metadata = {
    source: "content_intelligence",
    source_insight_id: row.id,
    category: row.category,
    theme: row.theme,
    apex_score: Number(row.apex_score ?? 0),
    translated: Boolean(row.is_translated),
    deployment_targets: deployment.targets,
    safety: {
      review_only: true,
      human_approval_required: true,
      no_public_copy_or_outbound_change_without_approval: true,
    },
  };

  const { data: task, error: taskError } = await admin.supa
    .from("ai_workforce_tasks")
    .insert({
      task_id: taskPublicId,
      workflow_name: "Content Intelligence Enhancement Loop",
      requestor: "Content Intelligence Agent",
      assigned_agent: deployment.agent,
      priority: deployment.priority,
      status: "awaiting_approval",
      input_path: "/admin/content-intel",
      input_data: metadata,
      expected_output:
        "Review-ready ecosystem enhancement with target surfaces, copy/UX recommendation, verification checklist, and rollout notes.",
      dependencies: [
        "HomeReach AI Assets business context",
        "Content Intelligence source insight",
        "Human approval checklist",
      ],
      approval_required: true,
      related_campaign: deployment.relatedCampaign,
      related_client: deployment.relatedClient,
      related_opportunity: row.theme ?? row.category,
      owner_user_id: admin.agentId,
      completion_notes: "Created from approved Content Intelligence insight. Review required before use.",
    })
    .select("id, task_id")
    .single();

  if (taskError || !task) {
    return NextResponse.json({ ok: false, error: taskError?.message ?? "task insert failed" }, { status: 500 });
  }
  const createdTask = task as CreatedTaskRow;

  const outputContent = buildEnhancementBrief(row, deployment);
  const { data: output, error: outputError } = await admin.supa
    .from("ai_outputs")
    .insert({
      title: `Content Intel enhancement: ${displayTheme(row)}`,
      agent_name: "Content Intelligence Agent",
      workflow: "Content Intelligence Enhancement Loop",
      output_type: "ecosystem_enhancement_task",
      content: outputContent,
      data_sources: [
        "Content Intelligence APEX insight",
        "AI Assets business context",
        "AI Workforce approval rules",
      ],
      prompt_sop_name: "Content Strategy Agent / Growth Intelligence SOP",
      chain_name: "Content Intel -> AI Workforce -> Human Review -> Ecosystem Enhancement",
      approval_status: "needs_review",
      verification_status: "needs_review",
      status: "active",
      owner_user_id: admin.agentId,
      notes:
        "Staged by Content Intelligence. This does not publish, send, change pricing, or modify live campaigns until separately approved.",
      metadata,
    })
    .select("id, title")
    .single();

  if (outputError || !output) {
    await admin.supa
      .from("ai_workforce_tasks")
      .update({
        status: "blocked",
        error_notes: outputError?.message ?? "AI output insert failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", createdTask.id);
    return NextResponse.json({ ok: false, error: outputError?.message ?? "output insert failed" }, { status: 500 });
  }
  const createdOutput = output as CreatedOutputRow;

  await Promise.all([
    admin.supa
      .from("ai_workforce_tasks")
      .update({ output_id: createdOutput.id, updated_at: new Date().toISOString() })
      .eq("id", createdTask.id),
    admin.supa.from("ai_workforce_activity_logs").insert({
      task_id: createdTask.id,
      task_public_id: createdTask.task_id,
      agent_name: "Content Intelligence Agent",
      event_type: "content_intel_enhancement_staged",
      status: "awaiting_approval",
      summary: `Content Intelligence staged "${displayTheme(row)}" as an ecosystem enhancement.`,
      details: metadata,
      approval_status: "needs_review",
      related_output_id: createdOutput.id,
      created_by: admin.agentId,
    }),
    admin.supa.from("ci_outcome_events").insert({
      item_type: "enhancement",
      item_id: createdTask.id,
      outcome: "pending",
      agent_id: admin.agentId,
      notes: `Staged insight ${row.id} for review-only ecosystem enhancement.`,
    }),
    admin.supa.from("ci_outcome_events").insert({
      item_type: "insight",
      item_id: row.id,
      outcome: "win",
      agent_id: admin.agentId,
      notes: `Approved insight ${row.id} while staging a review-only AI Workforce enhancement.`,
    }),
    admin.supa.from("ci_insights").update({ status: "approved" }).eq("id", row.id),
  ]);

  return NextResponse.json({
    ok: true,
    taskId: createdTask.task_id,
    taskDbId: createdTask.id,
    outputId: createdOutput.id,
    message: "AI enhancement task staged for human review.",
  });
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function displayTheme(row: InsightRow): string {
  return row.theme?.replace(/_/g, " ") || row.category.replace(/_/g, " ");
}

function classifyDeployment(row: InsightRow) {
  const haystack = `${row.category} ${row.theme ?? ""} ${row.insight_text}`.toLowerCase();
  const apex = Number(row.apex_score ?? 0);

  if (haystack.includes("procurement") || haystack.includes("supply") || haystack.includes("saving")) {
    return {
      agent: "Procurement Agent",
      priority: apex >= 18 ? "high" : "medium",
      relatedCampaign: null,
      relatedClient: "Procurement prospects",
      targets: [
        "Procurement dashboard copy",
        "Savings report language",
        "Procurement email drafts",
        "Owner-facing onboarding",
      ],
    };
  }

  if (haystack.includes("political") || haystack.includes("campaign") || haystack.includes("candidate")) {
    return {
      agent: "Political Campaign Agent",
      priority: "high",
      relatedCampaign: "Political mail campaigns",
      relatedClient: null,
      targets: [
        "Political campaign dashboard copy",
        "Candidate follow-up drafts",
        "Proposal framing",
        "Campaign option explanations",
      ],
    };
  }

  if (haystack.includes("seo") || haystack.includes("search") || haystack.includes("content")) {
    return {
      agent: "Content Strategy Agent",
      priority: apex >= 18 ? "high" : "medium",
      relatedCampaign: "SEO and content engine",
      relatedClient: null,
      targets: [
        "SEO pages",
        "Authority content briefs",
        "Daily content center",
        "Website messaging",
      ],
    };
  }

  return {
    agent: "Revenue Integrity Agent",
    priority: apex >= 18 ? "high" : "medium",
    relatedCampaign: "Growth execution",
    relatedClient: null,
    targets: [
      "Sales scripts",
      "Outreach drafts",
      "Dashboard recommendations",
      "Lead follow-up flows",
    ],
  };
}

function buildEnhancementBrief(
  row: InsightRow,
  deployment: ReturnType<typeof classifyDeployment>,
) {
  return [
    `Source insight`,
    row.insight_text,
    ``,
    `Recommended deployment targets`,
    ...deployment.targets.map((target) => `- ${target}`),
    ``,
    `AI agent assignment`,
    `${deployment.agent} should convert this insight into a practical HomeReach enhancement draft.`,
    ``,
    `Required output`,
    `- Plain-language recommendation`,
    `- Where it should appear in the ecosystem`,
    `- Draft copy or UX change if relevant`,
    `- Expected revenue or clarity impact`,
    `- Safety/compliance checks`,
    `- Rollback notes`,
    ``,
    `Safety lock`,
    `This is review-only. Do not publish, send outreach, change pricing, change campaigns, or commit spend without a separate human approval workflow.`,
  ].join("\n");
}
