// ─────────────────────────────────────────────────────────────────────────────
// Deduper — Identity Matching + Confidence Scoring
//
// Compares incoming normalized records against an existing set to detect
// duplicates before committing. Uses multi-signal scoring:
//   HIGH (auto-merge):  exact phone OR exact email + same city
//   MEDIUM (flag):      same name + same city; OR same phone (different name)
//   LOW (flag):         same name + same category (no contact info match)
//
// Never blindly merges low-confidence matches — flags them for human review.
// ─────────────────────────────────────────────────────────────────────────────

import type { NormalizedBusiness, DedupeResult, DedupeMatch, DedupeConfidence } from "./types";
import { normalizePhone } from "./normalizer";

// ─────────────────────────────────────────────────────────────────────────────
// Text Utilities
// ─────────────────────────────────────────────────────────────────────────────

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(inc|llc|co|corp|company|ltd|the|&|and)\b/g, "")
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCity(city?: string): string {
  if (!city) return "";
  return city.toLowerCase().replace(/[^a-z]/g, "");
}

/** Levenshtein distance for fuzzy name matching */
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    }
  }
  return dp[m][n];
}

/** Names are "similar enough" if within 15% Levenshtein distance */
function namesSimilar(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (na === nb) return true;
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return false;
  return levenshtein(na, nb) / maxLen <= 0.15;
}

// ─────────────────────────────────────────────────────────────────────────────
// Single-record deduplication against an existing collection
// ─────────────────────────────────────────────────────────────────────────────

export function dedupeAgainst(
  incoming: NormalizedBusiness,
  existing: NormalizedBusiness[]
): DedupeResult {
  const inPhone = incoming.phone;
  const inEmail = incoming.email;
  const inName  = incoming.name;
  const inCity  = incoming.city;

  for (const candidate of existing) {
    const matchedOn: string[] = [];
    let confidence: DedupeConfidence | null = null;

    // ── Signal 1: Exact phone match ──────────────────────────────────────────
    if (inPhone && candidate.phone && inPhone === candidate.phone) {
      matchedOn.push("phone");

      if (inEmail && candidate.email && inEmail === candidate.email) {
        matchedOn.push("email");
        confidence = "high";
      } else if (namesSimilar(inName, candidate.name)) {
        matchedOn.push("business_name");
        confidence = "high";
      } else {
        // Same phone, different name — flag for review
        confidence = "medium";
      }
    }

    // ── Signal 2: Exact email match ──────────────────────────────────────────
    if (!confidence && inEmail && candidate.email && inEmail === candidate.email) {
      matchedOn.push("email");
      if (normalizeCity(inCity) === normalizeCity(candidate.city) && inCity) {
        matchedOn.push("city");
        confidence = "high";
      } else {
        confidence = "medium";
      }
    }

    // ── Signal 3: Name + city ────────────────────────────────────────────────
    if (!confidence && namesSimilar(inName, candidate.name)) {
      matchedOn.push("business_name");
      if (normalizeCity(inCity) === normalizeCity(candidate.city) && inCity) {
        matchedOn.push("city");
        confidence = "medium";
      } else if (incoming.category && candidate.category &&
                 incoming.category === candidate.category) {
        matchedOn.push("category");
        confidence = "low";
      }
    }

    // ── Signal 4: Place ID (highest trust external identifier) ───────────────
    if (!confidence && incoming.placeId && candidate.placeId &&
        incoming.placeId === candidate.placeId) {
      matchedOn.push("place_id");
      confidence = "high";
    }

    if (confidence) {
      const action: DedupeMatch["action"] =
        confidence === "high"   ? "merge" :
        confidence === "medium" ? "flag_for_review" : "flag_for_review";

      const reason = buildReason(confidence, matchedOn, incoming, candidate);

      return {
        isNew:        false,
        normalizedId: candidate.id,
        match: {
          incomingId:  incoming.id,
          existingId:  candidate.id,
          confidence,
          matchedOn,
          action,
          reason,
        },
      };
    }
  }

  // No match found — it's a new record
  return { isNew: true, normalizedId: incoming.id };
}

// ─────────────────────────────────────────────────────────────────────────────
// Dedupe an entire batch — detects within-batch duplicates too
// ─────────────────────────────────────────────────────────────────────────────

export interface BatchDedupeResult {
  unique:    NormalizedBusiness[];
  merged:    Array<{ kept: NormalizedBusiness; dropped: NormalizedBusiness; match: DedupeMatch }>;
  flagged:   Array<{ incoming: NormalizedBusiness; candidate: NormalizedBusiness; match: DedupeMatch }>;
}

