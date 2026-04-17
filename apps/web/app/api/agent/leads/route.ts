import { NextResponse }       from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies }            from "next/headers";
import { createServiceClient } from "@/lib/supabase/service";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/agent/leads
// Returns paginated leads for the authenticated agent only.
// Params: ?status=all|replied|payment_sent|contacted|interested&page=N&limit=N
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const sessionClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = user.app_metadata?.user_role as string;
  const { searchParams } = new URL(req.url);
  const previewId = searchParams.get("preview_agent_id");
  const agentId   = (role === "admin" && previewId) ? previewId : user.id;

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
