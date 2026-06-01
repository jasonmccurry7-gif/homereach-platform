import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api-guards";
import { CanvaApiError } from "@/lib/canva/client";
import { createCanvaJobPlan, runCanvaAutofill, type HomeReachCanvaJobInput } from "@/lib/canva/orchestrator";

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  let body: HomeReachCanvaJobInput;
  try {
    body = (await req.json()) as HomeReachCanvaJobInput;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.templateKey || !body.context || !body.title || !body.fields) {
    return NextResponse.json(
      { ok: false, error: "templateKey, context, title, and fields are required" },
      { status: 400 },
    );
  }

  try {
    const result = await runCanvaAutofill(body);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof CanvaApiError) {
      return NextResponse.json(
        { ok: false, error: error.message, status: error.status, details: error.details, plan: createCanvaJobPlan(body) },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to run Canva autofill" },
      { status: 500 },
    );
  }
}
