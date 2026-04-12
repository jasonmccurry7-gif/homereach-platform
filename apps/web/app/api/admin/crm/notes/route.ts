import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { lead_id, company_id, type, body: noteBody, is_pinned } = body;
  if (!noteBody) return NextResponse.json({ error: "body required" }, { status: 400 });

  const { data, error } = await supabase.from("crm_notes").insert({
    lead_id, company_id, type: type ?? "other",
    body: noteBody, is_pinned: is_pinned ?? false,
    agent_id: user.id,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update last_note_at on lead
  if (lead_id) {
    await supabase.from("sales_leads").update({ last_note_at: new Date().toISOString() }).eq("id", lead_id);
  }

  return NextResponse.json({ note: data });
}
