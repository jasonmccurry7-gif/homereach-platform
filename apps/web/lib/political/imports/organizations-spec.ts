// ─────────────────────────────────────────────────────────────────────────────
// Organizations importer spec.
//
// Accepts CSV from FEC committee bulk data (cm.txt converted to CSV), Ohio
// Secretary of State PAC filings (CSV download), or any other operator-
// prepared CSV that conforms to the column shape below.
//
// Required: legal_name, org_type, state.
// Dedup: by EIN (case-insensitive) when present, else by (lower(legal_name),
//        upper(state)).
// ─────────────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ParseResult, ImporterSpec } from "./spec";
import { verifyAgainstAliases } from "./header-utils";

export type OrgType =
  | "campaign_committee"
  | "pac"
  | "super_pac"
  | "party_committee"
  | "advocacy"
  | "nonprofit_501c4"
  | "other";

export interface OrganizationPayload {
  legal_name: string;
  display_name: string | null;
  org_type: OrgType;
  ein: string | null;
  state: string;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  primary_contact_phone: string | null;
  website: string | null;
  notes: string | null;
}

const ALIASES: Record<string, readonly string[]> = {
  legal_name:            ["legal_name", "name", "committee_name", "organization_name", "org_name"],
  display_name:          ["display_name", "short_name", "common_name"],
  org_type:              ["org_type", "type", "committee_type", "organization_type"],
  ein:                   ["ein", "tax_id", "irs_ein"],
  state:                 ["state", "registration_state", "st"],
  primary_contact_name:  ["primary_contact_name", "contact_name", "treasurer", "treasurer_name"],
  primary_contact_email: ["primary_contact_email", "contact_email", "email"],
  primary_contact_phone: ["primary_contact_phone", "contact_phone", "phone"],
  website:               ["website", "url", "web"],
  notes:                 ["notes", "description"],
};

const REQUIRED = ["legal_name", "org_type", "state"] as const;
const OPTIONAL = [
  "display_name", "ein",
  "primary_contact_name", "primary_contact_email", "primary_contact_phone",
  "website", "notes",
] as const;

const VALID_ORG_TYPES = new Set<OrgType>([
  "campaign_committee",
  "pac",
  "super_pac",
  "party_committee",
  "advocacy",
  "nonprofit_501c4",
  "other",
]);

// FEC committee_type → our org_type. FEC uses single-letter codes (cm.txt
// CMTE_TP). Ref: FEC bulk-data documentation, committee master file.
const FEC_TYPE_MAP: Record<string, OrgType> = {
  P: "campaign_committee", // Presidential
  H: "campaign_committee", // House
  S: "campaign_committee", // Senate
  Q: "pac",                // PAC, qualified
  N: "pac",                // PAC, non-qualified
  O: "super_pac",          // Super PAC (independent expenditure-only)
  V: "super_pac",          // Hybrid PAC (Carey)
  W: "super_pac",          // Hybrid PAC, non-qualified
  X: "party_committee",    // Party, non-qualified
  Y: "party_committee",    // Party, qualified
  Z: "party_committee",    // National party non-federal account
  I: "other",              // Independent expenditure-only filer (501c)
  C: "advocacy",           // Communication cost
  E: "other",              // Electioneering communication
  D: "other",              // Delegate committee
  U: "other",              // Single-candidate independent expenditure
};

function pick(raw: Record<string, string>, field: string): string | undefined {
  for (const alias of ALIASES[field] ?? [field]) {
    if (raw[alias] !== undefined && raw[alias] !== "") return raw[alias];
  }
  return undefined;
}

function normalizeOrgType(v: string | undefined): OrgType | null {
  if (!v) return null;
  const s = v.trim();
  // Accept exact enum value (case-insensitive)
  const lower = s.toLowerCase();
  if (VALID_ORG_TYPES.has(lower as OrgType)) return lower as OrgType;

  // Single-letter FEC code?
  if (s.length === 1) {
    const mapped = FEC_TYPE_MAP[s.toUpperCase()];
    if (mapped) return mapped;
  }

  // Friendly synonyms
  if (/super.?pac/i.test(s)) return "super_pac";
  if (/political.action.committee|^pac$/i.test(s)) return "pac";
  if (/501.?c.?4/i.test(s)) return "nonprofit_501c4";
  if (/party/i.test(s)) return "party_committee";
  if (/campaign|candidate.committee/i.test(s)) return "campaign_committee";
  if (/advocacy/i.test(s)) return "advocacy";

  return null;
}

