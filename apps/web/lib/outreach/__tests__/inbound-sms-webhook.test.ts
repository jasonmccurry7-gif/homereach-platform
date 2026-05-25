import { describe, expect, it } from "vitest";
import {
  buildInboundSmsWebhookUrl,
  buildTwilioInboundSignature,
  shouldRetryUnmatchedInboundSmsReply,
  validateTwilioInboundSignature,
} from "../inbound-sms-webhook";

describe("inbound SMS Twilio signature validation", () => {
  const authToken = "twilio-test-auth-token";
  const requestUrl = "https://preview.example.com/api/webhooks/outreach/sms";
  const appUrl = "https://home-reach.com";

  function sampleParams() {
    return new URLSearchParams({
      Body: "hello",
      From: "+15555550123",
      MessageSid: "SMtest",
      To: "+15555550100",
    });
  }

  it("builds the canonical webhook URL from the configured app URL", () => {
    expect(buildInboundSmsWebhookUrl(requestUrl, appUrl)).toBe(
      "https://home-reach.com/api/webhooks/outreach/sms",
    );
  });

  it("can build a canonical URL for another Twilio SMS endpoint", () => {
    expect(
      buildInboundSmsWebhookUrl(
        "https://preview.example.com/api/command",
        appUrl,
        "/api/command",
      ),
    ).toBe("https://home-reach.com/api/command");
  });

  it("accepts a valid Twilio signature", () => {
    const params = sampleParams();
    const signature = buildTwilioInboundSignature(
      authToken,
      buildInboundSmsWebhookUrl(requestUrl, appUrl),
      params,
    );

    expect(
      validateTwilioInboundSignature({
        authToken,
        nodeEnv: "production",
        signature,
        requestUrl,
        appUrl,
        params,
      }),
    ).toBe(true);
  });

  it("accepts a valid signature for a custom canonical path", () => {
    const params = sampleParams();
    const signature = buildTwilioInboundSignature(
      authToken,
      "https://home-reach.com/api/command",
      params,
    );

    expect(
      validateTwilioInboundSignature({
        authToken,
        nodeEnv: "production",
        signature,
        requestUrl: "https://preview.example.com/api/command",
        appUrl,
        params,
        canonicalPath: "/api/command",
      }),
    ).toBe(true);
  });

  it("rejects an invalid Twilio signature", () => {
    expect(
      validateTwilioInboundSignature({
        authToken,
        nodeEnv: "production",
        signature: "invalid",
        requestUrl,
        appUrl,
        params: sampleParams(),
      }),
    ).toBe(false);
  });

  it("fails closed without an auth token in production", () => {
    expect(
      validateTwilioInboundSignature({
        nodeEnv: "production",
        signature: null,
        requestUrl,
        appUrl,
        params: sampleParams(),
      }),
    ).toBe(false);
  });

  it("allows missing auth token outside production for local testing", () => {
    expect(
      validateTwilioInboundSignature({
        nodeEnv: "development",
        signature: null,
        requestUrl,
        appUrl,
        params: sampleParams(),
      }),
    ).toBe(true);
  });
});

describe("inbound SMS webhook retry decisions", () => {
  it("retries unmatched replies when the revenue bridge throws", () => {
    expect(
      shouldRetryUnmatchedInboundSmsReply({
        bridgeFailed: true,
        bridgeResult: null,
      }),
    ).toBe(true);
  });

  it("retries unmatched replies when the bridge processed but missed the event ledger", () => {
    expect(
      shouldRetryUnmatchedInboundSmsReply({
        bridgeFailed: false,
        bridgeResult: { processed: true, eventId: null },
      }),
    ).toBe(true);
  });

  it("acknowledges unmatched replies when the bridge captured the event", () => {
    expect(
      shouldRetryUnmatchedInboundSmsReply({
        bridgeFailed: false,
        bridgeResult: { processed: true, eventId: "event-id" },
      }),
    ).toBe(false);
  });

  it("acknowledges unmatched replies when the bridge is deliberately disabled", () => {
    expect(
      shouldRetryUnmatchedInboundSmsReply({
        bridgeFailed: false,
        bridgeResult: { processed: false, reason: "feature_flag_off" },
      }),
    ).toBe(false);
  });
});
