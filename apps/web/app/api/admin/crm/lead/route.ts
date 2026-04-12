import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/admin/crm/lead?id=UUID
// Returns full lead detail with outreach history, notes, tasks, conversations
export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const [leadRes, outreachRes, notesRes, tasksRes, convRes, historyRes] = await Promise.all([
    supabase.from("sales_leads").select("*, crm_lead_tags(tag_id, crm_tags(name, color))").eq("id", id).single(),
    supabase.from("crm_outreach_events").select("*").eq("lead_id", id).order("created_at", { ascending: false }).limit(50),
    supabase.from("crm_notes").select("*, profiles(full_name)").eq("lead_id", id).order("created_at", { ascending: false }),
    supabase.from("crm_tasks").select("*").eq("lead_id", id).order("due_at", { ascending: true }),
    supabase.from("crm_conversations").select("*").eq("lead_id", id),
    supabase.from("crm_pipeline_history").select("*").eq("lead_id", id).order("created_at", { ascending: false }).limit(20),
  ]);

  return NextResponse.json({
    lead:            leadRes.data,
    outreach_events: outreachRes.data ?? [],
    notes:           notesRes.data ?? [],
    tasks:           tasksRes.data ?? [],
    conversations:   convRes.data ?? [],
    pipeline_history: historyRes.data ?? [],
  });
}

// PATCH /api/admin/crm/lead — update lead fields or pipeline stage
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const body = await request.json();
  const { id, updates, stage_change, agent_id, stage_reason } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  if (updates) {
    const { error } = await supabase
      .from("sales_leads")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Log pipeline stage change
  if (stage_change) {
    const { data: lead } = await supabase.from("sales_leads").select("pipeline_stage").eq("id", id).single();
    await supabase.from("crm_pipeline_history").insert({
      lead_id:    id,
      agent_id:   agent_id ?? null,
      from_stage: lead?.pipeline_stage ?? null,
      to_stage:   stage_change,
      reason:     stage_reason ?? null,
    });
    await supabase.from("sales_leads").update({ pipeline_stage: stage_change, updated_at: new Date().toISOString() }).eq("id", id);
  }

  return NextResponse.json({ ok: true });
}
