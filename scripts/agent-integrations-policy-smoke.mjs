import assert from "node:assert/strict";

import {
  detectSensitiveActionFlags,
  isSensitivePermissionScope,
  normalizeAgentPermissionScope,
  redactUnsafeIntegrationPayload,
  validateExternalActionIntent,
} from "../apps/web/lib/agent-integrations/rules.ts";

assert.equal(normalizeAgentPermissionScope("unknown"), "read_only");
assert.equal(isSensitivePermissionScope("read_only"), false);
assert.equal(isSensitivePermissionScope("send_after_approval"), true);
assert.equal(isSensitivePermissionScope("purchase_after_approval"), true);
assert.equal(isSensitivePermissionScope("submit_after_approval"), true);

assert.deepEqual(
  detectSensitiveActionFlags({
    intentType: "prepare_supplier_comparison",
    targetSystem: "supplier websites",
    permissionScope: "prepare_only",
  }),
  [],
);

assert.deepEqual(
  detectSensitiveActionFlags({
    intentType: "send_sms",
    targetSystem: "Twilio",
    permissionScope: "send_after_approval",
  }).sort(),
  ["send_after_approval", "send_or_publish"].sort(),
);

assert.equal(
  validateExternalActionIntent({
    intentType: "send_email",
    targetSystem: "Gmail",
    permissionScope: "read_only",
    approvalEventId: "approval-event",
  }).ok,
  false,
);

assert.equal(
  validateExternalActionIntent({
    intentType: "send_email",
    targetSystem: "Gmail",
    permissionScope: "send_after_approval",
  }).ok,
  false,
);

assert.equal(
  validateExternalActionIntent({
    intentType: "send_email",
    targetSystem: "Gmail",
    permissionScope: "send_after_approval",
    approvalEventId: "approval-event",
  }).ok,
  true,
);

assert.equal(
  validateExternalActionIntent({
    intentType: "delete_customer_records",
    targetSystem: "HomeReach Admin",
    permissionScope: "submit_after_approval",
    approvalEventId: "approval-event",
  }).ok,
  false,
);

const redacted = redactUnsafeIntegrationPayload({
  subject: "Safe",
  apiKey: "do-not-store",
  nested: {
    refreshToken: "do-not-store",
    useful: "keep",
  },
});

assert.equal(redacted.apiKey, "[redacted]");
assert.equal(redacted.nested.refreshToken, "[redacted]");
assert.equal(redacted.nested.useful, "keep");

console.log("Agent Integrations policy smoke passed.");
