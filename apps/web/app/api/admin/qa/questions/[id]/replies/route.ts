// ─────────────────────────────────────────────────────────────────────────────
// GET  /api/admin/qa/questions/:id/replies
// POST /api/admin/qa/questions/:id/replies  { body, parentReplyId? }
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { qaFlagGate, requireAgent } from "@/lib/qa/guards";
import { logUsage } from "@/lib/qa/usage";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const flag = qaFlagGate();
  if (flag) return flag;
  const g = await requireAgent();
  if (!g.ok) return g.response;

  const { id } = await ctx.params;
  const { data, error } = await g.supa
    .from("qa_thread_replies")
    .select("*")
    .eq("question_id", id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ replies: data ?? [] });
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const flag = qaFlagGate();
  if (flag) return flag;
  const g = await requireAgent();
  if (!g.ok) return g.response;

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Partial<{
    body: string;
    parentReplyId: string;
  }>;

  const text = (body.body || "").trim();
  if (text.length < 1 || text.length > 4000) {
    return NextResponse.json(
      { error: "body must be 1-4000 chars" },
      { status: 400 },
    );
  }

  const { data, error } = await g.supa
    .from("qa_thread_replies")
    .insert({
      question_id: id,
      parent_reply_id: body.parentReplyId ?? null,
      author_agent_id: g.agentId,
      author_role: g.isAdmin ? "admin" : "agent",
      body: text,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logUsage(g.supa, {
    eventType: "reply_added",
    agentId: g.agentId,
    questionId: id,
    replyId: (data as any).id,
  });

  return NextResponse.json({ reply: data });
}
