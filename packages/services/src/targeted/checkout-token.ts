import { createHmac, timingSafeEqual } from "node:crypto";

export const TARGETED_CHECKOUT_SIGNING_SECRET_ENV = "TARGETED_CHECKOUT_SIGNING_SECRET";
export const TARGETED_CHECKOUT_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const TOKEN_PURPOSE = "targeted_checkout";
const TOKEN_VERSION = 1;

export type TargetedCheckoutTokenPayload = {
  v: typeof TOKEN_VERSION;
  purpose: typeof TOKEN_PURPOSE;
  campaignId: string;
  email: string;
  iat: number;
  exp: number;
};

export type TargetedCheckoutTokenVerification =
  | { ok: true; payload: TargetedCheckoutTokenPayload }
  | {
      ok: false;
      reason:
        | "missing_token"
        | "missing_secret"
        | "malformed_token"
        | "bad_signature"
        | "wrong_campaign"
        | "wrong_email"
        | "expired";
    };

export function normalizeTargetedCheckoutEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function createTargetedCheckoutToken(input: {
  campaignId: string;
  email: string;
  secret?: string | null;
  now?: Date;
  expiresAt?: Date;
}): string | null {
  const secret = resolveSecret(input.secret);
  if (!secret) return null;

  const issuedAtMs = input.now?.getTime() ?? Date.now();
  const expiresAtMs =
    input.expiresAt?.getTime() ?? issuedAtMs + TARGETED_CHECKOUT_TOKEN_TTL_MS;

  const payload: TargetedCheckoutTokenPayload = {
    v: TOKEN_VERSION,
    purpose: TOKEN_PURPOSE,
    campaignId: input.campaignId,
    email: normalizeTargetedCheckoutEmail(input.email),
    iat: toUnixSeconds(issuedAtMs),
    exp: toUnixSeconds(expiresAtMs),
  };

  const encodedPayload = encodeJson(payload);
  return `${encodedPayload}.${sign(encodedPayload, secret)}`;
}

export function verifyTargetedCheckoutToken(
  token: string | null | undefined,
  expected: {
    campaignId: string;
    email: string;
  },
  options: {
    secret?: string | null;
    now?: Date;
  } = {}
): TargetedCheckoutTokenVerification {
  if (!token) return { ok: false, reason: "missing_token" };

  const secret = resolveSecret(options.secret);
  if (!secret) return { ok: false, reason: "missing_secret" };

  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { ok: false, reason: "malformed_token" };
  }

  const [encodedPayload, providedSignature] = parts as [string, string];
  const expectedSignature = sign(encodedPayload, secret);
  if (!safeSignatureEqual(providedSignature, expectedSignature)) {
    return { ok: false, reason: "bad_signature" };
  }

  const payload = decodePayload(encodedPayload);
  if (!payload) return { ok: false, reason: "malformed_token" };

  const nowSeconds = toUnixSeconds(options.now?.getTime() ?? Date.now());
  if (payload.exp <= nowSeconds) return { ok: false, reason: "expired" };
  if (payload.campaignId !== expected.campaignId) {
    return { ok: false, reason: "wrong_campaign" };
  }
  if (payload.email !== normalizeTargetedCheckoutEmail(expected.email)) {
    return { ok: false, reason: "wrong_email" };
  }

  return { ok: true, payload };
}

function resolveSecret(secret: string | null | undefined): string | null {
  return secret || process.env[TARGETED_CHECKOUT_SIGNING_SECRET_ENV] || null;
}

function toUnixSeconds(ms: number): number {
  return Math.floor(ms / 1000);
}

function encodeJson(payload: TargetedCheckoutTokenPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodePayload(encodedPayload: string): TargetedCheckoutTokenPayload | null {
  try {
    const decoded = Buffer.from(encodedPayload, "base64url").toString("utf8");
    const parsed: unknown = JSON.parse(decoded);
    if (!isPayload(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function sign(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

function safeSignatureEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function isPayload(value: unknown): value is TargetedCheckoutTokenPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<TargetedCheckoutTokenPayload>;
  return (
    payload.v === TOKEN_VERSION &&
    payload.purpose === TOKEN_PURPOSE &&
    typeof payload.campaignId === "string" &&
    typeof payload.email === "string" &&
    typeof payload.iat === "number" &&
    typeof payload.exp === "number"
  );
}
