import { describe, expect, it } from "vitest";
import {
  buildPostmarkEmailEventInsert,
  checkPostmarkWebhookAuth,
  classifyPostmarkEvent,
  getLeadEmailStatusWriteFilter,
  normalizePostmarkRecipient,
} from "../postmark-webhook";

describe("Postmark webhook helpers", () => {
  it("normalizes recipient addresses from Postmark payloads", () => {
    expect(normalizePostmarkRecipient({ Recipient: " Owner@Example.COM " })).toBe(
      "owner@example.com",
    );
    expect(normalizePostmarkRecipient({ Email: "Lead@Example.com" })).toBe(
      "lead@example.com",
    );
    expect(normalizePostmarkRecipient({})).toBeNull();
  });

  it("classifies delivery without allowing suppression states to be overwritten", () => {
    expect(classifyPostmarkEvent({ RecordType: "Delivery" })).toEqual({
      eventType: "delivered",
      bounceType: null,
      leadEmailStatus: "valid",
    });

    expect(getLeadEmailStatusWriteFilter("valid")).toBe(
      "email_status.is.null,email_status.eq.unknown,email_status.eq.bounced_temporary",
    );
  });

  it("classifies hard and temporary bounces separately", () => {
    expect(
      classifyPostmarkEvent({ RecordType: "Bounce", Type: "HardBounce" }),
    ).toEqual({
      eventType: "bounce",
      bounceType: "permanent",
      leadEmailStatus: "bounced_permanent",
    });

    expect(
      classifyPostmarkEvent({ RecordType: "Bounce", Type: "SoftBounce" }),
    ).toEqual({
      eventType: "bounce",
      bounceType: "transient",
      leadEmailStatus: "bounced_temporary",
    });

    expect(getLeadEmailStatusWriteFilter("bounced_temporary")).toBe(
      "email_status.is.null,email_status.eq.unknown,email_status.eq.valid,email_status.eq.bounced_temporary",
    );
  });

  it("classifies complaint and unsubscribe events as suppression states", () => {
    expect(classifyPostmarkEvent({ RecordType: "SpamComplaint" })).toEqual({
      eventType: "spam_complaint",
      bounceType: null,
      leadEmailStatus: "complained",
    });

    expect(
      classifyPostmarkEvent({
        RecordType: "SubscriptionChange",
        ChangeType: "Unsubscribed",
      }),
    ).toEqual({
      eventType: "subscription_change",
      bounceType: null,
      leadEmailStatus: "unsubscribed",
    });

    expect(getLeadEmailStatusWriteFilter("complained")).toBeNull();
    expect(getLeadEmailStatusWriteFilter("unsubscribed")).toBeNull();
  });

  it("validates Postmark Basic Auth without contacting Postmark", () => {
    const authorization = `Basic ${Buffer.from("postmark-user:postmark-pass").toString("base64")}`;

    expect(
      checkPostmarkWebhookAuth({
        authorization,
        expectedUser: "postmark-user",
        expectedPass: "postmark-pass",
        isProduction: true,
      }),
    ).toEqual({ ok: true });

    expect(
      checkPostmarkWebhookAuth({
        authorization: null,
        expectedUser: "postmark-user",
        expectedPass: "postmark-pass",
        isProduction: true,
      }),
    ).toEqual({ ok: false, reason: "missing Basic Auth header" });

    expect(
      checkPostmarkWebhookAuth({
        authorization,
        expectedUser: "postmark-user",
        expectedPass: "wrong-pass",
        isProduction: true,
      }),
    ).toEqual({ ok: false, reason: "Basic Auth mismatch" });
  });

  it("fails closed when Postmark auth is missing in production", () => {
    expect(
      checkPostmarkWebhookAuth({
        authorization: null,
        isProduction: true,
      }),
    ).toEqual({
      ok: false,
      reason: "POSTMARK_WEBHOOK_USER/PASSWORD not configured in production",
    });

    expect(
      checkPostmarkWebhookAuth({
        authorization: null,
        isProduction: false,
      }),
    ).toEqual({ ok: true });
  });

  it("maps a provider-shaped delivery payload into the email event row", () => {
    const payload = {
      RecordType: "Delivery",
      MessageID: "postmark-message-id",
      Recipient: "Owner@Example.com",
      Subject: "Welcome",
      Tag: "prospecting",
      ClientIP: "203.0.113.10",
      UserAgent: "Postmark sample",
      Geo: {
        Country: "US",
        Region: "NC",
        City: "Raleigh",
      },
    };

    expect(buildPostmarkEmailEventInsert(payload)).toEqual({
      provider: "postmark",
      event_type: "delivered",
      message_id: "postmark-message-id",
      recipient: "owner@example.com",
      subject: "Welcome",
      bounce_type: null,
      error_code: null,
      error_message: null,
      click_url: null,
      ip: "203.0.113.10",
      user_agent: "Postmark sample",
      geo_country: "US",
      geo_region: "NC",
      geo_city: "Raleigh",
      tags: ["prospecting"],
      raw_payload: payload,
    });
  });
});
