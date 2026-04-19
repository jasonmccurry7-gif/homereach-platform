// ─────────────────────────────────────────────────────────────────────────────
// HomeReach — Content Intelligence Route Guards
//
// Mirrors lib/qa/guards.ts. Every /api/admin/content-intel/* route must call
// ciFlagGate() first. The cron endpoint uses requireCronSecret() instead of a
// user session (since the scheduler has no user).
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient as createUserScopedClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getCronSecret, isContentIntelEnabled } from "./env";

type ServiceSupa = ReturnType<typeof createServiceClient>;

/** Return 404 when the Content Intelligence system is disabled. */
export function ciFlagGate(): NextResponse | null {
  if (!isContentIntelEnabled()) {
    return new NextResponse("Not Found", { status: 404 });
  }
  return null;
}

/** Guard for admin-only routes (review queue, config, etc.). */
export async function requireAdmin(): Promise<
  | { ok: true; agentId: string; supa: ServiceSupa }
  | { ok: false; response: NextResponse }
> {
  const userScoped = await createUserScopedClient();
  const { data: userData, error } = await userScoped.auth.getUser();
  if (error || !userData?.user) {
    return {
      ok: false,
      response: new NextResponse("Unauthorized", { status: 401 }),
    };
  }

  const svc = createServiceClient();
  const { data: profile } = await svc
    .from("profiles")
    .select("id, role")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (!profile) {
    return {
      ok: false,
      response: new NextResponse("Forbidden", { status: 403 }),
    };
  }

  if ((profile as any).role !== "admin") {
    return {
      ok: false,
      response: new NextResponse("Admin only", { status: 403 }),
    };
  }

  return { ok: true, agentId: (profile as any).id, supa: svc };
}

/** Guard for agent-accessible read-only endpoints (dashboard cards). */
export async function requireAgent(): Promise<
  | { ok: true; agentId: string; isAdmin: boolean; supa: ServiceSupa }
  | { ok: false; response: NextResponse }
> {
  const userScoped = await createUserScopedClient();
  const { data: userData, error } = await userScoped.auth.getUser();
  if (error || !userData?.user) {
    return {
      ok: false,
      response: new NextResponse("Unauthorized", { status: 401 }),
    };
  }

  const svc = createServiceClient();
  const { data: profile } = await svc
    .from("profiles")
    .select("id, role")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (!profile) {
    return {
      ok: false,
      response: new NextResponse("Forbidden", { status: 403 }),
    };
  }

  return {
    ok: true,
    agentId: (profile as any).id,
    isAdmin: (profile as any).role === "admin",
    supa: svc,
  };
}

/**
 * Guard for the cron trigger endpoint. No user session required; must present
 * a bearer token equal to CONTENT_INTEL_CRON_SECRET.
 */
export function requireCronSecret(req: NextRequest): NextResponse | null {
  const secret = getCronSecret();
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
