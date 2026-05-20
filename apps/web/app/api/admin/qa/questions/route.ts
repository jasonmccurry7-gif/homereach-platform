// ─────────────────────────────────────────────────────────────────────────────
// GET  /api/admin/qa/questions         — list with filters
// POST /api/admin/qa/questions         — create a question + trigger AI answer
//
// Gated by ENABLE_QA_SYSTEM. Returns 404 if the flag is off.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { qaFlagGate, requireAgent } from "@/lib/qa/guards";
import { buildRetrievalContext } from "@/lib/qa/retrieval";
import { generateQaAnswer } from "@/lib/qa/claude";
import { logUsage, checkDailyCap } from "@/lib/qa/usage";
import { isQaAiDisabled } from "@/lib/qa/env";

export const dynamic = "force-dynamic";

// ── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const flag = qaFlagGate();
  if (flag) return flag;

  const g = await requireAgent();
  if (!g.ok) return g.response;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const pinned = searchParams.get("pinned");
  const tag = searchParams.get("tag");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10) || 50, 200);

  let query = g.supa
    .from("qa_questions")
    .select(
      "id, question_text, category_tags, visibility, status, is_pinned, upvote_count, lead_id, city_id, asked_by_agent_id, created_at, updated_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status) query = query.eq("status", status);
  if (pinned === "true") query = query.eq("is_pinned", true);
  if (tag) query = query.contains("category_tags", [tag]);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ questions: data ?? [] });
}

// ── POST ─────────────────────────────────────────────────────────────────────

type PostBody = {
  questionText: string;
  categoryTags?: string[];
  visibility?: "private" | "team" | "public";
  leadId?: string | null;
  cityId?: string | null;
  categoryId?: string | null;
  lastInteractionId?: string | null;
};

export async function POST(req: NextRequest) {
  const flag = qaFlagGate();
  if (flag) return flag;

  const g = await requireAgent();
  if (!g.ok) return g.response;

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const text = (body.questionText || "").trim();
  if (text.length < 3 || text.length > 2000) {
    return NextResponse.json(
      { error: "questionText must be 3-2000 chars" },
      { status: 400 },
    );
  }

  const visibility = body.visibility || "team";
  if (!["private", "team", "public"].includes(visibility)) {
    return NextResponse.json({ error: "invalid visibility" }, { status: 400 });
  }

  // 1) Insert the question
  const { data: inserted, error: insertErr } = await g.supa
    .from("qa_questions")
    .insert({
      asked_by_agent_id: g.agentId,
      question_text: text,
      category_tags: Array.isArray(body.categoryTags) ? body.categoryTags : [],
      visibility,
      lead_id: body.leadId ?? null,
      city_id: body.cityId ?? null,
      category_id: body.categoryId ?? null,
      last_interaction_id: body.lastInteractionId ?? null,
      status: "open",
    })
    .select(
      "id, question_text, category_tags, visibility, status, is_pinned, upvote_count, lead_id, city_id, asked_by_agent_id, created_at, updated_at",
    )
    .single();

  if (insertErr || !inserted) {
    return NextResponse.json(
      { error: insertErr?.message || "insert failed" },
      { status: 500 },
    );
  }

  await logUsage(g.supa, {
    eventType: "question_asked",
    agentId: g.agentId,
    questionId: (inserted as any).id,
    leadId: body.leadId ?? null,
    metadata: { visibility, tags: inserted.category_tags },
  });

  // 2) Generate AI answer (inline, best-effort, non-blocking for the caller)
  let aiAnswerId: string | null = null;
  let aiStatus: "generated" | "skipped_disabled" | "skipped_capped" | "error" = "generated";

  if (isQaAiDisabled()) {
    aiStatus = "skipped_disabled";
  } else {
    const cap = await checkDailyCap(g.supa, g.agentId);
    if (cap.capped) {
      aiStatus = "skipped_capped";
    } else {
      try {
        const context = await buildRetrievalContext(g.supa, {
          questionText: text,
          leadId: body.leadId,
          cityId: body.cityId,
          categoryId: body.categoryId,
          categoryTags: body.categoryTags,
        });

        const result = await generateQaAnswer(text, context);

        if (result.ok) {
          const { data: ans } = await g.supa
            .from("qa_answers")
            .insert({
              question_id: (inserted as any).id,
              source: "ai",
              author_agent_id: null,
              direct_answer: result.payload.directAnswer,
              what_to_say: result.payload.whatToSay,
              what_to_do_next: result.payload.whatToDoNext,
              why_this_works: result.payload.whyThisWorks,
              related_question_ids: result.payload.relatedQuestionIds,
              model_name: result.modelName,
              model_tokens_input: result.tokensInput,
              model_tokens_output: result.tokensOutput,
              generation_latency_ms: result.latencyMs,
            })
            .select("id")
            .single();
          aiAnswerId = (ans as any)?.id ?? null;

          await g.supa
            .from("qa_questions")
            .update({ status: "answered", updated_at: new Date().toISOString() })
            .eq("id", (inserted as any).id);

          await logUsage(g.supa, {
            eventType: "answer_generated",
            agentId: g.agentId,
            questionId: (inserted as any).id,
            answerId: aiAnswerId,
            metadata: {
              model: result.modelName,
              tokens_in: result.tokensInput,
              tokens_out: result.tokensOutput,
              latency_ms: result.latencyMs,
            },
          });
        } else {
          aiStatus = "error";
          await logUsage(g.supa, {
            eventType: "answer_generation_failed",
            agentId: g.agentId,
            questionId: (inserted as any).id,
            metadata: {
              model: result.modelName,
              latency_ms: result.latencyMs,
              error: result.error,
            },
          });
        }
      } catch (err) {
        aiStatus = "error";
        console.error("[qa] AI generation error:", err);
      }
    }
  }

  return NextResponse.json({
    question: inserted,
    aiAnswerId,
    aiStatus,
  });
}
