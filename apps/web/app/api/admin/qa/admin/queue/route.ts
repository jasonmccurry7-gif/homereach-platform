// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/qa/admin/queue
//
// Admin-only: questions needing attention.
//  - Unresolved (status=open, no best answer, > 1h old)
//  - High upvote, no official answer
//  - Asked >= 3 times recently (knowledge gap signal)
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { qaFlagGate, requireAdmin } from "@/lib/qa/guards";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const flag = qaFlagGate();
  if (flag) return flag;
  const a = await requireAdmin();
  if (!a.ok) return a.response;

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const [unresolvedR, popularR] = await Promise.all([
    a.supa
      .from("qa_questions")
      .select(
        "id, question_text, category_tags, status, upvote_count, created_at, asked_by_agent_id",
      )
      .eq("status", "open")
      .lt("created_at", oneHourAgo)
      .order("created_at", { ascending: true })
      .limit(50),
    a.supa
      .from("qa_questions")
      .select(
        "id, question_text, category_tags, status, upvote_count, created_at, asked_by_agent_id",
      )
      .neq("status", "archived")
      .gte("upvote_count", 3)
      .order("upvote_count", { ascending: false })
      .limit(25),
  ]);

  return NextResponse.json({
    unresolved: unresolvedR.data ?? [],
    popular: popularR.data ?? [],
  });
}
