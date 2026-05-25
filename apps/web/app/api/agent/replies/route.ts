import { NextResponse }       from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  requireAdminOrSalesAgent,
  resolveAgentScope,
} from "@/lib/auth/api-guards";

// GET /api/agent/replies — replies waiting for this agent, newest first
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const guard = await requireAdminOrSalesAgent();
  if (!guard.ok) return guard.response;
  const user = guard.user!;

  const { searchParams } = new URL(req.url);
  const preview = searchParams.get("preview_agent_id");
  const scope = resolveAgentScope(user, preview);
  if (!scope.ok) return scope.response;
  const agentId = scope.agentId ?? user.id;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("sales_leads")
    .select("id, business_name, city, category, status, last_reply_at, phone, email")
    .eq("assigned_agent_id", agentId)
    .eq("status", "replied")
    .order("last_reply_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ replies: data ?? [], count: (data ?? []).length });
}
