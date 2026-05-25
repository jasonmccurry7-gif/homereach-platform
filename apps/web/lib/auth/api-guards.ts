import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { extractRequestSecret } from "./request-secret";
import { userHasRole, type AppRole } from "./agent-scope";

export { extractBearerToken, extractRequestSecret } from "./request-secret";
export {
  isAdminUser,
  isSalesAgentUser,
  resolveAgentScope,
  userHasRole,
  type AgentScopeResult,
  type AppRole,
} from "./agent-scope";

type GuardSuccess = {
  ok: true;
  user?: User;
};

type GuardFailure = {
  ok: false;
  response: NextResponse;
};

export type ApiGuardResult = GuardSuccess | GuardFailure;
function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
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

export async function requireAdminSalesAgentOrCron(
  req: Request
): Promise<ApiGuardResult> {
  const cron = requireCron(req);
  if (cron.ok) return cron;

  return requireAdminOrSalesAgent();
}
