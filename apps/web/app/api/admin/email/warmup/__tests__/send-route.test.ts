import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../send/route";

const mocks = vi.hoisted(() => ({
  requireAdminOrCron: vi.fn(),
  createServiceClient: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock("@/lib/auth/api-guards", () => ({
  requireAdminOrCron: mocks.requireAdminOrCron,
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: mocks.createServiceClient,
}));

vi.mock("@/lib/runtime/app-url", () => ({
  getPublicAppBaseUrl: () => "https://home-reach.test",
}));

vi.mock("@/lib/sales-engine/email-warmup-config", () => ({
  WARMUP_SEED_EMAILS: ["seed-one@home-reach.test", "seed-two@home-reach.test"],
  getRampEntry: () => ({ dailyTarget: 4, seedRatio: 1 }),
  getSeedTemplate: (_day: number, index: number) => ({
    subject: `Seed ${index + 1}`,
    body: `Warmup body ${index + 1}`,
  }),
}));

vi.mock("@homereach/services/outreach", () => ({
  sendEmail: mocks.sendEmail,
}));

function warmupDbMock() {
  const inserts: Record<string, unknown[]> = {};
  const updates: Record<string, unknown[]> = {};

  return {
    inserts,
    updates,
    from: vi.fn((table: string) => {
      if (table === "agent_identities") {
        return {
          select: () => ({
            eq: async () => ({
              data: [{
                agent_id: "agent-1",
                from_email: "agent@home-reach.test",
                from_name: "Agent One",
                is_active: true,
              }],
            }),
          }),
        };
      }

      if (table === "email_warmup_state") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: "state-1",
                    agent_id: "agent-1",
                    from_email: "agent@home-reach.test",
                    warmup_day: 1,
                    is_active: true,
                    total_sent: 0,
                  },
                }),
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

      if (table === "email_warmup_log") {
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

describe("email warmup sender identity", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.requireAdminOrCron.mockResolvedValue({ ok: true });
    mocks.sendEmail.mockResolvedValue({ success: true, externalId: "message-1" });
    process.env.DEFAULT_FROM_EMAIL = "default@home-reach.test";
    process.env.MAILGUN_FROM_EMAIL = "mailgun-before@home-reach.test";
    process.env.MAILGUN_FROM_NAME = "Mailgun Before";
  });

  it("passes the agent identity directly without mutating provider environment variables", async () => {
    const db = warmupDbMock();
    mocks.createServiceClient.mockReturnValue(db);

    const response = await POST(new Request("https://home-reach.test/api/admin/email/warmup/send", {
      method: "POST",
    }) as never);

    expect(response.status).toBe(200);
    expect(mocks.sendEmail).toHaveBeenCalledTimes(4);
    for (const call of mocks.sendEmail.mock.calls) {
      expect(call[0]).toMatchObject({
        fromEmail: "agent@home-reach.test",
        fromName: "Agent One",
      });
    }
    expect(process.env.MAILGUN_FROM_EMAIL).toBe("mailgun-before@home-reach.test");
    expect(process.env.MAILGUN_FROM_NAME).toBe("Mailgun Before");
    expect(db.inserts.email_warmup_log).toHaveLength(4);
    expect(db.updates.email_warmup_state).toEqual([
      expect.objectContaining({ warmup_day: 2, total_sent: 4 }),
    ]);
  });
});
