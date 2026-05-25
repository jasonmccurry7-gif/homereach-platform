import { describe, expect, it } from "vitest";
import { resolveAgentScope } from "../agent-scope";
import type { User } from "@supabase/supabase-js";

function user(id: string, role: string): User {
  return {
    id,
    app_metadata: { user_role: role },
    aud: "authenticated",
    created_at: new Date(0).toISOString(),
    user_metadata: {},
  } as User;
}

describe("resolveAgentScope", () => {
  it("scopes sales agents to their own user id", () => {
    expect(resolveAgentScope(user("agent-1", "sales_agent"), null)).toMatchObject({
      ok: true,
      agentId: "agent-1",
      isSalesAgent: true,
    });
  });

  it("rejects sales agents requesting another agent id", () => {
    const result = resolveAgentScope(user("agent-1", "sales_agent"), "agent-2");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(403);
  });

  it("lets admins request any agent id or omit scoping", () => {
    expect(resolveAgentScope(user("admin-1", "admin"), "agent-2")).toMatchObject({
      ok: true,
      agentId: "agent-2",
      isAdmin: true,
    });
    expect(resolveAgentScope(user("admin-1", "admin"), null)).toMatchObject({
      ok: true,
      agentId: null,
      isAdmin: true,
    });
  });

  it("can require admins to provide an explicit agent id", () => {
    const result = resolveAgentScope(user("admin-1", "admin"), null, {
      requireAgentId: true,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(400);
  });
});
