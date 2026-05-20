import { NextResponse } from "next/server";
import { ciFlagGate, requireAdmin } from "@/lib/content-intel/guards";
import { getLearningSourceRegistry, getLearningSourceRegistrySummary } from "@/lib/content-intel/source-registry";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = ciFlagGate();
  if (gate) return gate;

  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const rows = getLearningSourceRegistry();
  return NextResponse.json({
    ok: true,
    rows,
    summary: getLearningSourceRegistrySummary(rows),
  });
}
