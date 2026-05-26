import { describe, expect, it } from "vitest";
import {
  isCheckoutSessionPaymentSatisfied,
  isStripeSubscriptionProvisionableStatus,
  mapStripeSubscriptionStatusToSpotStatus,
} from "../subscription-activation";

describe("Stripe subscription activation guards", () => {
  it("only provisions active or trialing subscriptions", () => {
    expect(isStripeSubscriptionProvisionableStatus("active")).toBe(true);
    expect(isStripeSubscriptionProvisionableStatus("trialing")).toBe(true);

    for (const status of [
      "incomplete",
      "incomplete_expired",
      "past_due",
      "canceled",
      "unpaid",
      "paused",
      undefined,
      null,
    ]) {
      expect(isStripeSubscriptionProvisionableStatus(status)).toBe(false);
    }
  });

  it("maps Stripe subscription statuses to spot lifecycle states conservatively", () => {
    expect(mapStripeSubscriptionStatusToSpotStatus("active")).toBe("active");
    expect(mapStripeSubscriptionStatusToSpotStatus("trialing")).toBe("active");
    expect(mapStripeSubscriptionStatusToSpotStatus("past_due")).toBe("paused");
    expect(mapStripeSubscriptionStatusToSpotStatus("unpaid")).toBe("paused");
    expect(mapStripeSubscriptionStatusToSpotStatus("paused")).toBe("paused");
    expect(mapStripeSubscriptionStatusToSpotStatus("incomplete")).toBeNull();
    expect(mapStripeSubscriptionStatusToSpotStatus("canceled")).toBeNull();
  });

  it("only treats paid or no-payment-required Checkout sessions as satisfied", () => {
    expect(isCheckoutSessionPaymentSatisfied("paid")).toBe(true);
    expect(isCheckoutSessionPaymentSatisfied("no_payment_required")).toBe(true);
    expect(isCheckoutSessionPaymentSatisfied("unpaid")).toBe(false);
    expect(isCheckoutSessionPaymentSatisfied(null)).toBe(false);
    expect(isCheckoutSessionPaymentSatisfied(undefined)).toBe(false);
  });
});
