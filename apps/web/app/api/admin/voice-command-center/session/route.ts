import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api-guards";
import {
  endVoiceSession,
  startVoiceSession,
} from "@/lib/voice-command-center/repository";

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
  const intent = typeof body.intent === "string" ? body.intent : "start";

  if (intent === "end") {
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
    if (!sessionId) {
      return NextResponse.json({ ok: false, error: "sessionId is required" }, { status: 400 });
    }

    const result = await endVoiceSession(
      sessionId,
      user.id,
      typeof body.transcript === "string" ? body.transcript : "",
      typeof body.summary === "string" ? body.summary : "",
    );
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  }

  const result = await startVoiceSession(
    user.id,
    typeof body.modelUsed === "string" ? body.modelUsed : "not_started",
  );
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
