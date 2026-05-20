// GET + POST /api/admin/content-intel/config/competitors
//
// Admin CRUD for ci_competitor_sources (competitor names, YouTube channels,
// blog URLs, etc.). Used by the admin UI.

import { NextResponse, type NextRequest } from "next/server";
import { ciFlagGate, requireAdmin } from "@/lib/content-intel/guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_TYPES = new Set(["agency","software","brand","franchise","direct_mail","lead_gen","other"]);
const VALID_SOURCES = new Set(["youtube","blog","ads"]);

export async function GET() {
  const gate = ciFlagGate();
  if (gate) return gate;
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { data, error } = await admin.supa
    .from("ci_competitor_sources")
    .select("*")
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
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 }); }
  const {
    action, id, name, category, competitor_type, content_source,
    youtube_channel_id, youtube_handle, blog_url, priority_score, active_flag, notes,
  } = body ?? {};

  if (action === "upsert") {
    const cleanSources = Array.isArray(content_source)
      ? content_source.filter((s: any) => typeof s === "string" && VALID_SOURCES.has(s))
      : ["youtube"];
    const row: any = {
      ...(id ? { id } : {}),
      name: String(name ?? "").trim(),
      category: category ? String(category).trim() : "*",
      competitor_type: VALID_TYPES.has(competitor_type) ? competitor_type : null,
      content_source: cleanSources.length ? cleanSources : ["youtube"],
      youtube_channel_id: youtube_channel_id ? String(youtube_channel_id).trim() : null,
      youtube_handle: youtube_handle ? String(youtube_handle).trim() : null,
      blog_url: blog_url ? String(blog_url).trim() : null,
      priority_score: Math.min(10, Math.max(1, Number(priority_score ?? 5))),
      active_flag: Boolean(active_flag ?? true),
      notes: notes ? String(notes) : null,
    };
    if (!row.name) return NextResponse.json({ ok: false, error: "name required" }, { status: 400 });

    const { error } = await admin.supa
      .from("ci_competitor_sources")
      .upsert(row, { onConflict: "name,category" });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  if (action === "delete" && id) {
    const { error } = await admin.supa.from("ci_competitor_sources").delete().eq("id", id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 });
}
