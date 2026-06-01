import "server-only";

import { generateText } from "@/lib/ai/llm";

export type ProcurementDocumentType =
  | "inventory_sheet"
  | "invoice"
  | "receipt"
  | "purchase_history"
  | "mixed";

export type UploadedProcurementFile = {
  fileName: string;
  mediaType: string;
  buffer: Buffer;
};

export type NormalizedProcurementLine = {
  sku: string;
  itemName: string;
  category: string;
  unit: string;
  supplierName?: string;
  quantity?: number;
  onHandQuantity?: number;
  reorderPointQuantity?: number;
  targetStockQuantity?: number;
  averageDailyUse?: number;
  unitPriceCents?: number;
  lineTotalCents?: number;
  purchasedAt?: string;
  invoiceReference?: string;
  sourceFileName?: string;
  confidence: "low" | "medium" | "high";
  notes?: string;
};

export type ProcurementNormalizationResult = {
  documentType: ProcurementDocumentType;
  lines: NormalizedProcurementLine[];
  rejected: Array<{ source: string; reason: string }>;
  warnings: string[];
  standardizedCsv: string;
  sourceSummaries: Array<{
    fileName: string;
    extractionMode: string;
    rowsFound: number;
  }>;
};

type AiExtractionResult = {
  supplierName?: string;
  documentDate?: string;
  invoiceReference?: string;
  lines?: Array<Record<string, unknown>>;
  warnings?: string[];
};

type ExtractedContent = {
  fileName: string;
  extractionMode: string;
  text: string;
  rows: Array<Record<string, unknown>>;
  warnings: string[];
};

const TEXT_DECODER = new TextDecoder("utf-8", { fatal: false });

export async function normalizeProcurementDocuments({
  documentType,
  files,
  text,
}: {
  documentType: ProcurementDocumentType;
  files: UploadedProcurementFile[];
  text?: string;
}): Promise<ProcurementNormalizationResult> {
  const extracted: ExtractedContent[] = [];

  if (text?.trim()) {
    extracted.push({
      fileName: "pasted-text",
      extractionMode: "pasted_text",
      text,
      rows: parseDelimitedRows(text),
      warnings: [],
    });
  }

  for (const file of files) {
    extracted.push(await extractFileContent(file, documentType));
  }

  const lines: NormalizedProcurementLine[] = [];
  const rejected: Array<{ source: string; reason: string }> = [];
  const warnings = extracted.flatMap((source) => source.warnings);

  for (const source of extracted) {
    const deterministicRows = source.rows
      .map((row) =>
        normalizeProcurementRow({
          row,
          documentType,
          sourceFileName: source.fileName,
        })
      )
      .filter(Boolean) as NormalizedProcurementLine[];

    lines.push(...deterministicRows);

    if (deterministicRows.length === 0 && source.text.trim()) {
      try {
        const aiRows = await normalizeFreeformTextWithAi({
          documentType,
          fileName: source.fileName,
          text: source.text,
        });
        lines.push(...aiRows.lines);
        warnings.push(...aiRows.warnings);
      } catch (error) {
        rejected.push({
          source: source.fileName,
          reason: error instanceof Error ? error.message : "AI normalization failed",
        });
      }
    }

    if (source.rows.length === 0 && !source.text.trim()) {
      rejected.push({
        source: source.fileName,
        reason: "No readable text or table rows could be extracted.",
      });
    }
  }

  const deduped = dedupeLines(lines);

  return {
    documentType,
    lines: deduped,
    rejected,
    warnings,
    standardizedCsv: toStandardizedCsv(deduped),
    sourceSummaries: extracted.map((source) => ({
      fileName: source.fileName,
      extractionMode: source.extractionMode,
      rowsFound: source.rows.length,
    })),
  };
}

async function extractFileContent(
  file: UploadedProcurementFile,
  documentType: ProcurementDocumentType
): Promise<ExtractedContent> {
  const lowerName = file.fileName.toLowerCase();
  const mediaType = file.mediaType.toLowerCase();

  if (isSpreadsheet(lowerName, mediaType)) {
    return extractSpreadsheet(file);
  }

  if (isTextLike(lowerName, mediaType)) {
    const text = TEXT_DECODER.decode(file.buffer);
    return {
      fileName: file.fileName,
      extractionMode: "text_or_csv",
      text,
      rows: parseDelimitedRows(text),
      warnings: [],
    };
  }

  if (isAiReadableBinary(mediaType) && canUseAnthropic()) {
    return extractBinaryWithAnthropic(file, documentType);
  }

  return {
    fileName: file.fileName,
    extractionMode: "unsupported_binary",
    text: "",
    rows: [],
    warnings: [
      `${file.fileName} needs document AI/OCR. Configure ANTHROPIC_API_KEY for PDF and receipt image extraction.`,
    ],
  };
}

