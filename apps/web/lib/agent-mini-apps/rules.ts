export const MINI_APP_TYPES = [
  "outreach_approval",
  "political_plan",
  "route_density",
  "procurement_savings",
  "samgov_bid",
  "website_build",
  "generic_task",
] as const;

export const MINI_APP_STATUSES = [
  "generated",
  "needs_review",
  "edited",
  "approved",
  "scheduled",
  "executed",
  "rejected",
  "archived",
  "failed",
  "sent_to_execution_queue",
] as const;

export const MINI_APP_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export const MINI_APP_RISK_LEVELS = ["low", "medium", "high", "critical"] as const;

export const MINI_APP_EVENT_TYPES = [
  "created",
  "viewed",
  "edited",
  "approved",
  "rejected",
  "archived",
  "scheduled",
  "executed",
  "failed",
  "assigned",
  "sent_to_execution_queue",
  "manual_takeover_requested",
] as const;

export const EXECUTION_PERMISSION_SCOPES = [
  "read_only",
  "draft_only",
  "prepare_only",
  "send_after_approval",
  "purchase_after_approval",
  "submit_after_approval",
] as const;

export type MiniAppType = (typeof MINI_APP_TYPES)[number];
export type MiniAppStatus = (typeof MINI_APP_STATUSES)[number];
export type MiniAppPriority = (typeof MINI_APP_PRIORITIES)[number];
export type MiniAppRiskLevel = (typeof MINI_APP_RISK_LEVELS)[number];
export type MiniAppEventType = (typeof MINI_APP_EVENT_TYPES)[number];
export type ExecutionPermissionScope = (typeof EXECUTION_PERMISSION_SCOPES)[number];

export const FINAL_MINI_APP_STATUSES = ["executed", "rejected", "archived"] as const;

export const MINI_APP_TRANSITIONS: Record<MiniAppStatus, MiniAppStatus[]> = {
  generated: ["needs_review", "edited", "archived", "failed"],
  needs_review: ["edited", "approved", "rejected", "archived", "failed"],
  edited: ["approved", "rejected", "archived", "failed"],
  approved: ["scheduled", "executed", "sent_to_execution_queue", "archived", "failed"],
  scheduled: ["executed", "archived", "failed"],
  sent_to_execution_queue: ["executed", "archived", "failed"],
  failed: ["archived"],
  executed: [],
  rejected: [],
  archived: [],
};

const SECRET_KEY_PATTERNS = [
  "password",
  "passcode",
  "secret",
  "api_key",
  "apikey",
  "mfa",
  "token",
  "authorization",
  "cookie",
  "session",
];

export function isFinalMiniAppStatus(status: MiniAppStatus) {
  return FINAL_MINI_APP_STATUSES.includes(status as (typeof FINAL_MINI_APP_STATUSES)[number]);
}

export function validateMiniAppTransition(current: MiniAppStatus, next: MiniAppStatus) {
  if (current === next) return null;
  if (isFinalMiniAppStatus(current)) {
    return "Final mini apps cannot be changed without a new version or clone.";
  }
  if (!MINI_APP_TRANSITIONS[current].includes(next)) {
    return `Invalid status transition: ${current} -> ${next}.`;
  }
  return null;
}

export function changedPayloadKeys(before: Record<string, unknown>, after: Record<string, unknown>) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return Array.from(keys).filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
}

export function redactUnsafeEventPayload(value: unknown): Record<string, unknown> {
  return sanitizeRecord(asRecord(value));
}

function sanitizeRecord(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      key,
      isSecretKey(key) ? "[redacted]" : sanitizeValue(value),
    ]),
  );
}

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (value && typeof value === "object") return sanitizeRecord(value as Record<string, unknown>);
  return value;
}

function isSecretKey(key: string) {
  const normalized = key.toLowerCase().replace(/[\s-]/g, "_");
  return SECRET_KEY_PATTERNS.some((pattern) => normalized.includes(pattern));
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
