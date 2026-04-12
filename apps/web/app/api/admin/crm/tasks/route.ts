import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { lead_id, type, title, description, due_at } = body;
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });

  const { data, error } = await supabase.from("crm_tasks").insert({
    lead_id, type: type ?? "follow_up", title, description,
    due_at, agent_id: user.id, status: "pending",
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (lead_id) await supabase.from("sales_leads").update({ next_follow_up_at: due_at }).eq("id", lead_id);

  return NextResponse.json({ task: data });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const body = await request.json();
  const { id, status, completed_at } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await supabase.from("crm_tasks")
    .update({ status, completed_at: completed_at ?? (status === "done" ? new Date().toISOString() : null) })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
