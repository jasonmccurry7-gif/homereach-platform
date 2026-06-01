import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const TaskUpdateSchema = z.object({
  status: z.enum(["open", "in_progress", "completed", "blocked", "cancelled"]),
  notes: z.string().max(2000).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  const body = await req.json().catch(() => null);
  const parsed = TaskUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid task update", details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("digital_campaign_tasks")
    .update({
      status: parsed.data.status,
      notes: parsed.data.notes,
      completed_at: parsed.data.status === "completed" ? now : null,
      updated_at: now,
    })
    .eq("id", taskId)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ task: data });
}
