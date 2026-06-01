import {
  resolvePriceSourceQuality,
  supportedPriceSourceTypes,
  type PriceSourceQuality,
} from "@/lib/operations-copilot/price-confidence";

export type PriceImportInput = {
  industryId?: string;
  region?: string;
  zipCode?: string;
  sourceType?: string;
  sourceLabel?: string;
  csvText?: string;
  rows?: PriceImportRow[];
};

export type PriceImportRow = {
  sku?: string;
  itemName?: string;
  category?: string;
  supplierName?: string;
  unit?: string;
  observedPrice?: string | number;
  observedPriceCents?: string | number;
  normalizedUnitPrice?: string | number;
  normalizedUnitPriceCents?: string | number;
  landedPrice?: string | number;
  landedPriceCents?: string | number;
  availableQuantity?: string | number;
  inStock?: string | boolean;
  leadTimeDays?: string | number;
  sourceUrl?: string;
  sourceLabel?: string;
  sourceType?: string;
  validUntil?: string;
  confidence?: string;
  priceBasis?: string;
  notes?: string;
  capturedAt?: string;
};

export type NormalizedPriceImportRow = {
  industryId: string;
  region: string;
  zipCode: string;
  sku: string;
  itemName: string;
  category: string;
  supplierName: string;
  sourceType: string;
  sourceQuality: PriceSourceQuality;
  sourceLabel: string;
  sourceUrl?: string;
  unit: string;
  observedPriceCents?: number;
  normalizedUnitPriceCents?: number;
  landedPriceCents?: number;
  availableQuantity?: string;
  inStock?: boolean;
  leadTimeDays?: number;
  validUntil?: string;
  confidence: "low" | "medium" | "high";
  priceBasis: string;
  notes?: string;
  capturedAt?: Date;
  metadata: Record<string, unknown>;
};

type ImportNormalizeResult = NormalizedPriceImportRow | { reason: string };

export function normalizePriceImport(input: PriceImportInput) {
  const rawRows = [
    ...parseCsvRows(input.csvText ?? ""),
    ...(input.rows ?? []),
  ];
  const accepted: NormalizedPriceImportRow[] = [];
  const rejected: Array<{ row: number; reason: string }> = [];

  rawRows.forEach((row, index) => {
    const normalized = normalizeImportRow(row, input);
    if ("reason" in normalized) {
      rejected.push({ row: index + 1, reason: normalized.reason });
      return;
    }
    accepted.push(normalized);
  });

  return { accepted, rejected };
}

function normalizeImportRow(row: PriceImportRow, input: PriceImportInput): ImportNormalizeResult {
  const sku = clean(row.sku);
  const itemName = clean(row.itemName);
  const category = clean(row.category);
  const supplierName = clean(row.supplierName);
  const unit = clean(row.unit) || "unit";
  const sourceType = normalizeSourceType(clean(row.sourceType) || input.sourceType || "manual_quote");
  const observedPriceCents = coerceCents(row.observedPriceCents ?? row.observedPrice);
  const landedPriceCents = coerceCents(row.landedPriceCents ?? row.landedPrice);
  const normalizedUnitPriceCents = coerceCents(
    row.normalizedUnitPriceCents ?? row.normalizedUnitPrice
  );

  if (!sku) return { reason: "Missing sku" };
  if (!itemName) return { reason: "Missing itemName" };
  if (!category) return { reason: "Missing category" };
  if (!supplierName) return { reason: "Missing supplierName" };
  if (observedPriceCents === undefined && landedPriceCents === undefined) {
    return { reason: "Missing observedPrice or landedPrice" };
  }

  const sourceQuality = resolvePriceSourceQuality(sourceType);
  const confidence = normalizeConfidence(row.confidence, sourceQuality);

  return {
    industryId: clean(input.industryId) || "roofing",
    region: clean(input.region) || "Akron / Northeast Ohio",
    zipCode: clean(input.zipCode) || "44309",
    sku,
    itemName,
    category,
    supplierName,
    sourceType,
    sourceQuality,
    sourceLabel:
      clean(row.sourceLabel) ||
      clean(input.sourceLabel) ||
      defaultSourceLabel(sourceType, sourceQuality),
    sourceUrl: clean(row.sourceUrl) || undefined,
    unit,
    observedPriceCents,
    normalizedUnitPriceCents,
    landedPriceCents,
    availableQuantity:
      row.availableQuantity === undefined ? undefined : String(row.availableQuantity),
    inStock: coerceBoolean(row.inStock),
    leadTimeDays: coerceInteger(row.leadTimeDays),
    validUntil: clean(row.validUntil) || undefined,
    confidence,
    priceBasis: clean(row.priceBasis) || defaultPriceBasis(sourceQuality),
    notes: clean(row.notes) || undefined,
    capturedAt: coerceDate(row.capturedAt),
    metadata: {
      sourceQuality,
      ingestionMethod: sourceType,
      verifiedForOrdering: sourceQuality === "verified",
    },
  } satisfies NormalizedPriceImportRow;
}

