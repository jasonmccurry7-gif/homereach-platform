"use server";

// ─────────────────────────────────────────────────────────────────────────────
// Data Sources — Server Actions.
//
// • runFecIngestionAction(kind, cycle, state?) — pulls from OpenFEC into
//   the staging tables. Admin only.
// • toggleDataSourceEnabledAction(id, enabled) — flip the registry flag.
// ─────────────────────────────────────────────────────────────────────────────

import { revalidatePath } from "next/cache";
import { createClient as createUserClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isPoliticalEnabled } from "@/lib/political/env";
import { runFecIngestion, type FecIngestionKind, type FecIngestionResult } from "@/lib/political/fec/ingest";

async function requireAdmin(): Promise<string> {
  if (!isPoliticalEnabled()) throw new Error("Political Command Center is disabled.");
  const supabase = await createUserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated.");
  const role = user.app_metadata?.user_role as string | undefined;
  if (role !== "admin") throw new Error("Admin role required.");
  return user.id;
}

export async function runFecIngestionAction(args: {
  kind: FecIngestionKind;
  cycle: number;
  state?: string;
  maxRecords?: number;
}): Promise<FecIngestionResult> {
  try {
    const userId = await requireAdmin();
    const supabase = createServiceClient();
    const result = await runFecIngestion(supabase, {
      kind: args.kind,
      cycle: args.cycle,
      state: args.state,
      maxRecords: args.maxRecords,
      uploadedBy: userId,
    });
    revalidatePath("/admin/political/data-sources");
    revalidatePath("/admin/political/review");
    revalidatePath("/admin/political/imports");
    return result;
  } catch (err) {
    return {
      ok: false,
      fetched: 0, inserted: 0, skipped: 0, failed: 0,
      durationMs: 0,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function toggleDataSourceEnabledAction(args: {
  id: string;
  enabled: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    const supabase = createServiceClient();
    const { error } = await supabase
      .from("political_data_sources")
      .update({ enabled: args.enabled })
      .eq("id", args.id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/political/data-sources");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
