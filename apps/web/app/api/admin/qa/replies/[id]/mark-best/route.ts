// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/qa/replies/:id/mark-best
//
// Marks a reply as the thread's best answer. Admin OR thread author.
// Clears the flag from any other reply on the same thread.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { qaFlagGate, requireAgent } from "@/lib/qa/guards";
import { logUsage } from "@/lib/qa/usage";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const flag = qaFlagGate();
  if (flag) return flag;
  const g = await requireAgent();
  if (!g.ok) return g.response;

  const { id } = await ctx.params;

  const { data: reply } = await g.supa
    .from("qa_thread_replies")
    .select("id, question_id")
    .eq("id", id)
    .maybeSingle();

  if (!reply) {
    return NextResponse.json({ error: "reply not found" }, { status: 404 });
  }

  const { data: q } = await g.supa
    .from("qa_questions")
    .select("asked_by_agent_id")
    .eq("id", (reply as any).question_id)
    .single();

  const isAuthor = (q as any)?.asked_by_agent_id === g.agentId;
  if (!isAuthor && !g.isAdmin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Clear any existing best on any answer on this thread
  await g.supa
    .from("qa_answers")
    .update({ is_best: false })
    .eq("question_id", (reply as any).question_id);

  // Mark this reply's answer as best (if the reply is actually paired with an answer)
  // V1 semantics: "best" is a flag on the structured answer, not the reply itself.
  // So marking a reply as best means: the admin/author has decided this reply IS
  // the canonical answer — we promote it to an admin-authored qa_answers row.
  const { data: replyRow } = await g.supa
    .from("qa_thread_replies")
    .select("body, author_agent_id")
    .eq("id", id)
    .single();

  const { data: promoted } = await g.supa
    .from("qa_answers")
    .insert({
      question_id: (reply as any).question_id,
      source: "admin",
      author_agent_id: (replyRow as any).author_agent_id,
      direct_answer: (replyRow as any).body,
      is_best: true,
    })
    .select("id")
    .single();

  await g.supa
    .from("qa_questions")
    .update({
      status: "resolved",
      updated_at: new Date().toISOString(),
    })
    .eq("id", (reply as any).question_id);

  await logUsage(g.supa, {
    eventType: "marked_best",
    agentId: g.agentId,
    questionId: (reply as any).question_id,
    replyId: id,
    answerId: (promoted as any)?.id ?? null,
  });

  return NextResponse.json({ ok: true, promotedAnswerId: (promoted as any)?.id ?? null });
}
