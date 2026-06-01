import { NextResponse } from "next/server";
import { requireAdminOrSalesAgent, roleOf } from "@/lib/auth/api-guards";
import { createManualMiniAppEvent } from "@/lib/agent-mini-apps/mutations";
import { loadAgentMiniAppDetail } from "@/lib/agent-mini-apps/repository";
import { createServiceClient } from "@/lib/supabase/service";

type JsonRecord = Record<string, unknown>;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ miniAppId: string }> },
) {
  const guard = await requireAdminOrSalesAgent();
  if (!guard.ok) return guard.response;

  const { miniAppId } = await params;
  const detail = await loadAgentMiniAppDetail({
    id: miniAppId,
    userId: guard.user?.id ?? null,
    role: roleOf(guard.user),
  });

  if (detail.warning === "Forbidden") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ ok: true, data: detail.events });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ miniAppId: string }> },
) {
  const guard = await requireAdminOrSalesAgent();
  if (!guard.ok) return guard.response;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ ok: false, error: "Supabase service credentials are not configured." }, { status: 503 });
  }

  try {
    const { miniAppId } = await params;
    const body = (await request.json().catch(() => ({}))) as JsonRecord;
    const result = await createManualMiniAppEvent({
      db: createServiceClient(),
      actorUserId: guard.user?.id ?? null,
      role: roleOf(guard.user),
      miniAppId,
      body,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : result.status ?? 400 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: errorMessage(error) }, { status: 500 });
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Agent Mini App event request failed.";
}
