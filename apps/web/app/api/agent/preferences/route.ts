import { NextResponse }       from "next/server";
import { requireAdminOrSalesAgent } from "@/lib/auth/api-guards";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/agent/preferences
//
// Thin, auth-enforced proxy to /api/admin/alerts/preferences.
// Agents can read their OWN alert preferences without admin API access.
// agent_id is always set from user.id — never from request params.
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const guard = await requireAdminOrSalesAgent();
  if (!guard.ok) return guard.response;
  const user = guard.user;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { origin } = new URL(req.url);
  const res = await fetch(`${origin}/api/admin/alerts/preferences?agent_id=${user.id}`, {
    headers: { "Cookie": req.headers.get("cookie") ?? "" },
  });

  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
