export const DESIGN_META_MARKER = "[homereach_design]";
export const MIGRATION_META_MARKER = "[migration_meta]";

export type PostcardDesignSource = "manual_upload" | "manual_url" | "generated";

export interface PostcardDesignMeta {
  designUrl: string;
  source: PostcardDesignSource;
  uploadedAt: string;
  storagePath?: string;
  fileName?: string;
}

const DESIGN_URL_KEYS = [
  "designUrl",
  "design_url",
  "manualDesignUrl",
  "manual_design_url",
  "generatedDesignUrl",
  "generated_design_url",
  "adDesignUrl",
  "ad_design_url",
  "artworkUrl",
  "artwork_url",
  "proofUrl",
  "proof_url",
  "imageUrl",
  "image_url",
  "logoUrl",
  "logo_url",
] as const;

function parseMarkerJson(notes: string | null | undefined, marker: string): Record<string, unknown> | null {
  if (!notes) return null;
  const idx = notes.indexOf(marker);
  if (idx === -1) return null;

  const start = idx + marker.length;
  const nextMarker = notes.indexOf("\n[", start);
  const raw = notes.slice(start, nextMarker === -1 ? undefined : nextMarker).trim();
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function removeMarker(notes: string, marker: string): string {
  const idx = notes.indexOf(marker);
  if (idx === -1) return notes.trim();

  const nextMarker = notes.indexOf("\n[", idx + marker.length);
  return [
    notes.slice(0, idx).trimEnd(),
    nextMarker === -1 ? "" : notes.slice(nextMarker).trimStart(),
  ]
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

function findDesignUrl(meta: Record<string, unknown> | null): string | null {
  if (!meta) return null;
  for (const key of DESIGN_URL_KEYS) {
    const value = meta[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

export function getPostcardDesignMeta(notes: string | null | undefined): PostcardDesignMeta | null {
  const designMeta = parseMarkerJson(notes, DESIGN_META_MARKER);
  const designUrl = findDesignUrl(designMeta);
  if (!designUrl) return null;

  const source = designMeta?.source === "manual_upload" ||
    designMeta?.source === "manual_url" ||
    designMeta?.source === "generated"
    ? designMeta.source
    : "manual_url";

  return {
    designUrl,
    source,
    uploadedAt: typeof designMeta?.uploadedAt === "string" ? designMeta.uploadedAt : "",
    storagePath: typeof designMeta?.storagePath === "string" ? designMeta.storagePath : undefined,
    fileName: typeof designMeta?.fileName === "string" ? designMeta.fileName : undefined,
  };
}

export function getPostcardDesignUrl(notes: string | null | undefined): string | null {
  const current = getPostcardDesignMeta(notes);
  if (current?.designUrl) return current.designUrl;

  return findDesignUrl(parseMarkerJson(notes, MIGRATION_META_MARKER));
}

export function upsertPostcardDesignMeta(
  notes: string | null | undefined,
  meta: PostcardDesignMeta,
): string {
  const base = removeMarker(notes ?? "", DESIGN_META_MARKER);
  const encoded = `${DESIGN_META_MARKER}${JSON.stringify(meta)}`;
  const migrationIndex = base.indexOf(MIGRATION_META_MARKER);

  if (migrationIndex === -1) {
    return [base.trim(), encoded].filter(Boolean).join("\n\n");
  }

  return [
    base.slice(0, migrationIndex).trimEnd(),
    encoded,
    base.slice(migrationIndex).trimStart(),
  ]
    .filter(Boolean)
    .join("\n\n");
}
