import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api-guards";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

const PROMOTABLE_TYPES = new Set(["insight"]);

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  let body: { itemType?: string; itemId?: string; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const itemType = body.itemType?.trim();
  const itemId = body.itemId?.trim();

  if (!itemType || !itemId || !PROMOTABLE_TYPES.has(itemType)) {
    return NextResponse.json({ ok: false, error: "A valid itemType and itemId are required." }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: insight, error: readError } = await supabase
    .from("ci_insights")
    .select("id,category,theme,insight_text,rationale,apex_score,status,created_at")
    .eq("id", itemId)
    .maybeSingle();

  if (readError) {
    return NextResponse.json({ ok: false, error: readError.message }, { status: 500 });
  }
  if (!insight) {
    return NextResponse.json({ ok: false, error: "Learning Engine insight not found." }, { status: 404 });
  }

  const sourceKey = `learning-promoted-insight-${insight.id}`;
  const title = `Promoted Learning insight: ${insight.theme || insight.category || "HomeReach improvement"}`;
  const note = body.note?.trim() || null;

  const { data: action, error: upsertError } = await supabase
    .from("unified_action_items")
    .upsert(
      {
        source_key: sourceKey,
        source: "learning_engine_promotion",
        dashboard: "Learning Engine",
        route: "/admin/content-intel",
        title,
        reason: `${insight.category ?? "general"} insight with APEX ${insight.apex_score ?? 0}: ${String(insight.insight_text ?? "").slice(0, 220)}`,
        recommended_action: "Review this promoted Learning Engine idea and approve a safe internal handoff only if it fits the current roadmap.",
        impact: "Turns a research finding into supervised internal implementation work without production execution.",
        urgency: Number(insight.apex_score ?? 0) >= 18 ? "medium" : "low",
        status: "needs_review",
        owner: "admin",
        requires_human_approval: true,
        source_created_at: insight.created_at ?? null,
        last_seen_at: new Date().toISOString(),
        source_snapshot: {
          itemType,
          itemId,
          category: insight.category,
          theme: insight.theme,
          apexScore: insight.apex_score,
          status: insight.status,
          promotedBy: guard.user?.id ?? null,
          note,
        },
        metadata: {
          promotedFrom: "learning_engine",
          promotionMode: "internal_review_only",
        },
      },
      { onConflict: "source_key" },
    )
    .select("id,source_key")
    .single();

  if (upsertError || !action) {
    return NextResponse.json({ ok: false, error: upsertError?.message ?? "Promotion failed." }, { status: 500 });
  }

  await supabase.from("unified_action_events").insert({
    action_item_id: action.id,
    source_key: sourceKey,
    event_type: "created",
    actor_id: guard.user?.id ?? null,
    note: note ?? "Learning Engine item promoted for internal review.",
    metadata: {
      itemType,
      itemId,
      externalWorkflowTouched: false,
    },
  });

  return NextResponse.json({
    ok: true,
    sourceKey,
    actionItemId: action.id,
    route: "/admin/agents",
    message: "Learning Engine insight promoted to the Action Center. No production workflow was executed.",
  });
}
