import { NextResponse } from "next/server";
import { isPoliticalEnabled } from "@/lib/political/env";
import { savePublicMapPlan } from "@/lib/political/map-plans";
import {
  checkPublicRateLimit,
  publicRateLimitHeaders,
} from "@/lib/security/public-rate-limit";

const MAX_PUBLIC_MAP_PLAN_BODY_BYTES = 750_000;
const MAP_PLAN_SAVE_RATE_LIMIT = {
  scope: "political:map-plan-save",
  limit: 30,
  windowMs: 5 * 60_000,
};

export async function POST(request: Request) {
  if (!isPoliticalEnabled()) {
    return NextResponse.json({ ok: false, error: "Political module disabled" }, { status: 404 });
  }

  const rateLimit = checkPublicRateLimit(request, MAP_PLAN_SAVE_RATE_LIMIT);
  const headers = publicRateLimitHeaders(rateLimit);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many map plan save requests." },
      { status: 429, headers }
    );
  }

  let body: unknown;
  try {
    const rawBody = await request.text();
    if (rawBody.length > MAX_PUBLIC_MAP_PLAN_BODY_BYTES) {
      return NextResponse.json(
        { ok: false, error: "Map plan payload is too large" },
        { status: 413, headers }
      );
    }
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400, headers });
  }

  try {
    const result = await savePublicMapPlan(body && typeof body === "object" ? body : {});
    return NextResponse.json(result, { status: result.ok ? 201 : 202, headers });
  } catch (error) {
    console.error("[api/political/map-plans] failed", error);
    return NextResponse.json(
      {
        ok: false,
        stored: "local_only",
        reason: "Map plan save failed before reaching the database.",
      },
      { status: 202, headers }
    );
  }
}
