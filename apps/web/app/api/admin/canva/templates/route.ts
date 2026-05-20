import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api-guards";
import { CanvaApiError, CanvaConnectClient } from "@/lib/canva/client";
import { getCanvaConfigStatus, HOMEREACH_CANVA_TEMPLATES } from "@/lib/canva/config";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const status = getCanvaConfigStatus();
  if (status.mode !== "live_token_ready") {
    return NextResponse.json({
      ok: true,
      live: false,
      message: "Canva token is not configured. Returning HomeReach template registry only.",
      templates: HOMEREACH_CANVA_TEMPLATES,
      status,
    });
  }

  try {
    const client = new CanvaConnectClient();
    const canvaTemplates = await client.listBrandTemplates(50);
    return NextResponse.json({
      ok: true,
      live: true,
      templates: HOMEREACH_CANVA_TEMPLATES,
      canvaTemplates,
      status,
    });
  } catch (error) {
    if (error instanceof CanvaApiError) {
      return NextResponse.json(
        { ok: false, error: error.message, status: error.status, details: error.details },
        { status: error.status },
      );
    }
    return NextResponse.json({ ok: false, error: "Unable to list Canva templates" }, { status: 500 });
  }
}
