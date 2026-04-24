// ─────────────────────────────────────────────────────────────────────────────
// HomeReach — Political Command Center route guards
//
// Mirrors lib/lead-intel/guards.ts so the scheduled cron trigger behaves
// identically to the existing lead-intel cron. Flag + bearer-secret gates
// stay server-only.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getPoliticalCronSecret, isPoliticalEnabled } from "./env";

/** 404 when the Political Command Center is disabled. */
export function politicalFlagGate(): NextResponse | null {
  if (!isPoliticalEnabled()) {
    return new NextResponse("Not Found", { status: 404 });
  }
  return null;
}

/**
 * Validates the `Authorization: Bearer <token>` header against the cron
 * secret resolved by getPoliticalCronSecret(). Returns a NextResponse when
 * the guard should short-circuit the route, or null when the request is
 * permitted to continue.
 */
export function requirePoliticalCronSecret(req: NextRequest): NextResponse | null {
  const secret = getPoliticalCronSecret();
  if (!secret) {
    return new NextResponse("Cron not configured", { status: 503 });
  }
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;
  if (token !== secret) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  return null;
}