export function dedupeBatch(
  incoming: NormalizedBusiness[],
  existingInSystem: NormalizedBusiness[] = []
): BatchDedupeResult {
  const unique:  NormalizedBusiness[] = [...existingInSystem];
  const merged:  BatchDedupeResult["merged"]  = [];
  const flagged: BatchDedupeResult["flagged"] = [];

  for (const record of incoming) {
    const result = dedupeAgainst(record, unique);

    if (result.isNew) {
      unique.push(record);
    } else if (result.match) {
      const { match } = result;
      const candidate = unique.find((b) => b.id === match.existingId)!;

      if (match.action === "merge" && match.confidence === "high") {
        // Merge: keep existing, enrich with any new non-null fields
        const enriched = mergeRecords(candidate, record);
        const idx = unique.indexOf(candidate);
        unique[idx] = enriched;
        merged.push({ kept: enriched, dropped: record, match });
      } else {
        // Flag for human review — keep both until resolved
        flagged.push({ incoming: record, candidate, match });
        // Still add incoming as separate entry so we don't lose data
        unique.push({ ...record, id: record.id + "-flagged" });
      }
    }
  }

  return { unique, merged, flagged };
}

// ─────────────────────────────────────────────────────────────────────────────
// Record Merging (high-confidence only)
// ─────────────────────────────────────────────────────────────────────────────

function mergeRecords(
  existing: NormalizedBusiness,
  incoming: NormalizedBusiness
): NormalizedBusiness {
  // Prefer existing status if it's "higher" in the funnel
  const existingRank = statusRank(existing.status);
  const incomingRank = statusRank(incoming.status);
  const status = existingRank >= incomingRank ? existing.status : incoming.status;

  // Merge outreach flags: OR all booleans (additive — once sent, always sent)
  const flags = {
    scraped_already:       existing.outreachFlags.scraped_already       || incoming.outreachFlags.scraped_already,
    outreach_sent_email:   existing.outreachFlags.outreach_sent_email   || incoming.outreachFlags.outreach_sent_email,
    outreach_sent_sms:     existing.outreachFlags.outreach_sent_sms     || incoming.outreachFlags.outreach_sent_sms,
    replied:               existing.outreachFlags.replied               || incoming.outreachFlags.replied,
    intake_sent:           existing.outreachFlags.intake_sent           || incoming.outreachFlags.intake_sent,
    customer_active:       existing.outreachFlags.customer_active       || incoming.outreachFlags.customer_active,
    do_not_contact:        existing.outreachFlags.do_not_contact        || incoming.outreachFlags.do_not_contact,
    safe_for_new_outreach: !existing.outreachFlags.do_not_contact &&
                           !incoming.outreachFlags.do_not_contact &&
                           !existing.outreachFlags.customer_active &&
                           !incoming.outreachFlags.customer_active,
    suppression_reason:    existing.outreachFlags.suppression_reason ?? incoming.outreachFlags.suppression_reason,
  };

  return {
    ...existing,
    // Enrich with incoming non-null fields
    phone:       existing.phone    ?? incoming.phone,
    email:       existing.email    ?? incoming.email,
    website:     existing.website  ?? incoming.website,
    address:     existing.address  ?? incoming.address,
    placeId:     existing.placeId  ?? incoming.placeId,
    notes:       [existing.notes, incoming.notes].filter(Boolean).join(" | ") || undefined,
    status,
    outreachFlags: flags,
    monthlyValue:  existing.monthlyValue ?? incoming.monthlyValue,
    agentId:       existing.agentId      ?? incoming.agentId,
    spotId:        existing.spotId       ?? incoming.spotId,
    campaignId:    existing.campaignId   ?? incoming.campaignId,
    updatedAt:     new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Status Rank (higher = more advanced in funnel)
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_RANK: Record<string, number> = {
  scraped:          1,
  not_contacted:    2,
  contacted:        3,
  replied:          4,
  interested:       5,
  intake_sent:      6,
  booked:           7,
  active_customer:  8,
  closed_lost:      0,
  do_not_contact:   0,
};

function statusRank(s: string): number {
  return STATUS_RANK[s] ?? 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Human-readable reason builder
// ─────────────────────────────────────────────────────────────────────────────

function buildReason(
  confidence: DedupeConfidence,
  matchedOn: string[],
  incoming: NormalizedBusiness,
  candidate: NormalizedBusiness
): string {
  const signals = matchedOn.join(" + ");
  if (confidence === "high") {
    return `Auto-merged: matched on ${signals}. Existing record (${candidate.name}) enriched with incoming data.`;
  }
  if (confidence === "medium") {
    return `Possible duplicate: matched on ${signals}. "${incoming.name}" vs. "${candidate.name}" — requires manual review.`;
  }
  return `Low-confidence match on ${signals}. "${incoming.name}" vs. "${candidate.name}" — flagged for human review.`;
}