function normalizeEin(v: string | undefined): string | null {
  if (!v) return null;
  // Strip non-digits, then format as ##-#######
  const digits = v.replace(/\D/g, "");
  if (digits.length !== 9) return null;
  return `${digits.slice(0, 2)}-${digits.slice(2)}`;
}

function normalizeEmail(v: string | undefined): string | null {
  if (!v) return null;
  const trimmed = v.trim().toLowerCase();
  // Loose check; the source is responsible for cleaning, we just sanity-test
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;
  return trimmed;
}

function normalizeWebsite(v: string | undefined): string | null {
  if (!v) return null;
  let s = v.trim();
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  try {
    const url = new URL(s);
    return url.toString();
  } catch {
    return null;
  }
}

export function makeOrganizationsSpec(): ImporterSpec<OrganizationPayload> {
  return {
    kind: "organizations",
    requiredColumns: REQUIRED,
    optionalColumns: OPTIONAL,

    verifyHeader(headers: string[]) {
      return verifyAgainstAliases(headers, REQUIRED, OPTIONAL, ALIASES);
    },

    parseRow(raw): ParseResult<OrganizationPayload> {
      const legalName = pick(raw, "legal_name")?.trim();
      const orgTypeRaw = pick(raw, "org_type");
      const orgType = normalizeOrgType(orgTypeRaw);
      const state = pick(raw, "state")?.toUpperCase().trim();

      if (!legalName || legalName.length < 2) {
        return { ok: false, reason: "Missing or too-short 'legal_name'" };
      }
      if (!orgType) {
        return {
          ok: false,
          reason: `Invalid 'org_type': ${JSON.stringify(orgTypeRaw ?? "")} (expected one of: ${[...VALID_ORG_TYPES].join(", ")} or an FEC committee_type code)`,
        };
      }
      if (!state || state.length !== 2) {
        return { ok: false, reason: `Invalid 'state': ${JSON.stringify(state ?? "")} (need 2-letter US code)` };
      }

      const einRaw = pick(raw, "ein");
      const ein = einRaw ? normalizeEin(einRaw) : null;
      // EIN was provided but failed validation? Reject — wrong-format EINs
      // are a data quality bug we don't want silently dropped.
      if (einRaw && !ein) {
        return { ok: false, reason: `Invalid 'ein': ${JSON.stringify(einRaw)} (need 9 digits)` };
      }

      return {
        ok: true,
        payload: {
          legal_name: legalName,
          display_name: pick(raw, "display_name")?.trim() || null,
          org_type: orgType,
          ein,
          state,
          primary_contact_name: pick(raw, "primary_contact_name")?.trim() || null,
          primary_contact_email: normalizeEmail(pick(raw, "primary_contact_email")),
          primary_contact_phone: pick(raw, "primary_contact_phone")?.trim() || null,
          website: normalizeWebsite(pick(raw, "website")),
          notes: pick(raw, "notes")?.trim() || null,
        },
      };
    },

    dedupKey(p) {
      if (p.ein) return `ein:${p.ein.toLowerCase()}`;
      return `name:${p.legal_name.toLowerCase().trim()}|${p.state.toUpperCase()}`;
    },

    async loadExistingKeys(supabase) {
      const keys = new Set<string>();
      const pageSize = 1000;
      let from = 0;
      const maxRows = 100_000;

      while (from < maxRows) {
        const { data, error } = await supabase
          .from("political_organizations")
          .select("legal_name, state, ein")
          .range(from, from + pageSize - 1);

        if (error) throw new Error(`loadExistingKeys (organizations): ${error.message}`);
        if (!data || data.length === 0) break;

        for (const r of data) {
          if (r.ein) {
            keys.add(`ein:${String(r.ein).toLowerCase()}`);
          } else if (r.legal_name) {
            const st = String(r.state ?? "").toUpperCase();
            keys.add(`name:${String(r.legal_name).toLowerCase().trim()}|${st}`);
          }
        }

        if (data.length < pageSize) break;
        from += pageSize;
      }

      return keys;
    },

    async insertBatch(supabase, payloads, importId) {
      if (payloads.length === 0) return 0;
      const chunkSize = 500;
      let inserted = 0;

      for (let i = 0; i < payloads.length; i += chunkSize) {
        const chunk = payloads.slice(i, i + chunkSize).map((p) => ({
          ...p,
          import_id: importId,
        }));

        const { data, error } = await supabase
          .from("political_organizations")
          .insert(chunk)
          .select("id");

        if (error) {
          throw new Error(`insertBatch (organizations): ${error.message}`);
        }
        inserted += data?.length ?? 0;
      }
      return inserted;
    },
  };
}
