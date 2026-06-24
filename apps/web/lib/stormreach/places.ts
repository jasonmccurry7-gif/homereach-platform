import "server-only";

import { distanceMiles, eventCentroid } from "./geo";
import { impactedAreaLabel } from "./outreach";
import { STORMREACH_STORM_OUTREACH_INDUSTRIES } from "./prospecting";
import type { ScoredStormEvent, StormBusinessProspectInput } from "./types";

type GooglePlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  nationalPhoneNumber?: string;
  websiteUri?: string;
  businessStatus?: string;
  primaryType?: string;
  types?: string[];
};

type GooglePlacesResponse = {
  places?: GooglePlace[];
  nextPageToken?: string;
  error?: { message?: string; status?: string };
};

type SerpApiLocalResult = {
  title?: string;
  phone?: string;
  website?: string;
  address?: string;
  rating?: number;
  reviews?: number;
  place_id?: string;
  gps_coordinates?: {
    latitude?: number;
    longitude?: number;
  };
};

type SerpApiResponse = {
  local_results?: SerpApiLocalResult[];
  error?: string;
};

type HunterDomainSearchResponse = {
  data?: {
    emails?: Array<{
      value?: string;
      type?: string;
      confidence?: number;
    }>;
  };
};

export type PlacesContractorSearchResult = {
  prospects: StormBusinessProspectInput[];
  warnings: string[];
  providerConfigured: boolean;
  sourceUrl: string;
};

const GOOGLE_TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.nationalPhoneNumber",
  "places.websiteUri",
  "places.businessStatus",
  "places.primaryType",
  "places.types",
  "nextPageToken",
].join(",");

export async function fetchGooglePlacesContractors(input: {
  event: ScoredStormEvent;
  industries: string[];
  radiusMiles: number;
  limit?: number;
}): Promise<PlacesContractorSearchResult> {
  const apiKey = process.env.STORMREACH_GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  const sourceUrl = GOOGLE_TEXT_SEARCH_URL;
  if (!apiKey) {
    const serpResult = await fetchSerpApiContractors(input);
    return {
      ...serpResult,
      warnings: [
        serpResult.prospects.length
          ? "Google Places contractor search is not configured. StormReach used SerpAPI fallback for contractor discovery."
          : "Google Places contractor search is not configured. StormReach SerpAPI fallback did not return prospects.",
        ...serpResult.warnings,
      ],
      sourceUrl: serpResult.sourceUrl || sourceUrl,
    };
  }

  const centroid = eventCentroid(input.event);
  if (!centroid) {
    return {
      prospects: [],
      warnings: ["StormReach could not calculate an event centroid for Google Places contractor search."],
      providerConfigured: true,
      sourceUrl,
    };
  }

  const warnings: string[] = [];
  const prospects: StormBusinessProspectInput[] = [];
  const industries = input.industries.length ? input.industries : STORMREACH_STORM_OUTREACH_INDUSTRIES;
  const perIndustryLimit = Math.max(1, Math.ceil((input.limit ?? 240) / industries.length));

  for (const industry of industries) {
    try {
      prospects.push(...await fetchGooglePlacesIndustry({
        apiKey,
        event: input.event,
        industry,
        centroid,
        radiusMiles: input.radiusMiles,
        limit: perIndustryLimit,
      }));
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : `Google Places search failed for ${industry}.`);
    }
  }

  return {
    prospects: prospects.slice(0, input.limit ?? 240),
    warnings,
    providerConfigured: true,
    sourceUrl,
  };
}

async function fetchSerpApiContractors(input: {
  event: ScoredStormEvent;
  industries: string[];
  radiusMiles: number;
  limit?: number;
}): Promise<PlacesContractorSearchResult> {
  const sourceUrl = "https://serpapi.com/search";
  const apiKey = getStormReachSerpApiKey();
  const enabled = stormReachSerpApiEnabled();
  if (!apiKey || !enabled) {
    return {
      prospects: [],
      warnings: [!apiKey
        ? "StormReach SerpAPI contractor search needs SERPAPI_KEY, SERP_API, SERPAPI_API_KEY, or STORMREACH_SERPAPI_KEY."
        : "StormReach SerpAPI contractor search is disabled. Set STORMREACH_ENABLE_SERPAPI=true to use it for storm prospects."],
      providerConfigured: Boolean(apiKey) && enabled,
      sourceUrl,
    };
  }

  const centroid = eventCentroid(input.event);
  if (!centroid) {
    return {
      prospects: [],
      warnings: ["StormReach could not calculate an event centroid for SerpAPI contractor search."],
      providerConfigured: true,
      sourceUrl,
    };
  }

  const warnings: string[] = [];
  const prospects: StormBusinessProspectInput[] = [];
  const industries = input.industries.length ? input.industries : STORMREACH_STORM_OUTREACH_INDUSTRIES;
  const perIndustryLimit = Math.max(1, Math.ceil((input.limit ?? 240) / industries.length));
  const area = impactedAreaLabel(input.event);

  for (const industry of industries) {
    try {
      prospects.push(...await fetchSerpApiIndustry({
        apiKey,
        event: input.event,
        industry,
        centroid,
        radiusMiles: input.radiusMiles,
        limit: perIndustryLimit,
        area,
      }));
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : `SerpAPI contractor search failed for ${industry}.`);
    }
  }

  return {
    prospects: prospects.slice(0, input.limit ?? 240),
    warnings,
    providerConfigured: true,
    sourceUrl,
  };
}