async function extractSpreadsheet(file: UploadedProcurementFile): Promise<ExtractedContent> {
  const xlsx = await import("xlsx");
  const workbook = xlsx.read(file.buffer, { type: "buffer", cellDates: true });
  const rows: Array<Record<string, unknown>> = [];
  const textParts: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const sheetRows = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
      raw: false,
    });
    rows.push(...sheetRows);
    textParts.push(`${sheetName}\n${xlsx.utils.sheet_to_csv(sheet)}`);
  }

  return {
    fileName: file.fileName,
    extractionMode: "spreadsheet",
    text: textParts.join("\n\n"),
    rows,
    warnings: [],
  };
}

async function extractBinaryWithAnthropic(
  file: UploadedProcurementFile,
  documentType: ProcurementDocumentType
): Promise<ExtractedContent> {
  const mediaType = normalizeMediaType(file.mediaType);
  const isImage = mediaType.startsWith("image/");
  const blockType = isImage ? "image" : "document";
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model:
        process.env.OPCOPILOT_DOCUMENT_MODEL ||
        process.env.ANTHROPIC_DEFAULT_MODEL ||
        "claude-3-5-sonnet-latest",
      max_tokens: 3500,
      temperature: 0,
      system:
        "You extract procurement, inventory, receipt, and invoice line items. Return only JSON. Do not guess numbers that are not visible.",
      messages: [
        {
          role: "user",
          content: [
            {
              type: blockType,
              source: {
                type: "base64",
                media_type: mediaType,
                data: file.buffer.toString("base64"),
              },
            },
            {
              type: "text",
              text: buildExtractionPrompt(documentType, file.fileName),
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Document extraction failed: ${body.slice(0, 300)}`);
  }

  const payload = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const text = (payload.content ?? [])
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("");
  const parsed = parseJsonObject<AiExtractionResult>(text);
  const rows = parsed.lines ?? [];

  return {
    fileName: file.fileName,
    extractionMode: "document_ai",
    text,
    rows: rows.map((row) => ({
      ...row,
      supplierName: row.supplierName ?? parsed.supplierName,
      purchasedAt: row.purchasedAt ?? parsed.documentDate,
      invoiceReference: row.invoiceReference ?? parsed.invoiceReference,
    })),
    warnings: parsed.warnings ?? [],
  };
}

async function normalizeFreeformTextWithAi({
  documentType,
  fileName,
  text,
}: {
  documentType: ProcurementDocumentType;
  fileName: string;
  text: string;
}) {
  const result = await generateText({
    feature: "procurement-document-normalizer",
    responseFormat: "json",
    temperature: 0,
    maxTokens: 3000,
    system:
      "You normalize messy procurement documents into structured line items. Return only JSON. Do not invent prices, quantities, suppliers, dates, or SKUs.",
    prompt: `${buildExtractionPrompt(documentType, fileName)}\n\nDOCUMENT TEXT:\n${text.slice(0, 18000)}`,
  });

  const parsed = parseJsonObject<AiExtractionResult>(result.text);
  const rows = (parsed.lines ?? [])
    .map((row) =>
      normalizeProcurementRow({
        row: {
          ...row,
          supplierName: row.supplierName ?? parsed.supplierName,
          purchasedAt: row.purchasedAt ?? parsed.documentDate,
          invoiceReference: row.invoiceReference ?? parsed.invoiceReference,
        },
        documentType,
        sourceFileName: fileName,
      })
    )
    .filter(Boolean) as NormalizedProcurementLine[];

  return { lines: rows, warnings: parsed.warnings ?? [] };
}

function buildExtractionPrompt(documentType: ProcurementDocumentType, fileName: string) {
  return `Extract line items from ${fileName} as a ${documentType}.
Return JSON exactly like:
{
  "supplierName": "vendor if visible",
  "documentDate": "YYYY-MM-DD if visible",
  "invoiceReference": "invoice or receipt number if visible",
  "warnings": [],
  "lines": [
    {
      "sku": "visible SKU or blank",
      "itemName": "product or inventory item name",
      "category": "plain-language category",
      "unit": "case, each, lb, gallon, bundle, etc.",
      "supplierName": "line supplier if visible",
      "quantity": 0,
      "onHandQuantity": 0,
      "reorderPointQuantity": 0,
      "targetStockQuantity": 0,
      "averageDailyUse": 0,
      "unitPrice": 0,
      "lineTotal": 0,
      "purchasedAt": "YYYY-MM-DD",
      "invoiceReference": "reference"
    }
  ]
}
Rules: preserve visible facts, normalize units, leave unknown fields blank, and never fabricate savings.`;
}

function normalizeProcurementRow({
  row,
  documentType,
  sourceFileName,
}: {
  row: Record<string, unknown>;
  documentType: ProcurementDocumentType;
  sourceFileName: string;
}): NormalizedProcurementLine | null {
  const itemName = readString(row, [
    "itemName",
    "item",
    "product",
    "productName",
    "description",
    "itemDescription",
    "inventoryItem",
    "name",
  ]);
  if (!itemName) return null;

  const sku =
    readString(row, ["sku", "itemSku", "productSku", "partNumber", "itemNumber"]) ||
    buildSku(itemName);
  const category =
    readString(row, ["category", "department", "class", "type"]) || inferCategory(itemName);
  const supplierName = readString(row, ["supplierName", "supplier", "vendor", "vendorName"]);
  const unit = readString(row, ["unit", "uom", "unitOfMeasure", "pack", "package"]) || "unit";
  const unitPriceCents = readCents(row, ["unitPriceCents", "unitCostCents", "unitPrice", "price", "cost"]);
  const lineTotalCents = readCents(row, ["lineTotalCents", "lineTotal", "total", "amount", "extendedPrice"]);

  const confidence =
    itemName && (unitPriceCents || documentType === "inventory_sheet") ? "high" : "medium";

  return {
    sku,
    itemName,
    category,
    unit,
    supplierName: supplierName || undefined,
    quantity: readNumber(row, ["quantity", "qty", "orderedQuantity", "purchasedQuantity"]),
    onHandQuantity: readNumber(row, ["onHandQuantity", "onHand", "currentStock", "stock", "count"]),
    reorderPointQuantity: readNumber(row, ["reorderPointQuantity", "reorderPoint", "par", "min"]),
    targetStockQuantity: readNumber(row, ["targetStockQuantity", "targetStock", "target", "max"]),
    averageDailyUse: readNumber(row, ["averageDailyUse", "dailyUse", "avgDailyUse", "usage"]),
    unitPriceCents,
    lineTotalCents,
    purchasedAt: readDate(row, ["purchasedAt", "date", "invoiceDate", "receiptDate"]),
    invoiceReference:
      readString(row, ["invoiceReference", "invoiceNumber", "receiptNumber", "orderNumber"]) ||
      undefined,
    sourceFileName,
    confidence,
    notes: documentType === "inventory_sheet" ? "Normalized inventory upload" : undefined,
  };
}

function parseDelimitedRows(text: string): Array<Record<string, unknown>> {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const delimiter = detectDelimiter(lines[0] ?? "");
  const headers = splitDelimitedLine(lines[0] ?? "", delimiter).map(normalizeHeader);
  if (headers.length < 2) return [];

  return lines.slice(1).map((line) => {
    const cells = splitDelimitedLine(line, delimiter);
    return headers.reduce<Record<string, unknown>>((record, header, index) => {
      if (header) record[header] = cells[index] ?? "";
      return record;
    }, {});
  });
}

function detectDelimiter(header: string) {
  const tabs = (header.match(/\t/g) ?? []).length;
  const commas = (header.match(/,/g) ?? []).length;
  const semicolons = (header.match(/;/g) ?? []).length;
  if (tabs >= commas && tabs >= semicolons) return "\t";
  if (semicolons > commas) return ";";
  return ",";
}

function splitDelimitedLine(line: string, delimiter: string) {
  if (delimiter !== ",") return line.split(delimiter).map((cell) => cell.trim());

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

function normalizeHeader(value: string) {
  return value
    .trim()
    .replace(/^\uFEFF/, "")
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, char: string) => char.toUpperCase())
    .replace(/^[A-Z]/, (char) => char.toLowerCase());
}

function readString(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const direct = row[key];
    if (typeof direct === "string" && direct.trim()) return direct.trim();
    if (typeof direct === "number" && Number.isFinite(direct)) return String(direct);
    const matchedKey = Object.keys(row).find(
      (candidate) => normalizeHeader(candidate).toLowerCase() === key.toLowerCase()
    );
    const matched = matchedKey ? row[matchedKey] : undefined;
    if (typeof matched === "string" && matched.trim()) return matched.trim();
    if (typeof matched === "number" && Number.isFinite(matched)) return String(matched);
  }
  return "";
}

function readNumber(row: Record<string, unknown>, keys: string[]) {
  const raw = readString(row, keys);
  if (!raw) return undefined;
  const parsed = Number.parseFloat(raw.replace(/[$,%]/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readCents(row: Record<string, unknown>, keys: string[]) {
  const value = readNumber(row, keys);
  if (value === undefined) return undefined;
  return Math.round(value > 999 ? value : value * 100);
}

function readDate(row: Record<string, unknown>, keys: string[]) {
  const raw = readString(row, keys);
  if (!raw) return undefined;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString().slice(0, 10);
}

function buildSku(itemName: string) {
  return itemName
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function inferCategory(itemName: string) {
  const normalized = itemName.toLowerCase();
  if (/milk|cheese|cream|butter|yogurt/.test(normalized)) return "dairy";
  if (/flour|sugar|yeast|dough|bread|bakery/.test(normalized)) return "bakery";
  if (/tomato|lettuce|onion|pepper|produce|fruit|vegetable/.test(normalized)) return "produce";
  if (/shingle|roof|underlayment|nail|flashing/.test(normalized)) return "roofing";
  if (/mulch|soil|fertilizer|seed|plant/.test(normalized)) return "landscaping";
  if (/bag|glove|cleaner|soap|towel|janitorial/.test(normalized)) return "janitorial";
  return "supplies";
}

function dedupeLines(lines: NormalizedProcurementLine[]) {
  const seen = new Set<string>();
  return lines.filter((line) => {
    const key = [
      line.sourceFileName,
      line.invoiceReference,
      line.sku,
      line.supplierName,
      line.unitPriceCents,
      line.lineTotalCents,
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function toStandardizedCsv(lines: NormalizedProcurementLine[]) {
  const headers = [
    "sku",
    "itemName",
    "category",
    "unit",
    "supplierName",
    "quantity",
    "onHandQuantity",
    "reorderPointQuantity",
    "targetStockQuantity",
    "averageDailyUse",
    "unitPrice",
    "lineTotal",
    "purchasedAt",
    "invoiceReference",
    "confidence",
  ];
  return [
    headers.join(","),
    ...lines.map((line) =>
      headers
        .map((header) => {
          const value = csvValue(line, header);
          return `"${String(value ?? "").replace(/"/g, '""')}"`;
        })
        .join(",")
    ),
  ].join("\n");
}

