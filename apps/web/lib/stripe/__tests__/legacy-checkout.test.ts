import { describe, expect, it } from "vitest";
import { isLegacyStripeCheckoutEnabled } from "../legacy-checkout";

describe("legacy Stripe checkout guard", () => {
  it("defaults to disabled", () => {
    expect(isLegacyStripeCheckoutEnabled({})).toBe(false);
  });

  it("requires an explicit true value", () => {
    expect(isLegacyStripeCheckoutEnabled({ ENABLE_LEGACY_STRIPE_CHECKOUT: "false" })).toBe(false);
    expect(isLegacyStripeCheckoutEnabled({ ENABLE_LEGACY_STRIPE_CHECKOUT: "TRUE" })).toBe(false);
    expect(isLegacyStripeCheckoutEnabled({ ENABLE_LEGACY_STRIPE_CHECKOUT: "true" })).toBe(true);
  });
});
