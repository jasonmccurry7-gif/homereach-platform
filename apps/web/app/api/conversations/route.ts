// ─────────────────────────────────────────────────────────────────────────────
// GET /api/conversations
//
// Returns all conversations from the real DB (outreach_replies grouped by contact).
// Used by the admin inbox to load real data on mount and refresh.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { AutomationEngine } from "@/lib/engine/automation";
import { getConversationRepository } from "@/lib/engine/db/factory";

export async function GET() {
  try {
    const repo   = getConversationRepository();
    const engine = new AutomationEngine(repo);
    const convs  = await engine.getAllConversations();
    return NextResponse.json({ conversations: convs });
  } catch (err) {
    console.error("[GET /api/conversations]", err);
    return NextResponse.json(
      { error: "Failed to load conversations" },
      { status: 500 }
    );
  }
}
