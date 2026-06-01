import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminOrSalesAgent } from "@/lib/auth/api-guards";
import { MARKET_CAPTURE_PIPELINE_STAGES } from "@/lib/market-capture/campaign";
import { isMarketCaptureSalesDashboardEnabled } from "@/lib/market-capture/config";
import { ensureMarketCaptureFulfillment } from "@/lib/market-capture/fulfillment";
import { createServiceClient } from "@/lib/supabase/service";

const StageSchema = z.object({
  action: z.literal("update_stage"),
  stage: z.enum(MARKET_CAPTURE_PIPELINE_STAGES),
  note: z.string().trim().max(2000).optional(),
});

const TaskSchema = z.object({
  action: z.literal("update_task"),
  taskId: z.string().uuid(),
  status: z.enum(["open", "in_progress", "completed", "blocked", "cancelled"]),
  notes: z.string().trim().max(2000).optional(),
});

const NoteSchema = z.object({
  action: z.literal("add_note"),
  content: z.string().trim().min(1).max(2000),
});

const BodySchema = z.discriminatedUnion("action", [StageSchema, TaskSchema, NoteSchema]);

type Params = Promise<{ leadId: string }>;

function statusForStage(stage: string) {
  if (stage === "closed_won") return "closed_won";
  if (stage === "closed_lost") return "closed_lost";
  if (["ready_for_fulfillment", "campaign_setup", "asset_collection", "creative_review", "client_approval", "ready_for_launch"].includes(stage)) {
    return "ready_for_fulfillment";
  }
  if (["live", "reporting", "renewal_opportunity"].includes(stage)) return "active";
  if (stage === "closed") return "closed_won";
  if (stage === "qualified") return "qualified";
  return "active";
}

function nextActionForStage(stage: string) {
  switch (stage) {
    case "needs_review":
      return "Review intake";
    case "payment_pending":
      return "Follow up on payment";
    case "qualified":
      return "Confirm handoff details";
    case "ready_for_fulfillment":
      return "Move to fulfillment";
    case "campaign_setup":
      return "Validate target area and collect missing assets";
    case "asset_collection":
      return "Collect and review assets";
    case "creative_review":
      return "Review creative drafts";
    case "client_approval":
      return "Get client approval";
    case "ready_for_launch":
      return "Confirm launch readiness";
    case "live":
      return "Monitor campaign and schedule report";
    case "reporting":
      return "Enter monthly report metrics";
    case "renewal_opportunity":
      return "Prepare renewal recommendation";
    case "closed":
      return "Archive campaign";
    case "closed_won":
      return "Prepare fulfillment handoff";
    case "closed_lost":
      return "Archive or schedule nurture";
    default:
      return "Contact prospect";
  }
}

export async function POST(req: Request, { params }: { params: Params }) {
  if (!isMarketCaptureSalesDashboardEnabled()) {
    return NextResponse.json({ error: "Market Capture sales dashboard is disabled." }, { status: 404 });
  }

  const guard = await requireAdminOrSalesAgent();
  if (!guard.ok) return guard.response;

  const { leadId } = await params;
  const leadIdCheck = z.string().uuid().safeParse(leadId);
  if (!leadIdCheck.success) {
    return NextResponse.json({ error: "Invalid Market Capture lead id." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createServiceClient();
  const now = new Date().toISOString();

  if (parsed.data.action === "update_stage") {
    const stage = parsed.data.stage;
    const [pipelineUpdate, leadUpdate, noteInsert] = await Promise.all([
      supabase
        .from("market_capture_pipeline")
        .update({
          stage,
          status: stage === "closed_won" ? "won" : stage === "closed_lost" ? "lost" : "open",
          next_action: nextActionForStage(stage),
          last_activity_at: now,
          updated_at: now,
        })
        .eq("market_capture_lead_id", leadId),
      supabase
        .from("market_capture_leads")
        .update({
          status: statusForStage(stage),
          updated_at: now,
        })
        .eq("id", leadId),
      supabase.from("market_capture_notes").insert({
        market_capture_lead_id: leadId,
        author: guard.user?.email ?? "admin",
        note_type: "stage_change",
        content: parsed.data.note || `Pipeline stage changed to ${stage.replace(/_/g, " ")}.`,
        metadata: { stage },
      }),
    ]);

    const error = pipelineUpdate.error ?? leadUpdate.error ?? noteInsert.error;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (["ready_for_fulfillment", "campaign_setup", "closed_won"].includes(stage)) {
      try {
        await ensureMarketCaptureFulfillment({
          supabase,
          leadId,
          createdBy: guard.user?.email ?? "admin",
        });
      } catch (err) {
        console.error("[api/admin/market-capture] fulfillment init failed:", err);
      }
    }

    return NextResponse.json({ ok: true });
  }

  if (parsed.data.action === "update_task") {
    const update = await supabase
      .from("market_capture_tasks")
      .update({
        status: parsed.data.status,
        completed_at: parsed.data.status === "completed" ? now : null,
        notes: parsed.data.notes ?? null,
        updated_at: now,
      })
      .eq("id", parsed.data.taskId)
      .eq("market_capture_lead_id", leadId);

    if (update.error) return NextResponse.json({ error: update.error.message }, { status: 500 });

    await supabase.from("market_capture_notes").insert({
      market_capture_lead_id: leadId,
      author: guard.user?.email ?? "admin",
      note_type: "task",
      content: `Task updated to ${parsed.data.status}.`,
      metadata: { task_id: parsed.data.taskId },
    });

    return NextResponse.json({ ok: true });
  }

  const note = await supabase.from("market_capture_notes").insert({
    market_capture_lead_id: leadId,
    author: guard.user?.email ?? "admin",
    note_type: "note",
    content: parsed.data.content,
  });
  if (note.error) return NextResponse.json({ error: note.error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
