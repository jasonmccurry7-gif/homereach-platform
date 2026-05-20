import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api-guards";
import { getAgentPermissionMatrix } from "@/lib/ai-orchestration/agent-permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const permissions = await getAgentPermissionMatrix();
    return NextResponse.json({ ok: true, permissions });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unable to load agent permissions.",
      },
      { status: 500 }
    );
  }
}
