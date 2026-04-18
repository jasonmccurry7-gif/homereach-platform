// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/qa/scripts/copy
//   { answerId: string, channel: "sms"|"email"|"call"|"dm", content: string }
//
// Client-side does the clipboard write; this endpoint logs the event and
// records a qa_scripts_generated row (so we can later link attachments / sends).
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { qaFlagGate, requireAgent } from "@/lib/qa/guards";
import { logUsage } from "@/lib/qa/usage";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const flag = qaFlagGate();
  if (flag) return flag;
  const g = await requireAgent();
  if (!g.ok) return g.response;

  const body = (await req.json().catch(() => ({}))) as Partial<{
    answerId: string;
    channel: "sms" | "email" | "call" | "dm";
    content: string;
  }>;

  if (!body.answerId || !body.channel || !body.content) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }
  if (!["sms", "email", "call", "dm"].includes(body.channel)) {
    return NextResponse.json({ error: "invalid channel" }, { status: 400 });
  }
  if (body.content.length > 10000) {
    return NextResponse.json({ error: "content too long" }, { status: 400 });
  }

  const { data, error } = await g.supa
    .from("qa_scripts_generated")
    .insert({
      answer_id: body.answerId,
      channel: body.channel,
      content: body.content,
      copied_by_agent_id: g.agentId,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logUsage(g.supa, {
    eventType: "script_copied",
    agentId: g.agentId,
    answerId: body.answerId,
    scriptId: (data as any).id,
    metadata: { channel: body.channel },
  });

  return NextResponse.json({ scriptId: (data as any).id });
}
