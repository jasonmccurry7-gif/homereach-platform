// GET + POST /api/admin/seo-engine/pages
//
// GET: list seo_pages with optional filters (?status=&page_type=&city_id=&category_id=).
// POST: create a new draft.

import { NextResponse, type NextRequest } from "next/server";
import { seoFlagGate, requireAdmin } from "@/lib/seo/guards";
import { listPages } from "@/lib/seo/registry";
import { getInventorySnapshot } from "@/lib/seo/inventory-rules";
import type { SeoPageStatus } from "@/lib/seo/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RESERVED_SLUG_PREFIXES = ["get-started/", "targeted/start", "api/", "admin/", "auth/", "agent/", "dashboard/", "intake/"];

export async function GET(req: NextRequest) {
  const gate = seoFlagGate();
  if (gate) return gate;
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const url = new URL(req.url);
  const status = url.searchParams.get("status") as SeoPageStatus | null;
  const page_type = url.searchParams.get("page_type") as "city_category" | "city" | "targeted_route" | "featured" | null;
  const city_id = url.searchParams.get("city_id");
  const category_id = url.searchParams.get("category_id");

  const rows = await listPages({
    status: status ?? undefined,
    page_type: page_type ?? undefined,
    city_id: city_id ?? undefined,
    category_id: category_id ?? undefined,
  });

  return NextResponse.json({ ok: true, rows });
}

export async function POST(req: NextRequest) {
  const gate = seoFlagGate();
  if (gate) return gate;
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  let body: {
    page_type?: string;
    city_id?: string;
    category_id?: string | null;
    tier?: string | null;
    slug?: string;
    title_tag?: string;
    meta_description?: string;
    h1?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const page_type = String(body.page_type ?? "");
  const city_id = String(body.city_id ?? "");
  const category_id = body.category_id ?? null;
  const tier = body.tier ?? null;
  const slug = String(body.slug ?? "").trim().replace(/^\/+/, "");

  if (!["city_category", "city", "targeted_route", "featured"].includes(page_type)) {
    return NextResponse.json({ ok: false, error: "invalid_page_type" }, { status: 400 });
  }
  if (!city_id) return NextResponse.json({ ok: false, error: "city_id_required" }, { status: 400 });
  if (!slug) return NextResponse.json({ ok: false, error: "slug_required" }, { status: 400 });
  for (const prefix of RESERVED_SLUG_PREFIXES) {
    if (slug.startsWith(prefix)) {
      return NextResponse.json({ ok: false, error: `slug_reserved:${prefix}` }, { status: 409 });
    }
  }

  // City must exist + isActive=true
  const { data: city, error: cityErr } = await admin.supa
    .from("cities")
    .select("id, is_active, slug")
    .eq("id", city_id)
    .maybeSingle();
  if (cityErr || !city) return NextResponse.json({ ok: false, error: "city_not_found" }, { status: 404 });
  if (!(city as { is_active: boolean }).is_active) {
    return NextResponse.json({ ok: false, error: "city_not_active" }, { status: 409 });
  }

  // Category must exist (unless null for city/targeted_route)
  if (category_id) {
    const { data: cat, error: catErr } = await admin.supa
      .from("categories")
      .select("id")
      .eq("id", category_id)
      .maybeSingle();
    if (catErr || !cat) return NextResponse.json({ ok: false, error: "category_not_found" }, { status: 404 });
  }

  // Slug collision check (unique constraint also enforces this; early 409 for better UX)
  const { data: existing } = await admin.supa
    .from("seo_pages")
    .select("id, status")
    .eq("slug", slug)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ ok: false, error: "slug_collision", existing_id: (existing as { id: string }).id }, { status: 409 });
  }

  // Capture inventory snapshot at draft creation for later comparison
  const snapshot = await getInventorySnapshot(city_id, category_id);

  const h1_slug = body.h1 ? slugifyH1(String(body.h1)) : null;

  const { data: inserted, error: insertErr } = await admin.supa
    .from("seo_pages")
    .insert({
      page_type,
      slug,
      city_id,
      category_id,
      tier,
      status: "draft",
      title_tag: body.title_tag ?? null,
      meta_description: body.meta_description ?? null,
      h1: body.h1 ?? null,
      h1_slug,
      content_blocks: [],
      schema_ld: [],
      internal_links: [],
      primary_cta_url: null,
      inventory_snapshot: snapshot,
      created_by: admin.adminId,
    })
    .select("*")
    .maybeSingle();

  if (insertErr || !inserted) {
    return NextResponse.json({ ok: false, error: insertErr?.message ?? "insert_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, row: inserted });
}

function slugifyH1(h1: string): string {
  return h1
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 200);
}
