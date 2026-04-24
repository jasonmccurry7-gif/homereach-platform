"use server";

// ─────────────────────────────────────────────────────────────────────────────
// Top-level server actions for /admin/political.
//
// Currently: rescoreCandidatesAction — manual trigger for the priority
// rescorer. Admin-only (redundant with the layout gate; belt + suspenders).
// ─────────────────────────────────────────────────────────────────────────────

import { revalidatePath } from "next/cache";
import { isPoliticalEnabled } from "@/lib/political/env";
import { createClient as createUserClient } from "@/lib/supabase/server";
import { rescoreAllPoliticalCandidates } from "@/lib/political/priority-runner";

export interface RescoreResult {
  ok: boolean;
  error?: string;
  candidatesScanned?: number;
  candidatesUpdated?: number;
  durationMs?: number;
  tierCounts?: { hot: number; warm: number; cold: number };
}

export async function rescoreCandidatesAction(): Promise<RescoreResult> {
  if (!isPoliticalEnabled()) {
    return { ok: false, error: "Political Command Center is disabled." };
  }

  const supabase = await createUserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id ?? null;

  try {
    const summary = await rescoreAllPoliticalCandidates({
      ranByUserId: userId,
      source: "manual",
    });

    revalidatePath("/admin/political");
    return {
      ok: summary.ok,
      candidatesScanned: summary.candidatesScanned,
      candidatesUpdated: summary.candidatesUpdated,
      durationMs: summary.durationMs,
      tierCounts: summary.tierCounts,
      error: summary.errors.length > 0 ? summary.errors.join("; ") : undefined,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
