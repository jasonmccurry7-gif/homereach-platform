import { NextResponse }       from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies }            from "next/headers";
import { createServiceClient } from "@/lib/supabase/service";

// ─────────────────────────────────────────────────────────────────────────────
// GET  /api/admin/alerts/preferences          — read own or (admin) any agent's prefs
// POST /api/admin/alerts/preferences          — upsert alert preferences
//
// GET params:
//   agent_id (admin only) — defaults to authenticated user
//
// POST body:
//   { phone, quiet_hours_start?, quiet_hours_end?, max_per_hour?,
//     enabled_types?, urgent_override?, enabled? }
// ─────────────────────────────────────────────────────────────────────────────

async function getSessionUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const role = user.app_metadata?.user_role;

  // Admin can query any agent; agents can only query themselves
  let targetAgentId = user.id;
  if (role === "admin" && searchParams.get("agent_id")) {
    targetAgentId = searchParams.get("agent_id")!;
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("agent_alert_preferences")
    .select("*")
    .eq("agent_id", targetAgentId)
    .single();

  if (error && error.code !== "PGRST116") {
    // PGRST116 = no rows found — that's OK (returns defaults)
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    preferences: data ?? null,
    defaults_applied: !data,
  });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const role = user.app_metadata?.user_role;

  // Agents can only set their own prefs; admin can set for any agent
  let targetAgentId = user.id;
  if (role === "admin" && body.agent_id && typeof body.agent_id === "string") {
    targetAgentId = body.agent_id;
  }

  // Only accept known fields — never let arbitrary data in
  const payload: Record<string, unknown> = { agent_id: targetAgentId, updated_at: new Date().toISOString() };
  if (typeof body.phone               === "string")  payload.phone               = body.phone;
  if (typeof body.quiet_hours_start   === "number")  payload.quiet_hours_start   = body.quiet_hours_start;
  if (typeof body.quiet_hours_end     === "number")  payload.quiet_hours_end     = body.quiet_hours_end;
  if (typeof body.max_per_hour        === "number")  payload.max_per_hour        = body.max_per_hour;
  if (Array.isArray(body.enabled_types))             payload.enabled_types       = body.enabled_types;
  if (typeof body.urgent_override     === "boolean") payload.urgent_override     = body.urgent_override;
  if (typeof body.enabled             === "boolean") payload.enabled             = body.enabled;

  if (!payload.phone) {
    return NextResponse.json({ error: "phone is required" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("agent_alert_preferences")
    .upsert(payload, { onConflict: "agent_id" })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ preferences: data, saved: true });
}
