import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

type GuardSuccess = {
  ok: true;
  user?: User;
};

type GuardFailure = {
  ok: false;
  response: NextResponse;
};

export type ApiGuardResult = GuardSuccess | GuardFailure;
export type AppRole = "admin" | "sales_agent" | "client";

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return null;
  return authHeader.slice("bearer ".length).trim() || null;
}

export function extractRequestSecret(req: Request): string | null {
  return req.headers.get("x-cron-secret")?.trim() || extractBearerToken(req);
}

export function isAdminUser(user: User | null | undefined): user is User {
  return user?.app_metadata?.user_role === "admin";
}

export function userHasRole(
  user: User | null | undefined,
  roles: readonly AppRole[]
): user is User {
  return Boolean(user && roles.includes(user.app_metadata?.user_role as AppRole));
}

export async function requireRole(roles: readonly AppRole[]): Promise<ApiGuardResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, response: jsonError("Unauthorized", 401) };
  }

  if (!userHasRole(user, roles)) {
    return { ok: false, response: jsonError("Forbidden", 403) };
  }

  return { ok: true, user };
}

export async function requireAdmin(): Promise<ApiGuardResult> {
  return requireRole(["admin"]);
}

export async function requireAdminOrSalesAgent(): Promise<ApiGuardResult> {
  return requireRole(["admin", "sales_agent"]);
}

export function requireCron(req: Request, envName = "CRON_SECRET"): ApiGuardResult {
  const expected = process.env[envName];
  if (!expected) {
    return {
      ok: false,
      response: jsonError(`${envName} is not configured`, 503),
    };
  }

  const provided = extractRequestSecret(req);
  if (provided !== expected) {
    return { ok: false, response: jsonError("Unauthorized", 401) };
  }

  return { ok: true };
}

export async function requireAdminOrCron(req: Request): Promise<ApiGuardResult> {
  const cron = requireCron(req);
  if (cron.ok) return cron;

  return requireAdmin();
}
