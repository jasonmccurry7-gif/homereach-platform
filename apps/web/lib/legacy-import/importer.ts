// ─────────────────────────────────────────────────────────────────────────────
// Legacy Importer — Main Orchestrator
//
// Execution order (per spec):
//   1. Ingest raw export
//   2. Normalize all records
//   3. Dedupe (intra-batch + against existing system records)
//   4. Apply suppression logic
//   5. Build import report
//
// Returns a fully populated ImportState ready to render in the dashboard.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  LegacyExport, LegacyCustomer,
  NormalizedBusiness, NormalizedOutreachEvent,
  NormalizedConversation,
  ImportReport, ImportRecord, ImportState,
} from "./types";
import {
  normalizeBusiness, normalizeOutreachEvent,
  normalizeConversation,
} from "./normalizer";
import { dedupeBatch }               from "./deduper";
import { evaluateSuppressionBatch }  from "./suppression";

// ─────────────────────────────────────────────────────────────────────────────
// Run ID Generator
// ─────────────────────────────────────────────────────────────────────────────

function runId(): string {
  return `import-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Find customer record for a business by ID or phone
// ─────────────────────────────────────────────────────────────────────────────

function findCustomer(
  bizId: string | number | undefined,
  phone: string | undefined,
  customers: LegacyCustomer[]
): LegacyCustomer | undefined {
  return customers.find((c) => {
    if (bizId && c.business_id && String(c.business_id) === String(bizId)) return true;
    if (phone && c.phone && c.phone.replace(/\D/g, "") === phone.replace(/\D/g, "")) return true;
    return false;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Import Function
// ─────────────────────────────────────────────────────────────────────────────

export function runImport(
  payload: LegacyExport,
  existingBusinesses: NormalizedBusiness[] = []
): ImportState {
  const startedAt = new Date().toISOString();
  const id        = runId();

  const businesses    = payload.businesses    ?? [];
  const outreach      = payload.outreach      ?? [];
  const conversations = payload.conversations ?? [];
  const messages      = payload.messages      ?? [];
  const customers     = payload.customers     ?? [];

  const records: ImportRecord[] = [];
  const importedAt = new Date().toISOString();

  // ── Phase 1: Normalize businesses ─────────────────────────────────────────
  const rawNormalized: NormalizedBusiness[] = businesses.map((biz) => {
    try {
      const customer = findCustomer(biz.id, biz.phone ?? biz.phone_number, customers);
      return normalizeBusiness(biz, outreach, customer);
    } catch (e) {
      return null as unknown as NormalizedBusiness;
    }
  }).filter(Boolean);

  // ── Phase 2: Dedupe ────────────────────────────────────────────────────────
  const { unique, merged, flagged } = dedupeBatch(rawNormalized, existingBusinesses);

  // Build import records for merged
  for (const { kept, dropped, match } of merged) {
    records.push({
      id:           dropped.id,
      type:         "business",
      status:       "merged",
      normalizedId: kept.id,
      legacyId:     dropped.legacyId,
      name:         dropped.name,
      reason:       match.reason,
      dedupe:       match,
      importedAt,
    });
  }

  // Build import records for flagged
  for (const { incoming, candidate, match } of flagged) {
    records.push({
      id:           incoming.id,
      type:         "business",
      status:       "flagged",
      normalizedId: incoming.id,
      legacyId:     incoming.legacyId,
      name:         incoming.name,
      reason:       match.reason,
      dedupe:       match,
      importedAt,
    });
  }

  // The cleanly imported businesses are anything in unique that isn't from existingBusinesses
  const existingIds  = new Set(existingBusinesses.map((b) => b.id));
  const mergedIds    = new Set(merged.map((m) => m.kept.id));
  const droppedIds   = new Set(merged.map((m) => m.dropped.id));
  const flaggedIds   = new Set(flagged.map((f) => f.incoming.id));
  const flaggedCopies = new Set(flagged.map((f) => f.incoming.id + "-flagged"));

  const cleanImports = unique.filter((b) =>
    !existingIds.has(b.id) &&
    !mergedIds.has(b.id) &&
    !droppedIds.has(b.id) &&
    !flaggedCopies.has(b.id)
  );

  for (const biz of cleanImports) {
    records.push({
      id:           biz.id,
      type:         "business",
      status:       "imported",
      normalizedId: biz.id,
      legacyId:     biz.legacyId,
      name:         biz.name,
      importedAt,
    });
  }

  // ── Phase 3: Normalize outreach events ────────────────────────────────────
  // Map legacy business_id → normalized business id
  const legacyIdToBizId = new Map<string, string>();
  for (const biz of unique) {
    if (biz.legacyId) legacyIdToBizId.set(biz.legacyId, biz.id);
  }

  const normalizedOutreach: NormalizedOutreachEvent[] = [];
  for (const o of outreach) {
    try {
      const bizId = legacyIdToBizId.get(String(o.business_id ?? "")) ?? "unknown";
      normalizedOutreach.push(normalizeOutreachEvent(o, bizId));
      records.push({
        id:           `out-${o.id ?? Math.random()}`,
        type:         "outreach",
        status:       "imported",
        normalizedId: bizId,
        legacyId:     String(o.id ?? ""),
        importedAt,
      });
    } catch {
      records.push({
        id:           `out-err-${o.id}`,
        type:         "outreach",
        status:       "error",
        normalizedId: "unknown",
        reason:       "Failed to normalize outreach record",
        importedAt,
      });
    }
  }

  // ── Phase 4: Normalize conversations + messages ───────────────────────────
  const normalizedConversations: NormalizedConversation[] = [];
  for (const conv of conversations) {
    try {
      const bizId = legacyIdToBizId.get(String(conv.business_id ?? conv.lead_id ?? "")) ?? "unknown";
      normalizedConversations.push(normalizeConversation(conv, bizId, messages));
      records.push({
        id:           `conv-${conv.id ?? Math.random()}`,
        type:         "conversation",
        status:       "imported",
        normalizedId: bizId,
        legacyId:     String(conv.id ?? ""),
        importedAt,
      });
    } catch {
      records.push({
        id:           `conv-err-${conv.id}`,
        type:         "conversation",
        status:       "error",
        normalizedId: "unknown",
        reason:       "Failed to normalize conversation",
        importedAt,
      });
    }
  }

  // ── Phase 5: Apply suppression across all unique businesses ───────────────
  // (Suppression flags are already embedded in outreachFlags on each NormalizedBusiness)
  // Re-evaluate after deduplication to ensure merged flags are correct
  const suppressionSummary = evaluateSuppressionBatch(unique);

  // ── Phase 6: Build report ─────────────────────────────────────────────────
  const completedAt = new Date().toISOString();

  const totalImported     = records.filter((r) => r.status === "imported").length;
  const totalMerged       = records.filter((r) => r.status === "merged").length;
  const totalFlagged      = records.filter((r) => r.status === "flagged").length;
  const totalSkipped      = records.filter((r) => r.status === "skipped").length;
  const totalErrors       = records.filter((r) => r.status === "error").length;

  const report: ImportReport = {
    runId:         id,
    startedAt,
    completedAt,
    source:        payload.source ?? "replit",
    // Totals
    totalBusinesses:         businesses.length,
    totalOutreach:           outreach.length,
    totalConversations:      conversations.length,
    totalMessages:           messages.length,
    totalCustomers:          customers.length,
    // Outcomes
    imported:                totalImported,
    merged:                  totalMerged,
    flagged:                 totalFlagged,
    skipped:                 totalSkipped,
    errors:                  totalErrors,
    // Safety summary (from suppression)
    activeCustomers:         suppressionSummary.blockedCustomer,
    safeForOutreach:         suppressionSummary.allowInitialOutreach,
    suppressedFromOutreach:  unique.length - suppressionSummary.allowInitialOutreach - suppressionSummary.allowFollowupOnly,
    doNotContact:            suppressionSummary.blockedDnc,
    requiresManualReview:    totalFlagged + suppressionSummary.requiresManualReview,
    records,
  };

  return {
    phase:         "complete",
    progress:      100,
    message:       `Import complete — ${businesses.length} businesses processed, ${totalFlagged} flagged for review.`,
    report,
    businesses:    unique,
    outreach:      normalizedOutreach,
    conversations: normalizedConversations,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience: run against mock data
// ─────────────────────────────────────────────────────────────────────────────

export function runMockImport(): ImportState {
  const { MOCK_LEGACY_EXPORT } = require("./mock-legacy-data");
  return runImport(MOCK_LEGACY_EXPORT, []);
}
