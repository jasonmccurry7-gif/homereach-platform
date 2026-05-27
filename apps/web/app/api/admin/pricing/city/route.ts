import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api-guards";

// PUT /api/admin/pricing/city
// Body: { cityId, foundingEligible: boolean }

export async function PUT(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const db = createServiceClient();
  const { cityId, foundingEligible } = await req.json();

  const { error } = await db.from("cities").update({ founding_eligible: foundingEligible }).eq("id", cityId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
