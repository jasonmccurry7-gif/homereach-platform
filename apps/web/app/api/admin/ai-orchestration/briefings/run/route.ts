import { NextResponse } from "next/server";
import { requireAdminOrCron } from "@/lib/auth/api-guards";
import {
  inferBriefingTypeForEasternTime,
  runOperationalBriefing,
  type OperationalBriefingType,
} from "@/lib/ai-orchestration/briefings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const TYPES = new Set<OperationalBriefingType>(["morning", "evening", "manual", "cron"]);

function normalizeType(value: string | null | undefined): OperationalBriefingType | null {
  if (!value) return null;
  return TYPES.has(value as OperationalBriefingType) ? (value as OperationalBriefingType) : null;
}

async function run(req: Request, method: "GET" | "POST") {
  const guard = await requireAdminOrCron(req);
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  let requestedType = normalizeType(url.searchParams.get("type"));

  if (method === "POST") {
    try {
      const body = await req.json();
      requestedType = normalizeType(body?.type) ?? requestedType;
    } catch {
      // Empty POST bodies are allowed so the admin UI can trigger a manual run safely.
    }
  }

  const type = requestedType ?? (method === "GET" ? inferBriefingTypeForEasternTime() : "manual");
  const triggeredBy = guard.user ? "admin" : "cron";
  const result = await runOperationalBriefing({ type, triggeredBy });

  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

export async function GET(req: Request) {
  return run(req, "GET");
}

export async function POST(req: Request) {
  return run(req, "POST");
}
