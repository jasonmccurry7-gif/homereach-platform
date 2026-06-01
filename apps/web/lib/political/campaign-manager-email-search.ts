import "server-only";

import {
  normalizePoliticalOutreachEmail,
  politicalCandidateQualityBlockers,
} from "./candidate-launch-agent";
import { isCandidateSerpApiEnabled } from "./candidate-intelligence/providers/serpapi";
import { resolveEnvAlias } from "@/lib/app-url";
import type { CandidateRow } from "./queries";

type SupabaseLooseClient = {
  from(table: string): any;
};

type CandidateSearchRow = {
  id: string;
  candidate_name: string;
  office_sought: string | null;
  state: string;
  geography_type: string | null;
  geography_value: string | null;
  district_type: string | null;
  candidate_status: string;
  election_date: string | null;
  election_year: number | null;
  party_optional_public: string | null;
  campaign_website: string | null;
  campaign_email: string | null;
  campaign_phone: string | null;
  facebook_url: string | null;
  messenger_url: string | null;
  campaign_manager_name: string | null;
  campaign_manager_email: string | null;
  source_url: string | null;
  source_type: string | null;
  data_verified_at: string | null;
  completeness_score: number | null;
  priority_score: number | null;
  last_contacted_at: string | null;
  next_follow_up_at: string | null;
  notes: string | null;
  do_not_contact: boolean;
  do_not_email: boolean;
  do_not_text: boolean;
  created_at: string;
  updated_at: string;
};

export type CampaignEmailFinding = {
  email: string;
  role: "Campaign Manager" | "Campaign Contact" | "Press Contact" | "Treasurer" | "General Campaign Email";
  confidence: number;
  sourceUrl: string;
  evidence: string;
  isManagerLikely: boolean;
};

export type CampaignManagerEmailSearchResult = {
  candidateId: string;
  candidateName: string;
  status: "updated" | "found_existing" | "not_found" | "skipped";
  reason?: string;
  findings: CampaignEmailFinding[];
  selectedEmail: string | null;
  selectedRole: string | null;
  contactsInserted: number;
  candidateUpdated: boolean;
};

export type CampaignManagerEmailSearchSummary = {
  scanned: number;
  candidatesUpdated: number;
  contactsInserted: number;
  emailsFound: number;
  skipped: number;
  results: CampaignManagerEmailSearchResult[];
};

export type CampaignManagerEmailSearchOptions = {
  candidateId?: string;
  limit?: number;
  force?: boolean;
  includeSearchEngine?: boolean;
  maxPagesPerCandidate?: number;
  actorUserId?: string | null;
};

const CANDIDATE_COLUMNS = [
  "id",
  "candidate_name",
  "office_sought",
  "state",
  "geography_type",
  "geography_value",
  "district_type",
  "candidate_status",
  "election_date",
  "election_year",
  "party_optional_public",
  "campaign_website",
  "campaign_email",
  "campaign_phone",
  "facebook_url",
  "messenger_url",
  "campaign_manager_name",
  "campaign_manager_email",
  "source_url",
  "source_type",
  "data_verified_at",
  "completeness_score",
  "priority_score",
  "last_contacted_at",
  "next_follow_up_at",
  "notes",
  "do_not_contact",
  "do_not_email",
  "do_not_text",
  "created_at",
  "updated_at",
].join(", ");

const CONTACT_PAGE_PATHS = [
  "",
  "/contact",
  "/about",
  "/team",
  "/press",
  "/media",
  "/volunteer",
  "/get-involved",
  "/privacy",
];

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const MANAGER_CONTEXT =
  /\b(campaign\s+manager|campaign\s+director|manager|chief\s+of\s+staff|general\s+consultant|senior\s+advisor|field\s+director)\b/i;
const PRESS_CONTEXT = /\b(press|media|communications?|comms|spokesperson)\b/i;
const TREASURER_CONTEXT = /\b(treasurer|finance\s+director|compliance)\b/i;
const CAMPAIGN_CONTEXT = /\b(campaign|committee|contact|team|office|volunteer|vote|elect|friends\s+of)\b/i;
const LOW_VALUE_LOCAL_PARTS = new Set(["noreply", "no-reply", "donotreply", "do-not-reply", "webmaster", "admin"]);

