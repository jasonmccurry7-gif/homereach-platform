// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/qa/knowledge/dedupe-check  { draft: string }
//
// Before creating a new question, check if an existing knowledge entry
// already covers the draft. Returns top-3 candidates.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { qaFlagGate, requireAgent } from "@/lib/qa/guards";
import { dedupeCheck } from "@/lib/qa/retrieval";
import { logUsage } from "@/lib/qa/usage";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const flag = qaFlagGate();
  if (flag) return flag;
  const g = await requireAgent();
  if (!g.ok) return g.response;

  const body = (await req.json().catch(() => ({}))) as { draft?: string };
  const draft = (body.draft || "").trim();
  if (draft.length < 3) {
    return NextResponse.json({ suggestions: [] });
  }

  const suggestions = await dedupeCheck(g.supa, draft);

  await logUsage(g.supa, {
    eventType: "dedupe_checked",
    agentId: g.agentId,
    metadata: { draft_len: draft.length, suggestion_count: suggestions.length },
  });

  return NextResponse.json({ suggestions });
}
