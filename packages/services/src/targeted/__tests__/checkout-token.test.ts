import { describe, expect, it } from "vitest";
import {
  createTargetedCheckoutToken,
  normalizeTargetedCheckoutEmail,
  verifyTargetedCheckoutToken,
} from "../checkout-token";

const secret = "test-targeted-checkout-secret";
const campaignId = "00000000-0000-4000-8000-000000000001";
const email = "Owner@Example.com";
const now = new Date("2026-05-25T12:00:00.000Z");

describe("targeted checkout token", () => {
  it("normalizes campaign email addresses", () => {
    expect(normalizeTargetedCheckoutEmail("  Owner@Example.COM ")).toBe(
      "owner@example.com"
    );
  });

  it("returns null when no signing secret is configured", () => {
    expect(
      createTargetedCheckoutToken({
        campaignId,
        email,
        secret: null,
        now,
      })
    ).toBeNull();
  });

  it("creates and verifies a valid token", () => {
    const token = createTargetedCheckoutToken({
      campaignId,
      email,
      secret,
      now,
    });

    const result = verifyTargetedCheckoutToken(
      token,
      { campaignId, email: "owner@example.com" },
      { secret, now }
    );

    expect(result).toMatchObject({ ok: true });
    if (result.ok) {
      expect(result.payload.campaignId).toBe(campaignId);
      expect(result.payload.email).toBe("owner@example.com");
    }
  });

  it("rejects tampered signatures", () => {
    const token = createTargetedCheckoutToken({
      campaignId,
      email,
      secret,
      now,
    });

    expect(
      verifyTargetedCheckoutToken(
        `${token}.tampered`,
        { campaignId, email },
        { secret, now }
      )
    ).toEqual({ ok: false, reason: "malformed_token" });

    const parts = token?.split(".");
    expect(parts).toHaveLength(2);
    const tamperedToken = `${parts?.[0]}.bad${parts?.[1]}`;

    expect(
      verifyTargetedCheckoutToken(tamperedToken, { campaignId, email }, { secret, now })
    ).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("rejects a token for a different campaign", () => {
    const token = createTargetedCheckoutToken({
      campaignId,
      email,
      secret,
      now,
    });

    expect(
      verifyTargetedCheckoutToken(
        token,
        {
          campaignId: "00000000-0000-4000-8000-000000000002",
          email,
        },
        { secret, now }
      )
    ).toEqual({ ok: false, reason: "wrong_campaign" });
  });

  it("rejects a token for a different customer email", () => {
    const token = createTargetedCheckoutToken({
      campaignId,
      email,
      secret,
      now,
    });

    expect(
      verifyTargetedCheckoutToken(
        token,
        { campaignId, email: "other@example.com" },
        { secret, now }
      )
    ).toEqual({ ok: false, reason: "wrong_email" });
  });

  it("rejects expired tokens", () => {
    const token = createTargetedCheckoutToken({
      campaignId,
      email,
      secret,
      now,
      expiresAt: new Date("2026-05-25T12:05:00.000Z"),
    });

    expect(
      verifyTargetedCheckoutToken(
        token,
        { campaignId, email },
        { secret, now: new Date("2026-05-25T12:05:01.000Z") }
      )
    ).toEqual({ ok: false, reason: "expired" });
  });
});
