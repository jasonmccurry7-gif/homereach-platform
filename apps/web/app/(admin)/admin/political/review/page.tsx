import { createServiceClient } from "@/lib/supabase/service";
import { ReviewQueue } from "./_components/ReviewQueue";

// ─────────────────────────────────────────────────────────────────────────────
// /admin/political/review
//
// Staging review queue. Records ingested via /admin/political/data-sources
// (FEC) or future OH SoS / BOE jobs land in the staging_* tables with
// review_status = 'pending'. This page surfaces the queue + per-row and
// per-batch review actions.
//
// Phase 1A: shows pending records, lets admins approve/reject one at a time
// or by batch. Auto-dedup match suggestions and promotion-to-live actions
// arrive in Phase 1B.
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";
export const metadata = { title: "Review Queue · Political · HomeReach" };

interface SearchParams {
  kind?: string;
  batch?: string;
}

export interface ReviewRow {
  record_kind: "candidate" | "organization" | "campaign";
  id: string;
  display_name: string;
  detail_1: string | null;
  detail_2: string | null;
  state: string | null;
  cycle: number | null;
  source_type: string;
  source_url: string | null;
  source_id: string | null;
  import_batch_id: string | null;
  match_confidence: number | null;
  validation_status: "valid" | "warning" | "rejected";
  created_at: string;
}

export default async function PoliticalReviewPage(
  props: { searchParams: Promise<SearchParams> }
) {
  const params = await props.searchParams;
  const kindFilter = params.kind === "candidate" || params.kind === "organization" || params.kind === "campaign"
    ? params.kind
    : undefined;
  const batchFilter = params.batch ?? undefined;

  const supabase = createServiceClient();
  let q = supabase
    .from("political_review_queue")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  if (kindFilter) q = q.eq("record_kind", kindFilter);
  if (batchFilter) q = q.eq("import_batch_id", batchFilter);

  const { data, error } = await q;

  // Counts per kind (full pending queue, regardless of filter)
  const { data: counts } = await supabase
    .from("political_review_queue")
    .select("record_kind")
    .limit(10000);

  const countByKind = { candidate: 0, organization: 0, campaign: 0 };
  if (counts) {
    for (const row of counts) {
      countByKind[row.record_kind as keyof typeof countByKind]++;
    }
  }

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Review queue
        </h1>
        <p className="text-sm text-slate-600">
          New records ingested from upstream data sources. Approve to mark
          ready for promotion, reject to discard. Promotion to the live sales
          pipeline is a separate step (Phase 1B) so the dedup engine can suggest
          merges before write.
        </p>
      </header>

      {error && (
        <div className="rounded border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900">
          Failed to load queue: {error.message}
        </div>
      )}

      <ReviewQueue
        rows={(data ?? []) as ReviewRow[]}
        counts={countByKind}
        activeKind={kindFilter ?? null}
        activeBatch={batchFilter ?? null}
      />
    </section>
  );
}
