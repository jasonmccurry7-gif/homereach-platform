import { afterEach, describe, expect, it } from "vitest";
import {
  checkPublicRateLimit,
  clearPublicRateLimitForTests,
  publicRateLimitHeaders,
} from "../public-rate-limit";

const spotResolveRateLimit = {
  scope: "spots:resolve",
  limit: 120,
  windowMs: 60_000,
};

const spotAvailabilityRateLimit = {
  scope: "spots:availability",
  limit: 120,
  windowMs: 60_000,
};

function resolveRequest(ip = "203.0.113.120") {
  return new Request("https://example.test/api/spots/resolve?citySlug=wooster-oh&categorySlug=hvac", {
    method: "GET",
    headers: {
      "x-forwarded-for": ip,
    },
  });
}

describe("public read route rate limits", () => {
  afterEach(() => {
    clearPublicRateLimitForTests();
  });

  it("tracks spot resolution lookups separately from mutation scopes", () => {
    const resolve = checkPublicRateLimit(resolveRequest(), spotResolveRateLimit);
    const checkout = checkPublicRateLimit(resolveRequest(), {
      ...spotResolveRateLimit,
      scope: "checkout:spots",
      limit: 12,
      windowMs: 10 * 60_000,
    });

    expect(resolve).toMatchObject({ allowed: true, remaining: 119, limit: 120 });
    expect(checkout).toMatchObject({ allowed: true, remaining: 11, limit: 12 });
  });

  it("keeps spot availability checks isolated from slug resolution", () => {
    const ip = "203.0.113.122";
    const resolve = checkPublicRateLimit(resolveRequest(ip), spotResolveRateLimit);
    const availability = checkPublicRateLimit(resolveRequest(ip), spotAvailabilityRateLimit);

    expect(resolve).toMatchObject({ allowed: true, remaining: 119, limit: 120 });
    expect(availability).toMatchObject({ allowed: true, remaining: 119, limit: 120 });
  });

  it("returns retry metadata after excessive spot resolution lookups", () => {
    let result = checkPublicRateLimit(resolveRequest("203.0.113.121"), spotResolveRateLimit);

    for (let attempt = 0; attempt < 120; attempt += 1) {
      result = checkPublicRateLimit(resolveRequest("203.0.113.121"), spotResolveRateLimit);
    }

    expect(result.allowed).toBe(false);
    expect(publicRateLimitHeaders(result)).toMatchObject({
      "RateLimit-Limit": "120",
      "RateLimit-Remaining": "0",
      "Retry-After": expect.any(String),
    });
  });
});
