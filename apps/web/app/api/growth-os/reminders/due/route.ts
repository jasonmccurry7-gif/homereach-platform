import { NextResponse } from "next/server";
import {
  db,
  fsgosBusinessProfiles,
  fsgosWeeklyInputs,
} from "@homereach/db";
import { eq } from "drizzle-orm";
import {
  getGrowthOsCronSecret,
  isGrowthOsEnabled,
} from "@/lib/growth-os/feature-flag";
import { getCurrentWeekStartDate } from "@/lib/growth-os/metrics";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
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

  const weekStartDate = getCurrentWeekStartDate();
  const [profiles, completedInputs] = await Promise.all([
    db
      .select({
        userId: fsgosBusinessProfiles.userId,
        companyName: fsgosBusinessProfiles.companyName,
        timezone: fsgosBusinessProfiles.timezone,
      })
      .from(fsgosBusinessProfiles),
    db
      .select({ userId: fsgosWeeklyInputs.userId })
      .from(fsgosWeeklyInputs)
      .where(eq(fsgosWeeklyInputs.weekStartDate, weekStartDate)),
  ]);

  const completed = new Set(completedInputs.map((row) => row.userId));
  const due = profiles.filter((profile) => !completed.has(profile.userId));

  return NextResponse.json({
    weekStartDate,
    dueCount: due.length,
    due,
    sendsPerformed: false,
  });
}
