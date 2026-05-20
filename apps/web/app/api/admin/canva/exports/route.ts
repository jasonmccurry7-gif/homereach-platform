import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api-guards";
import { CanvaApiError, CanvaConnectClient, type CanvaExportRequest } from "@/lib/canva/client";
import { getCanvaConfigStatus } from "@/lib/canva/config";

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  let body: CanvaExportRequest;
  try {
    body = (await req.json()) as CanvaExportRequest;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.design_id || !body.format?.type) {
    return NextResponse.json({ ok: false, error: "design_id and format.type are required" }, { status: 400 });
  }

  const status = getCanvaConfigStatus();
  if (status.mode !== "live_token_ready") {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      message: "Canva token is not configured. Export request validated but not sent.",
      request: body,
      status,
    });
  }

  try {
    const client = new CanvaConnectClient();
    const job = await client.createExportJob(body);
    return NextResponse.json({ ok: true, dryRun: false, job });
  } catch (error) {
    if (error instanceof CanvaApiError) {
      return NextResponse.json(
        { ok: false, error: error.message, status: error.status, details: error.details },
        { status: error.status },
      );
    }
    return NextResponse.json({ ok: false, error: "Unable to create Canva export job" }, { status: 500 });
  }
}
