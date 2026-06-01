import "server-only";

import { generateText } from "@/lib/ai/llm";
import { isContractOSAiAnalysisEnabled } from "./config";

export type ContractOSDocumentAnalysisInput = {
  fileName: string;
  mimeType: string;
  buffer?: Buffer;
  pastedText?: string;
};

export type ContractOSDocumentAnalysis = {
  fileName: string;
  mimeType: string;
  parsedAt: string;
  parserStatus: "parsed" | "partial" | "unsupported";
  analysisMode: "ai" | "deterministic";
  summary: string;
  whatGovernmentIsBuying: string;
  submissionMethod: string;
  deadlines: string[];
  requiredDocuments: string[];
  complianceItems: string[];
  pricingWarnings: string[];
  riskFlags: string[];
  nextActions: string[];
  textPreview: string;
  warnings: string[];
};

const MAX_TEXT_CHARS = 80_000;
const DATE_PATTERN =
  /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{1,2},?\s+\d{4}\b|\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/gi;

function normalizeText(value: string) {
  return value.replace(/\r/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function unique(values: string[], limit = 10) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).slice(0, limit);
}

function includesAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

async function extractPdfText(buffer: Buffer) {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  try {
    const parsed = await parser.getText();
    return parsed.text ?? "";
  } finally {
    await parser.destroy();
  }
}

async function extractText(input: ContractOSDocumentAnalysisInput) {
  const warnings: string[] = [];
  const pasted = normalizeText(input.pastedText ?? "");
  if (pasted) {
    return { text: pasted.slice(0, MAX_TEXT_CHARS), parserStatus: "parsed" as const, warnings };
  }

  if (!input.buffer || input.buffer.length === 0) {
    return {
      text: "",
      parserStatus: "unsupported" as const,
      warnings: ["No file text or pasted solicitation text was provided."],
    };
  }

  const name = input.fileName.toLowerCase();
  const type = input.mimeType.toLowerCase();

  if (type.includes("pdf") || name.endsWith(".pdf")) {
    try {
      const text = normalizeText(await extractPdfText(input.buffer));
      return {
        text: text.slice(0, MAX_TEXT_CHARS),
        parserStatus: text ? ("parsed" as const) : ("partial" as const),
        warnings: text ? warnings : ["PDF was received, but no selectable text was extracted. OCR may be required."],
      };
    } catch (error) {
      return {
        text: "",
        parserStatus: "partial" as const,
        warnings: [
          "PDF upload was accepted, but text extraction failed. OCR/manual review is required before relying on the summary.",
          error instanceof Error ? error.message : "Unknown PDF parser error.",
        ],
      };
    }
  }

  if (
    type.startsWith("text/") ||
    name.endsWith(".txt") ||
    name.endsWith(".md") ||
    name.endsWith(".csv") ||
    name.endsWith(".rtf")
  ) {
    return {
      text: normalizeText(input.buffer.toString("utf8")).slice(0, MAX_TEXT_CHARS),
      parserStatus: "parsed" as const,
      warnings,
    };
  }

  return {
    text: "",
    parserStatus: "unsupported" as const,
    warnings: [
      "This file type was uploaded, but ContractOS could not extract text yet. Convert it to PDF/text or route it to manual review.",
    ],
  };
}

function detectRequiredDocuments(text: string) {
  const docs: string[] = [];
  const candidates: Array<[RegExp[], string]> = [
    [[/\bSF\s?1449\b/i, /\bstandard form 1449\b/i], "SF 1449 / solicitation cover form"],
    [[/\bSF\s?18\b/i, /\brequest for quotations\b/i], "SF 18 / request for quotation"],
    [[/\bcapability statement\b/i], "Capability statement"],
    [[/\btechnical (?:proposal|approach|response)\b/i], "Technical approach / proposal"],
    [[/\bmanagement (?:plan|approach)\b/i], "Management plan"],
    [[/\bpast performance\b/i], "Past performance references"],
    [[/\bpricing (?:sheet|schedule|proposal|volume)\b/i, /\bprice quote\b/i], "Pricing sheet / pricing proposal"],
    [[/\binsurance\b/i], "Insurance proof"],
    [[/\bbond(?:ing)?\b/i], "Bonding information"],
    [[/\bsubcontract(?:or|ing)\b/i], "Subcontractor plan or disclosure"],
    [[/\bcybersecurity\b/i, /\bCMMC\b/i, /\bNIST\b/i], "Cybersecurity compliance information"],
    [[/\bSAM\b/i, /\bUEI\b/i, /\bCAGE\b/i], "SAM / UEI / CAGE confirmation"],
  ];

  for (const [patterns, label] of candidates) {
    if (includesAny(text, patterns)) docs.push(label);
  }

  return unique(docs, 12);
}

