// ─────────────────────────────────────────────────────────────────────────────
// HomeReach SEO Engine - Route Guards
//
// Mirrors lib/content-intel/guards.ts exactly. Every /api/admin/seo-engine/*
// route must call seoFlagGate() first; admin-only routes then call
// requireAdmin().
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { createClient as createUserScopedClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isSeoEngineEnabled, isSeoDraftGenerationEnabled } from "./env";

type ServiceSupa = ReturnType<typeof createServiceClient>;

/** Return 404 when the SEO engine is disabled. */
export function seoFlagGate(): NextResponse | null {
  if (!isSeoEngineEnabled()) {
    return new NextResponse("Not Found", { status: 404 });
  }
  return null;
}

/** Double gate for the Claude draft generation endpoint. */
export function seoDraftFlagGate(): NextResponse | null {
  if (!isSeoEngineEnabled() || !isSeoDraftGenerationEnabled()) {
    return new NextResponse("Not Found", { status: 404 });
  }
  return null;
}

/** Guard for admin-only endpoints. */
export async function requireAdmin(): Promise<
  | { ok: true; adminId: string; supa: ServiceSupa }
  | { ok: false; response: NextResponse }
> {
  const userScoped = await createUserScopedClient();
  const { data: userData, error } = await userScoped.auth.getUser();
  if (error || !userData?.user) {
    return { ok: false, response: new NextResponse("Unauthorized", { status: 401 }) };
  }

  const svc = createServiceClient();
  const { data: profile } = await svc
    .from("profiles")
    .select("id, role")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (!profile) {
    return { ok: false, response: new NextResponse("Forbidden", { status: 403 }) };
  }
  if ((profile as { role: string }).role !== "admin") {
    return { ok: false, response: new NextResponse("Admin only", { status: 403 }) };
  }

  return { ok: true, adminId: (profile as { id: string }).id, supa: svc };
}
