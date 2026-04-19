// POST /api/admin/content-intel/feedback
//
// Body: { itemType, itemId, outcome, notes? }
// Records an outcome event and triggers learning weight updates.

import { NextResponse, type NextRequest } from "next/server";
import { ciFlagGate, requireAgent } from "@/lib/content-intel/guards";
import { applyOutcome } from "@/lib/content-intel/learning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_TYPES = new Set(["action", "script", "offer", "automation", "enhancement", "insight"]);
const VALID_OUTCOMES = new Set(["pending", "win", "neutral", "failed"]);

export async function POST(req: NextRequest) {
  const gate = ciFlagGate();
  if (gate) return gate;
  const auth = await requireAgent();
  if (!auth.ok) return auth.response;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  const { itemType, itemId, outcome, notes } = body ?? {};
  if (!VALID_TYPES.has(itemType) || !VALID_OUTCOMES.has(outcome) || typeof itemId !== "string") {
    return NextResponse.json({ ok: false, error: "invalid payload" }, { status: 400 });
  }

  const { data: event, error } = await auth.supa
    .from("ci_outcome_events")
    .insert({ item_type: itemType, item_id: itemId, outcome, notes: notes ?? null, agent_id: auth.agentId })
    .select("id")
    .single();
  if (error || !event) {
    return NextResponse.json({ ok: false, error: error?.message ?? "insert failed" }, { status: 500 });
  }

  // Also flip the artifact's own status to mirror the latest outcome
  if (outcome !== "pending") {
    const table = itemType === "insight" ? "ci_insights" : `ci_${itemType}s`;
    await auth.supa.from(table).update({ status: outcome }).eq("id", itemId);
  }

  // Fire-and-forget learning update (non-blocking; keep API snappy)
  applyOutcome({
    eventId: (event as any).id,
    itemType: itemType as any,
    itemId,
    outcome: outcome as any,
    supa: auth.supa,
  }).catch((err) => console.warn("[content-intel] learning update failed:", err));

  return NextResponse.json({ ok: true, eventId: (event as any).id });
}
