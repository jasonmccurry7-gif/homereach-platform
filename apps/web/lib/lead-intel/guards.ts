// ─────────────────────────────────────────────────────────────────────────────
// HomeReach — Lead Intelligence Route Guards
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient as createUserScopedClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getCronSecret, isLeadIntelEnabled } from "./env";

type ServiceSupa = ReturnType<typeof createServiceClient>;

export function liFlagGate(): NextResponse | null {
  if (!isLeadIntelEnabled()) return new NextResponse("Not Found", { status: 404 });
  return null;
}

export async function requireAgent(): Promise<
  | { ok: true; agentId: string; isAdmin: boolean; supa: ServiceSupa }
  | { ok: false; response: NextResponse }
> {
  const userScoped = await createUserScopedClient();
  const { data: userData, error } = await userScoped.auth.getUser();
  if (error || !userData?.user) {
    return { ok: false, response: new NextResponse("Unauthorized", { status: 401 }) };
  }
  const svc = createServiceClient();
  const { data: profile } = await svc
    .from("profiles").select("id, role").eq("id", userData.user.id).maybeSingle();
  if (!profile) return { ok: false, response: new NextResponse("Forbidden", { status: 403 }) };
  return {
    ok: true,
    agentId: (profile as any).id,
    isAdmin: (profile as any).role === "admin",
    supa: svc,
  };
}

export function requireCronSecret(req: NextRequest): NextResponse | null {
  const secret = getCronSecret();
  if (!secret) return new NextResponse("Cron not configured", { status: 503 });
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;
  if (token !== secret) return new NextResponse("Unauthorized", { status: 401 });
  return null;
}
