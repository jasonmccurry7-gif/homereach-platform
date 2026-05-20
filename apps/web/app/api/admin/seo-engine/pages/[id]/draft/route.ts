// POST /api/admin/seo-engine/pages/[id]/draft
//
// Claude-powered content draft generator. DOUBLE flag-gated:
//   ENABLE_SEO_ENGINE AND ENABLE_SEO_DRAFT_GENERATION.
//
// Mandates that four blocks (city_relevance, category_pain, proof_trust,
// faq) carry "[MANUAL: ...]" placeholders so the admin must hand-edit them
// before the page can pass the publish-time authored-words quality gate.
//
// Calls Anthropic REST API directly (no SDK) to match lib/qa/claude.ts +
// lib/content-intel/extractor.ts patterns.

import { NextResponse, type NextRequest } from "next/server";
import { seoDraftFlagGate, requireAdmin } from "@/lib/seo/guards";
import { getAnthropicKey, getDraftModel } from "@/lib/seo/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DraftInput = {
  structured_inputs?: {
    city_notes?: string;
    category_pain_points?: string[];
    desired_tone?: string;
  };
};

const SYSTEM_PROMPT = `You are Claude, drafting SEO landing-page content for HomeReach.

HomeReach sells exclusive city-category advertising slots (one business per category per city) to local home-service businesses. Buyers are business owners, NOT homeowners.

Your output MUST be strict JSON matching the schema below. No markdown, no preamble.

OUTPUT SCHEMA:
{
  "title_tag": string,           // 40-60 chars, includes city + category
  "meta_description": string,    // 120-160 chars, includes a verb-led CTA hook
  "h1": string,                  // statement form, not a duplicate of title_tag
  "content_blocks": [
    // 15 blocks in this order. For each, fill "text" with the visible copy.
    { "kind": "hero", "text": string, "data": { "headline": string, "subheadline": string, "primary_cta_label": string, "primary_cta_url": string } },
    { "kind": "city_relevance", "text": "[MANUAL: hand-author a 80-200 word paragraph with neighborhoods, homeowner data, local anchors]", "requires_human_authoring": true, "data": {} },
    { "kind": "category_pain", "text": "[MANUAL: list 3-5 category-specific pain points for this buyer]", "requires_human_authoring": true, "data": { "pain_points": [] } },
    { "kind": "how_it_works", "text": string, "data": {} },
    { "kind": "exclusivity_explainer", "text": string, "data": {} },
    { "kind": "scarcity_availability", "text": "", "data": {} },
    { "kind": "pricing_offer", "text": "", "data": {} },
    { "kind": "proof_trust", "text": "[MANUAL: real testimonial with name+business+city consent, OR honest early-access framing]", "requires_human_authoring": true, "data": { "mode": "early_access" } },
    { "kind": "faq", "text": "[MANUAL: hand-author 3-8 pairs with city+category-specific questions]", "requires_human_authoring": true, "data": { "pairs": [] } },
    { "kind": "cta_final", "text": string, "data": { "primary_cta_label": string, "primary_cta_url": string } },
    { "kind": "internal_links", "text": "", "data": { "links": [] } }
  ],
  "primary_cta_url": string      // MUST be "/get-started/<citySlug>/<categorySlug>" for city_category pages; "/targeted/start?city=<citySlug>" for targeted_route; never generic "/get-started"
}

RULES:
- Primary CTA URL must be specific to this page's city AND category. Generic "/get-started" is forbidden.
- The four [MANUAL:] placeholders must remain untouched - the admin hand-edits them next.
- No fabricated testimonials. If no testimonial is available, use "early_access" mode honestly.
- Category pain points must be structural (what makes generating leads hard for this category), not city-specific.
- No em-dashes. Use plain hyphens.`;

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = seoDraftFlagGate();
  if (gate) return gate;
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { id } = await ctx.params;

  const { data: page, error } = await admin.supa
    .from("seo_pages")
    .select("id, page_type, slug, city_id, category_id, status")
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!page) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  type P = { id: string; page_type: string; slug: string; city_id: string; category_id: string | null; status: string };
  const p = page as P;
  if (p.status !== "draft" && p.status !== "review") {
    return NextResponse.json({ ok: false, error: "not_editable_status", status: p.status }, { status: 409 });
  }

  // Resolve city + category names for context
  const [cityRes, catRes] = await Promise.all([
    admin.supa.from("cities").select("name, slug, state").eq("id", p.city_id).maybeSingle(),
    p.category_id
      ? admin.supa.from("categories").select("name, slug").eq("id", p.category_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  type City = { name: string; slug: string; state: string };
  type Cat = { name: string; slug: string };
  const city = cityRes.data as City | null;
  const cat = catRes.data as Cat | null;
  if (!city) return NextResponse.json({ ok: false, error: "city_not_resolved" }, { status: 500 });

  let body: DraftInput = {};
  try {
    body = (await req.json()) as DraftInput;
  } catch {
    // empty body is OK
  }
  const inputs = body.structured_inputs ?? {};

  const userPrompt = [
    `PAGE_TYPE: ${p.page_type}`,
    `CITY: ${city.name}, ${city.state} (slug=${city.slug})`,
    cat ? `CATEGORY: ${cat.name} (slug=${cat.slug})` : `CATEGORY: none (city-only page)`,
    `SLUG: ${p.slug}`,
    inputs.city_notes ? `CITY_NOTES: ${inputs.city_notes}` : "",
    inputs.desired_tone ? `TONE: ${inputs.desired_tone}` : "TONE: confident, no fluff, no filler",
    inputs.category_pain_points && inputs.category_pain_points.length > 0
      ? `CATEGORY_PAIN_SEEDS: ${inputs.category_pain_points.join(" | ")}`
      : "",
    ``,
    `Draft the page per the schema. Remember: [MANUAL:] placeholders stay intact.`,
  ]
    .filter(Boolean)
    .join("\n");

  const apiKey = getAnthropicKey();
  const model = getDraftModel();
  const startedAt = Date.now();

  let rawText = "";
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 2500,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json(
        { ok: false, error: "anthropic_error", status: res.status, detail: errText.slice(0, 500) },
        { status: 502 },
      );
    }
    const payload = (await res.json()) as { content: Array<{ type: string; text?: string }> };
    rawText = payload.content
      .filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("");
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: "fetch_failed", message: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }

  // Extract JSON (Claude may include whitespace or light prose around it)
  const firstBrace = rawText.indexOf("{");
  const lastBrace = rawText.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return NextResponse.json({ ok: false, error: "no_json_in_response", raw: rawText.slice(0, 500) }, { status: 502 });
  }
  let parsed: {
    title_tag?: string;
    meta_description?: string;
    h1?: string;
    content_blocks?: unknown[];
    primary_cta_url?: string;
  };
  try {
    parsed = JSON.parse(rawText.slice(firstBrace, lastBrace + 1));
  } catch {
    return NextResponse.json({ ok: false, error: "json_parse_failed", raw: rawText.slice(0, 500) }, { status: 502 });
  }

  const update = {
    title_tag: parsed.title_tag ?? null,
    meta_description: parsed.meta_description ?? null,
    h1: parsed.h1 ?? null,
    content_blocks: Array.isArray(parsed.content_blocks) ? parsed.content_blocks : [],
    primary_cta_url: parsed.primary_cta_url ?? null,
  };

  const { data: updated, error: updErr } = await admin.supa
    .from("seo_pages")
    .update(update)
    .eq("id", id)
    .select("id, slug, title_tag, h1")
    .maybeSingle();
  if (updErr || !updated) {
    return NextResponse.json({ ok: false, error: updErr?.message ?? "update_failed" }, { status: 500 });
  }

  console.log(`[seo.page.drafted] id=${id} model=${model} ms=${Date.now() - startedAt} actor=${admin.adminId}`);
  return NextResponse.json({
    ok: true,
    row: updated,
    draft: parsed,
    model_name: model,
    latency_ms: Date.now() - startedAt,
    note: "Four MANUAL blocks are placeholders and must be hand-edited before publish.",
  });
}
