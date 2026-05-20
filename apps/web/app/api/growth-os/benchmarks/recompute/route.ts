import { NextResponse } from "next/server";
import { recomputeGrowthOsBenchmarks } from "@/lib/growth-os/benchmarks";
import {
  getGrowthOsBenchmarkSystemUserId,
  getGrowthOsCronSecret,
  isGrowthOsEnabled,
} from "@/lib/growth-os/feature-flag";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isGrowthOsEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const configuredSecret = getGrowthOsCronSecret();
  const authHeader = req.headers.get("authorization") ?? "";
  const bearer = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : "";
  const headerSecret = req.headers.get("x-fsgos-cron-secret") ?? bearer;

  if (!configuredSecret || headerSecret !== configuredSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const systemUserId = getGrowthOsBenchmarkSystemUserId();
  if (!systemUserId) {
    return NextResponse.json(
      { error: "FSGOS_BENCHMARK_SYSTEM_USER_ID is required" },
      { status: 500 }
    );
  }

  const result = await recomputeGrowthOsBenchmarks(systemUserId);
  return NextResponse.json({
    ...result,
    minSampleSize: 10,
  });
}
