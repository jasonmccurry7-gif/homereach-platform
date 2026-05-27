import { describe, expect, it } from "vitest";
import {
  extractBearerToken,
  extractRequestSecret,
  requestSecretMatches,
} from "../request-secret";

describe("request secret helpers", () => {
  it("extracts bearer tokens case-insensitively", () => {
    const req = new Request("https://example.test", {
      headers: { Authorization: "Bearer cron-secret" },
    });

    expect(extractBearerToken(req)).toBe("cron-secret");
  });

  it("prefers x-cron-secret over bearer tokens", () => {
    const req = new Request("https://example.test", {
      headers: {
        Authorization: "Bearer bearer-secret",
        "x-cron-secret": "header-secret",
      },
    });

    expect(extractRequestSecret(req)).toBe("header-secret");
  });

  it("matches the expected request secret", () => {
    const req = new Request("https://example.test", {
      headers: { "x-cron-secret": "expected-secret" },
    });

    expect(requestSecretMatches(req, "expected-secret")).toBe(true);
  });

  it("does not match when the expected secret is missing", () => {
    const req = new Request("https://example.test", {
      headers: { "x-cron-secret": "provided-secret" },
    });

    expect(requestSecretMatches(req)).toBe(false);
  });
});
