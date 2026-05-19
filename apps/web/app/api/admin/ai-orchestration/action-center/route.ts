import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api-guards";
import {
  getUnifiedActionCenter,
  updateUnifiedActionItem,
  type UnifiedActionOperation,
} from "@/lib/ai-orchestration/action-center";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") ?? "24");
  const actionCenter = await getUnifiedActionCenter(Number.isFinite(limit) ? limit : 24);

  return NextResponse.json({
    ok: true,
    ...actionCenter,
  });
}

const ALLOWED_OPERATIONS = new Set<UnifiedActionOperation>(["resolve", "snooze", "dismiss", "reopen", "comment"]);

export async function PATCH(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  let body: {
    sourceKey?: string;
    operation?: UnifiedActionOperation;
    note?: string;
    snoozeHours?: number;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.sourceKey || !body.operation || !ALLOWED_OPERATIONS.has(body.operation)) {
    return NextResponse.json(
      { ok: false, error: "sourceKey and a valid operation are required." },
      { status: 400 }
    );
  }

  const result = await updateUnifiedActionItem({
    sourceKey: body.sourceKey,
    operation: body.operation,
    note: body.note,
    snoozeHours: body.snoozeHours,
    actorId: guard.user?.id ?? null,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
