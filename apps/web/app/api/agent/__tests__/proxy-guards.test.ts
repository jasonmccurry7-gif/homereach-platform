import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as logActionPost } from "../log-action/route";
import { GET as preferencesGet } from "../preferences/route";

const mocks = vi.hoisted(() => ({
  requireAdminOrSalesAgent: vi.fn(),
}));

vi.mock("@/lib/auth/api-guards", () => ({
  requireAdminOrSalesAgent: mocks.requireAdminOrSalesAgent,
}));

function user(id: string, role = "sales_agent"): User {
  return {
    id,
    app_metadata: { user_role: role },
    aud: "authenticated",
    created_at: new Date(0).toISOString(),
    user_metadata: {},
  } as User;
}

describe("agent proxy route guards", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.requireAdminOrSalesAgent.mockReset();
  });

  it("rejects log-action requests before body parsing or proxying when role guard fails", async () => {
    mocks.requireAdminOrSalesAgent.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });
    const fetchMock = vi.spyOn(globalThis, "fetch");

    const response = await logActionPost(new Request("https://example.test/api/agent/log-action", {
      method: "POST",
      body: "not-json",
    }));

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("proxies log-action requests with the authenticated agent id", async () => {
    mocks.requireAdminOrSalesAgent.mockResolvedValue({ ok: true, user: user("agent-1") });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 201 })
    );

    const response = await logActionPost(new Request("https://example.test/api/agent/log-action", {
      method: "POST",
      headers: { Cookie: "sb-session=1" },
      body: JSON.stringify({
        agent_id: "agent-2",
        action_type: "call_logged",
        lead_id: "lead-1",
      }),
    }));

    expect(response.status).toBe(201);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://example.test/api/admin/sales/event");
    expect((init.headers as Record<string, string>).Cookie).toBe("sb-session=1");
    expect(JSON.parse(String(init.body))).toMatchObject({
      agent_id: "agent-1",
      action_type: "call_logged",
      lead_id: "lead-1",
    });
  });

  it("rejects preference proxy requests before proxying when role guard fails", async () => {
    mocks.requireAdminOrSalesAgent.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });
    const fetchMock = vi.spyOn(globalThis, "fetch");

    const response = await preferencesGet(
      new Request("https://example.test/api/agent/preferences")
    );

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("proxies preference requests for the authenticated agent only", async () => {
    mocks.requireAdminOrSalesAgent.mockResolvedValue({ ok: true, user: user("agent-1") });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ preferences: null }), { status: 200 })
    );

    const response = await preferencesGet(new Request("https://example.test/api/agent/preferences", {
      headers: { Cookie: "sb-session=1" },
    }));

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://example.test/api/admin/alerts/preferences?agent_id=agent-1");
    expect((init.headers as Record<string, string>).Cookie).toBe("sb-session=1");
  });
});
