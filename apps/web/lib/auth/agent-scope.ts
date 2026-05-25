import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";

export type AppRole = "admin" | "sales_agent" | "client";

type ScopeFailure = {
  ok: false;
  response: NextResponse;
};

export type AgentScopeResult =
  | {
      ok: true;
      agentId: string | null;
      isAdmin: boolean;
      isSalesAgent: boolean;
    }
  | ScopeFailure;

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export function isAdminUser(user: User | null | undefined): user is User {
  return user?.app_metadata?.user_role === "admin";
}

export function isSalesAgentUser(user: User | null | undefined): user is User {
  return user?.app_metadata?.user_role === "sales_agent";
}

export function userHasRole(
  user: User | null | undefined,
  roles: readonly AppRole[],
): user is User {
  return Boolean(user && roles.includes(user.app_metadata?.user_role as AppRole));
}

export function resolveAgentScope(
  user: User | null | undefined,
  requestedAgentId?: string | null,
  options: { requireAgentId?: boolean } = {},
): AgentScopeResult {
  if (!user) {
    return { ok: false, response: jsonError("Unauthorized", 401) };
  }

  if (isSalesAgentUser(user)) {
    if (requestedAgentId && requestedAgentId !== user.id) {
      return { ok: false, response: jsonError("Forbidden", 403) };
    }

    return {
      ok: true,
      agentId: user.id,
      isAdmin: false,
      isSalesAgent: true,
    };
  }

  if (isAdminUser(user)) {
    if (options.requireAgentId && !requestedAgentId) {
      return { ok: false, response: jsonError("agent_id required", 400) };
    }

    return {
      ok: true,
      agentId: requestedAgentId ?? null,
      isAdmin: true,
      isSalesAgent: false,
    };
  }

  return { ok: false, response: jsonError("Forbidden", 403) };
}
