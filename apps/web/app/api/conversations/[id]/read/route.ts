// ─────────────────────────────────────────────────────────────────────────────
// POST /api/conversations/[id]/read
// Marks all inbound messages in a conversation as read.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { getConversationRepository } from "@/lib/engine/db/factory";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await context.params;
    const repo = getConversationRepository();
    await repo.markRead(conversationId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[POST /api/conversations/[id]/read]", err);
    return NextResponse.json({ error: "Failed to mark read" }, { status: 500 });
  }
}
