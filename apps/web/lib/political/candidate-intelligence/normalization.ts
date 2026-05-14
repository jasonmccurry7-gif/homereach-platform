import { createHash } from "node:crypto";
import type { DataConfidence, NormalizedCandidateIntelRecord, OfficeLevel } from "./types";

const SUFFIX_RE = /\b(jr|sr|ii|iii|iv|v|phd|md|esq)\b/gi;
const TITLE_RE = /\b(the honorable|honorable|hon|mr|mrs|ms|miss|dr|judge|justice|rep|sen|mayor)\b/gi;

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeCandidateName(name: string): string {
  return normalizeWhitespace(
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(TITLE_RE, " ")
      .replace(SUFFIX_RE, " ")
      .replace(/[^a-z0-9\s'-]/g, " ")
      .replace(/[-']/g, " "),
  );
}

export function normalizeState(value: unknown): string | null {
  const state = String(value ?? "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(state) ? state : null;
}

export function normalizeParty(value: unknown): string | null {
  const raw = normalizeWhitespace(String(value ?? ""));
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (["d", "dem", "democrat", "democratic"].includes(lower)) return "Democratic";
  if (["r", "rep", "republican", "gop"].includes(lower)) return "Republican";
  if (["i", "ind", "independent"].includes(lower)) return "Independent";
  if (["nonpartisan", "n/a", "na", "none"].includes(lower)) return "Nonpartisan";
  return raw;
}

export function normalizeFilingStatus(value: unknown): string | null {
  const raw = normalizeWhitespace(String(value ?? ""));
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (lower.includes("certified")) return "certified";
  if (lower.includes("filed") || lower.includes("active") || lower === "c") return "filed";
  if (lower.includes("pending")) return "pending";
  if (lower.includes("withdraw")) return "withdrawn";
  if (lower.includes("disqual") || lower.includes("reject")) return "rejected";
  return lower.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export function inferOfficeLevel(office: unknown): OfficeLevel {
  const value = String(office ?? "").toLowerCase();
  if (!value) return "other";
  if (value.includes("president") || value.includes("senate") || value.includes("representative") || value.includes("congress")) {
    return "federal";
  }
  if (value.includes("governor") || value.includes("state house") || value.includes("state senate") || value.includes("attorney general") || value.includes("secretary of state")) {
    return "state";
  }
  if (value.includes("county") || value.includes("sheriff") || value.includes("commissioner") || value.includes("prosecutor")) {
    return "county";
  }
  if (value.includes("school")) return "school_board";
  if (value.includes("judge") || value.includes("judicial") || value.includes("court") || value.includes("justice")) {
    return "judicial";
  }
  if (value.includes("mayor") || value.includes("council") || value.includes("municipal")) return "municipal";
  if (value.includes("township")) return "township";
  if (value.includes("measure") || value.includes("issue") || value.includes("levy") || value.includes("initiative")) {
    return "ballot_measure";
  }
  return "other";
}

export function inferOfficeHierarchy(officeName: string | null | undefined, officeLevel: OfficeLevel): string[] {
  const hierarchy: string[] = [officeLevel];
  const office = String(officeName ?? "").toLowerCase();
  if (office.includes("state house")) hierarchy.push("state_house");
  if (office.includes("state senate")) hierarchy.push("state_senate");
  if (office.includes("congress") || office.includes("representative")) hierarchy.push("congressional");
  if (office.includes("school")) hierarchy.push("school_board");
  if (office.includes("judge") || office.includes("court")) hierarchy.push("judicial");
  return Array.from(new Set(hierarchy));
}

export function sha256Json(value: unknown): string {
  return createHash("sha256")
    .update(stableStringify(value))
    .digest("hex");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`)
    .join(",")}}`;
}

export function buildCandidateDedupeKey(record: NormalizedCandidateIntelRecord): string {
  return [
    normalizeCandidateName(record.candidateName),
    record.officeCode ?? normalizeCandidateName(record.officeName ?? ""),
    normalizeState(record.state) ?? "",
    normalizeCandidateName(record.districtLabel ?? record.jurisdictionName ?? ""),
    record.electionYear ?? (record.electionDate ? record.electionDate.slice(0, 4) : ""),
  ].join("|");
}

export function buildSearchText(record: NormalizedCandidateIntelRecord): string {
  return normalizeWhitespace(
    [
      record.candidateName,
      record.displayName,
      record.party,
      record.officeName,
      record.officeLevel,
      record.state,
      record.jurisdictionName,
      record.districtLabel,
      record.electionName,
      record.electionDate,
      record.filingStatus,
      record.campaignEmail,
      record.campaignPhone,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

export function confidenceFromSource(sourceKey: string, completeness: number): number {
  const sourceBase =
    sourceKey.startsWith("fec_") ? 25 :
    sourceKey.includes("sos") || sourceKey.includes("boe") ? 24 :
    sourceKey.includes("google") ? 18 :
    sourceKey.includes("democracy_works") ? 18 :
    sourceKey.includes("ballotpedia") ? 17 :
    sourceKey.includes("serpapi") ? 14 :
    10;
  return Math.max(0, Math.min(100, sourceBase + completeness));
}

export function deriveDataConfidence(sourceKey: string, hasElectionDate: boolean): DataConfidence {
  if (sourceKey.includes("sos") || sourceKey.includes("boe") || sourceKey.startsWith("fec_")) {
    return hasElectionDate ? "exact" : "public_aggregate";
  }
  if (sourceKey.includes("google") || sourceKey.includes("democracy_works") || sourceKey.includes("ballotpedia")) {
    return "paid_vendor";
  }
  if (sourceKey.includes("serpapi")) {
    return "public_aggregate";
  }
  return "estimated";
}

export function isoDate(value: unknown): string | null {
  if (!value) return null;
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export function electionYearFrom(date: string | null | undefined, fallback?: number | null): number | null {
  if (date) return Number.parseInt(date.slice(0, 4), 10);
  return fallback ?? null;
}
