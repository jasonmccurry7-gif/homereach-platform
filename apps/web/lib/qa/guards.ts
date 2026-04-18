// ─────────────────────────────────────────────────────────────────────────────
// HomeReach — Q&A Route Guards
//
// Centralized guard helpers used by every /api/admin/qa/* route handler.
//
// Auth model:
//   1. The user-scoped Supabase client (from @/lib/supabase/server) is used
//      ONLY to call supa.auth.getUser() — proves the request has a valid
//      session cookie.
//   2. All subsequent reads and writes (including the profile role lookup)
//      use the SERVICE-ROLE client, which bypasses RLS. This matches the
//      pattern used by the existing Echo / Sentinel / Stripe webhook routes.
//   3. RLS policies in migration 050 are retained as defense-in-depth for
//      any direct DB access that does use user JWT (e.g. future client-side
//      Supabase queries); server routes sidestep them.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { createClient as createUserScopedClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isQaEnabled } from "./env";

type ServiceSupa = ReturnType<typeof createServiceClient>;

/**
 * Return 404 when the Q&A system is disabled. Call at the top of every
 * Q&A route handler. Returns null if enabled (continue).
 */
export function qaFlagGate(): NextResponse | null {
  if (!isQaEnabled()) {
    return new NextResponse("Not Found", { status: 404 });
  }
  return null;
}

/**
 * Resolve the authenticated user + their role from profiles.
 * Returns a service-role Supabase client for route handlers to use.
 */
export async function requireAgent(): Promise<
  | {
      ok: true;
      agentId: string;
      isAdmin: boolean;
      supa: ServiceSupa;
    }
  | { ok: false; response: NextResponse }
> {
  // 1) Prove the request has a valid Supabase session (user-scoped client
  //    reads the session cookie; this does not touch any RLS-gated tables).
  const userScoped = await createUserScopedClient();
  const { data: userData, error } = await userScoped.auth.getUser();
  if (error || !userData?.user) {
    return {
      ok: false,
      response: new NextResponse("Unauthorized", { status: 401 }),
    };
  }

  const userId = userData.user.id;

  // 2) Look up the profile with the service-role client (bypasses RLS).
  const svc = createServiceClient();
  const { data: profile } = await svc
    .from("profiles")
    .select("id, role")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) {
    return {
      ok: false,
      response: new NextResponse(
        "No profile row for auth user — contact admin",
        { status: 403 },
      ),
    };
  }

  return {
    ok: true,
    agentId: (profile as any).id as string,
    isAdmin: ((profile as any).role as string) === "admin",
    supa: svc,
  };
}

/** Shorthand for when a route requires admin. */
export async function requireAdmin(): Promise<
  | { ok: true; agentId: string; supa: ServiceSupa }
  | { ok: false; response: NextResponse }
> {
  const guard = await requireAgent();
  if (!guard.ok) return guard;
  if (!guard.isAdmin) {
    return {
      ok: false,
      response: new NextResponse("Admin only", { status: 403 }),
    };
  }
  return { ok: true, agentId: guard.agentId, supa: guard.supa };
}
