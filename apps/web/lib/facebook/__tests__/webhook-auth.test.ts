import { describe, expect, it } from "vitest";
import {
  buildFacebookWebhookSignature,
  resolveFacebookWebhookVerifyToken,
  validateFacebookWebhookSignature,
} from "../webhook-auth";

describe("facebook webhook auth helpers", () => {
  it("accepts a valid sha256 signature", () => {
    const rawBody = JSON.stringify({ object: "page", entry: [] });
    const signature = buildFacebookWebhookSignature(rawBody, "app-secret");

    expect(
      validateFacebookWebhookSignature({
        rawBody,
        signature,
        appSecret: "app-secret",
        nodeEnv: "production",
      })
    ).toEqual({ ok: true, skipped: false });
  });

  it("rejects an invalid signature when the app secret is configured", () => {
    const result = validateFacebookWebhookSignature({
      rawBody: "{}",
      signature: "sha256=0000000000000000000000000000000000000000000000000000000000000000",
      appSecret: "app-secret",
      nodeEnv: "production",
    });

    expect(result).toEqual({
      ok: false,
      status: 401,
      error: "Invalid signature",
    });
  });

  it("rejects missing app secret in production", () => {
    const result = validateFacebookWebhookSignature({
      rawBody: "{}",
      signature: null,
      nodeEnv: "production",
    });

    expect(result).toEqual({
      ok: false,
      status: 503,
      error: "Facebook app secret not configured",
    });
  });

  it("allows unsigned local development payloads when no app secret is configured", () => {
    const result = validateFacebookWebhookSignature({
      rawBody: "{}",
      signature: null,
      nodeEnv: "development",
    });

    expect(result).toEqual({ ok: true, skipped: true });
  });

  it("prefers the new verify token name and supports the legacy alias", () => {
    expect(
      resolveFacebookWebhookVerifyToken({
        primary: "new-token",
        legacy: "old-token",
        nodeEnv: "production",
      })
    ).toBe("new-token");

    expect(
      resolveFacebookWebhookVerifyToken({
        legacy: "old-token",
        nodeEnv: "production",
      })
    ).toBe("old-token");
  });

  it("fails closed without a configured verify token in production", () => {
    expect(resolveFacebookWebhookVerifyToken({ nodeEnv: "production" })).toBeNull();
  });
});