function parseCsvRows(csvText: string): PriceImportRow[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0] ?? "").map((header) => normalizeHeader(header));
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    return headers.reduce<Record<string, string>>((record, header, index) => {
      if (header) record[header] = cells[index] ?? "";
      return record;
    }, {}) as PriceImportRow;
  });
}

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && next === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function normalizeHeader(header: string) {
  const key = header.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const map: Record<string, keyof PriceImportRow> = {
    sku: "sku",
    item: "itemName",
    itemname: "itemName",
    product: "itemName",
    productname: "itemName",
    category: "category",
    supplier: "supplierName",
    suppliername: "supplierName",
    vendor: "supplierName",
    vendorname: "supplierName",
    unit: "unit",
    observedprice: "observedPrice",
    price: "observedPrice",
    observedpricecents: "observedPriceCents",
    normalizedunitprice: "normalizedUnitPrice",
    normalizedunitpricecents: "normalizedUnitPriceCents",
    landedprice: "landedPrice",
    landedcost: "landedPrice",
    landedpricecents: "landedPriceCents",
    availablequantity: "availableQuantity",
    quantity: "availableQuantity",
    instock: "inStock",
    leadtimedays: "leadTimeDays",
    sourceurl: "sourceUrl",
    sourcelabel: "sourceLabel",
    sourcetype: "sourceType",
    validuntil: "validUntil",
    confidence: "confidence",
    pricebasis: "priceBasis",
    notes: "notes",
    capturedat: "capturedAt",
  };
  return map[key] ?? key;
}

function normalizeSourceType(value: string) {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return supportedPriceSourceTypes.includes(normalized as never)
    ? normalized
    : "manual_quote";
}

function normalizeConfidence(
  value: unknown,
  sourceQuality: PriceSourceQuality
): "low" | "medium" | "high" {
  const normalized = typeof value === "string" ? value.toLowerCase() : "";
  if (normalized === "low" || normalized === "medium" || normalized === "high") {
    return normalized;
  }
  return sourceQuality === "verified" ? "high" : sourceQuality === "observed" ? "medium" : "low";
}

function defaultSourceLabel(sourceType: string, quality: PriceSourceQuality) {
  if (sourceType === "invoice_upload") return "Uploaded invoice";
  if (sourceType === "csv_import") return "Imported price CSV";
  if (sourceType === "manual_quote") return "Manual supplier quote";
  if (sourceType === "edi_832") return "EDI 832 price catalog";
  if (sourceType === "cxml_punchout") return "cXML/Punchout quote";
  if (sourceType.includes("api")) return "Supplier API feed";
  if (quality === "observed") return "Observed public benchmark";
  return "Estimated benchmark";
}

function defaultPriceBasis(quality: PriceSourceQuality) {
  if (quality === "verified") return "verified account or invoice price";
  if (quality === "observed") return "observed public benchmark price";
  return "estimated benchmark price";
}

function coerceCents(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.round(value > 999 ? value : value * 100) : undefined;
  }
  const cleaned = String(value).replace(/[$,\s]/g, "");
  const parsed = Number.parseFloat(cleaned);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.round(parsed > 999 ? parsed : parsed * 100);
}

function coerceInteger(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : undefined;
}

function coerceBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return undefined;
  const normalized = value.toLowerCase().trim();
  if (["yes", "true", "1", "in_stock", "available"].includes(normalized)) return true;
  if (["no", "false", "0", "out_of_stock", "unavailable"].includes(normalized)) return false;
  return undefined;
}

function coerceDate(value: unknown) {
  if (!value) return undefined;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
