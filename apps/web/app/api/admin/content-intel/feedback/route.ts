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
const VALID_OUTCOMES = new Set(["pending", "win", "neutral", "failed", "approved", "rejected"]);

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
  const normalizedOutcome = normalizeOutcome(outcome);
  const nextStatus = statusForItem(itemType, normalizedOutcome);

  const { data: event, error } = await auth.supa
    .from("ci_outcome_events")
    .insert({ item_type: itemType, item_id: itemId, outcome: normalizedOutcome, notes: notes ?? null, agent_id: auth.agentId })
    .select("id")
    .single();
  if (error || !event) {
    return NextResponse.json({ ok: false, error: error?.message ?? "insert failed" }, { status: 500 });
  }

  // Also flip the artifact's own status to mirror the latest outcome
  if (nextStatus) {
    const table = itemType === "insight" ? "ci_insights" : `ci_${itemType}s`;
    const { error: statusError } = await auth.supa.from(table).update({ status: nextStatus }).eq("id", itemId);
    if (statusError) {
      return NextResponse.json(
        {
          ok: false,
          eventId: (event as any).id,
          error: `Outcome recorded, but status update failed: ${statusError.message}`,
        },
        { status: 500 },
      );
    }
  }

  // Fire-and-forget learning update (non-blocking; keep API snappy)
  applyOutcome({
    eventId: (event as any).id,
    itemType: itemType as any,
    itemId,
    outcome: normalizedOutcome as any,
    supa: auth.supa,
  }).catch((err) => console.warn("[content-intel] learning update failed:", err));

  return NextResponse.json({ ok: true, eventId: (event as any).id, status: nextStatus });
}

function normalizeOutcome(outcome: string): "pending" | "win" | "neutral" | "failed" {
  if (outcome === "approved") return "win";
  if (outcome === "rejected") return "failed";
  return outcome as "pending" | "win" | "neutral" | "failed";
}

function statusForItem(itemType: string, outcome: "pending" | "win" | "neutral" | "failed"): string | null {
  if (outcome === "pending" || outcome === "neutral") return null;

  if (itemType === "insight" || itemType === "automation" || itemType === "enhancement") {
    return outcome === "win" ? "approved" : "rejected";
  }

  return outcome;
}
