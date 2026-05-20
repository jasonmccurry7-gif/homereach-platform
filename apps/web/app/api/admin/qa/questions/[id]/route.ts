// ─────────────────────────────────────────────────────────────────────────────
// GET    /api/admin/qa/questions/:id   — fetch full thread (question + answers + replies)
// PATCH  /api/admin/qa/questions/:id   — update status / pin
// DELETE /api/admin/qa/questions/:id   — soft archive (admin only)
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { qaFlagGate, requireAgent, requireAdmin } from "@/lib/qa/guards";

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

  const [questionR, answersR, repliesR] = await Promise.all([
    g.supa
      .from("qa_questions")
      .select(
        "id, question_text, category_tags, visibility, status, is_pinned, upvote_count, lead_id, city_id, asked_by_agent_id, created_at, updated_at",
      )
      .eq("id", id)
      .maybeSingle(),
    g.supa
      .from("qa_answers")
      .select(
        "id, source, author_agent_id, direct_answer, what_to_say, what_to_do_next, why_this_works, related_question_ids, is_official, is_best, is_locked, model_name, created_at",
      )
      .eq("question_id", id)
      .order("created_at", { ascending: true }),
    g.supa
      .from("qa_thread_replies")
      .select(
        "id, parent_reply_id, author_agent_id, author_role, body, upvote_count, is_admin_override, created_at",
      )
      .eq("question_id", id)
      .order("created_at", { ascending: true }),
  ]);

  if (!questionR.data) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json({
    question: questionR.data,
    answers: answersR.data ?? [],
    replies: repliesR.data ?? [],
  });
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const flag = qaFlagGate();
  if (flag) return flag;
  const g = await requireAgent();
  if (!g.ok) return g.response;

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Partial<{
    status: "open" | "answered" | "resolved" | "archived";
    isPinned: boolean;
  }>;

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.status) patch.status = body.status;
  if (typeof body.isPinned === "boolean") {
    if (!g.isAdmin) {
      return NextResponse.json({ error: "pin requires admin" }, { status: 403 });
    }
    patch.is_pinned = body.isPinned;
  }

  const { data, error } = await g.supa
    .from("qa_questions")
    .update(patch)
    .eq("id", id)
    .select("id, status, is_pinned")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ question: data });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const flag = qaFlagGate();
  if (flag) return flag;
  const a = await requireAdmin();
  if (!a.ok) return a.response;

  const { id } = await ctx.params;
  const { error } = await a.supa
    .from("qa_questions")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
