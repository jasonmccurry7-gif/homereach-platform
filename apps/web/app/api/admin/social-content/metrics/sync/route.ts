import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrCron } from "@/lib/auth/api-guards";
import { syncSocialProviderMetrics } from "@/lib/social-content/provider-metrics";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return handleSync(req);
}

export async function POST(req: NextRequest) {
  return handleSync(req);
}

async function handleSync(req: NextRequest) {
  const guard = await requireAdminOrCron(req);
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") ?? "25");

  try {
    const result = await syncSocialProviderMetrics({
      limit: Number.isFinite(limit) ? Math.min(Math.max(Math.round(limit), 1), 100) : 25,
    });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to sync social metrics" },
      { status: 500 },
    );
  }
}
