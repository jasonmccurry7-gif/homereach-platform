import { NextResponse }       from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies }            from "next/headers";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/agent/log-action
//
// Thin, auth-enforced wrapper around /api/admin/sales/event.
// Agents on mobile can log actions without direct admin API access.
// SECURITY: agentId is ALWAYS set from user.id — never from request body.
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const session = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  // Strip agent_id from body — always use authenticated user
  const { agent_id: _, ...rest } = body;

  const { origin } = new URL(req.url);
  const res = await fetch(`${origin}/api/admin/sales/event`, {
    method:  "POST",
    headers: { "Content-Type": "application/json", "Cookie": req.headers.get("cookie") ?? "" },
    body:    JSON.stringify({ ...rest, agent_id: user.id }),
  });

  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
