import { NextResponse }       from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies }            from "next/headers";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/agent/preferences
//
// Thin, auth-enforced proxy to /api/admin/alerts/preferences.
// Agents can read their OWN alert preferences without admin API access.
// agent_id is always set from user.id — never from request params.
// ─────────────────────────────────────────────────────────────────────────────

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

  const { origin } = new URL(req.url);
  const res = await fetch(`${origin}/api/admin/alerts/preferences?agent_id=${user.id}`, {
    headers: { "Cookie": req.headers.get("cookie") ?? "" },
  });

  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
