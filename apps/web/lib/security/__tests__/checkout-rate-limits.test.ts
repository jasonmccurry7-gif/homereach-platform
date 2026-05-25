import { afterEach, describe, expect, it } from "vitest";
import {
  checkPublicRateLimit,
  clearPublicRateLimitForTests,
  publicRateLimitHeaders,
} from "../public-rate-limit";

const checkoutRateLimit = {
  scope: "checkout:targeted",
  limit: 12,
  windowMs: 10 * 60_000,
};

function checkoutRequest(scopePath: string, ip = "203.0.113.90") {
  return new Request(`https://example.test${scopePath}`, {
    method: "POST",
    headers: {
      "x-forwarded-for": ip,
    },
  });
}

describe("checkout route rate limits", () => {
  afterEach(() => {
    clearPublicRateLimitForTests();
  });

  it("keeps checkout scopes isolated for the same client", () => {
    const targeted = checkPublicRateLimit(
      checkoutRequest("/api/stripe/targeted-checkout"),
      checkoutRateLimit
    );
    const intelligence = checkPublicRateLimit(
      checkoutRequest("/api/intelligence/checkout"),
      { ...checkoutRateLimit, scope: "checkout:intelligence" }
    );
    const legacy = checkPublicRateLimit(
      checkoutRequest("/api/stripe/checkout"),
      { ...checkoutRateLimit, scope: "checkout:legacy-stripe" }
    );

    expect(targeted.allowed).toBe(true);
    expect(targeted.remaining).toBe(11);
    expect(intelligence.allowed).toBe(true);
    expect(intelligence.remaining).toBe(11);
    expect(legacy.allowed).toBe(true);
    expect(legacy.remaining).toBe(11);
  });

  it("returns retry metadata after repeated checkout attempts", () => {
    let result = checkPublicRateLimit(
      checkoutRequest("/api/stripe/targeted-checkout", "203.0.113.91"),
      checkoutRateLimit
    );
    for (let attempt = 0; attempt < 13; attempt += 1) {
      result = checkPublicRateLimit(
        checkoutRequest("/api/stripe/targeted-checkout", "203.0.113.91"),
        checkoutRateLimit
      );
    }

    expect(result.allowed).toBe(false);
    expect(publicRateLimitHeaders(result)).toMatchObject({
      "RateLimit-Limit": "12",
      "RateLimit-Remaining": "0",
      "Retry-After": expect.any(String),
    });
  });
});
