import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendSms } from "../index";

const mocks = vi.hoisted(() => {
  const createMessage = vi.fn();
  const twilioClient = { messages: { create: createMessage } };

  return {
    createMessage,
    twilio: vi.fn(() => twilioClient),
  };
});

vi.mock("twilio", () => ({
  default: mocks.twilio,
}));

const ENV_KEYS = [
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_PHONE_NUMBER",
  "OUTREACH_SMS_FROM_NUMBER",
  "OUTREACH_TWILIO_MESSAGING_SERVICE_SID",
  "TWILIO_MESSAGING_SERVICE_SID",
  "OUTREACH_TEST_MODE",
  "OUTREACH_MANUAL_APPROVAL_MODE",
  "OUTREACH_SMS_PROSPECTING_LIVE_ENABLED",
] as const;

function resetSmsEnv() {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
  process.env.TWILIO_ACCOUNT_SID = "AC00000000000000000000000000000000";
  process.env.TWILIO_AUTH_TOKEN = "test-auth-token";
}

describe("sendSms", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSmsEnv();
    mocks.createMessage.mockResolvedValue({ sid: "SM123" });
  });

  it("returns a synthetic success in outreach test mode without creating a Twilio client", async () => {
    process.env.OUTREACH_TEST_MODE = "true";
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;

    const result = await sendSms({
      to: "+15555550100",
      body: "Test body",
    });

    expect(result.success).toBe(true);
    expect(result.testMode).toBe(true);
    expect(result.provider).toBe("twilio");
    expect(mocks.twilio).not.toHaveBeenCalled();
    expect(mocks.createMessage).not.toHaveBeenCalled();
  });

  it("prefers an explicit from number over an environment messaging service", async () => {
    process.env.OUTREACH_TWILIO_MESSAGING_SERVICE_SID = "MG_ENV";

    const result = await sendSms({
      to: "+15555550100",
      body: "Close follow-up",
      fromNumber: "+15555550101",
    });

    expect(result).toEqual({ success: true, externalId: "SM123", provider: "twilio" });
    expect(mocks.createMessage).toHaveBeenCalledWith(expect.objectContaining({
      to: "+15555550100",
      body: "Close follow-up",
      from: "+15555550101",
    }));
    expect(mocks.createMessage.mock.calls[0]?.[0]).not.toHaveProperty("messagingServiceSid");
  });

  it("uses an explicit messaging service when the caller supplies one", async () => {
    const result = await sendSms({
      to: "+15555550100",
      body: "Campaign follow-up",
      fromNumber: "+15555550101",
      messagingServiceSid: "MG_EXPLICIT",
    });

    expect(result.success).toBe(true);
    expect(mocks.createMessage).toHaveBeenCalledWith(expect.objectContaining({
      messagingServiceSid: "MG_EXPLICIT",
    }));
    expect(mocks.createMessage.mock.calls[0]?.[0]).not.toHaveProperty("from");
  });

  it("uses the environment messaging service when no explicit sender number exists", async () => {
    process.env.TWILIO_PHONE_NUMBER = "+15555550102";
    process.env.TWILIO_MESSAGING_SERVICE_SID = "MG_ENV";

    const result = await sendSms({
      to: "+15555550100",
      body: "System alert",
    });

    expect(result.success).toBe(true);
    expect(mocks.createMessage).toHaveBeenCalledWith(expect.objectContaining({
      messagingServiceSid: "MG_ENV",
    }));
    expect(mocks.createMessage.mock.calls[0]?.[0]).not.toHaveProperty("from");
  });

  it("blocks prospecting SMS in manual approval mode before creating a Twilio client", async () => {
    process.env.OUTREACH_MANUAL_APPROVAL_MODE = "true";
    process.env.TWILIO_PHONE_NUMBER = "+15555550102";

    const result = await sendSms({
      to: "+15555550100",
      body: "Prospecting message",
      intent: "prospecting",
    });

    expect(result.success).toBe(false);
    expect(result.provider).toBe("twilio");
    expect(result.error).toContain("Manual approval mode");
    expect(mocks.twilio).not.toHaveBeenCalled();
    expect(mocks.createMessage).not.toHaveBeenCalled();
  });
});
