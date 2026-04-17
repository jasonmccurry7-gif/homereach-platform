import { NextResponse }       from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies }            from "next/headers";
import { createServiceClient } from "@/lib/supabase/service";

// GET /api/agent/replies — replies waiting for this agent, newest first
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const session = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role    = user.app_metadata?.user_role as string;
  const { searchParams } = new URL(req.url);
  const preview = searchParams.get("preview_agent_id");
  const agentId = (role === "admin" && preview) ? preview : user.id;

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
