import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api-guards";
import { syncAiOutputLedger } from "@/lib/approvals/ai-output-ledger";
import { createServiceClient } from "@/lib/supabase/service";

type JsonRecord = Record<string, unknown>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const VALID_TASK_STATUSES = new Set([
  "new",
  "assigned",
  "in_progress",
  "blocked",
  "awaiting_approval",
  "approved",
  "rejected",
  "needs_revision",
  "completed",
  "failed",
]);

const VALID_PRIORITIES = new Set(["low", "medium", "high", "critical"]);
const VALID_OUTPUT_STATUSES = new Set(["draft", "needs_review", "approved", "rejected", "revision_needed", "archived"]);

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Supabase service credentials are not configured." }, { status: 503 });
  }

  const db = createServiceClient();
  const body = (await request.json().catch(() => ({}))) as JsonRecord;
  const action = String(body.action ?? "");
  const userId = guard.user?.id ?? null;

  try {
    switch (action) {
      case "create_task": {
        const taskId = stringValue(body.taskId) ?? `WF-${Date.now()}`;
        const row = {
          task_id: taskId,
          workflow_name: stringValue(body.workflowName) ?? "Manual AI Workforce Task",
          requestor: stringValue(body.requestor) ?? "HomeReach Admin",
          assigned_agent: stringValue(body.assignedAgent) ?? "Orchestrator Agent",
          priority: normalizePriority(body.priority),
          status: "new",
          input_path: stringValue(body.inputPath),
          input_data: asRecord(body.inputData),
          expected_output: stringValue(body.expectedOutput) ?? "Approval-gated AI workforce output.",
          dependencies: asStringArray(body.dependencies),
          due_date: stringValue(body.dueDate),
          approval_required: body.approvalRequired !== false,
          related_campaign: stringValue(body.relatedCampaign),
          related_client: stringValue(body.relatedClient),
          related_opportunity: stringValue(body.relatedOpportunity),
          owner_user_id: userId,
        };

        const { data, error } = await db.from("ai_workforce_tasks").insert(row).select("id,task_id").single();
        if (error) throw error;
        await logActivity(db, {
          taskId: String(data.id),
          taskPublicId: String(data.task_id),
          agentName: row.assigned_agent,
          eventType: "task_created",
          status: "new",
          summary: `Task ${row.task_id} created for ${row.assigned_agent}.`,
          details: { workflowName: row.workflow_name, approvalRequired: row.approval_required },
          approvalStatus: row.approval_required ? "needs_review" : "not_required",
          createdBy: userId,
        });
        return NextResponse.json({ ok: true, id: data.id, taskId: data.task_id });
      }

      case "update_task_status": {
        const id = requireUuid(body.id, "Task id is required.");
        const status = normalizeTaskStatus(body.status);
        const notes = stringValue(body.notes);
        if (status === "completed") {
          const { data: existingTask, error: existingTaskError } = await db
            .from("ai_workforce_tasks")
            .select("id,task_id,status,approval_required")
            .eq("id", id)
            .single();
          if (existingTaskError) throw existingTaskError;
          if (
            existingTask?.approval_required === true &&
            existingTask.status !== "approved"
          ) {
            return NextResponse.json(
              {
                error:
                  "Human approval is required before this AI task can be marked completed.",
              },
              { status: 409 },
            );
          }
        }
        const patch: JsonRecord = { status, updated_at: new Date().toISOString() };
        if (status === "completed" || status === "approved") patch.completion_notes = notes ?? `${status} from AI Workforce Command Center.`;
        if (status === "blocked" || status === "failed" || status === "needs_revision" || status === "rejected") patch.error_notes = notes ?? `${status} from AI Workforce Command Center.`;

        const { data, error } = await db
          .from("ai_workforce_tasks")
          .update(patch)
          .eq("id", id)
          .select("id,task_id,assigned_agent,workflow_name")
          .single();
        if (error) throw error;
        await logActivity(db, {
          taskId: String(data.id),
          taskPublicId: String(data.task_id),
          agentName: String(data.assigned_agent ?? "Orchestrator Agent"),
          eventType: "task_status_updated",
          status,
          summary: `Task ${data.task_id} moved to ${status}.`,
          details: { workflowName: data.workflow_name, notes },
          approvalStatus: approvalStatusForTask(status),
          createdBy: userId,
        });
        return NextResponse.json({ ok: true });
      }

      case "create_output": {
        const taskId = stringValue(body.taskId);
        const title = requireString(body.title, "Output title is required.");
        const content = requireString(body.content, "Output content is required.");
        const outputRow = {
          title,
          agent_name: stringValue(body.agentName) ?? "Orchestrator Agent",
          workflow: stringValue(body.workflow) ?? "AI Workforce",
          output_type: stringValue(body.outputType) ?? "draft",
          content,
          data_sources: asStringArray(body.dataSources),
          prompt_sop_name: stringValue(body.promptSopName),
          chain_name: stringValue(body.chainName),
          approval_status: "needs_review",
          verification_status: "pending",
          status: "active",
          owner_user_id: userId,
          notes: stringValue(body.notes),
          metadata: { taskId, source: "ai_workforce_command_center" },
        };
        const { data: output, error } = await db
          .from("ai_outputs")
          .insert(outputRow)
          .select("id,title,agent_name,workflow,output_type,approval_status,verification_status,winning_output,metadata,owner_user_id,created_at,updated_at")
          .single();
        if (error) throw error;

        let taskPublicId: string | null = taskId;
        let taskDbId: string | null = null;
        if (taskId) {
          const { data: task } = await db
            .from("ai_workforce_tasks")
            .update({ output_id: output.id, status: "awaiting_approval", updated_at: new Date().toISOString() })
            .eq("task_id", taskId)
            .select("id,task_id")
            .single();
          taskDbId = task?.id ? String(task.id) : null;
          taskPublicId = task?.task_id ? String(task.task_id) : taskId;
        }

        await logActivity(db, {
          taskId: taskDbId,
          taskPublicId,
          agentName: String(output.agent_name ?? outputRow.agent_name),
          eventType: "output_created",
          status: "awaiting_approval",
          summary: `AI output "${output.title}" created and queued for approval.`,
          details: { workflow: output.workflow, outputId: output.id },
          approvalStatus: "needs_review",
          relatedOutputId: String(output.id),
          createdBy: userId,
        });

        const ledgerResult = await syncAiOutputLedger(
          {
            id: output.id,
            title: String(output.title ?? title),
            agentName: output.agent_name,
            workflow: output.workflow,
            outputType: output.output_type,
            approvalStatus: String(output.approval_status ?? "needs_review"),
            verificationStatus: output.verification_status,
            winningOutput: Boolean(output.winning_output),
            metadata: asRecord(output.metadata),
            ownerUserId: output.owner_user_id,
            content,
            createdAt: output.created_at,
            updatedAt: output.updated_at,
          },
          {
            actorId: userId,
            actorLabel: guard.user?.email ?? "admin",
            eventType: "ai_output_created",
          },
        );
        if (!ledgerResult.ok && ledgerResult.error) {
          console.warn("[approval-ledger] ai workforce output create sync skipped:", ledgerResult.error);
        }
        return NextResponse.json({ ok: true, id: output.id });
      }

      case "update_output_status": {
        const id = requireUuid(body.id, "Output id is required.");
        const status = normalizeOutputStatus(body.status);
        const notes = stringValue(body.reviewNotes) ?? `Marked ${status} from AI Workforce Command Center.`;
        const { data: output, error } = await db
          .from("ai_outputs")
          .update({ approval_status: status, updated_at: new Date().toISOString() })
          .eq("id", id)
          .select("id,title,agent_name,workflow,output_type,approval_status,verification_status,winning_output,metadata,owner_user_id,created_at,updated_at")
          .single();
        if (error) throw error;

        await db.from("ai_output_reviews").insert({
          output_id: id,
          reviewer_user_id: userId,
          review_status: status === "revision_needed" ? "revision_needed" : status,
          review_notes: notes,
          checklist: { source: "ai_workforce_command_center" },
        });
        await logActivity(db, {
          agentName: String(output.agent_name ?? "Orchestrator Agent"),
          eventType: "output_status_updated",
          status,
          summary: `AI output "${output.title}" marked ${status}.`,
          details: { workflow: output.workflow, notes },
          approvalStatus: status === "approved" ? "approved" : status === "rejected" ? "rejected" : "needs_revision",
          relatedOutputId: id,
          createdBy: userId,
        });

        const ledgerResult = await syncAiOutputLedger(
          {
            id: output.id,
            title: String(output.title ?? "AI output"),
            agentName: output.agent_name,
            workflow: output.workflow,
            outputType: output.output_type,
            approvalStatus: String(output.approval_status ?? status),
            verificationStatus: output.verification_status,
            winningOutput: Boolean(output.winning_output),
            metadata: asRecord(output.metadata),
            ownerUserId: output.owner_user_id,
            createdAt: output.created_at,
            updatedAt: output.updated_at,
          },
          {
            actorId: userId,
            actorLabel: guard.user?.email ?? "admin",
            eventType: "ai_output_status_updated",
            eventNotes: notes,
          },
        );
        if (!ledgerResult.ok && ledgerResult.error) {
          console.warn("[approval-ledger] ai workforce output status sync skipped:", ledgerResult.error);
        }
        return NextResponse.json({ ok: true });
      }

      case "mark_winning_output": {
        const id = requireUuid(body.id, "Output id is required.");
        const { data: current, error: currentError } = await db
          .from("ai_outputs")
          .select("id,title,agent_name,approval_status,verification_status")
          .eq("id", id)
          .single();
        if (currentError) throw currentError;
        if (
          current.approval_status !== "approved" ||
          current.verification_status !== "verified"
        ) {
          return NextResponse.json(
            {
              error:
                "Only human-approved and verified outputs can be marked as winning outputs.",
            },
            { status: 409 },
          );
        }

        const { data, error } = await db
          .from("ai_outputs")
          .update({ winning_output: true, updated_at: new Date().toISOString() })
          .eq("id", id)
          .select("id,title,agent_name,workflow,output_type,approval_status,verification_status,winning_output,metadata,owner_user_id,created_at,updated_at")
          .single();
        if (error) throw error;
        await logActivity(db, {
          agentName: String(data.agent_name ?? "Orchestrator Agent"),
          eventType: "winning_output_marked",
          status: "completed",
          summary: `AI output "${data.title}" marked as winning output.`,
          details: { outputId: id },
          relatedOutputId: id,
          createdBy: userId,
        });

        const ledgerResult = await syncAiOutputLedger(
          {
            id: data.id,
            title: String(data.title ?? "AI output"),
            agentName: data.agent_name,
            workflow: data.workflow,
            outputType: data.output_type,
            approvalStatus: String(data.approval_status ?? "approved"),
            verificationStatus: data.verification_status,
            winningOutput: Boolean(data.winning_output),
            metadata: asRecord(data.metadata),
            ownerUserId: data.owner_user_id,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
          },
          {
            actorId: userId,
            actorLabel: guard.user?.email ?? "admin",
            eventType: "ai_output_marked_winning",
          },
        );
        if (!ledgerResult.ok && ledgerResult.error) {
          console.warn("[approval-ledger] ai workforce winning sync skipped:", ledgerResult.error);
        }
        return NextResponse.json({ ok: true });
      }

      case "save_output_as_sop": {
        const id = requireUuid(body.id, "Output id is required.");
        const { data: output, error } = await db.from("ai_outputs").select("*").eq("id", id).single();
        if (error) throw error;
        const promptName = `${String(output.title ?? "AI Output")} SOP (${id.slice(0, 8)})`;
        const { error: insertError } = await db.from("ai_prompt_sops").insert({
          prompt_name: promptName,
          category: String(output.workflow ?? "AI Workforce"),
          purpose: `Reusable SOP derived from ${String(output.title ?? "AI output")}.`,
          required_inputs: ["business context", "workflow inputs", "approval requirements"],
          prompt_text: String(output.content ?? ""),
          output_format: "Summary, full output, approval notes, next action.",
          approval_requirement: "Human approval required before customer-facing or high-stakes use.",
          tags: ["ai-workforce", "winning-output"],
          status: "active",
          owner_user_id: userId,
          related_workflow: String(output.workflow ?? "AI Workforce"),
          notes: `Saved from AI output ${id}.`,
        });
        if (insertError) throw insertError;
        await logActivity(db, {
          agentName: String(output.agent_name ?? "Orchestrator Agent"),
          eventType: "output_saved_as_sop",
          status: "completed",
          summary: `AI output "${String(output.title ?? "Untitled")}" saved as SOP.`,
          details: { outputId: id, promptName },
          relatedOutputId: id,
          createdBy: userId,
        });
        return NextResponse.json({ ok: true });
      }

      case "add_output_to_data_sources": {
        const id = requireUuid(body.id, "Output id is required.");
        const { data: output, error } = await db.from("ai_outputs").select("*").eq("id", id).single();
        if (error) throw error;
        const { error: insertError } = await db.from("ai_data_sources").insert({
          title: `${String(output.title ?? "AI Output")} Source`,
          category: "Prior winning prompts",
          description: `Reusable source created from AI workforce output ${id}.`,
          content: String(output.content ?? ""),
          tags: ["ai-workforce", "output-source"],
          related_workflow: String(output.workflow ?? "AI Workforce"),
          related_offer: null,
          quality_rating: 4,
          status: "active",
          owner_user_id: userId,
          notes: `Added from AI output ${id}.`,
        });
        if (insertError) throw insertError;
        await logActivity(db, {
          agentName: String(output.agent_name ?? "Orchestrator Agent"),
          eventType: "output_added_to_data_sources",
          status: "completed",
          summary: `AI output "${String(output.title ?? "Untitled")}" added to data sources.`,
          details: { outputId: id },
          relatedOutputId: id,
          createdBy: userId,
        });
        return NextResponse.json({ ok: true });
      }

      default:
        return NextResponse.json({ error: "Unknown AI Workforce action." }, { status: 400 });
    }
  } catch (error) {
    const message = errorMessage(error);
    if (/does not exist|Could not find|relation|schema cache/i.test(message)) {
      return NextResponse.json({ error: message, migration: "Run the AI Workforce Operating System migration." }, { status: 503 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function logActivity(
  db: ReturnType<typeof createServiceClient>,
  input: {
    taskId?: string | null;
    taskPublicId?: string | null;
    agentName?: string | null;
    eventType: string;
    status: string;
    summary: string;
    details?: JsonRecord;
    approvalStatus?: string;
    relatedOutputId?: string | null;
    createdBy?: string | null;
  },
) {
  await db.from("ai_workforce_activity_logs").insert({
    task_id: input.taskId ?? null,
    task_public_id: input.taskPublicId ?? null,
    agent_name: input.agentName ?? null,
    event_type: input.eventType,
    status: input.status,
    summary: input.summary,
    details: input.details ?? {},
    approval_status: input.approvalStatus ?? "not_required",
    related_output_id: input.relatedOutputId ?? null,
    created_by: input.createdBy ?? null,
  });
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function requireString(value: unknown, message: string): string {
  const result = stringValue(value);
  if (!result) throw new Error(message);
  return result;
}

function requireUuid(value: unknown, message: string): string {
  const id = requireString(value, message);
  if (!UUID_PATTERN.test(id)) {
    throw new Error(
      "This AI Workforce item is a virtual seed artifact, not a persisted database row. Refresh the dashboard after the AI Assets seed migration runs, then approve the real persisted artifact.",
    );
  }
  return id;
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
  return "AI Workforce action failed.";
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  if (typeof value === "string") return value.split(",").map((item) => item.trim()).filter(Boolean);
  return [];
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function normalizePriority(value: unknown) {
  const priority = String(value ?? "medium");
  return VALID_PRIORITIES.has(priority) ? priority : "medium";
}

function normalizeTaskStatus(value: unknown) {
  const status = String(value ?? "new");
  if (!VALID_TASK_STATUSES.has(status)) throw new Error(`Invalid task status: ${status}`);
  return status;
}

function normalizeOutputStatus(value: unknown) {
  const status = String(value ?? "needs_review");
  if (!VALID_OUTPUT_STATUSES.has(status)) throw new Error(`Invalid output status: ${status}`);
  return status;
}

function approvalStatusForTask(status: string) {
  if (status === "approved") return "approved";
  if (status === "rejected") return "rejected";
  if (status === "needs_revision") return "needs_revision";
  if (status === "awaiting_approval") return "needs_review";
  return "not_required";
}
