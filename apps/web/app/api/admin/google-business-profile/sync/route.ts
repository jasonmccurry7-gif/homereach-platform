import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api-guards";
import { syncGoogleBusinessProfileReadOnly } from "@/lib/google-business-profile/repository";

export async function POST() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const result = await syncGoogleBusinessProfileReadOnly();
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    mode: "read_only",
    result,
    safety: "No posts, review replies, listing updates, or public changes were published.",
  });
}
