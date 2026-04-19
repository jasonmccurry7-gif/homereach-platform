// GET + POST /api/admin/content-intel/config/channels
//
// Admin CRUD for ci_trusted_channels.

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
    .from("ci_trusted_channels")
    .select("*")
    .order("trust_score", { ascending: false });
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
  const { action, id, channel_name, channel_id, category, trust_score, force_include, translate_saas, notes } = body ?? {};

  if (action === "upsert") {
    const row: any = {
      ...(id ? { id } : {}),
      channel_name: String(channel_name ?? "").trim(),
      channel_id: channel_id ? String(channel_id).trim() : null,
      category: category ? String(category).trim() : "*",
      trust_score: Math.min(5, Math.max(1, Number(trust_score ?? 3))),
      force_include: Boolean(force_include ?? false),
      translate_saas: Boolean(translate_saas ?? false),
      notes: notes ? String(notes) : null,
    };
    if (!row.channel_name) {
      return NextResponse.json({ ok: false, error: "channel_name required" }, { status: 400 });
    }
    const { error } = await admin.supa
      .from("ci_trusted_channels")
      .upsert(row, { onConflict: "channel_name,category" });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  if (action === "delete" && id) {
    const { error } = await admin.supa.from("ci_trusted_channels").delete().eq("id", id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 });
}
