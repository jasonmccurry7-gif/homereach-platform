import { NextResponse } from "next/server";
import { getOperationsCopilotSessionUser } from "@/lib/operations-copilot/auth";
import { isOperationsCopilotEnabled } from "@/lib/operations-copilot/feature-flag";
import {
  answerOperationsQuestion,
  buildOperationsCopilotSnapshot,
} from "@/lib/operations-copilot/intelligence";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isOperationsCopilotEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const user = await getOperationsCopilotSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message =
    typeof body === "object" &&
    body !== null &&
    "message" in body &&
    typeof body.message === "string"
      ? body.message.trim()
      : "";

  if (message.length < 2) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  const snapshot = await buildOperationsCopilotSnapshot(user.id);
  const answer = answerOperationsQuestion({ snapshot, message });

  return NextResponse.json({
    answer,
    source: "deterministic_operations_engine",
    confidence: "medium",
  });
}
