import { describe, expect, it } from "vitest";
import {
  assertLeadCanReceiveSalesSend,
  resolveSalesOutboundChannel,
  resolveStoredLeadDestination,
} from "../outbound-send-guards";

describe("sales outbound send guards", () => {
  it("derives send channel from action type and rejects mismatches", () => {
    expect(resolveSalesOutboundChannel("text_sent", "sms")).toEqual({ ok: true, value: "sms" });
    expect(resolveSalesOutboundChannel("email_sent", "email")).toEqual({ ok: true, value: "email" });
    expect(resolveSalesOutboundChannel("facebook_sent", "facebook")).toEqual({ ok: true, value: "facebook" });
    expect(resolveSalesOutboundChannel("follow_up_sent", "sms")).toEqual({ ok: true, value: "sms" });

    expect(resolveSalesOutboundChannel("text_sent", "phone")).toMatchObject({
      ok: false,
      status: 400,
    });
    expect(resolveSalesOutboundChannel("email_sent", "sms")).toMatchObject({
      ok: false,
      status: 400,
    });
  });

  it("keeps customer sends pinned to the stored lead contact", () => {
    expect(resolveStoredLeadDestination({
      channel: "sms",
      leadPhone: "+15555550100",
      leadEmail: "owner@example.test",
    })).toEqual({ ok: true, value: "+15555550100" });

    expect(resolveStoredLeadDestination({
      channel: "email",
      leadPhone: "+15555550100",
      leadEmail: "owner@example.test",
      requestedToAddress: "other@example.test",
    })).toMatchObject({
      ok: false,
      status: 400,
    });
  });

  it("checks suppression using the canonical provider channel", () => {
    expect(assertLeadCanReceiveSalesSend({
      channel: "sms",
      smsOptOut: true,
    })).toMatchObject({ ok: false, status: 403 });

    expect(assertLeadCanReceiveSalesSend({
      channel: "email",
      emailStatus: "complained",
    })).toMatchObject({ ok: false, status: 403 });

    expect(assertLeadCanReceiveSalesSend({
      channel: "email",
      smsOptOut: true,
      emailStatus: "deliverable",
    })).toEqual({ ok: true, value: true });
  });
});
