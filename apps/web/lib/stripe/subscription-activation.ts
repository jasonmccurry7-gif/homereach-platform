import type Stripe from "stripe";

type SpotLifecycleStatus = "active" | "paused";

export function isStripeSubscriptionProvisionableStatus(
  status: Stripe.Subscription.Status | string | null | undefined,
): boolean {
  return status === "active" || status === "trialing";
}

export function mapStripeSubscriptionStatusToSpotStatus(
  status: Stripe.Subscription.Status | string | null | undefined,
): SpotLifecycleStatus | null {
  if (isStripeSubscriptionProvisionableStatus(status)) {
    return "active";
  }

  if (status === "past_due" || status === "unpaid" || status === "paused") {
    return "paused";
  }

  return null;
}

export function isCheckoutSessionPaymentSatisfied(
  paymentStatus: Stripe.Checkout.Session.PaymentStatus | string | null | undefined,
): boolean {
  return paymentStatus === "paid" || paymentStatus === "no_payment_required";
}
