// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/qa/knowledge/search?q=...&category=...&cityId=...&limit=20
//
// Full-text (and future semantic) search over the Q&A knowledge bible.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { qaFlagGate, requireAgent } from "@/lib/qa/guards";
import { searchKnowledge } from "@/lib/qa/retrieval";
import { logUsage } from "@/lib/qa/usage";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const flag = qaFlagGate();
  if (flag) return flag;
  const g = await requireAgent();
  if (!g.ok) return g.response;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const category = searchParams.get("category") || undefined;
  const cityId = searchParams.get("cityId") || undefined;
  const limit = parseInt(searchParams.get("limit") || "20", 10);

  const results = await searchKnowledge(g.supa, { q, category, cityId, limit });

  await logUsage(g.supa, {
    eventType: "knowledge_searched",
    agentId: g.agentId,
    metadata: { q, category, cityId, result_count: results.length },
  });

  return NextResponse.json({ results });
}
