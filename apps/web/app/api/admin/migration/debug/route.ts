import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  // Auth guard — admin only
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceClient();

  // 1. Raw migration records
  const { data: raw, error: rawErr } = await supabase
    .from("businesses")
    .select("id, name, notes, status")
    .like("notes", "%[migration_meta]%");

  if (rawErr) return NextResponse.json({ error: rawErr.message }, { status: 500 });

  // 2. Parse each record
  const parsed = (raw ?? []).map(row => {
    try {
      const metaStr = row.notes?.split("[migration_meta]")[1];
      const meta = JSON.parse(metaStr ?? "{}") as Record<string, unknown>;
      return {
        id:              row.id,
        name:            row.name,
        dbStatus:        row.status,
        migrationStatus: meta.migrationStatus,
        city:            meta.city,
        cityNormalized:  ((meta.city as string) ?? "").split(",")[0].trim(),
        category:        meta.category,
        spotType:        meta.spotType,
        willCount:       meta.migrationStatus !== "legacy_pending",
      };
    } catch {
      return { id: row.id, name: row.name, parseError: true };
    }
  });

  // 3. Cities table
  const { data: cities } = await supabase
    .from("cities")
    .select("id, name, state, is_active")
    .order("name");

  const cityNameMap: Record<string, string> = {};
  for (const c of cities ?? []) cityNameMap[c.name.toLowerCase()] = c.id;

  // 4. Check which records will match a city
  const withMatch = parsed.map(p => ({
    ...p,
    cityMatchFound: "cityNormalized" in p
      ? !!cityNameMap[((p as {cityNormalized: string}).cityNormalized ?? "").toLowerCase()]
      : false,
  }));

  const counting = withMatch.filter(p => "willCount" in p && p.willCount && "cityMatchFound" in p && p.cityMatchFound);
  const notCounting = withMatch.filter(p => !("willCount" in p && p.willCount && "cityMatchFound" in p && p.cityMatchFound));

  return NextResponse.json({
    summary: {
      totalMigrationRecords: raw?.length ?? 0,
      willCountTowardSpots:  counting.length,
      willNotCount:          notCounting.length,
    },
    countingRecords: counting,
    notCountingRecords: notCounting,
    allCitiesInDb: (cities ?? []).map(c => ({ id: c.id, name: c.name, active: c.is_active })),
  });
}
