import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ─────────────────────────────────────────────────────────────────────────────
// GET  /api/admin/system/pause — current pause state (system + all sequences + agents)
// POST /api/admin/system/pause — pause/unpause system | sequence | agent
//
// Body: { scope: "system" | "sequence" | "agent", id?: string, paused: boolean, reason?: string }
// ─────────────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
  const supabase = await createClient();

  const [sysResult, seqResult, agentResult] = await Promise.all([
    supabase.from("system_controls").select("all_paused, pause_reason, paused_at").eq("id", 1).single(),
    supabase.from("auto_sequences").select("id, name, channel, status, pause_reason, paused_at"),
    supabase.from("agent_pause_controls").select("agent_id, paused, reason, paused_at, profiles:agent_id(full_name)"),
  ]);

  return NextResponse.json({
    system: sysResult.data,
    sequences: seqResult.data ?? [],
    agents: agentResult.data ?? [],
  });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[route] error:`, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

}

export async function POST(req: NextRequest) {
  try {
  const supabase = await createClient();
  const body = await req.json();
  const { scope, id, paused, reason } = body;

  // Get admin identity
  const { data: { user } } = await supabase.auth.getUser();
  const adminId = user?.id ?? null;

  if (!["system", "sequence", "agent"].includes(scope)) {
    return NextResponse.json({ error: "scope must be: system | sequence | agent" }, { status: 400 });
  }

  const now = new Date().toISOString();

  // ── System-wide pause ──────────────────────────────────────────────────────
  if (scope === "system") {
    const { error } = await supabase
      .from("system_controls")
      .update({
        all_paused:   paused,
        paused_by:    paused ? adminId : null,
        paused_at:    paused ? now : null,
        pause_reason: paused ? (reason ?? "Admin pause") : null,
      })
      .eq("id", 1);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Also pause/unpause all sequences
    if (paused) {
      await supabase.from("auto_sequences")
        .update({ status: "paused", pause_reason: "system_pause", paused_by: adminId, paused_at: now })
        .eq("status", "active");
    } else {
      await supabase.from("auto_sequences")
        .update({ status: "active", pause_reason: null, paused_by: null, paused_at: null })
        .eq("pause_reason", "system_pause");
    }

    return NextResponse.json({ ok: true, scope: "system", paused });
  }

  // ── Sequence pause ─────────────────────────────────────────────────────────
  if (scope === "sequence") {
    if (!id) return NextResponse.json({ error: "id required for scope=sequence" }, { status: 400 });

    const newStatus = paused ? "paused" : "active";
    const { error } = await supabase
      .from("auto_sequences")
      .update({
        status:      newStatus,
        paused_by:   paused ? adminId : null,
        paused_at:   paused ? now : null,
        pause_reason: paused ? (reason ?? "Admin pause") : null,
      })
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, scope: "sequence", id, paused });
  }

  // ── Agent pause ────────────────────────────────────────────────────────────
  if (scope === "agent") {
    if (!id) return NextResponse.json({ error: "id required for scope=agent" }, { status: 400 });

    const { error } = await supabase
      .from("agent_pause_controls")
      .upsert({
        agent_id:  id,
        paused,
        paused_by: paused ? adminId : null,
        paused_at: paused ? now : null,
        reason:    paused ? (reason ?? "Admin pause") : null,
      }, { onConflict: "agent_id" });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Also stop active enrollments for this agent if pausing
    if (paused) {
      await supabase
        .from("auto_enrollments")
        .update({ status: "stopped", stopped_at: now, stop_reason: "agent_paused" })
        .eq("agent_id", id)
        .eq("status", "active");
    }

    return NextResponse.json({ ok: true, scope: "agent", id, paused });
  }

  return NextResponse.json({ error: "invalid scope" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[route] error:`, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

}
