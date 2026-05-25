import { describe, expect, it } from "vitest";
import { getStripePublicAppBaseUrl } from "../app-url";

describe("Stripe app URL resolver", () => {
  it("prefers the canonical public app URL", () => {
    expect(
      getStripePublicAppBaseUrl({
        NEXT_PUBLIC_APP_URL: "https://app.example.com/",
        VERCEL_URL: "preview.vercel.app",
      }),
    ).toBe("https://app.example.com");
  });

  it("falls back through compatible public aliases", () => {
    expect(
      getStripePublicAppBaseUrl({
        NEXT_PUBLIC_SITE_URL: "https://site.example.com/",
      }),
    ).toBe("https://site.example.com");
  });

  it("normalizes Vercel deployment URLs when public aliases are absent", () => {
    expect(
      getStripePublicAppBaseUrl({
        VERCEL_BRANCH_URL: "branch-preview.vercel.app/",
        VERCEL_URL: "unique-preview.vercel.app",
      }),
    ).toBe("https://branch-preview.vercel.app");
  });

  it("uses the production domain as the final fallback", () => {
    expect(getStripePublicAppBaseUrl({})).toBe("https://home-reach.com");
  });
});
