import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../close-deal/route";

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
  requireAdminOrSalesAgent: vi.fn(),
  resolveAgentScope: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: mocks.createServiceClient,
}));

vi.mock("@/lib/auth/api-guards", () => ({
  requireAdminOrSalesAgent: mocks.requireAdminOrSalesAgent,
  resolveAgentScope: mocks.resolveAgentScope,
}));

vi.mock("@/lib/runtime/app-url", () => ({
  getPublicAppBaseUrl: () => "https://home-reach.test",
}));

vi.mock("@homereach/services/outreach", () => ({
  sendEmail: mocks.sendEmail,
}));

function closeDealDbMock() {
  const inserts: Record<string, unknown[]> = {};
  const updates: Record<string, unknown[]> = {};

  return {
    inserts,
    updates,
    from: vi.fn((table: string) => {
      if (table === "sales_leads") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: {
                  id: "lead-1",
                  phone: "+15555550100",
                  email: "owner@example.test",
                  city: "Akron",
                  category: "Roofing",
                  business_name: "Example Roofing",
                  contact_name: "Sam Owner",
                  assigned_agent_id: "agent-1",
                },
                error: null,
              }),
            }),
          }),
          update: (payload: unknown) => ({
            eq: async () => {
              updates[table] = [...(updates[table] ?? []), payload];
              return { data: null, error: null };
            },
          }),
        };
      }

      if (table === "agent_identities") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: async () => ({
                  data: {
                    from_email: "agent@home-reach.test",
                    from_name: "Agent One",
                    twilio_phone: "+15555550101",
                  },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }

      if (table === "sales_events") {
        return {
          insert: async (payload: unknown) => {
            inserts[table] = [...(inserts[table] ?? []), payload];
            return { data: null, error: null };
          },
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

describe("admin sales close-deal", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.requireAdminOrSalesAgent.mockResolvedValue({
      ok: true,
      user: { id: "admin-1", app_metadata: { user_role: "admin" } },
    });
    mocks.resolveAgentScope.mockReturnValue({
      ok: true,
      agentId: "agent-1",
      isSalesAgent: false,
    });
    mocks.sendEmail.mockResolvedValue({ success: true, externalId: "email-1", provider: "postmark" });
  });

  it("routes email close-deal sends through the central email provider", async () => {
    const db = closeDealDbMock();
    mocks.createServiceClient.mockReturnValue(db);
    const fetchMock = vi.spyOn(globalThis, "fetch");

    const response = await POST(new Request("https://home-reach.test/api/admin/sales/close-deal", {
      method: "POST",
      body: JSON.stringify({
        agent_id: "agent-1",
        lead_id: "lead-1",
        channel: "email",
      }),
    }));

    expect(response.status).toBe(200);
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
    expect(mocks.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: "owner@example.test",
      fromEmail: "agent@home-reach.test",
      fromName: "Agent One",
      replyTo: "",
    }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(db.inserts.sales_events).toHaveLength(1);
    expect(db.updates.sales_leads).toHaveLength(1);
  });
});