function detectComplianceItems(text: string) {
  const items: string[] = [];
  const candidates: Array<[RegExp[], string]> = [
    [[/\bFAR\b/i, /\bDFARS\b/i], "FAR/DFARS clause review"],
    [[/\binsurance\b/i], "Insurance requirement review"],
    [[/\bbond(?:ing)?\b/i], "Bonding requirement review"],
    [[/\bprevailing wage\b/i, /\bDavis[- ]Bacon\b/i, /\bService Contract Act\b/i], "Labor compliance review"],
    [[/\bCMMC\b/i, /\bNIST\b/i, /\bcybersecurity\b/i], "Cybersecurity requirement review"],
    [[/\bsmall business\b/i, /\bset[- ]aside\b/i], "Set-aside eligibility review"],
    [[/\bsubcontract/i, /\bflow[- ]down\b/i], "Subcontractor and flow-down clause review"],
    [[/\bpage limit\b/i, /\bfont\b/i, /\bformat\b/i], "Formatting and page-limit review"],
  ];

  for (const [patterns, label] of candidates) {
    if (includesAny(text, patterns)) items.push(label);
  }

  return unique(items, 10);
}

function deterministicAnalysis(
  input: ContractOSDocumentAnalysisInput,
  text: string,
  parserStatus: ContractOSDocumentAnalysis["parserStatus"],
  warnings: string[],
): ContractOSDocumentAnalysis {
  const lower = text.toLowerCase();
  const requiredDocuments = detectRequiredDocuments(text);
  const complianceItems = detectComplianceItems(text);
  const deadlines = unique(text.match(DATE_PATTERN) ?? [], 8);
  const isBuyingSentence =
    text
      .split(/(?<=[.!?])\s+/)
      .find((sentence) => /\b(seeks|requires|requesting|purchase|provide|services|supplies|deliver)\b/i.test(sentence))
      ?.trim()
      .slice(0, 260) || "Review the solicitation text to confirm the exact products, services, quantities, and performance location.";

  const submissionMethod = /sam\.gov/i.test(text)
    ? "Verify the official SAM.gov notice and attachment instructions."
    : /email/i.test(text)
      ? "Email submission may be referenced; verify the exact address, subject line, deadline, and attachment rules."
      : /portal|piee|procurement/i.test(lower)
        ? "A portal submission may be required; verify portal access before bid prep."
        : "Submission method not clearly extracted; human review required.";

  const pricingWarnings = unique(
    [
      !/\b(quantity|quantities|line item|CLIN|unit price|pricing sheet|price schedule)\b/i.test(text)
        ? "Pricing basis is not clearly extracted. Do not price until quantities, CLINs, and response format are verified."
        : "",
      /\bfirm fixed price|FFP\b/i.test(text)
        ? "Firm-fixed-price language detected; scope clarity and contingency are critical before bidding."
        : "",
      /\bsite visit\b/i.test(text)
        ? "Site visit signal detected; pricing should wait for field assumptions or site visit notes."
        : "",
      /\boption year|base year|period of performance\b/i.test(text)
        ? "Period-of-performance language detected; include renewal/options in margin and cash-flow review."
        : "",
    ],
    8,
  );

  const riskFlags = unique(
    [
      parserStatus !== "parsed" ? "Document could not be fully parsed." : "",
      deadlines.length === 0 ? "No deadline was extracted from the uploaded text." : "",
      requiredDocuments.length === 0 ? "Required documents were not confidently extracted." : "",
      complianceItems.length === 0 ? "Compliance requirements need manual extraction." : "",
      /\bamendment\b/i.test(text) ? "Amendment language detected; verify all current amendments before responding." : "",
      /\bliquidated damages|penalt/i.test(text) ? "Penalty/liquidated damages signal detected." : "",
    ],
    8,
  );

  return {
    fileName: input.fileName,
    mimeType: input.mimeType,
    parsedAt: new Date().toISOString(),
    parserStatus,
    analysisMode: "deterministic",
    summary: text
      ? "ContractOS extracted the solicitation text and created a draft review. Verify all facts against the official source before pricing or submission."
      : "ContractOS received the document, but could not extract enough text for a reliable summary.",
    whatGovernmentIsBuying: isBuyingSentence,
    submissionMethod,
    deadlines,
    requiredDocuments,
    complianceItems,
    pricingWarnings,
    riskFlags,
    nextActions: [
      "Verify the official notice, attachments, amendments, and submission instructions.",
      "Complete missing compliance checklist items before pricing.",
      "Run market research and historical award review before setting a bid number.",
      "Keep final submission locked behind human approval.",
    ],
    textPreview: text.slice(0, 1_200),
    warnings,
  };
}

