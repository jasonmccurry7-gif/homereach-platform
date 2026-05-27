import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../event/route";

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
  requireAdminOrSalesAgent: vi.fn(),
  sendEmail: vi.fn(),
  sendSms: vi.fn(),
}));

vi.mock("@/lib/auth/api-guards", () => ({
  requireAdminOrSalesAgent: mocks.requireAdminOrSalesAgent,
}));

vi.mock("@/lib/outreach/twilio-status-callback", () => ({
  getTwilioStatusCallbackUrl: () => "https://home-reach.test/api/webhooks/twilio/status",
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: mocks.createServiceClient,
}));

vi.mock("@homereach/services/outreach", () => ({
  appendEmailComplianceHtml: (html: string) => html,
  appendEmailComplianceText: (text: string) => text,
  appendSmsCompliance: (text: string) => `${text} Reply STOP to opt out.`,
  getDefaultEmailIdentity: () => ({
    fromEmail: "agent@home-reach.test",
    fromName: "Agent One",
    replyTo: "reply@home-reach.test",
  }),
  renderOwnerTemplate: (template: string) => template,
  sendEmail: mocks.sendEmail,
  sendSms: mocks.sendSms,
}));

type LeadFixture = {
  phone?: string | null;
  email?: string | null;
  email_status?: string | null;
  do_not_contact?: boolean | null;
  sms_opt_out?: boolean | null;
  is_quarantined?: boolean | null;
  business_name?: string | null;
  assigned_agent_id?: string | null;
};

function salesEventDbMock(lead: LeadFixture) {
  const reads: string[] = [];
  const writes: string[] = [];

  return {
    reads,
    writes,
    rpc: vi.fn(async () => ({ data: { allowed: true }, error: null })),
    from: vi.fn((table: string) => {
      if (table === "system_controls") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  outreach_test_mode: false,
                  sms_prospecting_live_enabled: true,
                },
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === "sales_leads") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => {
                reads.push(table);
                return {
                  data: {
                    phone: "+15555550100",
                    email: "owner@example.test",
                    email_status: "deliverable",
                    do_not_contact: false,
                    sms_opt_out: false,
                    is_quarantined: false,
                    business_name: "Example Roofing",
                    assigned_agent_id: null,
                    ...lead,
                  },
                  error: null,
                };
              },
            }),
          }),
        };
      }

      if (table === "sales_events" || table === "agent_message_hashes") {
        return {
          insert: async () => {
            writes.push(table);
            return { data: null, error: null };
          },
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

function salesEventRequest(body: Record<string, unknown>) {
  return new Request("https://home-reach.test/api/admin/sales/event", {
    method: "POST",
    body: JSON.stringify({
      action_type: "text_sent",
      channel: "sms",
      lead_id: "lead-1",
      message: "Hello",
      ...body,
    }),
  });
}

describe("admin sales event send guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminOrSalesAgent.mockResolvedValue({
      ok: true,
      user: { id: "admin-1", app_metadata: { user_role: "admin" } },
    });
    mocks.sendEmail.mockResolvedValue({ success: true, externalId: "email-1", provider: "postmark" });
    mocks.sendSms.mockResolvedValue({ success: true, externalId: "sms-1", provider: "twilio" });
  });

  it("rejects send action and channel mismatches before provider calls", async () => {
    const db = salesEventDbMock({});
    mocks.createServiceClient.mockReturnValue(db);

    const response = await POST(salesEventRequest({
      action_type: "text_sent",
      channel: "phone",
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Action text_sent cannot send on channel phone.",
    });
    expect(db.reads).toEqual([]);
    expect(db.writes).toEqual([]);
    expect(mocks.sendSms).not.toHaveBeenCalled();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("rejects caller-supplied destinations that do not match the lead", async () => {
    const db = salesEventDbMock({});
    mocks.createServiceClient.mockReturnValue(db);

    const response = await POST(salesEventRequest({
      to_address: "+15555559999",
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Outbound destination must match the lead's stored contact.",
    });
    expect(mocks.sendSms).not.toHaveBeenCalled();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("uses canonical sms channel for opt-out checks", async () => {
    const db = salesEventDbMock({ sms_opt_out: true });
    mocks.createServiceClient.mockReturnValue(db);

    const response = await POST(salesEventRequest({
      action_type: "text_sent",
      channel: "sms",
    }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Lead has opted out of SMS.",
    });
    expect(mocks.sendSms).not.toHaveBeenCalled();
  });

  it("uses canonical email channel for suppression checks", async () => {
    const db = salesEventDbMock({ email_status: "complained" });
    mocks.createServiceClient.mockReturnValue(db);

    const response = await POST(salesEventRequest({
      action_type: "email_sent",
      channel: "email",
    }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Lead email is suppressed.",
    });
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });
});
