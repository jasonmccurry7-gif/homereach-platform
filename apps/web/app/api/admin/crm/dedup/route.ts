import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ─────────────────────────────────────────────────────────────────────────────
// GET  /api/admin/crm/dedup?resolution=pending|merged|kept_separate|all
// POST /api/admin/crm/dedup  — resolve a cluster: merge | keep_separate | reviewed
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const resolution = req.nextUrl.searchParams.get("resolution") ?? "pending";
  const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "50");

  let query = supabase
    .from("crm_dedup_clusters")
    .select(`
      id, match_reason, confidence, resolution, merge_notes, auto_detected, created_at,
      canonical:canonical_id (
        id, business_name, contact_name, email, phone, city, category,
        score, pipeline_stage, total_messages_sent, total_replies
      ),
      duplicate:duplicate_id (
        id, business_name, contact_name, email, phone, city, category,
        score, pipeline_stage, total_messages_sent, total_replies
      )
    `)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (resolution !== "all") {
    query = query.eq("resolution", resolution);
  }

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Counts by resolution
  const { data: counts } = await supabase
    .from("crm_dedup_clusters")
    .select("resolution")
    .then(res => {
      const tally: Record<string, number> = {};
      (res.data ?? []).forEach(r => { tally[r.resolution] = (tally[r.resolution] ?? 0) + 1; });
      return { data: tally };
    });

  return NextResponse.json({ clusters: data ?? [], counts, total: count });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { cluster_id, action, merge_notes } = await req.json();

  // Get current user
  let resolvedBy: string | null = null;
  const { data: { user } } = await supabase.auth.getUser();
  resolvedBy = user?.id ?? null;

  if (!cluster_id || !action) {
    return NextResponse.json({ error: "cluster_id and action required" }, { status: 400 });
  }

  if (!["merge", "keep_separate", "reviewed"].includes(action)) {
    return NextResponse.json({ error: "action must be: merge | keep_separate | reviewed" }, { status: 400 });
  }

  // Get cluster
  const { data: cluster, error: clusterErr } = await supabase
    .from("crm_dedup_clusters")
    .select("canonical_id, duplicate_id")
    .eq("id", cluster_id)
    .single();

  if (clusterErr || !cluster) {
    return NextResponse.json({ error: "cluster not found" }, { status: 404 });
  }

  if (action === "merge") {
    // Call RPC to merge duplicate into canonical
    const { error: mergeErr } = await supabase.rpc("merge_duplicate_lead", {
      p_canonical_id: cluster.canonical_id,
      p_duplicate_id: cluster.duplicate_id,
      p_resolved_by:  resolvedBy,
    });
    if (mergeErr) return NextResponse.json({ error: mergeErr.message }, { status: 500 });
    return NextResponse.json({ ok: true, action: "merged", canonical_id: cluster.canonical_id });
  }

  // keep_separate or reviewed — just update the cluster
  const resolution = action === "keep_separate" ? "kept_separate" : "reviewed";
  const { error: updateErr } = await supabase
    .from("crm_dedup_clusters")
    .update({
      resolution,
      resolved_by: resolvedBy,
      resolved_at: new Date().toISOString(),
      merge_notes: merge_notes ?? null,
    })
    .eq("id", cluster_id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, action: resolution });
}
