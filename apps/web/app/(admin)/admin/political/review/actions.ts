"use server";

// ─────────────────────────────────────────────────────────────────────────────
// Review Queue — Server Actions.
//
// Phase 1A only supports approve / reject + "merge stub" (admin manually
// picks an existing record). The full dedup auto-suggest + promotion-rule
// engine lands in Phase 1B.
//
// "Approve" in 1A only marks the staging row approved. Promotion to
// campaign_candidates / political_organizations happens in a separate
// promote action so the operator can review what's about to land.
// ─────────────────────────────────────────────────────────────────────────────

import { revalidatePath } from "next/cache";
import { createClient as createUserClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isPoliticalEnabled } from "@/lib/political/env";

export type ReviewKind = "candidate" | "organization" | "campaign";
export type ReviewAction = "approve" | "reject";

const TABLE_FOR: Record<ReviewKind, string> = {
  candidate:     "staging_candidates",
  organization:  "staging_organizations",
  campaign:      "staging_campaigns",
};

async function requireAdmin(): Promise<string> {
  if (!isPoliticalEnabled()) throw new Error("Political Command Center is disabled.");
  const supabase = await createUserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated.");
  const role = user.app_metadata?.user_role as string | undefined;
  if (role !== "admin") throw new Error("Admin role required.");
  return user.id;
}

export interface ReviewResult {
  ok: boolean;
  error?: string;
}

export async function reviewStagingRecordAction(args: {
  kind: ReviewKind;
  id: string;
  action: ReviewAction;
  notes?: string;
}): Promise<ReviewResult> {
  try {
    const userId = await requireAdmin();
    const supabase = createServiceClient();
    const table = TABLE_FOR[args.kind];

    const newStatus = args.action === "approve" ? "approved" : "rejected";

    const { error } = await supabase
      .from(table)
      .update({
        review_status: newStatus,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        review_notes: args.notes ?? null,
      })
      .eq("id", args.id);

    if (error) return { ok: false, error: error.message };

    revalidatePath("/admin/political/review");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export interface BatchReviewArgs {
  kind: ReviewKind;
  importBatchId: string;
  action: ReviewAction;
}

export async function batchReviewAction(args: BatchReviewArgs): Promise<ReviewResult & { affected?: number }> {
  try {
    const userId = await requireAdmin();
    const supabase = createServiceClient();
    const table = TABLE_FOR[args.kind];
    const newStatus = args.action === "approve" ? "approved" : "rejected";

    const { data, error } = await supabase
      .from(table)
      .update({
        review_status: newStatus,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("import_batch_id", args.importBatchId)
      .eq("review_status", "pending")
      .select("id");

    if (error) return { ok: false, error: error.message };

    revalidatePath("/admin/political/review");
    return { ok: true, affected: data?.length ?? 0 };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
