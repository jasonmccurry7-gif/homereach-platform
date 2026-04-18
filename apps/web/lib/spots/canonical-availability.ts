// ─────────────────────────────────────────────────────────────────────────────
// HomeReach — Canonical Availability Helper
//
// ONE function, ONE source of truth for "is (city, category) available
// right now for a new paying advertiser?". Called by both:
//   - GET  /api/spots/availability  (pre-checkout UI check)
//   - POST /api/spots/checkout      (server-side gate before any DB write)
//
// It unifies the three historical sources of truth:
//   1. spot_assignments     — canonical new-system state
//   2. orders              — pending/paid/active orders via businesses
//   3. businesses.notes    — legacy migration metadata with
//                            migrationStatus in ('legacy_active')
//   4. deny-list           — emergency hard block (lib/spots/deny-list.ts)
//
// Semantics:
//   - Returns available=false if ANY source reports the slot as taken.
//   - Returns available=false and fail-closed if any query errors.
//     Never return available=true after an error.
//
// The caller MUST treat a thrown error or a non-"ok" result as
// UNAVAILABLE. No "proceed on query failure" paths.
// ─────────────────────────────────────────────────────────────────────────────

import { createServiceClient } from "@/lib/supabase/service";
import { checkDenyList, normalizeName } from "./deny-list";

export type AvailabilitySource =
  | "deny_list"
  | "spot_assignments"
  | "orders"
  | "legacy_migration"
  | "query_error"
  | "ok";

export type AvailabilityResult = {
  available: boolean;
  source: AvailabilitySource;
  detail?: string;
  /** Human-readable message safe to surface in UI. */
  message?: string;
  /** Underlying error details for server logs. Never surfaced to client. */
  errorDetail?: string;
};

type SupaLike = ReturnType<typeof createServiceClient>;

/**
 * Canonical availability check. Fail-closed on any error.
 *
 * @param args.cityId       UUID of the city
 * @param args.categoryId   UUID of the category
 * @param args.supa         Optional service-role Supabase client (one will
 *                          be created if not passed). Pass one when you
 *                          already have it to save a handshake.
 */
