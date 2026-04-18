// ─────────────────────────────────────────────────────────────────────────────
// HomeReach — Q&A Route Guards
//
// Centralized guard helpers used by every /api/admin/qa/* route handler.
// Keeps feature-flag gating and auth verification in one place.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isQaEnabled } from "./env";

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
 * Resolve the authenticated user + their agent_identities row.
 * Returns a 401 response if unauthenticated.
 */
export async function requireAgent(): Promise<
  | {
      ok: true;
      agentId: string;
      isAdmin: boolean;
      supa: Awaited<ReturnType<typeof createClient>>;
    }
  | { ok: false; response: NextResponse }
> {
  const supa = await createClient();

  // ADMIN_DEV_BYPASS is intentionally NOT honored by Q&A routes — we always
  // require a real Supabase session. This is slightly stricter than existing
  // admin routes and matches the V1a security note in the blueprint.
  const { data: userData, error } = await supa.auth.getUser();
  if (error || !userData?.user) {
    return {
      ok: false,
      response: new NextResponse("Unauthorized", { status: 401 }),
    };
  }

  const userId = userData.user.id;

  // Canonical HomeReach auth pattern: profiles(id, role) is the source of truth.
  // Matches the RLS policies in 20_sales_execution_system.sql and 21_crm_full_schema.sql:
  //   EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  const { data: profile } = await supa
    .from("profiles")
    .select("id, role")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) {
    return {
      ok: false,
      response: new NextResponse("Unknown agent", { status: 403 }),
    };
  }

  return {
    ok: true,
    agentId: (profile as any).id as string,
    isAdmin: ((profile as any).role as string) === "admin",
    supa,
  };
}

/** Shorthand for when a route requires admin. */
export async function requireAdmin(): Promise<
  | { ok: true; agentId: string; supa: Awaited<ReturnType<typeof createClient>> }
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
