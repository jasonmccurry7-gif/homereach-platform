import assert from "node:assert/strict";

import {
  EXECUTION_PERMISSION_SCOPES,
  changedPayloadKeys,
  isFinalMiniAppStatus,
  redactUnsafeEventPayload,
  validateMiniAppTransition,
} from "../apps/web/lib/agent-mini-apps/rules.ts";

const validTransitions = [
  ["generated", "needs_review"],
  ["needs_review", "edited"],
  ["needs_review", "approved"],
  ["needs_review", "rejected"],
  ["edited", "approved"],
  ["approved", "scheduled"],
  ["approved", "executed"],
  ["approved", "sent_to_execution_queue"],
  ["scheduled", "executed"],
  ["generated", "archived"],
  ["approved", "failed"],
  ["failed", "archived"],
];

for (const [current, next] of validTransitions) {
  assert.equal(
    validateMiniAppTransition(current, next),
    null,
    `${current} -> ${next} should be valid`,
  );
}

const invalidTransitions = [
  ["generated", "approved"],
  ["needs_review", "scheduled"],
  ["executed", "edited"],
  ["rejected", "approved"],
  ["archived", "needs_review"],
];

for (const [current, next] of invalidTransitions) {
  assert.match(
    validateMiniAppTransition(current, next),
    /Invalid status transition|Final mini apps/,
    `${current} -> ${next} should be blocked`,
  );
}

assert.equal(isFinalMiniAppStatus("executed"), true);
assert.equal(isFinalMiniAppStatus("rejected"), true);
assert.equal(isFinalMiniAppStatus("archived"), true);
assert.equal(isFinalMiniAppStatus("approved"), false);
assert.equal(EXECUTION_PERMISSION_SCOPES[0], "read_only");

const redacted = redactUnsafeEventPayload({
  reason: "approve draft",
  password: "do-not-store",
  nested: {
    apiKey: "do-not-store",
    useful: "keep this",
  },
  array: [{ sessionToken: "do-not-store" }, { note: "safe" }],
});

assert.equal(redacted.password, "[redacted]");
assert.equal(redacted.nested.apiKey, "[redacted]");
assert.equal(redacted.nested.useful, "keep this");
assert.equal(redacted.array[0].sessionToken, "[redacted]");
assert.equal(redacted.array[1].note, "safe");

assert.deepEqual(
  changedPayloadKeys({ subject: "A", body: "Old" }, { subject: "A", body: "New", cta: "Book" }),
  ["body", "cta"],
);

console.log("Agent Mini Apps lifecycle smoke passed.");
