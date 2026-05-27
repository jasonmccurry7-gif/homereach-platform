import Stripe from "stripe";
import { afterEach, describe, expect, it } from "vitest";
import { constructWebhookEvent } from "../index";

const originalStripeSecretKey = process.env.STRIPE_SECRET_KEY;
const originalStripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

const webhookSecret = "whsec_test_signature_secret";
const rawPayload = JSON.stringify({
  id: "evt_synthetic_checkout_completed",
  object: "event",
  type: "checkout.session.completed",
  data: {
    object: {
      id: "cs_test_synthetic",
      object: "checkout.session",
      metadata: { type: "targeted_route_campaign" },
    },
  },
});

function buildStripeTestHeader(secret = webhookSecret): string {
  const stripe = new Stripe("sk_test_placeholder");
  return stripe.webhooks.generateTestHeaderString({
    payload: rawPayload,
    secret,
  });
}

describe("Stripe webhook signature verification", () => {
  afterEach(() => {
    if (originalStripeSecretKey === undefined) {
      delete process.env.STRIPE_SECRET_KEY;
    } else {
      process.env.STRIPE_SECRET_KEY = originalStripeSecretKey;
    }

    if (originalStripeWebhookSecret === undefined) {
      delete process.env.STRIPE_WEBHOOK_SECRET;
    } else {
      process.env.STRIPE_WEBHOOK_SECRET = originalStripeWebhookSecret;
    }
  });

  it("constructs an event from a correctly signed synthetic payload", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_placeholder";
    process.env.STRIPE_WEBHOOK_SECRET = webhookSecret;

    const event = constructWebhookEvent(rawPayload, buildStripeTestHeader());

    expect(event.id).toBe("evt_synthetic_checkout_completed");
    expect(event.type).toBe("checkout.session.completed");
  });

  it("rejects a payload signed with the wrong webhook secret", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_placeholder";
    process.env.STRIPE_WEBHOOK_SECRET = webhookSecret;

    expect(() =>
      constructWebhookEvent(rawPayload, buildStripeTestHeader("whsec_wrong")),
    ).toThrow();
  });

  it("fails closed when STRIPE_WEBHOOK_SECRET is missing", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_placeholder";
    delete process.env.STRIPE_WEBHOOK_SECRET;

    expect(() => constructWebhookEvent(rawPayload, buildStripeTestHeader())).toThrow(
      "STRIPE_WEBHOOK_SECRET is required",
    );
  });
});
