import { NextResponse } from "next/server";
import { getOperationsCopilotSessionUser } from "@/lib/operations-copilot/auth";
import { isOperationsCopilotEnabled } from "@/lib/operations-copilot/feature-flag";
import {
  listOperationsCopilotApprovals,
  resolveOperationsCopilotActionRequest,
} from "@/lib/operations-copilot/intelligence";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isOperationsCopilotEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const user = await getOperationsCopilotSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const approvals = await listOperationsCopilotApprovals(user.id);
  return NextResponse.json({ approvals });
}

export async function PATCH(req: Request) {
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

  const requestId =
    typeof body === "object" &&
    body !== null &&
    "requestId" in body &&
    typeof body.requestId === "string"
      ? body.requestId
      : "";
  const decision =
    typeof body === "object" &&
    body !== null &&
    "decision" in body &&
    (body.decision === "approved" || body.decision === "rejected")
      ? body.decision
      : null;

  if (!requestId || !decision) {
    return NextResponse.json(
      { error: "requestId and decision are required" },
      { status: 400 }
    );
  }

  const request = await resolveOperationsCopilotActionRequest({
    userId: user.id,
    requestId,
    decision,
  });

  if (!request) {
    return NextResponse.json({ error: "Action request not found" }, { status: 404 });
  }

  return NextResponse.json({ request });
}
