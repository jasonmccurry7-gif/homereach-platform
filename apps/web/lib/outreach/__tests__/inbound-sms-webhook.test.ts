import { describe, expect, it } from "vitest";
import { shouldRetryUnmatchedInboundSmsReply } from "../inbound-sms-webhook";

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