async function fetchSerpApiIndustry(input: {
  apiKey: string;
  event: ScoredStormEvent;
  industry: string;
  centroid: [number, number];
  radiusMiles: number;
  limit: number;
  area: string;
}) {
  const params = new URLSearchParams({
    engine: "google_maps",
    q: `${input.industry} contractors near ${input.area}`,
    api_key: input.apiKey,
    num: String(Math.min(Math.max(input.limit, 10), 40)),
    type: "search",
    ll: `@${input.centroid[1]},${input.centroid[0]},10z`,
  });
  const response = await fetch(`https://serpapi.com/search?${params}`);
  const json = await response.json().catch(() => ({})) as SerpApiResponse;
  if (!response.ok || json.error) {
    throw new Error(json.error || `SerpAPI contractor search failed for ${input.industry} with ${response.status}.`);
  }

  const prospects: StormBusinessProspectInput[] = [];
  for (const result of json.local_results ?? []) {
    const point = typeof result.gps_coordinates?.latitude === "number" && typeof result.gps_coordinates?.longitude === "number"
      ? [result.gps_coordinates.longitude, result.gps_coordinates.latitude] as [number, number]
      : null;
    const distanceToEvent = point ? distanceMiles(input.centroid, point) : null;
    if (typeof distanceToEvent === "number" && distanceToEvent > input.radiusMiles) continue;

    const address = parseAddress(result.address);
    const email = await findHunterEmail(result.title, result.website);
    prospects.push({
      businessName: result.title || "Unnamed contractor",
      email,
      phone: result.phone ?? null,
      website: result.website ?? null,
      city: address.city,
      state: address.state ?? input.event.impactedState ?? null,
      category: input.industry,
      source: "serpapi_google_maps",
      confidenceScore: scoreSerpApiResult(result, Boolean(email)),
      distanceToEvent: typeof distanceToEvent === "number" ? Number(distanceToEvent.toFixed(2)) : null,
      crmStatus: "new",
      suppressionStatus: "unchecked",
      notes: email
        ? "SerpAPI local business match with Hunter email enrichment. Review before outreach."
        : "SerpAPI local business match. Email enrichment or manual website review required before sending.",
      metadata: {
        source: "serpapi_google_maps",
        serpapi_place_id: result.place_id ?? null,
        formatted_address: result.address ?? null,
        rating: result.rating ?? null,
        reviews: result.reviews ?? null,
        latitude: point?.[1] ?? null,
        longitude: point?.[0] ?? null,
        search_radius_miles: input.radiusMiles,
        event_area: impactedAreaLabel(input.event),
        contact_enrichment_required: !email,
        email_enrichment_provider: email ? "hunter" : null,
        facebook_page: "Not publicly found",
        messenger_link: "Not publicly found",
        verification_status: email ? "partially_verified_public_sources" : "business_found_contact_incomplete",
        no_auto_send: true,
      },
    });
    if (prospects.length >= input.limit) break;
  }

  return prospects;
}

async function findHunterEmail(businessName: string | null | undefined, website: string | null | undefined) {
  const apiKey = process.env.HUNTER_API_KEY || process.env.HUNTER;
  const domain = extractDomain(website);
  if (!apiKey || !domain) return null;

  try {
    const params = new URLSearchParams({
      domain,
      company: String(businessName ?? ""),
      api_key: apiKey,
      limit: "10",
    });
    const response = await fetch(`https://api.hunter.io/v2/domain-search?${params}`);
    if (!response.ok) return null;
    const json = await response.json().catch(() => ({})) as HunterDomainSearchResponse;
    const emails = (json.data?.emails ?? [])
      .map((item) => ({ value: item.value?.trim().toLowerCase() ?? "", type: item.type, confidence: Number(item.confidence ?? 0) }))
      .filter((item) => item.value && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(item.value));
    const generic = emails.find((item) => /^(info|contact|hello|sales|office|service|admin)@/.test(item.value));
    return generic?.value ?? emails.sort((a, b) => b.confidence - a.confidence)[0]?.value ?? null;
  } catch {
    return null;
  }
}

