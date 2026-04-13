import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db, intakeSubmissions } from "@homereach/db";
import { eq } from "drizzle-orm";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/intake/[id]/review
// Admin-only: marks an intake submission as reviewed.
// ─────────────────────────────────────────────────────────────────────────────

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(req: Request, { params }: Params) {
  try {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminEmails = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase());
  if (!adminEmails.includes(user.email?.toLowerCase() ?? "")) {
    return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
  }

  const { id } = await params;

  const [updated] = await db
    .update(intakeSubmissions)
    .set({ status: "reviewed", updatedAt: new Date() })
    .where(eq(intakeSubmissions.id, id))
    .returning({ id: intakeSubmissions.id });

  if (!updated) {
    return NextResponse.json({ error: "Intake submission not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[route] error:`, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

}
