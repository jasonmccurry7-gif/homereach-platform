import { NextResponse } from "next/server";
import { requireAdmin, requireAdminOrSalesAgent, roleOf } from "@/lib/auth/api-guards";
import { createMiniApp } from "@/lib/agent-mini-apps/mutations";
import { loadAgentMiniAppsData } from "@/lib/agent-mini-apps/repository";
import { createServiceClient } from "@/lib/supabase/service";

type JsonRecord = Record<string, unknown>;

export async function GET() {
  const guard = await requireAdminOrSalesAgent();
  if (!guard.ok) return guard.response;

  const data = await loadAgentMiniAppsData({
    userId: guard.user?.id ?? null,
    role: roleOf(guard.user),
  });

  return NextResponse.json({ ok: true, data });
}

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ ok: false, error: "Supabase service credentials are not configured." }, { status: 503 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as JsonRecord;
    const result = await createMiniApp({
      db: createServiceClient(),
      actorUserId: guard.user?.id ?? null,
      body,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : result.status ?? 400 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: errorMessage(error) }, { status: 500 });
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Agent Mini App request failed.";
}
