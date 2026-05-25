import { afterEach, describe, expect, it } from "vitest";
import { getTwilioStatusCallbackUrl } from "../twilio-status-callback";

const ORIGINAL_ENV = { ...process.env };

describe("getTwilioStatusCallbackUrl", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("builds the Twilio status callback from the public app URL", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com/";

    expect(getTwilioStatusCallbackUrl()).toBe(
      "https://app.example.com/api/webhooks/twilio/status"
    );
  });
});
