// ─────────────────────────────────────────────────────────────────────────────
// HomeReach SEO Engine - Inventory Truth Helpers
//
// Two-layer enforcement:
//   - Publish time: ensure no spot_assignments row with status in
//     ('pending','active') exists for the page's (city, category) pair,
//     unless the page is in waitlist framing.
//   - Render time: ScarcityLive component re-queries at request time.
//
// Uses the PL/pgSQL seo_pages_inventory_ok() function for the publish gate
// and a plain Supabase query for the render-time snapshot.
// ─────────────────────────────────────────────────────────────────────────────

import { createServiceClient } from "@/lib/supabase/service";
import { isSeoEngineEnabled } from "./env";

/** True if the (city, category) slot is currently available. */
export async function isInventoryAvailable(cityId: string, categoryId: string | null): Promise<boolean> {
  if (!isSeoEngineEnabled()) return false;
  if (categoryId === null) return true; // city-only pages have no category slot to check
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("seo_pages_inventory_ok", {
    p_city_id: cityId,
    p_category_id: categoryId,
  });
  if (error) return false;
  return Boolean(data);
}

export type InventorySnapshot = {
  available: boolean;
  locked_rows_count: number;
  captured_at: string;
};

/** Captures the (city, category) inventory state at a point in time for auditability. */
export async function getInventorySnapshot(cityId: string, categoryId: string | null): Promise<InventorySnapshot> {
  const now = new Date().toISOString();
  if (!isSeoEngineEnabled() || categoryId === null) {
    return { available: categoryId === null, locked_rows_count: 0, captured_at: now };
  }
  const supabase = createServiceClient();
  const { count, error } = await supabase
    .from("spot_assignments")
    .select("*", { count: "exact", head: true })
    .eq("city_id", cityId)
    .eq("category_id", categoryId)
    .in("status", ["pending", "active"]);
  if (error) return { available: false, locked_rows_count: 0, captured_at: now };
  return {
    available: (count ?? 0) === 0,
    locked_rows_count: count ?? 0,
    captured_at: now,
  };
}

/** Render-time live scarcity data for the ScarcityLive component. */
export type LiveScarcity = {
  total_slots: number;
  taken: number;
  remaining: number;
  is_locked: boolean;
};

export async function getLiveScarcity(cityId: string, categoryId: string | null): Promise<LiveScarcity> {
  if (!isSeoEngineEnabled() || categoryId === null) {
    return { total_slots: 1, taken: 0, remaining: 1, is_locked: false };
  }
  const supabase = createServiceClient();
  const { count } = await supabase
    .from("spot_assignments")
    .select("*", { count: "exact", head: true })
    .eq("city_id", cityId)
    .eq("category_id", categoryId)
    .in("status", ["pending", "active"]);
  const taken = count ?? 0;
  return {
    total_slots: 1, // one exclusive advertiser per city+category
    taken,
    remaining: Math.max(0, 1 - taken),
    is_locked: taken >= 1,
  };
}
