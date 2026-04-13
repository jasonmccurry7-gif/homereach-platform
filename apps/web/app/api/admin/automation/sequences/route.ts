import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ─────────────────────────────────────────────────────────────────────────────
// GET  /api/admin/automation/sequences — list all sequences with step counts
// POST /api/admin/automation/sequences — create new sequence
// ─────────────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("auto_sequences")
    .select(`
      id, name, channel, category, city, status, stop_on_reply, description, created_at,
      auto_sequence_steps ( id, step_number, delay_hours, subject, body )
    `)
    .order("created_at");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Enrollment counts
  const seqIds = (data ?? []).map(s => s.id);
  const { data: counts } = await supabase
    .from("auto_enrollments")
    .select("sequence_id, status")
    .in("sequence_id", seqIds);

  const countMap = (counts ?? []).reduce<Record<string, Record<string, number>>>((acc, r) => {
    if (!acc[r.sequence_id]) acc[r.sequence_id] = {};
    acc[r.sequence_id][r.status] = (acc[r.sequence_id][r.status] ?? 0) + 1;
    return acc;
  }, {});

  const sequences = (data ?? []).map(s => ({
    ...s,
    step_count: s.auto_sequence_steps?.length ?? 0,
    enrollment_counts: countMap[s.id] ?? {},
  }));

  return NextResponse.json({ sequences });
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

  const { name, channel, category, city, stop_on_reply, description, steps } = body;

  if (!name || !channel) {
    return NextResponse.json({ error: "name and channel required" }, { status: 400 });
  }

  // Create sequence
  const { data: seq, error: seqErr } = await supabase
    .from("auto_sequences")
    .insert({ name, channel, category, city, stop_on_reply: stop_on_reply ?? true, description })
    .select()
    .single();

  if (seqErr) return NextResponse.json({ error: seqErr.message }, { status: 500 });

  // Create steps
  if (steps?.length) {
    const stepsData = steps.map((step: { step_number: number; delay_hours: number; subject?: string; body: string }) => ({
      sequence_id: seq.id,
      step_number: step.step_number,
      delay_hours: step.delay_hours ?? 0,
      subject: step.subject,
      body: step.body,
    }));
    await supabase.from("auto_sequence_steps").insert(stepsData);
  }

  return NextResponse.json({ sequence: seq });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[route] error:`, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

}