function hasAiProvider() {
  return isContractOSAiAnalysisEnabled() && Boolean(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY);
}

function parseAiJson(text: string) {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) return null;
  try {
    return JSON.parse(text.slice(first, last + 1)) as Partial<ContractOSDocumentAnalysis>;
  } catch {
    return null;
  }
}

async function tryAiAnalysis(base: ContractOSDocumentAnalysis, sourceText: string) {
  if (!hasAiProvider() || !sourceText) return base;

  try {
    const result = await generateText({
      feature: "contractos_document_analysis",
      responseFormat: "json",
      maxTokens: 1200,
      temperature: 0.1,
      system:
        "You summarize government contracting solicitation documents for small business owners. You never claim legal compliance, never guarantee wins, and every output remains Draft - Human Review Required.",
      prompt: `Create a concise JSON object with keys: summary, whatGovernmentIsBuying, submissionMethod, deadlines, requiredDocuments, complianceItems, pricingWarnings, riskFlags, nextActions. Use plain English and only the provided text.\n\nDocument text:\n${sourceText.slice(0, 25_000)}`,
    });

    const parsed = parseAiJson(result.text);
    if (!parsed) return base;

    return {
      ...base,
      analysisMode: "ai" as const,
      summary: typeof parsed.summary === "string" ? parsed.summary : base.summary,
      whatGovernmentIsBuying:
        typeof parsed.whatGovernmentIsBuying === "string"
          ? parsed.whatGovernmentIsBuying
          : base.whatGovernmentIsBuying,
      submissionMethod: typeof parsed.submissionMethod === "string" ? parsed.submissionMethod : base.submissionMethod,
      deadlines: Array.isArray(parsed.deadlines) ? unique(parsed.deadlines.map(String), 8) : base.deadlines,
      requiredDocuments: Array.isArray(parsed.requiredDocuments)
        ? unique(parsed.requiredDocuments.map(String), 12)
        : base.requiredDocuments,
      complianceItems: Array.isArray(parsed.complianceItems)
        ? unique(parsed.complianceItems.map(String), 10)
        : base.complianceItems,
      pricingWarnings: Array.isArray(parsed.pricingWarnings)
        ? unique(parsed.pricingWarnings.map(String), 8)
        : base.pricingWarnings,
      riskFlags: Array.isArray(parsed.riskFlags) ? unique(parsed.riskFlags.map(String), 8) : base.riskFlags,
      nextActions: Array.isArray(parsed.nextActions) ? unique(parsed.nextActions.map(String), 6) : base.nextActions,
      warnings: [
        ...base.warnings,
        `AI summary provider: ${result.provider} / ${result.modelName}. Draft - Human Review Required.`,
      ],
    };
  } catch (error) {
    return {
      ...base,
      warnings: [
        ...base.warnings,
        error instanceof Error ? `AI summarization fallback used: ${error.message}` : "AI summarization fallback used.",
      ],
    };
  }
}

export async function analyzeContractOSDocument(
  input: ContractOSDocumentAnalysisInput,
): Promise<ContractOSDocumentAnalysis> {
  const extracted = await extractText(input);
  const base = deterministicAnalysis(input, extracted.text, extracted.parserStatus, extracted.warnings);
  return tryAiAnalysis(base, extracted.text);
}
