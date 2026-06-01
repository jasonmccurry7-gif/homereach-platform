import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api-guards";
import { loadGoogleBusinessProfileIntegrationStatus } from "@/lib/google-business-profile/repository";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    googleBusinessProfile: await loadGoogleBusinessProfileIntegrationStatus(),
  });
}
