import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api-guards";
import { getAiCommandCenterState } from "@/lib/ai-orchestration/command-center";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const commandCenter = await getAiCommandCenterState();
    return NextResponse.json({ ok: true, commandCenter });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unable to load AI command center state.",
      },
      { status: 500 }
    );
  }
}
