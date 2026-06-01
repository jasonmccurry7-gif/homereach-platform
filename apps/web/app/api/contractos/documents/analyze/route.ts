import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { analyzeContractOSDocument } from "@/lib/contractos/document-analyzer";
import { contractOSFeatureFlags } from "@/lib/contractos/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 18 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = /\.(pdf|txt|md|csv|rtf)$/i;

function sanitizeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9_. -]/g, "_").slice(0, 140) || "contractos-upload";
}

function noStore(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      "Cache-Control": "no-store",
      ...(init?.headers ?? {}),
    },
  });
}

export async function POST(request: Request) {
  const flags = contractOSFeatureFlags();
  if (!flags.enabled || !flags.documentAnalyzer) {
    return noStore({ ok: false, error: "ContractOS document analysis is not enabled." }, { status: 404 });
  }

  const limited = checkRateLimit(request, {
    key: "contractos-document-analyze",
    limit: 8,
    windowMs: 10 * 60_000,
  });
  if (limited) return limited;

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return noStore({ ok: false, error: "Invalid multipart form data." }, { status: 400 });
  }

  const fileValue = formData.get("file");
  const pastedTextValue = formData.get("text");
  const pastedText = typeof pastedTextValue === "string" ? pastedTextValue.trim() : "";

  let buffer: Buffer | undefined;
  let fileName = "pasted-solicitation-text.txt";
  let mimeType = "text/plain";

  if (fileValue instanceof File && fileValue.size > 0) {
    fileName = sanitizeFileName(fileValue.name || "contractos-upload");
    mimeType = fileValue.type || "application/octet-stream";

    if (fileValue.size > MAX_FILE_BYTES) {
      return noStore(
        { ok: false, error: "File is too large. Upload a document under 18 MB." },
        { status: 413 },
      );
    }

    if (!ACCEPTED_EXTENSIONS.test(fileName) && !mimeType.startsWith("text/") && !mimeType.includes("pdf")) {
      return noStore(
        {
          ok: false,
          error: "Unsupported file type. Upload PDF, TXT, MD, CSV, or RTF for this ContractOS parser.",
        },
        { status: 415 },
      );
    }

    buffer = Buffer.from(await fileValue.arrayBuffer());
  }

  if (!buffer && !pastedText) {
    return noStore(
      { ok: false, error: "Upload a solicitation document or paste RFQ/RFP/SOW text." },
      { status: 400 },
    );
  }

  const analysis = await analyzeContractOSDocument({
    fileName,
    mimeType,
    buffer,
    pastedText,
  });

  return noStore({
    ok: true,
    analysis,
    approvalGate:
      "Draft - Human Review Required. This analysis does not certify compliance, approve pricing, or submit a bid.",
  });
}
