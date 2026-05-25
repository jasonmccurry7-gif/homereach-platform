import { describe, expect, it } from "vitest";
import {
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
});
