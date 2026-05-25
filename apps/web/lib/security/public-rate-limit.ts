import { createHash } from "node:crypto";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export interface PublicRateLimitOptions {
  scope: string;
  limit: number;
  windowMs: number;
}

export interface PublicRateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
}

type PublicRateLimitStore = Map<string, RateLimitEntry>;

declare global {
  var __homereachPublicRateLimitStore: PublicRateLimitStore | undefined;
}

function store(): PublicRateLimitStore {
  globalThis.__homereachPublicRateLimitStore ??= new Map();
  return globalThis.__homereachPublicRateLimitStore;
}

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    forwarded ||
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("cf-connecting-ip")?.trim() ||
    "unknown"
  );
}

function rateLimitKey(request: Request, scope: string): string {
  const digest = createHash("sha256").update(clientIp(request)).digest("hex").slice(0, 24);
  return `${scope}:${digest}`;
}

function pruneExpired(entries: PublicRateLimitStore, now: number) {
  if (entries.size < 500) return;
  for (const [key, entry] of entries) {
    if (entry.resetAt <= now) entries.delete(key);
  }
}

export function checkPublicRateLimit(
  request: Request,
  options: PublicRateLimitOptions,
): PublicRateLimitResult {
  const now = Date.now();
  const entries = store();
  pruneExpired(entries, now);

  const key = rateLimitKey(request, options.scope);
  const existing = entries.get(key);
  const resetAt = existing && existing.resetAt > now
    ? existing.resetAt
    : now + options.windowMs;
  const count = existing && existing.resetAt > now ? existing.count + 1 : 1;
  entries.set(key, { count, resetAt });

  const resetSeconds = Math.max(1, Math.ceil((resetAt - now) / 1000));
  const remaining = Math.max(0, options.limit - count);

  return {
    allowed: count <= options.limit,
    limit: options.limit,
    remaining,
    resetSeconds,
  };
}

export function publicRateLimitHeaders(result: PublicRateLimitResult): Record<string, string> {
  return {
    "RateLimit-Limit": String(result.limit),
    "RateLimit-Remaining": String(result.remaining),
    "RateLimit-Reset": String(result.resetSeconds),
    ...(result.allowed ? {} : { "Retry-After": String(result.resetSeconds) }),
  };
}

export function clearPublicRateLimitForTests() {
  store().clear();
}
