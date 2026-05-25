import { describe, expect, it } from "vitest";
import {
  STRIPE_WEBHOOK_EVENT_CLAIM_STALE_MS,
  decideStripeEventClaimForExisting,
  isStripeWebhookEventStale,
} from "../webhook-idempotency";

const now = new Date("2026-05-25T12:00:00.000Z");

describe("Stripe webhook idempotency decisions", () => {
  it("processes when no ledger row exists", () => {
    expect(decideStripeEventClaimForExisting(null, now)).toBe("process");
  });

  it("skips already completed events as processed duplicates", () => {
    expect(
      decideStripeEventClaimForExisting({ status: "processed", receivedAt: now }, now),
    ).toBe("processed_duplicate");
    expect(
      decideStripeEventClaimForExisting({ status: "skipped", receivedAt: now }, now),
    ).toBe("processed_duplicate");
  });

  it("reprocesses failed events", () => {
    expect(
      decideStripeEventClaimForExisting({ status: "failed", receivedAt: now }, now),
    ).toBe("process");
  });

  it("asks Stripe to retry fresh received events instead of acknowledging them", () => {
    const fresh = new Date(now.getTime() - STRIPE_WEBHOOK_EVENT_CLAIM_STALE_MS + 1);

    expect(
      decideStripeEventClaimForExisting({ status: "received", receivedAt: fresh }, now),
    ).toBe("retry_later");
  });

  it("reprocesses stale received events", () => {
    const stale = new Date(now.getTime() - STRIPE_WEBHOOK_EVENT_CLAIM_STALE_MS);

    expect(
      decideStripeEventClaimForExisting({ status: "received", receivedAt: stale }, now),
    ).toBe("process");
  });

  it("treats missing or invalid timestamps as stale", () => {
    expect(isStripeWebhookEventStale(null, now)).toBe(true);
    expect(isStripeWebhookEventStale("not-a-date", now)).toBe(true);
  });

  it("keeps unknown statuses retryable", () => {
    expect(
      decideStripeEventClaimForExisting({ status: "mystery", receivedAt: now }, now),
    ).toBe("retry_later");
  });
});
