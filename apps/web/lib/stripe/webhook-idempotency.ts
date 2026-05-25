export const STRIPE_WEBHOOK_EVENT_CLAIM_STALE_MS = 5 * 60 * 1000;

export type StripeEventClaim = "process" | "processed_duplicate" | "retry_later";

export interface StripeWebhookEventLedgerRow {
  status: string | null;
  receivedAt: Date | string | null;
}

export function isStripeWebhookEventStale(
  receivedAt: Date | string | null | undefined,
  now: Date = new Date(),
  staleAfterMs: number = STRIPE_WEBHOOK_EVENT_CLAIM_STALE_MS,
): boolean {
  if (!receivedAt) return true;

  const receivedTime = receivedAt instanceof Date
    ? receivedAt.getTime()
    : new Date(receivedAt).getTime();

  if (Number.isNaN(receivedTime)) return true;

  return now.getTime() - receivedTime >= staleAfterMs;
}

export function decideStripeEventClaimForExisting(
  existing: StripeWebhookEventLedgerRow | null | undefined,
  now: Date = new Date(),
  staleAfterMs: number = STRIPE_WEBHOOK_EVENT_CLAIM_STALE_MS,
): StripeEventClaim {
  if (!existing) return "process";

  if (existing.status === "processed" || existing.status === "skipped") {
    return "processed_duplicate";
  }

  if (existing.status === "failed") {
    return "process";
  }

  if (existing.status === "received") {
    return isStripeWebhookEventStale(existing.receivedAt, now, staleAfterMs)
      ? "process"
      : "retry_later";
  }

  return "retry_later";
}
