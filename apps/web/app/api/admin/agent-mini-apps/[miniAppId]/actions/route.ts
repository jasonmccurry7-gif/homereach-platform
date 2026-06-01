import { NextResponse } from "next/server";
import { requireAdminOrSalesAgent, roleOf } from "@/lib/auth/api-guards";
import { runMiniAppAction } from "@/lib/agent-mini-apps/mutations";
import { createServiceClient } from "@/lib/supabase/service";
import type { MiniAppAction } from "@/lib/agent-mini-apps/types";

type JsonRecord = Record<string, unknown>;

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
    const action = String(body.action ?? "") as MiniAppAction;
    const result = await runMiniAppAction({
      db: createServiceClient(),
      actorUserId: guard.user?.id ?? null,
      role: roleOf(guard.user),
      miniAppId,
      action,
      body,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : result.status ?? 400 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: errorMessage(error) }, { status: 500 });
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Agent Mini App action failed.";
}
