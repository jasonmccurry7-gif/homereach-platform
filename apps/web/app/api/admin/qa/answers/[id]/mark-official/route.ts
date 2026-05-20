// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/qa/answers/:id/mark-official   — admin only
//
// Flips is_official=true on the answer and upserts a qa_knowledge_entries row.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { qaFlagGate, requireAdmin } from "@/lib/qa/guards";
import { logUsage } from "@/lib/qa/usage";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const flag = qaFlagGate();
  if (flag) return flag;
  const a = await requireAdmin();
  if (!a.ok) return a.response;

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Partial<{
    title: string;
    body: string;
    cityScope: string[];
  }>;

  const { data: ans, error: ansErr } = await a.supa
    .from("qa_answers")
    .update({
      is_official: true,
      is_locked: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id, question_id, direct_answer")
    .single();

  if (ansErr || !ans) {
    return NextResponse.json(
      { error: ansErr?.message || "answer not found" },
      { status: 500 },
    );
  }

  // Fetch question for default title
  const { data: q } = await a.supa
    .from("qa_questions")
    .select("question_text, category_tags")
    .eq("id", (ans as any).question_id)
    .single();

  const title = body.title?.trim() || (q as any)?.question_text?.slice(0, 120) || "Official answer";
  const bodyText = body.body?.trim() || (ans as any).direct_answer;

  const { data: entry, error: entryErr } = await a.supa
    .from("qa_knowledge_entries")
    .insert({
      source_question_id: (ans as any).question_id,
      source_answer_id: (ans as any).id,
      title,
      body: bodyText,
      category_tags: (q as any)?.category_tags || [],
      city_scope: body.cityScope ?? null,
      promoted_by_admin_id: a.agentId,
    })
    .select("id")
    .single();

  if (entryErr) {
    return NextResponse.json({ error: entryErr.message }, { status: 500 });
  }

  await logUsage(a.supa, {
    eventType: "marked_official",
    agentId: a.agentId,
    answerId: (ans as any).id,
    questionId: (ans as any).question_id,
    metadata: { knowledge_entry_id: (entry as any).id },
  });

  return NextResponse.json({
    ok: true,
    knowledgeEntryId: (entry as any).id,
  });
}