function toCandidateRow(row: CandidateSearchRow): CandidateRow {
  return {
    id: row.id,
    candidateName: row.candidate_name,
    officeSought: row.office_sought,
    state: row.state,
    geographyType: row.geography_type as CandidateRow["geographyType"],
    geographyValue: row.geography_value,
    districtType: row.district_type as CandidateRow["districtType"],
    candidateStatus: row.candidate_status as CandidateRow["candidateStatus"],
    electionDate: row.election_date,
    electionYear: row.election_year,
    partyOptionalPublic: row.party_optional_public,
    campaignWebsite: row.campaign_website,
    campaignEmail: row.campaign_email,
    campaignPhone: row.campaign_phone,
    facebookUrl: row.facebook_url,
    messengerUrl: row.messenger_url,
    campaignManagerName: row.campaign_manager_name,
    campaignManagerEmail: row.campaign_manager_email,
    sourceUrl: row.source_url,
    sourceType: row.source_type,
    dataVerifiedAt: row.data_verified_at,
    completenessScore: row.completeness_score,
    priorityScore: row.priority_score,
    lastContactedAt: row.last_contacted_at,
    nextFollowUpAt: row.next_follow_up_at,
    notes: row.notes,
    doNotContact: row.do_not_contact,
    doNotEmail: row.do_not_email,
    doNotText: row.do_not_text,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeUrl(value: string | null | undefined): URL | null {
  const raw = value?.trim();
  if (!raw) return null;
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withProtocol);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return url;
  } catch {
    return null;
  }
}

function isFetchableCampaignSite(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  return !(
    host.includes("facebook.com") ||
    host.includes("messenger.com") ||
    host.includes("twitter.com") ||
    host.includes("x.com") ||
    host.includes("instagram.com") ||
    host.includes("linkedin.com") ||
    host.includes("ballotpedia.org") ||
    host.includes("fec.gov") ||
    host.includes("google.com")
  );
}

function urlsForBase(base: URL, maxPages: number): string[] {
  const urls = new Set<string>();
  for (const path of CONTACT_PAGE_PATHS) {
    if (urls.size >= maxPages) break;
    const url = new URL(path || "/", base.origin);
    urls.add(url.toString());
  }
  return Array.from(urls);
}

function candidateSiteUrls(candidate: CandidateSearchRow, maxPages: number): string[] {
  const base = normalizeUrl(candidate.campaign_website) ?? normalizeUrl(candidate.source_url);
  if (!base || !isFetchableCampaignSite(base)) return [];
  return urlsForBase(base, maxPages);
}

function candidateNameParts(candidateName: string): string[] {
  return primaryCandidateSearchName(candidateName)
    .toLowerCase()
    .split(/\s+/)
    .map((part) => part.replace(/[^a-z0-9]/g, ""))
    .filter((part) => part.length > 2);
}

function primaryCandidateSearchName(candidateName: string): string {
  return candidateName.split(/\s+(?:and|&)\s+/i)[0]?.trim() || candidateName.trim();
}

function isLikelyCampaignResult(candidate: CandidateSearchRow, link: string | null, title: string, snippet: string) {
  const url = normalizeUrl(link);
  if (!url || !isFetchableCampaignSite(url)) return false;
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const combined = `${title} ${snippet} ${host}`.toLowerCase();
  const nameParts = candidateNameParts(candidate.candidate_name);
  const nameMatch = nameParts.some((part) => host.includes(part) || combined.includes(part));
  const campaignLanguage = /\b(campaign|committee|official|vote|elect|contact|team|press)\b/i.test(combined);
  return nameMatch && campaignLanguage;
}

function serpApiQueries(candidate: CandidateSearchRow): string[] {
  const state = candidate.state ? candidate.state.toUpperCase() : "";
  const office = candidate.office_sought ?? "";
  const name = primaryCandidateSearchName(candidate.candidate_name);
  return [
    `"${name}" "${state}" campaign manager email`,
    `"${name}" "${office}" campaign contact email`,
    `"${name}" official campaign contact`,
  ].filter((query, index, arr) => query.trim() && arr.indexOf(query) === index);
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number.parseInt(dec, 10)))
    .replace(/&commat;/gi, "@")
    .replace(/&period;/gi, ".")
    .replace(/&amp;/gi, "&")
    .replace(/&nbsp;/gi, " ");
}

