import { afterEach, describe, expect, it } from "vitest";
import {
  checkPublicRateLimit,
  clearPublicRateLimitForTests,
  publicRateLimitHeaders,
} from "../public-rate-limit";

function requestForIp(ip: string) {
  return new Request("https://example.test/api/test", {
    headers: { "x-forwarded-for": `${ip}, 10.0.0.1` },
  });
}

describe("public rate limit helper", () => {
  afterEach(() => {
    clearPublicRateLimitForTests();
  });

  it("allows requests through the limit and then returns retry metadata", () => {
    const options = { scope: "test", limit: 2, windowMs: 60_000 };

    const first = checkPublicRateLimit(requestForIp("203.0.113.10"), options);
    const second = checkPublicRateLimit(requestForIp("203.0.113.10"), options);
    const third = checkPublicRateLimit(requestForIp("203.0.113.10"), options);

    expect(first).toMatchObject({ allowed: true, remaining: 1, limit: 2 });
    expect(second).toMatchObject({ allowed: true, remaining: 0, limit: 2 });
    expect(third.allowed).toBe(false);
    expect(publicRateLimitHeaders(third)).toMatchObject({
      "RateLimit-Limit": "2",
      "RateLimit-Remaining": "0",
      "Retry-After": expect.any(String),
    });
  });

  it("scopes counts by route scope and client IP", () => {
    const options = { scope: "scope-a", limit: 1, windowMs: 60_000 };
    const otherScope = { ...options, scope: "scope-b" };

    expect(checkPublicRateLimit(requestForIp("203.0.113.20"), options).allowed).toBe(true);
    expect(checkPublicRateLimit(requestForIp("203.0.113.20"), options).allowed).toBe(false);
    expect(checkPublicRateLimit(requestForIp("203.0.113.21"), options).allowed).toBe(true);
    expect(checkPublicRateLimit(requestForIp("203.0.113.20"), otherScope).allowed).toBe(true);
  });
});
