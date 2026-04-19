// GET + POST /api/admin/content-intel/config/topics
//
// Admin CRUD for ci_category_topics. Used by the admin UI to tune the
// category search-term seed list.

import { NextResponse, type NextRequest } from "next/server";
import { ciFlagGate, requireAdmin } from "@/lib/content-intel/guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const gate = ciFlagGate();
  if (gate) return gate;
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;
  const { data, error } = await admin.supa
    .from("ci_category_topics")
    .select("*")
    .order("category", { ascending: true })
    .order("priority_score", { ascending: false });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, rows: data ?? [] });
}

export async function POST(req: NextRequest) {
  const gate = ciFlagGate();
  if (gate) return gate;
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 }); }
  const { action, id, category, search_term, priority_score, active_flag } = body ?? {};

  if (action === "upsert") {
    const row = {
      ...(id ? { id } : {}),
      category: String(category ?? "").trim(),
      search_term: String(search_term ?? "").trim(),
      priority_score: Math.min(5, Math.max(1, Number(priority_score ?? 3))),
      active_flag: Boolean(active_flag ?? true),
    };
    if (!row.category || !row.search_term) {
      return NextResponse.json({ ok: false, error: "category + search_term required" }, { status: 400 });
    }
    const { error } = await admin.supa
      .from("ci_category_topics")
      .upsert(row, { onConflict: "category,search_term" });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  if (action === "delete" && id) {
    const { error } = await admin.supa.from("ci_category_topics").delete().eq("id", id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 });
}