function csvValue(line: NormalizedProcurementLine, header: string) {
  if (header === "unitPrice") return centsToDollars(line.unitPriceCents);
  if (header === "lineTotal") return centsToDollars(line.lineTotalCents);
  return line[header as keyof NormalizedProcurementLine] ?? "";
}

function centsToDollars(cents?: number) {
  return cents === undefined ? "" : (cents / 100).toFixed(2);
}

function parseJsonObject<T>(text: string): T {
  const trimmed = text.trim();
  const json = trimmed.startsWith("```")
    ? trimmed.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim()
    : trimmed;
  const start = json.indexOf("{");
  const end = json.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("AI returned no JSON object.");
  return JSON.parse(json.slice(start, end + 1)) as T;
}

function isSpreadsheet(fileName: string, mediaType: string) {
  return (
    /\.(xlsx|xls|xlsm|ods)$/i.test(fileName) ||
    mediaType.includes("spreadsheet") ||
    mediaType.includes("excel")
  );
}

function isTextLike(fileName: string, mediaType: string) {
  return (
    /\.(csv|tsv|txt|json)$/i.test(fileName) ||
    mediaType.startsWith("text/") ||
    mediaType.includes("json") ||
    mediaType.includes("csv")
  );
}

function isAiReadableBinary(mediaType: string) {
  return mediaType.startsWith("image/") || mediaType === "application/pdf";
}

function normalizeMediaType(mediaType: string) {
  if (mediaType === "image/jpg") return "image/jpeg";
  return mediaType || "application/pdf";
}

function canUseAnthropic() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}
