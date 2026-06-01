import { createHmac, timingSafeEqual } from "node:crypto";

type SignedTokenPayload = {
  scope: string;
  iat: number;
  exp: number;
  [key: string]: unknown;
};

const MAX_TOKEN_LENGTH = 4096;
const MAX_CLOCK_SKEW_SECONDS = 5 * 60;

function base64url(value: Buffer | string): string {
  return Buffer.from(value).toString("base64url");
}

function decodeBase64url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signingSecret(): string {
  if (process.env.NODE_ENV === "production" && !process.env.CHECKOUT_TOKEN_SECRET) {
    throw new Error("CHECKOUT_TOKEN_SECRET is required in production.");
  }

  const secret =
    process.env.CHECKOUT_TOKEN_SECRET ??
    process.env.PUBLIC_FLOW_TOKEN_SECRET ??
    process.env.INTERNAL_APP_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    process.env.CRON_SECRET;

  if (!secret) {
    throw new Error("No server-side token signing secret is configured.");
  }

  return secret;
}

function signatureFor(payload: string): string {
  return createHmac("sha256", signingSecret())
    .update(payload)
    .digest("base64url");
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function signPublicFlowToken(
  payload: Omit<SignedTokenPayload, "iat" | "exp">,
  ttlSeconds = 60 * 60 * 24 * 14,
): string {
  const now = Math.floor(Date.now() / 1000);
  const body = base64url(
    JSON.stringify({
      ...payload,
      iat: now,
      exp: now + ttlSeconds,
    }),
  );

  return `${body}.${signatureFor(body)}`;
}

export function verifyPublicFlowToken<T extends SignedTokenPayload>(
  token: string | null | undefined,
  expectedScope: string,
): { ok: true; payload: T } | { ok: false; reason: string } {
  if (!token) return { ok: false, reason: "missing_token" };
  if (token.length > MAX_TOKEN_LENGTH) return { ok: false, reason: "token_too_large" };

  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, reason: "malformed_token" };

  const [body, signature] = parts;
  if (!body || !signature) return { ok: false, reason: "malformed_token" };

  const expected = signatureFor(body);
  if (!safeEqual(signature, expected)) {
    return { ok: false, reason: "invalid_signature" };
  }

  let payload: T;
  try {
    payload = JSON.parse(decodeBase64url(body)) as T;
  } catch {
    return { ok: false, reason: "invalid_payload" };
  }

  if (payload.scope !== expectedScope) {
    return { ok: false, reason: "invalid_scope" };
  }

  const now = Math.floor(Date.now() / 1000);
  if (
    !Number.isFinite(payload.iat) ||
    payload.iat > now + MAX_CLOCK_SKEW_SECONDS
  ) {
    return { ok: false, reason: "invalid_issued_at" };
  }

  if (!Number.isFinite(payload.exp) || payload.exp <= now) {
    return { ok: false, reason: "expired_token" };
  }

  return { ok: true, payload };
}
