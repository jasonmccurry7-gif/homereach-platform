// ─────────────────────────────────────────────────────────────────────────────
// Legacy Data Import System — Public API
// ─────────────────────────────────────────────────────────────────────────────

export { runImport, runMockImport }           from "./importer";
export { dedupeAgainst, dedupeBatch }         from "./deduper";
export {
  evaluateSuppression, evaluateSuppressionBatch,
  outreachGuard, getDecisionMeta,
}                                             from "./suppression";
export {
  normalizePhone, normalizeEmail, normalizeWebsite,
  normalizeStatus, normalizeChannel, normalizeDirection,
  normalizeBusiness, normalizeOutreachEvent,
  normalizeConversation, normalizeMessage,
}                                             from "./normalizer";
export { MOCK_LEGACY_EXPORT }                 from "./mock-legacy-data";

export type {
  // Raw legacy shapes
  LegacyBusiness, LegacyOutreach, LegacyConversation,
  LegacyMessage, LegacyCustomer, LegacyExport,
  // Normalized models
  NormalizedStatus, OutreachFlags,
  NormalizedBusiness, NormalizedOutreachEvent,
  NormalizedConversation, NormalizedMessage,
  // Dedupe
  DedupeConfidence, DedupeMatch, DedupeResult,
  // Suppression
  SuppressionDecision, SuppressionResult, SuppressionSummary,
  // Import
  ImportRecordStatus, ImportRecord, ImportReport,
  ImportPhase, ImportState,
}                                             from "./types";
