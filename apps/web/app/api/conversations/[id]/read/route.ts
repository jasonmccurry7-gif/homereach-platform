// ─────────────────────────────────────────────────────────────────────────────
// POST /api/conversations/[id]/read
// Marks all inbound messages in a conversation as read.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { getConversationRepository } from "@/lib/engine/db/factory";
import { requireAdminOrSalesAgent } from "@/lib/auth/api-guards";
import { createServiceClient } from "@/lib/supabase/service";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function canAccessConversation(userId: string, role: string | undefined, conversationId: string) {
  if (role === "admin") return true;
  if (role !== "sales_agent") return false;

  const leadId = conversationId.replace(/^conv-/, "");
  if (!UUID_RE.test(leadId)) return false;

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("sales_leads")
    .select("id")
    .eq("id", leadId)
    .eq("assigned_agent_id", userId)
    .maybeSingle();

  return Boolean(data);
}

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireAdminOrSalesAgent();
    if (!guard.ok) return guard.response;

    const { id: conversationId } = await context.params;
    const currentUser = guard.user!;
    const role = currentUser.app_metadata?.user_role as string | undefined;
    if (!(await canAccessConversation(currentUser.id, role, conversationId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const repo = getConversationRepository();
    await repo.markRead(conversationId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[POST /api/conversations/[id]/read]", err);
    return NextResponse.json({ error: "Failed to mark read" }, { status: 500 });
  }
}
