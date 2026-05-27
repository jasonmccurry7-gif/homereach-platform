import twilio from "twilio";
import { describe, expect, it } from "vitest";
import {
  buildTwilioMessageStatusInsert,
  buildTwilioStatusCallbackUrl,
  parseTwilioStatusForm,
  shouldRetryTwilioStatusInsert,
} from "../twilio-status-webhook";

describe("Twilio status webhook helpers", () => {
  it("normalizes a provider-shaped delivered status callback", () => {
    const rawText = new URLSearchParams({
      MessageSid: "SMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      MessageStatus: "delivered",
      To: "+15555550123",
      From: "+15555550999",
      MessagingServiceSid: "MGaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      SmsSid: "SMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      AccountSid: "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      ApiVersion: "2010-04-01",
    }).toString();

    const params = parseTwilioStatusForm(rawText);
    expect(buildTwilioMessageStatusInsert(params)).toEqual({
      message_sid: "SMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      message_status: "delivered",
      error_code: null,
      error_message: null,
      to_number: "+15555550123",
      from_number: "+15555550999",
      messaging_service_sid: "MGaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      sms_sid: "SMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      account_sid: "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      api_version: "2010-04-01",
      raw_payload: params,
    });
  });

  it("normalizes failed callbacks with carrier error details", () => {
    const params = parseTwilioStatusForm(
      new URLSearchParams({
        SmsSid: "SMbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        SmsStatus: "undelivered",
        ErrorCode: "30007",
        ErrorMessage: "Carrier violation",
      }).toString(),
    );

    expect(buildTwilioMessageStatusInsert(params)).toMatchObject({
      message_sid: "SMbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      message_status: "undelivered",
      error_code: "30007",
      error_message: "Carrier violation",
    });
  });

  it("ignores non-status payloads without a message id and status", () => {
    expect(buildTwilioMessageStatusInsert({ MessageSid: "SM123" })).toBeNull();
    expect(buildTwilioMessageStatusInsert({ MessageStatus: "delivered" })).toBeNull();
  });

  it("builds the exact URL used for Twilio signature validation", () => {
    expect(
      buildTwilioStatusCallbackUrl(
        "http://localhost:3000/api/webhooks/twilio/status",
        "https://home-reach.com",
      ),
    ).toBe("https://home-reach.com/api/webhooks/twilio/status");
  });

  it("validates a signed sample callback without sending SMS", () => {
    const authToken = "dummy-auth-token";
    const url = "https://home-reach.com/api/webhooks/twilio/status";
    const params = {
      MessageSid: "SMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      MessageStatus: "delivered",
      To: "+15555550123",
      From: "+15555550999",
    };
    const signature = twilio.getExpectedTwilioSignature(authToken, url, params);

    expect(twilio.validateRequest(authToken, signature, url, params)).toBe(true);
  });

  it("marks insert failures as retryable provider callbacks", () => {
    expect(shouldRetryTwilioStatusInsert(null)).toBe(false);
    expect(shouldRetryTwilioStatusInsert(undefined)).toBe(false);
    expect(shouldRetryTwilioStatusInsert({ message: "database unavailable" })).toBe(true);
  });
});
