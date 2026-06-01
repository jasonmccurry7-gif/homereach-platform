export type JobsiteHaloAddress = {
  name: string;
  address: string;
  radiusMiles: number;
  notes?: string | null;
};

export type JobsiteHaloMetadata = {
  enabled: boolean;
  defaultRadiusMiles: number;
  radiusReason: string;
  radiusPreference?: string | null;
  proofNotes?: string | null;
  addresses: JobsiteHaloAddress[];
};

const INDUSTRY_RADIUS_DEFAULTS = [
  {
    match: ["roof", "solar", "siding", "window"],
    radiusMiles: 1,
    reason: "High-ticket exterior services usually work best around tight jobsite neighborhoods first.",
  },
  {
    match: ["hvac", "plumb", "electric", "pest", "concrete", "landscap", "lawn", "tree"],
    radiusMiles: 1.5,
    reason: "Home-service jobs can support a slightly wider neighborhood halo when service radius allows it.",
  },
  {
    match: ["real estate", "realtor", "med spa", "dent", "restaurant", "fitness", "chiropractic"],
    radiusMiles: 2,
    reason: "Appointment and local retail offers often need a wider local radius around proof points.",
  },
  {
    match: ["political", "campaign", "candidate"],
    radiusMiles: 3,
    reason: "Political geography should stay district/geography based and avoid individual-level claims.",
  },
] as const;

function normalizeLine(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function getJobsiteHaloRadiusDefault(industry: string | null | undefined) {
  const lower = String(industry ?? "").toLowerCase();
  const found = INDUSTRY_RADIUS_DEFAULTS.find((item) => item.match.some((token) => lower.includes(token)));

  return (
    found ?? {
      radiusMiles: 1,
      reason: "Default starter radius keeps the campaign focused until performance data supports expansion.",
    }
  );
}

export function normalizeJobsiteRadiusPreference(value: string | null | undefined, industry: string | null | undefined) {
  const fallback = getJobsiteHaloRadiusDefault(industry);
  const raw = String(value ?? "").trim();
  const numeric = Number(raw.replace(/[^0-9.]/g, ""));

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return fallback;
  }

  const radiusMiles = Math.min(10, Math.max(0.25, numeric));
  return {
    radiusMiles,
    reason:
      radiusMiles !== numeric
        ? "Client preference was constrained to the safe 0.25-10 mile operating range."
        : "Client-provided radius preference.",
  };
}

export function parseJobsiteAddressLines(input: {
  rawAddresses?: string | null;
  radiusPreference?: string | null;
  industry?: string | null;
}) {
  const radius = normalizeJobsiteRadiusPreference(input.radiusPreference, input.industry);
  const lines = String(input.rawAddresses ?? "")
    .split(/\r?\n/)
    .map(normalizeLine)
    .filter(Boolean)
    .slice(0, 10);

  return lines.map((line, index) => {
    const [namePart, addressPart, notesPart] = line.split("|").map((part) => normalizeLine(part ?? ""));
    const address = String(addressPart || namePart);
    const name = addressPart ? namePart || `Jobsite ${index + 1}` : `Jobsite ${index + 1}`;

    return {
      name,
      address,
      radiusMiles: radius.radiusMiles,
      notes: notesPart || null,
    };
  });
}

export function buildJobsiteHaloMetadata(input: {
  industry?: string | null;
  rawAddresses?: string | null;
  radiusPreference?: string | null;
  proofNotes?: string | null;
}) {
  const radius = normalizeJobsiteRadiusPreference(input.radiusPreference, input.industry);
  const addresses = parseJobsiteAddressLines(input);

  return {
    enabled: addresses.length > 0 || Boolean(String(input.proofNotes ?? "").trim()),
    defaultRadiusMiles: radius.radiusMiles,
    radiusReason: radius.reason,
    radiusPreference: input.radiusPreference?.trim() || null,
    proofNotes: input.proofNotes?.trim() || null,
    addresses,
  } satisfies JobsiteHaloMetadata;
}

export function getJobsiteHaloMetadata(metadata: unknown): JobsiteHaloMetadata | null {
  if (!metadata || typeof metadata !== "object") return null;
  const value = (metadata as { jobsite_halo?: unknown }).jobsite_halo;
  if (!value || typeof value !== "object") return null;

  const candidate = value as Partial<JobsiteHaloMetadata>;
  const addresses = Array.isArray(candidate.addresses)
    ? candidate.addresses
        .filter((item): item is JobsiteHaloAddress => Boolean(item && typeof item.address === "string"))
        .map((item, index) => ({
          name: item.name || `Jobsite ${index + 1}`,
          address: item.address,
          radiusMiles: Number.isFinite(Number(item.radiusMiles)) ? Number(item.radiusMiles) : Number(candidate.defaultRadiusMiles ?? 1),
          notes: item.notes ?? null,
        }))
    : [];

  return {
    enabled: Boolean(candidate.enabled || addresses.length > 0),
    defaultRadiusMiles: Number.isFinite(Number(candidate.defaultRadiusMiles)) ? Number(candidate.defaultRadiusMiles) : 1,
    radiusReason: candidate.radiusReason || "Default starter radius.",
    radiusPreference: candidate.radiusPreference ?? null,
    proofNotes: candidate.proofNotes ?? null,
    addresses,
  };
}

export function buildJobsiteHaloCampaignLocationRows(input: {
  campaignId: string;
  metadata: unknown;
  fallbackTargetArea?: string | null;
}) {
  const jobsiteHalo = getJobsiteHaloMetadata(input.metadata);
  if (!jobsiteHalo?.addresses.length) return [];

  return jobsiteHalo.addresses.map((item) => ({
    campaign_id: input.campaignId,
    location_type: "jobsite",
    name: item.name,
    address: item.address,
    radius_miles: item.radiusMiles,
    notes: [item.notes, jobsiteHalo.proofNotes, input.fallbackTargetArea]
      .filter(Boolean)
      .join(" | ")
      .slice(0, 1800),
  }));
}

export function summarizeJobsiteHalo(input: JobsiteHaloMetadata | null) {
  if (!input?.enabled) return "No structured Jobsite Halo details submitted.";
  const count = input.addresses.length;
  const addressWord = count === 1 ? "address" : "addresses";
  return `${count} jobsite ${addressWord}; default radius ${input.defaultRadiusMiles} miles. ${input.radiusReason}`;
}