export async function checkCanonicalAvailability(args: {
  cityId: string;
  categoryId: string;
  supa?: SupaLike;
}): Promise<AvailabilityResult> {
  const { cityId, categoryId } = args;
  const supa = args.supa ?? createServiceClient();

  // ── 0) Resolve city + category names (needed for deny-list + legacy check)
  //      Done first because both (1) and (3) need the names.
  let cityName: string | null = null;
  let categoryName: string | null = null;
  try {
    const [{ data: cityRow }, { data: catRow }] = await Promise.all([
      supa.from("cities").select("name").eq("id", cityId).maybeSingle(),
      supa.from("categories").select("name").eq("id", categoryId).maybeSingle(),
    ]);
    cityName = (cityRow as any)?.name ?? null;
    categoryName = (catRow as any)?.name ?? null;
  } catch (err) {
    return {
      available: false,
      source: "query_error",
      detail: "Could not resolve city/category names",
      message:
        "We could not confirm availability right now. Please try again in a moment.",
      errorDetail: err instanceof Error ? err.message : String(err),
    };
  }

  // The request MUST identify a real city + category. Guard against
  // callers that send a UUID with no matching row.
  if (!cityName || !categoryName) {
    return {
      available: false,
      source: "query_error",
      detail: "city or category not found",
      message: "We could not find that city or category.",
    };
  }

  // ── 1) Emergency deny-list (hardcoded in deny-list.ts)
  const deny = checkDenyList(cityName, categoryName);
  if (deny) {
    return {
      available: false,
      source: "deny_list",
      detail: deny.reason,
      message:
        "This spot is currently locked. Join the waitlist to be notified when it opens.",
    };
  }

  // ── 2) spot_assignments (canonical new-system state)
  try {
    const { data, error } = await supa
      .from("spot_assignments")
      .select("id, status")
      .eq("city_id", cityId)
      .eq("category_id", categoryId)
      .in("status", ["pending", "active"])
      .limit(1);
    if (error) throw error;
    if (data && data.length > 0) {
      return {
        available: false,
        source: "spot_assignments",
        detail: `spot_assignment ${(data[0] as any).id} is ${(data[0] as any).status}`,
        message:
          "This spot is currently taken. Join the waitlist to be notified when it opens.",
      };
    }
  } catch (err) {
    return {
      available: false,
      source: "query_error",
      detail: "spot_assignments query failed",
      message:
        "We could not confirm availability right now. Please try again in a moment.",
      errorDetail: err instanceof Error ? err.message : String(err),
    };
  }

  // ── 3) orders via businesses (new-system, pre-subscription)
  //      Catches checkouts where the Stripe subscription hasn't activated
  //      yet and therefore no spot_assignments row exists (race guard).
  try {
    const { data: bizRows, error: bizErr } = await supa
      .from("businesses")
      .select("id")
      .eq("city_id", cityId)
      .eq("category_id", categoryId);
    if (bizErr) throw bizErr;
    const bizIds = (bizRows ?? []).map((b: any) => b.id);
    if (bizIds.length > 0) {
      const { count, error: orderErr } = await supa
        .from("orders")
        .select("id", { count: "exact", head: true })
        .in("business_id", bizIds)
        .in("status", ["pending", "paid", "active"]);
      if (orderErr) throw orderErr;
      if ((count ?? 0) > 0) {
        return {
          available: false,
          source: "orders",
          detail: `${count} pending/paid/active orders already exist`,
          message:
            "This spot is currently in checkout by another buyer. Please try again in a few minutes.",
        };
      }
    }
  } catch (err) {
    return {
      available: false,
      source: "query_error",
      detail: "orders query failed",
      message:
        "We could not confirm availability right now. Please try again in a moment.",
      errorDetail: err instanceof Error ? err.message : String(err),
    };
  }

  // ── 4) Legacy migration metadata (businesses.notes JSON)
  //      This is the source that was invisible to the audit's availability
  //      endpoint before this fix. Legacy-active clients are stored with
  //      city_id=null, category_id=null, and city/category-as-strings in a
  //      [migration_meta]{...} JSON block inside the notes column.
  try {
    const { data: legacyRows, error } = await supa
      .from("businesses")
      .select("id, notes")
      .like("notes", "%[migration_meta]%")
      .limit(500); // cap — migration table is < 500 rows in practice
    if (error) throw error;

    const cityKey = normalizeName(cityName);
    const catKey = normalizeName(categoryName);

    for (const row of legacyRows ?? []) {
      const raw = (row as any).notes as string | null;
      if (!raw) continue;
      const idx = raw.indexOf("[migration_meta]");
      if (idx < 0) continue;
      const jsonStr = raw.slice(idx + "[migration_meta]".length).trim();
      let meta: any = null;
      try {
        meta = JSON.parse(jsonStr);
      } catch {
        continue; // unparseable metadata — skip, don't fail-open
      }
      const metaStatus = String(meta?.migrationStatus ?? "");
      if (metaStatus !== "legacy_active") continue; // legacy_pending does NOT occupy
      const metaCity = normalizeName(meta?.city);
      const metaCat = normalizeName(meta?.category);
      if (metaCity === cityKey && metaCat === catKey) {
        return {
          available: false,
          source: "legacy_migration",
          detail: `legacy_active migration record ${(row as any).id}`,
          message:
            "This spot is currently taken. Join the waitlist to be notified when it opens.",
        };
      }
    }
  } catch (err) {
    return {
      available: false,
      source: "query_error",
      detail: "legacy migration metadata query failed",
      message:
        "We could not confirm availability right now. Please try again in a moment.",
      errorDetail: err instanceof Error ? err.message : String(err),
    };
  }

  // ── All sources clear → available.
  return { available: true, source: "ok" };
}
