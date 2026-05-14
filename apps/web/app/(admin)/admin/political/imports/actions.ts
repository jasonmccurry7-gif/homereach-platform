"use server";

// ─────────────────────────────────────────────────────────────────────────────
// Political CSV import — Server Actions.
//
// Three actions:
//   • previewImportAction   — parse + validate the CSV, return per-row preview
//   • commitImportAction    — actually insert; creates an audit row in
//                             political_imports tagged onto every inserted row
//   • rollbackImportAction  — delete all rows tagged with a given importId
//                             and mark the audit row rolled_back
//
// All three are admin-only. The middleware + (admin)/layout already block
// non-admins from reaching these routes, but we re-check inside each action
// (defense in depth — an action can be called from anywhere in the app).
// ─────────────────────────────────────────────────────────────────────────────

import { revalidatePath } from "next/cache";
import { createClient as createUserClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isPoliticalEnabled } from "@/lib/political/env";
import { runPreview, runCommit, runRollback } from "@/lib/political/imports/pipeline";
import { makeRoutesSpec } from "@/lib/political/imports/routes-spec";
import { makeOrganizationsSpec } from "@/lib/political/imports/organizations-spec";
import type {
  ImportPreview,
  CommitResult,
  RollbackResult,
  ImportKind,
} from "@/lib/political/imports/types";
import type { ImporterSpec } from "@/lib/political/imports/spec";

// ─────────────────────────────────────────────────────────────────────────────
// Auth helper — returns the admin user's ID, or throws.
// ─────────────────────────────────────────────────────────────────────────────

async function requireAdmin(): Promise<string> {
  if (!isPoliticalEnabled()) {
    throw new Error("Political Command Center is disabled.");
  }
  const supabase = await createUserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated.");

  const role = user.app_metadata?.user_role as string | undefined;
  if (role !== "admin") {
    throw new Error("Admin role required for political imports.");
  }
  return user.id;
}

// ─────────────────────────────────────────────────────────────────────────────
// Spec resolver
// ─────────────────────────────────────────────────────────────────────────────

function specFor(kind: ImportKind, source: string): ImporterSpec<unknown> {
  if (kind === "routes") return makeRoutesSpec(source) as ImporterSpec<unknown>;
  if (kind === "organizations") return makeOrganizationsSpec() as ImporterSpec<unknown>;
  throw new Error(`Unknown import kind: ${kind}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// previewImportAction
// ─────────────────────────────────────────────────────────────────────────────

export interface PreviewArgs {
  kind: ImportKind;
  csvText: string;
  source: string;
  originalFilename: string | null;
}

export async function previewImportAction(args: PreviewArgs): Promise<
  { ok: true; preview: ImportPreview } | { ok: false; error: string }
> {
  try {
    await requireAdmin();
    if (!args.csvText || args.csvText.trim().length === 0) {
      return { ok: false, error: "Empty CSV." };
    }
    if (!args.source || args.source.trim().length === 0) {
      return { ok: false, error: "Provenance 'source' is required." };
    }

    const supabase = createServiceClient();
    const spec = specFor(args.kind, args.source);
    const preview = await runPreview({
      supabase,
      spec,
      csvText: args.csvText,
      source: args.source.trim(),
      originalFilename: args.originalFilename,
    });
    return { ok: true, preview };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// commitImportAction
// ─────────────────────────────────────────────────────────────────────────────

export interface CommitArgs {
  kind: ImportKind;
  csvText: string;
  source: string;
  originalFilename: string | null;
  /** Operator must explicitly confirm if a prior upload of this exact file exists. */
  acknowledgePriorUpload?: boolean;
}

export async function commitImportAction(args: CommitArgs): Promise<CommitResult> {
  try {
    const userId = await requireAdmin();
    if (!args.csvText) {
      return { ok: false, inserted: 0, skipped: 0, rejected: 0, error: "Empty CSV." };
    }
    if (!args.source) {
      return { ok: false, inserted: 0, skipped: 0, rejected: 0, error: "source required" };
    }

    const supabase = createServiceClient();
    const spec = specFor(args.kind, args.source);

    // Re-check prior upload server-side (the client UI also checks, but
    // never trust the client).
    const previewForCheck = await runPreview({
      supabase, spec,
      csvText: args.csvText,
      source: args.source,
      originalFilename: args.originalFilename,
    });
    if (previewForCheck.priorUpload && !args.acknowledgePriorUpload) {
      return {
        ok: false,
        inserted: 0,
        skipped: 0,
        rejected: 0,
        error: `This exact file (sha256=${previewForCheck.fileSha256.slice(0, 12)}…) was previously uploaded as import ${previewForCheck.priorUpload.importId} (status: ${previewForCheck.priorUpload.status}). Re-uploading would create duplicate audit entries. Confirm to proceed.`,
      };
    }

    const result = await runCommit({
      supabase,
      spec,
      csvText: args.csvText,
      source: args.source.trim(),
      originalFilename: args.originalFilename,
      uploadedBy: userId,
    });

    if (result.ok) {
      revalidatePath("/admin/political/imports");
      revalidatePath(`/admin/political/${args.kind}`);
      revalidatePath(`/admin/political/${args.kind}/import`);
    }
    return result;
  } catch (err) {
    return {
      ok: false,
      inserted: 0,
      skipped: 0,
      rejected: 0,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// rollbackImportAction
// ─────────────────────────────────────────────────────────────────────────────

export async function rollbackImportAction(importId: string): Promise<RollbackResult> {
  try {
    const userId = await requireAdmin();
    if (!importId) {
      return { ok: false, importId: "", rowsRemoved: 0, error: "importId required" };
    }
    const supabase = createServiceClient();
    const result = await runRollback({ supabase, importId, rolledBackBy: userId });

    if (result.ok) {
      revalidatePath("/admin/political/imports");
      revalidatePath("/admin/political/routes");
      revalidatePath("/admin/political/routes/import");
      revalidatePath("/admin/political/organizations");
      revalidatePath("/admin/political/organizations/import");
    }
    return result;
  } catch (err) {
    return {
      ok: false,
      importId,
      rowsRemoved: 0,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
