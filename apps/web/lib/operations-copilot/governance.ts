import "server-only";

import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getSupplierConnectors } from "@/lib/operations-copilot/supplier-connectors";

const MAX_TEXT_LENGTH = 1_200;
const MAX_OBJECT_KEYS = 80;
const MAX_ARRAY_ITEMS = 50;
const MAX_JSON_DEPTH = 5;
const MAX_MONEY_CENTS = 50_000_000;

export type SupplifyConfidence = "low" | "medium" | "high";

export function jsonNoStore(
  body: unknown,
  init?: ResponseInit & { status?: number }
) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");

  return NextResponse.json(body, {
    ...init,
    headers,
  });
}

export function guardSupplifyMutation(
  request: Request,
  {
    key,
    limit = 30,
    userId,
    windowMs = 60_000,
  }: {
    key: string;
    limit?: number;
    userId: string;
    windowMs?: number;
  }
) {
  const originError = validateSameOrigin(request);
  if (originError) return originError;

  return checkRateLimit(request, {
    key,
    limit,
    windowMs,
    identifier: userId,
  });
}

export function validateSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return null;

  try {
    const originHost = new URL(origin).host;
    const requestHost =
      request.headers.get("x-forwarded-host") ??
      request.headers.get("host") ??
      new URL(request.url).host;

    if (originHost !== requestHost) {
      return jsonNoStore({ error: "Invalid request origin" }, { status: 403 });
    }
  } catch {
    return jsonNoStore({ error: "Invalid request origin" }, { status: 403 });
  }

  return null;
}

export function sanitizeActionType(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_:-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 96);

  return normalized.length >= 2 ? normalized : null;
}

export function sanitizeText(
  value: unknown,
  fallback = "",
  maxLength = MAX_TEXT_LENGTH
) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed ? trimmed.slice(0, maxLength) : fallback;
}

export function sanitizeMoneyCents(value: unknown, fallback = 0) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(MAX_MONEY_CENTS, Math.round(numeric)));
}

export function sanitizeRiskScore(value: unknown, fallback = 50) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

export function sanitizeConfidence(value: unknown): SupplifyConfidence {
  if (value === "high" || value === "medium" || value === "low") return value;
  if (typeof value === "string") {
    const normalized = value.toLowerCase();
    if (normalized === "high" || normalized === "medium" || normalized === "low") {
      return normalized;
    }
  }
  return "medium";
}

export function approvalLockedPayload(value: unknown) {
  const sanitized = sanitizeJsonValue(value);
  const payload =
    typeof sanitized === "object" && sanitized !== null && !Array.isArray(sanitized)
      ? sanitized
      : {};

  return {
    ...payload,
    approvalOnly: true,
    liveOrderingEnabled: false,
    spendCommitmentBlocked: true,
    supplierPaymentProcessedByHomeReach: false,
    governanceMode: "human_approval_required_no_spend_commitment",
  };
}

export function sanitizeJsonValue(value: unknown, depth = 0): unknown {
  if (value === null) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return Math.max(-MAX_MONEY_CENTS, Math.min(MAX_MONEY_CENTS, value));
  }
  if (typeof value === "string") return value.trim().slice(0, MAX_TEXT_LENGTH);
  if (depth >= MAX_JSON_DEPTH) return "[truncated]";

  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => sanitizeJsonValue(item, depth + 1));
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, MAX_OBJECT_KEYS)
        .map(([key, entryValue]) => [
          key.replace(/[^a-zA-Z0-9_.:-]/g, "_").slice(0, 80),
          sanitizeJsonValue(entryValue, depth + 1),
        ])
    );
  }

  return null;
}

export function readApprovedSupplierReferenceUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    if (!getAllowedSupplierHosts().has(url.hostname.toLowerCase())) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function getAllowedSupplierHosts() {
  return new Set(
    getSupplierConnectors()
      .flatMap((connector) => {
        if (!connector.searchUrlPattern) return [];
        try {
          return [
            new URL(connector.searchUrlPattern.replace("{query}", "supplies")).hostname.toLowerCase(),
          ];
        } catch {
          return [];
        }
      })
      .filter(Boolean)
  );
}
