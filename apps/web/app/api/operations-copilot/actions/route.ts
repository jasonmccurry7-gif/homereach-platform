import { NextResponse } from "next/server";
import { getOperationsCopilotSessionUser } from "@/lib/operations-copilot/auth";
import { isOperationsCopilotEnabled } from "@/lib/operations-copilot/feature-flag";
import { createOperationsCopilotActionRequest } from "@/lib/operations-copilot/intelligence";

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

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const actionType =
    "actionType" in body && typeof body.actionType === "string"
      ? body.actionType
      : "";
  const title =
    "title" in body && typeof body.title === "string"
      ? body.title
      : actionType;

  if (!actionType) {
    return NextResponse.json({ error: "Action type is required" }, { status: 400 });
  }

  const requestPayload =
    "payload" in body && isRecord(body.payload) ? body.payload : {};

  const request = await createOperationsCopilotActionRequest({
    userId: user.id,
    actionType,
    title,
    payload: {
      requestedFrom: "operations_copilot_console",
      ...requestPayload,
    },
  });

  if (!request) {
    return NextResponse.json(
      { error: "Action request could not be created" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    id: request.id,
    title: request.title,
    status: request.status,
    approvalRequired: request.approvalRequired,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
