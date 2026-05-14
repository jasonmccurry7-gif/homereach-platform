// ─────────────────────────────────────────────────────────────────────────────
// Minimal RFC 4180 CSV parser.
//
// We don't pull a dep for this. CSV is a small, well-defined format and the
// admin-import use case has predictable inputs (USPS EDDM exports, FEC
// committee bulk converted to CSV, OH SoS PAC exports).
//
// Supported:
//   • Comma delimiter (configurable)
//   • Optional quoted fields with "" escape for embedded quotes
//   • CRLF or LF line endings
//   • Header row (always first row)
//   • Blank trailing lines ignored
//
// NOT supported (intentionally — would invite ambiguity):
//   • Multi-character delimiters
//   • Comment lines
//   • Custom escape characters other than ""
//
// If a real-world file breaks the parser, the right fix is to clean the
// file — not to expand this parser into a Pandora's box.
// ─────────────────────────────────────────────────────────────────────────────

export interface CsvParseOptions {
  /** Field delimiter. Default: ','. Pass '\t' for TSV. */
  delimiter?: string;
}

export interface CsvParseResult {
  /** Header row, normalized: lowercased + trimmed. */
  headers: string[];
  /** Data rows as objects keyed by header. Empty fields → empty string. */
  rows: Record<string, string>[];
  /** Total raw line count including header. */
  totalLines: number;
}

export function parseCsv(text: string, options: CsvParseOptions = {}): CsvParseResult {
  const delimiter = options.delimiter ?? ",";
  if (delimiter.length !== 1) {
    throw new Error("parseCsv: delimiter must be a single character");
  }

  // Strip BOM if present
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }

  const records = tokenize(text, delimiter);
  const totalLines = records.length;

  if (records.length === 0) {
    return { headers: [], rows: [], totalLines: 0 };
  }

  // Normalize headers: lowercased, trimmed, internal whitespace collapsed
  // to a single underscore. This lets vendor exports with headers like
  // "Carrier Route" or "Mailing Zip" work against alias maps that use the
  // canonical underscore form.
  const headerRecord = records[0];
  if (!headerRecord) {
    return { headers: [], rows: [], totalLines: 0 };
  }
  const headers = headerRecord.map((h) =>
    h.trim().toLowerCase().replace(/\s+/g, "_")
  );
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < records.length; i++) {
    const fields = records[i];
    if (!fields) continue;

    // Skip wholly blank rows (common at end of file)
    const isBlank = fields.length === 0 || fields.every((f) => f.length === 0);
    if (isBlank) continue;

    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      const header = headers[j];
      if (!header) continue;
      row[header] = (fields[j] ?? "").trim();
    }
    rows.push(row);
  }

  return { headers, rows, totalLines };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tokenizer — splits text into rows of fields, respecting quotes.
// ─────────────────────────────────────────────────────────────────────────────

function tokenize(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const len = text.length;

  while (i < len) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < len && text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }

    // Not in quotes
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }

    if (ch === delimiter) {
      current.push(field);
      field = "";
      i++;
      continue;
    }

    if (ch === "\n" || ch === "\r") {
      current.push(field);
      rows.push(current);
      current = [];
      field = "";
      // Consume CRLF as one newline
      if (ch === "\r" && i + 1 < len && text[i + 1] === "\n") {
        i += 2;
      } else {
        i++;
      }
      continue;
    }

    field += ch;
    i++;
  }

  // Flush the trailing field/row
  if (field.length > 0 || current.length > 0) {
    current.push(field);
    rows.push(current);
  }

  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// SHA-256 of arbitrary text — used for file-level dup detection.
// Uses Web Crypto so it runs the same in Node 20+ and in the browser.
// ─────────────────────────────────────────────────────────────────────────────

export async function sha256Hex(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}