function stripHtml(value: string): string {
  return decodeHtmlEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeObfuscatedEmails(value: string): string {
  return value
    .replace(/\s*(?:\[|\()(?:at|@)(?:\]|\))\s*/gi, "@")
    .replace(/\s*(?:\[|\()(?:dot|\.)(?:\]|\))\s*/gi, ".")
    .replace(/\s+at\s+/gi, "@")
    .replace(/\s+dot\s+/gi, ".");
}

function emailContext(text: string, email: string): string {
  const index = text.toLowerCase().indexOf(email.toLowerCase());
  if (index < 0) return text.slice(0, 240);
  const start = Math.max(0, index - 160);
  const end = Math.min(text.length, index + email.length + 160);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

function scoreEmail(email: string, sourceUrl: string, context: string): CampaignEmailFinding | null {
  const normalized = normalizePoliticalOutreachEmail(email);
  if (!normalized) return null;

  const [local = "", domain = ""] = normalized.split("@");
  if (!local || !domain || LOW_VALUE_LOCAL_PARTS.has(local)) return null;
  if (/\.(png|jpg|jpeg|gif|webp|svg|pdf)$/i.test(normalized)) return null;

  const lowerContext = context.toLowerCase();
  const source = sourceUrl.toLowerCase();
  let confidence = 48;
  let role: CampaignEmailFinding["role"] = "General Campaign Email";

  if (CAMPAIGN_CONTEXT.test(lowerContext)) confidence += 14;
  if (MANAGER_CONTEXT.test(lowerContext)) {
    confidence += 30;
    role = "Campaign Manager";
  } else if (PRESS_CONTEXT.test(lowerContext)) {
    confidence += 18;
    role = "Press Contact";
  } else if (TREASURER_CONTEXT.test(lowerContext)) {
    confidence += 12;
    role = "Treasurer";
  } else if (/^(campaign|info|contact|team|hello|press|media|office|vote|elect)$/i.test(local)) {
    confidence += 12;
    role = "Campaign Contact";
  }

  if (source.includes("/contact") || source.includes("/team") || source.includes("/about")) confidence += 10;
  if (source.includes("/press") || source.includes("/media")) confidence += 6;
  if (/(gmail|outlook|hotmail|yahoo|icloud)\.com$/i.test(domain)) confidence -= 4;
  if (/(privacy|terms|donorbox|actblue|anedot|winred|ngpvan|nationbuilder|squarespace|wixstatic)/i.test(lowerContext)) {
    confidence -= 10;
  }

  confidence = Math.max(20, Math.min(98, confidence));

  return {
    email: normalized,
    role,
    confidence,
    sourceUrl,
    evidence: context.slice(0, 300),
    isManagerLikely: role === "Campaign Manager",
  };
}

function extractEmailsFromHtml(html: string, sourceUrl: string): CampaignEmailFinding[] {
  const decoded = decodeHtmlEntities(html);
  const text = normalizeObfuscatedEmails(stripHtml(decoded));
  const rawSources = [decoded, text].join(" ");
  const emails = new Set<string>();
  for (const match of rawSources.matchAll(EMAIL_PATTERN)) {
    const normalized = normalizePoliticalOutreachEmail(match[0]);
    if (normalized) emails.add(normalized);
  }

  return Array.from(emails)
    .map((email) => scoreEmail(email, sourceUrl, emailContext(text, email)))
    .filter((finding): finding is CampaignEmailFinding => Boolean(finding));
}

async function discoverCandidateUrlsWithSerpApi(
  candidate: CandidateSearchRow,
  maxUrls: number,
): Promise<{ urls: string[]; findings: CampaignEmailFinding[] }> {
  const key = resolveEnvAlias("SERPAPI_KEY", "SERP_API", "SERPAPI_API_KEY");
  if (!key || !isCandidateSerpApiEnabled()) return { urls: [], findings: [] };

  const urls = new Set<string>();
  const findings = new Map<string, CampaignEmailFinding>();

  for (const query of serpApiQueries(candidate)) {
    if (urls.size >= maxUrls) break;
    const url = new URL("https://serpapi.com/search.json");
    url.searchParams.set("engine", "google");
    url.searchParams.set("q", query);
    url.searchParams.set("api_key", key);
    url.searchParams.set("num", "8");
    url.searchParams.set("hl", "en");
    url.searchParams.set("gl", "us");
    if (candidate.state) url.searchParams.set("location", `${candidate.state.toUpperCase()}, United States`);

    const response = await fetch(url, { headers: { accept: "application/json" }, cache: "no-store" });
    if (!response.ok) continue;
    const payload = (await response.json().catch(() => ({}))) as {
      organic_results?: Array<{ title?: string; link?: string; snippet?: string }>;
    };

    for (const result of payload.organic_results ?? []) {
      const title = result.title ?? "";
      const link = result.link ?? "";
      const snippet = result.snippet ?? "";
      const text = normalizeObfuscatedEmails(stripHtml(`${title} ${snippet}`));
      for (const match of text.matchAll(EMAIL_PATTERN)) {
        const finding = scoreEmail(match[0], link || "SerpAPI result snippet", emailContext(text, match[0]));
        if (finding) findings.set(finding.email, finding);
      }

      if (!isLikelyCampaignResult(candidate, link, title, snippet)) continue;
      const parsed = normalizeUrl(link);
      if (!parsed) continue;
      for (const discovered of urlsForBase(parsed, 4)) {
        if (urls.size >= maxUrls) break;
        urls.add(discovered);
      }
    }
  }

  return { urls: Array.from(urls), findings: Array.from(findings.values()) };
}

async function fetchPage(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "HomeReachBot/1.0 (+https://home-reach.com; campaign contact verification; human-reviewed outreach)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("text/html")) return null;
    return await response.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function findCandidateEmails(
  candidate: CandidateSearchRow,
  maxPages: number,
  includeSearchEngine: boolean,
): Promise<CampaignEmailFinding[]> {
  const findingsByEmail = new Map<string, CampaignEmailFinding>();
  const urls = new Set(candidateSiteUrls(candidate, maxPages));

  if (includeSearchEngine) {
    const discovered = await discoverCandidateUrlsWithSerpApi(candidate, maxPages);
    for (const url of discovered.urls) urls.add(url);
    for (const finding of discovered.findings) {
      const existing = findingsByEmail.get(finding.email);
      if (!existing || finding.confidence > existing.confidence) {
        findingsByEmail.set(finding.email, finding);
      }
    }
  }

  for (const url of Array.from(urls).slice(0, maxPages)) {
    const html = await fetchPage(url);
    if (!html) continue;
    for (const finding of extractEmailsFromHtml(html, url)) {
      const existing = findingsByEmail.get(finding.email);
      if (!existing || finding.confidence > existing.confidence) {
        findingsByEmail.set(finding.email, finding);
      }
    }
  }
  return Array.from(findingsByEmail.values()).sort((a, b) => {
    if (a.isManagerLikely !== b.isManagerLikely) return a.isManagerLikely ? -1 : 1;
    return b.confidence - a.confidence;
  });
}

async function loadCandidatesForSearch(
  supabase: SupabaseLooseClient,
  options: CampaignManagerEmailSearchOptions,
): Promise<CandidateSearchRow[]> {
  const limit = Math.max(1, Math.min(options.limit ?? 40, 100));
  let query = supabase
    .from("campaign_candidates")
    .select(CANDIDATE_COLUMNS)
    .eq("candidate_status", "active")
    .order("priority_score", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (options.candidateId) {
    query = query.eq("id", options.candidateId);
  } else if (!options.force) {
    query = query.or("campaign_manager_email.is.null,campaign_email.is.null");
  }

  const { data, error } = await query;
  if (error) throw new Error(`campaign manager email search candidate load failed: ${error.message}`);
  return (data ?? []) as CandidateSearchRow[];
}

async function existingContactsForCandidate(supabase: SupabaseLooseClient, candidateId: string) {
  const { data, error } = await supabase
    .from("political_campaign_contacts")
    .select("id,name,role,email,is_primary")
    .eq("campaign_candidate_id", candidateId);
  if (error) throw new Error(`campaign contact lookup failed: ${error.message}`);
  return (data ?? []) as Array<{
    id: string;
    name: string;
    role: string | null;
    email: string | null;
    is_primary: boolean;
  }>;
}

async function insertDiscoveredContacts(
  supabase: SupabaseLooseClient,
  candidate: CandidateSearchRow,
  findings: CampaignEmailFinding[],
): Promise<number> {
  const existing = await existingContactsForCandidate(supabase, candidate.id);
  const existingEmails = new Set(
    existing.map((contact) => normalizePoliticalOutreachEmail(contact.email)).filter(Boolean) as string[],
  );
  let hasPrimary = existing.some((contact) => contact.is_primary);
  let inserted = 0;

  for (const finding of findings.slice(0, 4)) {
    if (existingEmails.has(finding.email)) continue;
    const shouldBePrimary = !hasPrimary && (finding.isManagerLikely || finding.confidence >= 65);
    const { error } = await supabase.from("political_campaign_contacts").insert({
      campaign_candidate_id: candidate.id,
      name:
        finding.isManagerLikely && candidate.campaign_manager_name
          ? candidate.campaign_manager_name
          : `${candidate.candidate_name} campaign ${finding.role.toLowerCase()}`,
      role: finding.role,
      email: finding.email,
      is_primary: shouldBePrimary,
      preferred_contact_method: "email",
      do_not_contact: false,
      do_not_email: false,
      do_not_text: false,
    });
    if (error) throw new Error(`campaign contact insert failed for ${candidate.candidate_name}: ${error.message}`);
    inserted += 1;
    existingEmails.add(finding.email);
    hasPrimary = hasPrimary || shouldBePrimary;
  }

  return inserted;
}

function appendEnrichmentNote(
  existingNotes: string | null,
  finding: CampaignEmailFinding,
  nowIso: string,
): string {
  const note = [
    `Campaign contact enrichment ${nowIso.slice(0, 10)}:`,
    `found ${finding.role.toLowerCase()} ${finding.email}`,
    `from ${finding.sourceUrl}`,
    `confidence ${finding.confidence}.`,
    "Public-source result; review before outreach.",
  ].join(" ");
  const combined = [existingNotes?.trim(), note].filter(Boolean).join("\n");
  return combined.slice(-1800);
}

async function updateCandidateWithFinding(
  supabase: SupabaseLooseClient,
  candidate: CandidateSearchRow,
  finding: CampaignEmailFinding,
): Promise<boolean> {
  const currentManagerEmail = normalizePoliticalOutreachEmail(candidate.campaign_manager_email);
  const currentCampaignEmail = normalizePoliticalOutreachEmail(candidate.campaign_email);
  const patch: Record<string, unknown> = {
    data_verified_at: new Date().toISOString(),
    completeness_score: Math.min(100, Math.max(candidate.completeness_score ?? 0, finding.isManagerLikely ? 82 : 74)),
    notes: appendEnrichmentNote(candidate.notes, finding, new Date().toISOString()),
  };

  if (!currentCampaignEmail) {
    patch.campaign_email = finding.email;
  }
  if (!currentManagerEmail && finding.isManagerLikely) {
    patch.campaign_manager_email = finding.email;
  }

  const updateKeys = Object.keys(patch);
  if (updateKeys.length === 3 && currentCampaignEmail && (!finding.isManagerLikely || currentManagerEmail)) {
    return false;
  }

  const { error } = await supabase.from("campaign_candidates").update(patch).eq("id", candidate.id);
  if (error) throw new Error(`candidate contact update failed for ${candidate.candidate_name}: ${error.message}`);
  return true;
}

async function logEmailSearchActivity(
  supabase: SupabaseLooseClient,
  candidateId: string,
  result: CampaignManagerEmailSearchResult,
  actorUserId?: string | null,
) {
  const { error } = await supabase.from("political_agent_activity_log").insert({
    candidate_id: candidateId,
    activity_type: "campaign_manager_email_search",
    status: result.status === "updated" || result.status === "found_existing" ? "complete" : "blocked",
    message:
      result.selectedEmail
        ? `Campaign contact email found for ${result.candidateName}: ${result.selectedRole} ${result.selectedEmail}.`
        : `Campaign contact email search completed for ${result.candidateName}: ${result.reason ?? result.status}.`,
    payload: {
      selectedEmail: result.selectedEmail,
      selectedRole: result.selectedRole,
      findings: result.findings,
      contactsInserted: result.contactsInserted,
      candidateUpdated: result.candidateUpdated,
    },
    actor_user_id: actorUserId ?? null,
  });
  if (error && !String(error.message ?? "").includes("does not exist")) throw error;
}

export async function searchAndStoreCampaignManagerEmails(
  supabase: SupabaseLooseClient,
  options: CampaignManagerEmailSearchOptions = {},
): Promise<CampaignManagerEmailSearchSummary> {
  const candidates = await loadCandidatesForSearch(supabase, options);
  const results: CampaignManagerEmailSearchResult[] = [];
  const maxPages = Math.max(1, Math.min(options.maxPagesPerCandidate ?? 6, 9));

  for (const candidate of candidates) {
    const candidateRow = toCandidateRow(candidate);
    const blockers = politicalCandidateQualityBlockers(candidateRow).filter(
      (blocker) =>
        !blocker.toLowerCase().includes("saved campaign email is a placeholder") &&
        !blocker.toLowerCase().includes("saved campaign email is a homereach"),
    );
    if (candidate.do_not_contact || candidate.do_not_email || blockers.length > 0) {
      const result: CampaignManagerEmailSearchResult = {
        candidateId: candidate.id,
        candidateName: candidate.candidate_name,
        status: "skipped",
        reason: blockers[0] ?? "Candidate is marked do-not-contact or do-not-email.",
        findings: [],
        selectedEmail: null,
        selectedRole: null,
        contactsInserted: 0,
        candidateUpdated: false,
      };
      results.push(result);
      await logEmailSearchActivity(supabase, candidate.id, result, options.actorUserId);
      continue;
    }

    const existingManager = normalizePoliticalOutreachEmail(candidate.campaign_manager_email);
    const existingCampaign = normalizePoliticalOutreachEmail(candidate.campaign_email);
    const enrichedToday = candidate.notes?.includes(`Campaign contact enrichment ${new Date().toISOString().slice(0, 10)}`);
    if (!options.force && existingManager && existingCampaign) {
      const result: CampaignManagerEmailSearchResult = {
        candidateId: candidate.id,
        candidateName: candidate.candidate_name,
        status: "found_existing",
        reason: "Candidate already has usable campaign and manager emails.",
        findings: [],
        selectedEmail: existingManager,
        selectedRole: "Campaign Manager",
        contactsInserted: 0,
        candidateUpdated: false,
      };
      results.push(result);
      continue;
    }
    if (!options.force && existingCampaign && enrichedToday) {
      const result: CampaignManagerEmailSearchResult = {
        candidateId: candidate.id,
        candidateName: candidate.candidate_name,
        status: "found_existing",
        reason: "Candidate already has a usable campaign contact from today's enrichment pass.",
        findings: [],
        selectedEmail: existingCampaign,
        selectedRole: "Campaign Contact",
        contactsInserted: 0,
        candidateUpdated: false,
      };
      results.push(result);
      continue;
    }

    if (candidateSiteUrls(candidate, maxPages).length === 0 && !options.includeSearchEngine) {
      const result: CampaignManagerEmailSearchResult = {
        candidateId: candidate.id,
        candidateName: candidate.candidate_name,
        status: "skipped",
        reason: "No fetchable campaign website or source URL is saved.",
        findings: [],
        selectedEmail: null,
        selectedRole: null,
        contactsInserted: 0,
        candidateUpdated: false,
      };
      results.push(result);
      await logEmailSearchActivity(supabase, candidate.id, result, options.actorUserId);
      continue;
    }

    const findings = await findCandidateEmails(candidate, maxPages, Boolean(options.includeSearchEngine));
    const selected = findings[0] ?? null;
    if (!selected) {
      const result: CampaignManagerEmailSearchResult = {
        candidateId: candidate.id,
        candidateName: candidate.candidate_name,
        status: "not_found",
        reason: "No usable public campaign email was found on the checked campaign pages.",
        findings: [],
        selectedEmail: null,
        selectedRole: null,
        contactsInserted: 0,
        candidateUpdated: false,
      };
      results.push(result);
      await logEmailSearchActivity(supabase, candidate.id, result, options.actorUserId);
      continue;
    }

    const contactsInserted = await insertDiscoveredContacts(supabase, candidate, findings);
    const candidateUpdated = await updateCandidateWithFinding(supabase, candidate, selected);
    const result: CampaignManagerEmailSearchResult = {
      candidateId: candidate.id,
      candidateName: candidate.candidate_name,
      status: candidateUpdated || contactsInserted > 0 ? "updated" : "found_existing",
      findings,
      selectedEmail: selected.email,
      selectedRole: selected.role,
      contactsInserted,
      candidateUpdated,
    };
    results.push(result);
    await logEmailSearchActivity(supabase, candidate.id, result, options.actorUserId);
  }

  return {
    scanned: candidates.length,
    candidatesUpdated: results.filter((result) => result.candidateUpdated).length,
    contactsInserted: results.reduce((total, result) => total + result.contactsInserted, 0),
    emailsFound: results.filter((result) => Boolean(result.selectedEmail)).length,
    skipped: results.filter((result) => result.status === "skipped").length,
    results,
  };
}
