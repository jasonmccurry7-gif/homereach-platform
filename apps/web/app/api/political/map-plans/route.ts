import { NextResponse } from "next/server";
import { isPoliticalEnabled } from "@/lib/political/env";
import { savePublicMapPlan } from "@/lib/political/map-plans";

export async function POST(request: Request) {
  if (!isPoliticalEnabled()) {
    return NextResponse.json({ ok: false, error: "Political module disabled" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const result = await savePublicMapPlan(body && typeof body === "object" ? body : {});
    return NextResponse.json(result, { status: result.ok ? 201 : 202 });
  } catch (error) {
    console.error("[api/political/map-plans] failed", error);
    return NextResponse.json(
      {
        ok: false,
        stored: "local_only",
        reason: "Map plan save failed before reaching the database.",
      },
      { status: 202 }
    );
  }
}
