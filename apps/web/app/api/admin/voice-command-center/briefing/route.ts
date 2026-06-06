import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api-guards";
import { getDailyBriefing } from "@/lib/voice-command-center/repository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const user = guard.user;
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = asRecord(await req.json().catch(() => ({})));
  const requestedType = typeof body.briefingType === "string" ? body.briefingType : "on_demand";
  const briefingType =
    requestedType === "morning" || requestedType === "afternoon" || requestedType === "on_demand"
      ? requestedType
      : "on_demand";

  const result = await getDailyBriefing(user.id, briefingType);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
