import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api-guards";
import {
  completeAutopilotInternalTask,
  createAutopilotInternalTask,
  decideAutopilotApproval,
  getAutopilotControlCenter,
  queueAutopilotInternalHandoff,
  type AutopilotDecision,
} from "@/lib/ai-orchestration/autopilot";

export const dynamic = "force-dynamic";

const DECISIONS = new Set<AutopilotDecision>(["approve", "reject", "comment"]);

export async function GET(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") ?? "12");
  const control = await getAutopilotControlCenter(Number.isFinite(limit) ? limit : 12);

  return NextResponse.json({
    ok: true,
    ...control,
  });
}

export async function PATCH(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  let body: {
    requestId?: string;
    decision?: AutopilotDecision;
    note?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.requestId || !body.decision || !DECISIONS.has(body.decision)) {
    return NextResponse.json(
      { ok: false, error: "requestId and a valid decision are required." },
      { status: 400 }
    );
  }

  const result = await decideAutopilotApproval({
    requestId: body.requestId,
    decision: body.decision,
    note: body.note,
    actorId: guard.user?.id ?? null,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  let body: {
    requestId?: string;
    taskId?: string;
    operation?: "queue_internal_handoff" | "create_internal_task" | "complete_internal_task";
    note?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.operation || !["queue_internal_handoff", "create_internal_task", "complete_internal_task"].includes(body.operation)) {
    return NextResponse.json(
      { ok: false, error: "requestId and a valid operation are required." },
      { status: 400 }
    );
  }

  if (body.operation === "complete_internal_task") {
    if (!body.taskId) {
      return NextResponse.json({ ok: false, error: "taskId is required." }, { status: 400 });
    }
    const result = await completeAutopilotInternalTask({
      taskId: body.taskId,
      note: body.note,
      actorId: guard.user?.id ?? null,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  }

  if (!body.requestId) {
    return NextResponse.json({ ok: false, error: "requestId is required." }, { status: 400 });
  }

  const result = body.operation === "create_internal_task"
    ? await createAutopilotInternalTask({
        requestId: body.requestId,
        note: body.note,
        actorId: guard.user?.id ?? null,
      })
    : await queueAutopilotInternalHandoff({
        requestId: body.requestId,
        note: body.note,
        actorId: guard.user?.id ?? null,
      });

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