function scoreSerpApiResult(result: SerpApiLocalResult, hasEmail: boolean) {
  let score = 58;
  if (typeof result.rating === "number" && result.rating >= 4) score += 8;
  if (typeof result.reviews === "number" && result.reviews >= 10) score += 6;
  if (typeof result.reviews === "number" && result.reviews >= 50) score += 4;
  if (result.website) score += 6;
  if (result.phone) score += 4;
  if (hasEmail) score += 10;
  return Math.max(0, Math.min(100, score));
}

function extractDomain(url: string | null | undefined) {
  if (!url) return null;
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

async function fetchGooglePlacesIndustry(input: {
  apiKey: string;
  event: ScoredStormEvent;
  industry: string;
  centroid: [number, number];
  radiusMiles: number;
  limit: number;
}) {
  const prospects: StormBusinessProspectInput[] = [];
  let pageToken: string | undefined;
  let pageCount = 0;
  const radiusMeters = Math.max(1000, Math.round(input.radiusMiles * 1609.344));

  do {
    const body: Record<string, unknown> = {
      textQuery: `${input.industry} contractor`,
      pageSize: Math.min(20, input.limit - prospects.length),
      locationBias: {
        circle: {
          center: {
            latitude: input.centroid[1],
            longitude: input.centroid[0],
          },
          radius: radiusMeters,
        },
      },
      regionCode: "US",
      languageCode: "en",
    };
    if (pageToken) body.pageToken = pageToken;

    const response = await fetch(GOOGLE_TEXT_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": input.apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify(body),
    });
    const json = await response.json().catch(() => ({})) as GooglePlacesResponse;
    if (!response.ok || json.error) {
      throw new Error(json.error?.message || `Google Places search failed for ${input.industry} with ${response.status}.`);
    }

    for (const place of json.places ?? []) {
      const point = place.location && typeof place.location.latitude === "number" && typeof place.location.longitude === "number"
        ? [place.location.longitude, place.location.latitude] as [number, number]
        : null;
      const distanceToEvent = point ? distanceMiles(input.centroid, point) : null;
      if (typeof distanceToEvent === "number" && distanceToEvent > input.radiusMiles) continue;

      const address = parseAddress(place.formattedAddress);
      prospects.push({
        businessName: place.displayName?.text || "Unnamed contractor",
        phone: place.nationalPhoneNumber ?? null,
        website: place.websiteUri ?? null,
        city: address.city,
        state: address.state ?? input.event.impactedState ?? null,
        category: input.industry,
        source: "google_places",
        confidenceScore: place.businessStatus === "OPERATIONAL" ? 72 : 58,
        distanceToEvent: typeof distanceToEvent === "number" ? Number(distanceToEvent.toFixed(2)) : null,
        crmStatus: "new",
        suppressionStatus: "unchecked",
        notes: place.websiteUri
          ? "Google Places match. Email enrichment or manual website review required before sending."
          : "Google Places match. Contact enrichment required before sending.",
        metadata: {
          source: "google_places",
          google_place_id: place.id ?? null,
          formatted_address: place.formattedAddress ?? null,
          business_status: place.businessStatus ?? null,
          primary_type: place.primaryType ?? null,
          types: place.types ?? [],
          latitude: point?.[1] ?? null,
          longitude: point?.[0] ?? null,
          search_radius_miles: input.radiusMiles,
          search_radius_meters_sent_to_google: radiusMeters,
          event_area: impactedAreaLabel(input.event),
          contact_enrichment_required: true,
          facebook_page: "Not publicly found",
          messenger_link: "Not publicly found",
          verification_status: "business_found_contact_incomplete",
          no_auto_send: true,
        },
      });
      if (prospects.length >= input.limit) break;
    }

    pageToken = prospects.length < input.limit ? json.nextPageToken : undefined;
    pageCount += 1;
  } while (pageToken && pageCount < 6 && prospects.length < input.limit);

  return prospects;
}

function parseAddress(address: string | null | undefined) {
  const parts = String(address ?? "").split(",").map((part) => part.trim()).filter(Boolean);
  const stateMatch = parts.find((part) => /\b[A-Z]{2}\b/.test(part))?.match(/\b([A-Z]{2})\b/);
  const state = stateMatch?.[1] ?? null;
  const stateIndex = stateMatch ? parts.findIndex((part) => part.includes(stateMatch[0])) : -1;
  const city = stateIndex > 0 ? parts[stateIndex - 1] : parts.length >= 3 ? parts[parts.length - 3] : null;
  return { city, state };
}

function stormReachSerpApiEnabled() {
  return process.env.STORMREACH_ENABLE_SERPAPI === "true" || process.env.SERPAPI_PAUSED === "false";
}

function getStormReachSerpApiKey() {
  return firstEnvValue("STORMREACH_SERPAPI_KEY", "SERPAPI_KEY", "SERP_API", "SERPAPI_API_KEY");
}

function firstEnvValue(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return "";
}
