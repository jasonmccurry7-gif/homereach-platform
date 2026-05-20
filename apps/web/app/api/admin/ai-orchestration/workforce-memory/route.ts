import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api-guards";
import {
  enqueueAiWorkforceIngestionSource,
  enqueueAiWorkforceTask,
  getAiWorkforceFoundationState,
  recordAiWorkforceEvent,
  upsertAiWorkforceMemoryItem,
} from "@/lib/ai-orchestration/workforce-memory";
import { syncAiWorkforceDomainMemory } from "@/lib/ai-orchestration/workforce-domain-sync";
import { syncAiWorkforceSignals } from "@/lib/ai-orchestration/workforce-memory-sync";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) {
    return guard.response;
  }

  const state = await getAiWorkforceFoundationState();
  return NextResponse.json(state);
}

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) {
    return guard.response;
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const operation = String((body as Record<string, unknown>).operation ?? "");
  if (operation === "sync_signals") {
    try {
      const result = await syncAiWorkforceSignals(guard.user?.id ?? null);
      return NextResponse.json({ ok: true, operation, result });
    } catch (error) {
      return NextResponse.json({
        error: error instanceof Error ? error.message : String(error),
      }, { status: 500 });
    }
  }
  if (operation === "sync_domain_memory") {
    try {
      const result = await syncAiWorkforceDomainMemory(guard.user?.id ?? null);
      return NextResponse.json({ ok: true, operation, result });
    } catch (error) {
      return NextResponse.json({
        error: error instanceof Error ? error.message : String(error),
      }, { status: 500 });
    }
  }

  const payload = (body as Record<string, unknown>).payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json({ error: "payload is required." }, { status: 400 });
  }

  try {
    if (operation === "record_event") {
      const result = await recordAiWorkforceEvent(payload as Parameters<typeof recordAiWorkforceEvent>[0]);
      return NextResponse.json({ ok: true, operation, result });
    }
    if (operation === "upsert_memory") {
      const result = await upsertAiWorkforceMemoryItem(payload as Parameters<typeof upsertAiWorkforceMemoryItem>[0]);
      return NextResponse.json({ ok: true, operation, result });
    }
    if (operation === "enqueue_task") {
      const result = await enqueueAiWorkforceTask(payload as Parameters<typeof enqueueAiWorkforceTask>[0]);
      return NextResponse.json({ ok: true, operation, result });
    }
    if (operation === "enqueue_ingestion") {
      const result = await enqueueAiWorkforceIngestionSource(payload as Parameters<typeof enqueueAiWorkforceIngestionSource>[0]);
      return NextResponse.json({ ok: true, operation, result });
    }

    return NextResponse.json({
      error: "Unsupported operation.",
      allowed: ["sync_signals", "sync_domain_memory", "record_event", "upsert_memory", "enqueue_task", "enqueue_ingestion"],
    }, { status: 400 });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
