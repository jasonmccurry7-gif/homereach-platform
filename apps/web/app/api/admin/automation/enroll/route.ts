import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/automation/enroll
// Body: { lead_id, sequence_id, agent_id? }
// OR   { lead_ids: string[], sequence_id, agent_id? }  — bulk enroll
//
// DELETE /api/admin/automation/enroll
// Body: { enrollment_id } | { lead_id, sequence_id }
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const body = await req.json();
  const { sequence_id, agent_id } = body;

  if (!sequence_id) {
    return NextResponse.json({ error: "sequence_id required" }, { status: 400 });
  }

  // Single or bulk
  const leadIds: string[] = body.lead_ids ?? (body.lead_id ? [body.lead_id] : []);
  if (!leadIds.length) {
    return NextResponse.json({ error: "lead_id or lead_ids required" }, { status: 400 });
  }

  const results: { lead_id: string; enrollment_id?: string; error?: string }[] = [];

  for (const lead_id of leadIds) {
    const { data, error } = await supabase.rpc("enroll_lead_in_sequence", {
      p_lead_id: lead_id,
      p_sequence_id: sequence_id,
      p_agent_id: agent_id ?? null,
    });

    if (error) {
      results.push({ lead_id, error: error.message });
    } else {
      results.push({ lead_id, enrollment_id: data as string });
    }
  }

  const succeeded = results.filter(r => !r.error).length;
  const failed    = results.filter(r => !!r.error).length;

  return NextResponse.json({ enrolled: succeeded, failed, results });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const body = await req.json();

  let query = supabase.from("auto_enrollments").update({
    status: "stopped",
    stopped_at: new Date().toISOString(),
    stop_reason: "manual_stop",
  });

  if (body.enrollment_id) {
    query = query.eq("id", body.enrollment_id);
  } else if (body.lead_id && body.sequence_id) {
    query = query.eq("lead_id", body.lead_id).eq("sequence_id", body.sequence_id);
  } else if (body.lead_id) {
    // Stop ALL active enrollments for this lead
    query = query.eq("lead_id", body.lead_id).eq("status", "active");
  } else {
    return NextResponse.json({ error: "enrollment_id or lead_id required" }, { status: 400 });
  }

  const { error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
