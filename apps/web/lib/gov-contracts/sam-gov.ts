import type { GovContractOpportunity } from "./types";
import { recommendedActionFor, scoreGovContractOpportunity } from "./scoring";

const SAM_OPPORTUNITIES_URL =
  process.env.SAM_GOV_OPPORTUNITIES_URL || "https://api.sam.gov/opportunities/v2/search";

interface SamGovPlace {
  city?: { name?: string | null } | null;
  state?: { code?: string | null } | null;
  zip?: string | null;
  country?: { code?: string | null } | null;
}

interface SamGovOpportunityRecord {
  noticeId?: string;
  title?: string;
  solicitationNumber?: string | null;
  department?: string | null;
  subTier?: string | null;
  office?: string | null;
  postedDate?: string | null;
  type?: string | null;
  baseType?: string | null;
  archiveDate?: string | null;
  typeOfSetAside?: string | null;
  typeOfSetAsideDescription?: string | null;
  responseDeadLine?: string | null;
  naicsCode?: string | null;
  classificationCode?: string | null;
  active?: string | null;
  award?: { amount?: string | number | null } | null;
  placeOfPerformance?: SamGovPlace | null;
  uiLink?: string | null;
  description?: string | null;
  resourceLinks?: string[] | null;
  links?: Array<{ href?: string | null; title?: string | null; type?: string | null }> | null;
}

interface SamGovSearchResponse {
  totalRecords?: number;
  limit?: number;
  offset?: number;
  opportunitiesData?: SamGovOpportunityRecord[];
}

export interface SamGovSearchParams {
  keyword?: string;
  postedFrom?: string;
  postedTo?: string;
  dueFrom?: string;
  dueTo?: string;
  naics?: string;
  psc?: string;
  state?: string;
  setAside?: string;
  noticeType?: string;
  limit?: number;
  offset?: number;
}

function toSamDate(date: Date) {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${date.getFullYear()}`;
}

function defaultPostedFrom() {
  const d = new Date();
  d.setDate(d.getDate() - 14);
  return toSamDate(d);
}

function defaultPostedTo() {
  return toSamDate(new Date());
}

function parseMoneyCents(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number.parseFloat(String(value).replace(/[$,]/g, ""));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

function normalizeDueDate(value: string | null | undefined) {
  if (!value || value === "null") return null;
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  return value;
}

function normalizePlace(place: SamGovPlace | null | undefined) {
  const city = place?.city?.name ?? null;
  const state = place?.state?.code ?? null;
  const zip = place?.zip ?? null;
  const country = place?.country?.code ?? "USA";
  return {
    city,
    state,
    zip,
    country,
    label: [city, state, zip].filter(Boolean).join(", ") || "Place of performance not listed",
  };
}

function normalizeUiLink(record: SamGovOpportunityRecord) {
  const uiLink = record.uiLink && record.uiLink !== "null" ? record.uiLink : null;
  if (uiLink) return uiLink;
  if (record.noticeId) return `https://sam.gov/opp/${encodeURIComponent(record.noticeId)}/view`;
  return null;
}

export function mapSamGovRecord(record: SamGovOpportunityRecord): GovContractOpportunity {
  const sourceId = record.noticeId ?? record.solicitationNumber ?? crypto.randomUUID();
  const location = normalizePlace(record.placeOfPerformance);
  const estimatedValueCents = parseMoneyCents(record.award?.amount);
  const dueDate = normalizeDueDate(record.responseDeadLine);
  const title = record.title?.trim() || "Untitled SAM.gov opportunity";
  const agency = record.subTier || record.department || "Agency not listed";
  const summary =
    "Live SAM.gov opportunity. Review the linked notice, attachments, amendments, and submission instructions before any go/no-go, pricing, or proposal action.";

  const scored = scoreGovContractOpportunity({
    title,
    agency,
    noticeType: record.type,
    naicsCode: record.naicsCode,
    pscCode: record.classificationCode,
    setAsideDescription: record.typeOfSetAsideDescription,
    dueDate,
    estimatedValueCents,
    locationState: location.state,
    summary,
  });

  const opportunity: GovContractOpportunity = {
    id: sourceId,
    sourceSystem: "sam.gov",
    sourceId,
    sourceUrl: normalizeUiLink(record),
    title,
    agency,
    department: record.department ?? null,
    office: record.office ?? null,
    solicitationNumber: record.solicitationNumber?.trim() || null,
    noticeType: record.type ?? "Notice",
    baseNoticeType: record.baseType ?? null,
    postedDate: record.postedDate ?? null,
    dueDate,
    questionsDeadline: null,
    siteVisitAt: null,
    naicsCode: record.naicsCode ?? null,
    pscCode: record.classificationCode ?? null,
    setAsideCode: record.typeOfSetAside ?? null,
    setAsideDescription: record.typeOfSetAsideDescription ?? null,
    estimatedValueCents,
    awardAmountCents: estimatedValueCents,
    location,
    pipelineStatus: "new",
    ...scored,
    recommendedNextAction: "",
    summary,
    complianceNotes: [
      "AI score is advisory only.",
      "Human approval is required before pricing, certification claims, subcontractor commitments, or bid submission.",
      "Read the official SAM.gov notice and all attachments before any external action.",
    ],
    attachments: [
      ...(record.description && record.description !== "null"
        ? [{ label: "SAM.gov description", url: record.description, type: "description" }]
        : []),
      ...(record.resourceLinks ?? []).map((url, index) => ({
        label: `Resource link ${index + 1}`,
        url,
        type: "resource",
      })),
    ],
    amendmentCount: 0,
    missingItems: scored.missingItems,
    lastSyncedAt: new Date().toISOString(),
    isSample: false,
  };

  opportunity.recommendedNextAction = recommendedActionFor(opportunity);
  return opportunity;
}

export async function searchSamGovOpportunities(params: SamGovSearchParams = {}) {
  const apiKey = process.env.SAM_GOV_API_KEY;
  if (!apiKey) {
    return {
      ok: false as const,
      status: 503,
      error: "SAM_GOV_API_KEY is not configured.",
      opportunities: [],
      totalRecords: 0,
    };
  }

  const url = new URL(SAM_OPPORTUNITIES_URL);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("postedFrom", params.postedFrom || defaultPostedFrom());
  url.searchParams.set("postedTo", params.postedTo || defaultPostedTo());
  url.searchParams.set("limit", String(Math.min(Math.max(params.limit ?? 50, 1), 1000)));
  url.searchParams.set("offset", String(Math.max(params.offset ?? 0, 0)));

  if (params.keyword) url.searchParams.set("title", params.keyword);
  if (params.naics) url.searchParams.set("ncode", params.naics);
  if (params.psc) url.searchParams.set("ccode", params.psc);
  if (params.state) url.searchParams.set("state", params.state);
  if (params.setAside) url.searchParams.set("typeOfSetAside", params.setAside);
  if (params.noticeType) url.searchParams.set("ptype", params.noticeType);
  if (params.dueFrom) url.searchParams.set("rdlfrom", params.dueFrom);
  if (params.dueTo) url.searchParams.set("rdlto", params.dueTo);

  const response = await fetch(url, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    return {
      ok: false as const,
      status: response.status,
      error: `SAM.gov request failed with HTTP ${response.status}.`,
      opportunities: [],
      totalRecords: 0,
    };
  }

  const payload = (await response.json()) as SamGovSearchResponse;
  const records = payload.opportunitiesData ?? [];

  return {
    ok: true as const,
    status: 200,
    opportunities: records.map(mapSamGovRecord),
    totalRecords: payload.totalRecords ?? records.length,
    raw: payload,
  };
}
