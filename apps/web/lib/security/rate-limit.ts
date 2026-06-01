import { NextResponse } from "next/server";

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
  identifier?: string | null;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

function clientIp(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || "unknown";

  return (
    req.headers.get("x-real-ip") ??
    req.headers.get("cf-connecting-ip") ??
    "unknown"
  );
}

function cleanup(now: number) {
  if (buckets.size < 1_000) return;

  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function checkRateLimit(
  req: Request,
  options: RateLimitOptions,
): NextResponse | null {
  if (process.env.DISABLE_IN_MEMORY_RATE_LIMIT === "true") return null;

  const now = Date.now();
  cleanup(now);

  const identifier = options.identifier ?? clientIp(req);
  const key = `${options.key}:${identifier}`;
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + options.windowMs });
    return null;
  }

  if (existing.count >= options.limit) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((existing.resetAt - now) / 1000),
    );

    return NextResponse.json(
      {
        error: "Too many requests. Please wait a moment and try again.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSeconds),
          "X-RateLimit-Limit": String(options.limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(existing.resetAt / 1000)),
        },
      },
    );
  }

  existing.count += 1;
  return null;
}
