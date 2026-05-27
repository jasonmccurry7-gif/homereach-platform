import { NextResponse }       from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  requireAdminOrSalesAgent,
  resolveAgentScope,
} from "@/lib/auth/api-guards";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/agent/leads
// Returns paginated leads for the authenticated agent only.
// Params: ?status=all|replied|payment_sent|contacted|interested&page=N&limit=N
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const guard = await requireAdminOrSalesAgent();
  if (!guard.ok) return guard.response;
  const user = guard.user!;

  const { searchParams } = new URL(req.url);
  const previewId = searchParams.get("preview_agent_id");
  const scope = resolveAgentScope(user, previewId);
  if (!scope.ok) return scope.response;
  const agentId = scope.agentId ?? user.id;

  const status  = searchParams.get("status") ?? "all";
  const page    = Math.max(parseInt(searchParams.get("page")  ?? "1",  10), 1);
  const limit   = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 100);
  const offset  = (page - 1) * limit;

  const supabase = createServiceClient();
  let query = supabase
    .from("sales_leads")
    .select("id, business_name, city, category, status, phone, email, last_reply_at, last_contacted_at, score, notes", { count: "exact" })
    .eq("assigned_agent_id", agentId)
    .order("last_reply_at", { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);

  if (status !== "all") query = query.eq("status", status);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    leads:      data ?? [],
    total:      count ?? 0,
    page,
    limit,
    has_more:   (count ?? 0) > offset + limit,
  });
}
