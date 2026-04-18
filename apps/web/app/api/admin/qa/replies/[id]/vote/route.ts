// ─────────────────────────────────────────────────────────────────────────────
// POST   /api/admin/qa/replies/:id/vote    — upvote a reply
// DELETE /api/admin/qa/replies/:id/vote    — remove your upvote
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { qaFlagGate, requireAgent } from "@/lib/qa/guards";

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

  // Insert vote (unique constraint prevents duplicates)
  const { error } = await g.supa.from("qa_reply_votes").insert({
    reply_id: id,
    voter_agent_id: g.agentId,
    vote: 1,
  });

  // If already voted (unique violation), that's fine
  if (error && !error.message.includes("duplicate")) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Recompute upvote_count
  const { count } = await g.supa
    .from("qa_reply_votes")
    .select("id", { count: "exact", head: true })
    .eq("reply_id", id);

  await g.supa
    .from("qa_thread_replies")
    .update({ upvote_count: count ?? 0 })
    .eq("id", id);

  return NextResponse.json({ upvoteCount: count ?? 0 });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const flag = qaFlagGate();
  if (flag) return flag;
  const g = await requireAgent();
  if (!g.ok) return g.response;

  const { id } = await ctx.params;
  await g.supa
    .from("qa_reply_votes")
    .delete()
    .eq("reply_id", id)
    .eq("voter_agent_id", g.agentId);

  const { count } = await g.supa
    .from("qa_reply_votes")
    .select("id", { count: "exact", head: true })
    .eq("reply_id", id);

  await g.supa
    .from("qa_thread_replies")
    .update({ upvote_count: count ?? 0 })
    .eq("id", id);

  return NextResponse.json({ upvoteCount: count ?? 0 });
}
