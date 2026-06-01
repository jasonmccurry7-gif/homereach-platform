export const INTEGRATION_CONNECTION_TYPES = [
  "oauth",
  "api_reference",
  "manual_browser",
  "webhook",
  "mcp",
  "native_connector",
  "none",
] as const;

export const INTEGRATION_CONNECTION_STATUSES = [
  "not_configured",
  "pending",
  "active",
  "expired",
  "revoked",
  "error",
  "archived",
] as const;

export const AGENT_PERMISSION_SCOPES = [
  "read_only",
  "draft_only",
  "prepare_only",
  "send_after_approval",
  "purchase_after_approval",
  "submit_after_approval",
] as const;

export const AGENT_TOOL_RISK_LEVELS = ["low", "medium", "high", "critical"] as const;

export const EXTERNAL_ACTION_INTENT_STATUSES = [
  "draft",
  "approval_required",
  "approved",
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
  "manual_takeover_needed",
  "archived",
] as const;

export const AGENT_EXECUTION_ATTEMPT_STATUSES = [
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
  "manual_takeover_needed",
] as const;

export type IntegrationConnectionType = (typeof INTEGRATION_CONNECTION_TYPES)[number];
export type IntegrationConnectionStatus = (typeof INTEGRATION_CONNECTION_STATUSES)[number];
export type AgentPermissionScope = (typeof AGENT_PERMISSION_SCOPES)[number];
export type AgentToolRiskLevel = (typeof AGENT_TOOL_RISK_LEVELS)[number];
export type ExternalActionIntentStatus = (typeof EXTERNAL_ACTION_INTENT_STATUSES)[number];
export type AgentExecutionAttemptStatus = (typeof AGENT_EXECUTION_ATTEMPT_STATUSES)[number];

type JsonRecord = Record<string, unknown>;

const SEND_TERMS = ["send", "email", "sms", "dm", "post", "publish"];
const PURCHASE_TERMS = ["purchase", "order", "spend", "charge", "refund", "pay"];
const SUBMIT_TERMS = ["submit", "sign", "contract", "certify"];
const MANUAL_TAKEOVER_TERMS = ["delete", "export", "account settings", "password", "mfa", "api key", "secret"];

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

export function normalizeAgentPermissionScope(value: unknown): AgentPermissionScope {
  const scope = String(value ?? "read_only");
  return AGENT_PERMISSION_SCOPES.includes(scope as AgentPermissionScope)
    ? (scope as AgentPermissionScope)
    : "read_only";
}

export function isSensitivePermissionScope(scope: AgentPermissionScope) {
  return (
    scope === "send_after_approval" ||
    scope === "purchase_after_approval" ||
    scope === "submit_after_approval"
  );
}

export function detectSensitiveActionFlags(input: {
  intentType?: string | null;
  targetSystem?: string | null;
  targetIdentifier?: string | null;
  permissionScope?: AgentPermissionScope | string | null;
  payload?: JsonRecord | null;
}) {
  const scope = normalizeAgentPermissionScope(input.permissionScope);
  const haystack = [
    input.intentType,
    input.targetSystem,
    input.targetIdentifier,
    scope,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const flags = new Set<string>();
  if (isSensitivePermissionScope(scope)) flags.add(scope);
  addMatchingFlags(flags, haystack, SEND_TERMS, "send_or_publish");
  addMatchingFlags(flags, haystack, PURCHASE_TERMS, "purchase_or_payment");
  addMatchingFlags(flags, haystack, SUBMIT_TERMS, "submit_or_contract");
  addMatchingFlags(flags, haystack, MANUAL_TAKEOVER_TERMS, "manual_takeover_required");
  return Array.from(flags);
}

export function validateExternalActionIntent(input: {
  intentType: unknown;
  targetSystem: unknown;
  permissionScope: unknown;
  approvalEventId?: unknown;
  payload?: unknown;
}) {
  const intentType = stringValue(input.intentType);
  const targetSystem = stringValue(input.targetSystem);
  const permissionScope = normalizeAgentPermissionScope(input.permissionScope);
  const approvalEventId = stringValue(input.approvalEventId);
  const payload = asRecord(input.payload);

  if (!intentType) return { ok: false as const, error: "External action intent type is required." };
  if (!targetSystem) return { ok: false as const, error: "External action target system is required." };
  if (isSensitivePermissionScope(permissionScope) && !approvalEventId) {
    return {
      ok: false as const,
      error: `${permissionScope} requires a persisted human approval event before queuing external execution.`,
    };
  }

  const flags = detectSensitiveActionFlags({
    intentType,
    targetSystem,
    permissionScope,
    payload,
  });
  if (flags.includes("manual_takeover_required")) {
    return {
      ok: false as const,
      error:
        "This action mentions delete/export/account/secret/MFA behavior and must use manual takeover, not automated execution.",
    };
  }
  if (flags.includes("send_or_publish") && permissionScope !== "send_after_approval") {
    return {
      ok: false as const,
      error: "Send, SMS, DM, email, post, or publish actions require send_after_approval scope.",
    };
  }
  if (flags.includes("purchase_or_payment") && permissionScope !== "purchase_after_approval") {
    return {
      ok: false as const,
      error: "Purchase, order, spend, charge, refund, or payment actions require purchase_after_approval scope.",
    };
  }
  if (flags.includes("submit_or_contract") && permissionScope !== "submit_after_approval") {
    return {
      ok: false as const,
      error: "Submit, sign, contract, or certification actions require submit_after_approval scope.",
    };
  }

  return {
    ok: true as const,
    value: {
      intentType,
      targetSystem,
      permissionScope,
      approvalEventId,
      payload: redactUnsafeIntegrationPayload(payload),
      sensitiveFlags: flags,
    },
  };
}

export function redactUnsafeIntegrationPayload(value: unknown): JsonRecord {
  return sanitizeRecord(asRecord(value));
}

function addMatchingFlags(flags: Set<string>, haystack: string, terms: string[], flag: string) {
  if (terms.some((term) => haystack.includes(term))) flags.add(flag);
}

function sanitizeRecord(record: JsonRecord): JsonRecord {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      key,
      isSecretKey(key) ? "[redacted]" : sanitizeValue(value),
    ]),
  );
}

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (value && typeof value === "object") return sanitizeRecord(value as JsonRecord);
  return value;
}

function isSecretKey(key: string) {
  const normalized = key.toLowerCase().replace(/[\s-]/g, "_");
  return SECRET_KEY_PATTERNS.some((pattern) => normalized.includes(pattern));
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}
