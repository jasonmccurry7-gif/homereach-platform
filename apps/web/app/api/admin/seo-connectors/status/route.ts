import { NextResponse } from "next/server";
import { getSeoConnectorSnapshot } from "@/lib/seo/connectors";
import { requireAdmin, seoFlagGate } from "@/lib/seo/guards";

export async function GET() {
  const gate = seoFlagGate();
  if (gate) return gate;

  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const snapshot = await getSeoConnectorSnapshot();
  return NextResponse.json(snapshot);
}
