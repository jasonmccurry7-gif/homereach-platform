import { z } from "zod";
import { getOperationsCopilotSessionUser } from "@/lib/operations-copilot/auth";
import { isOperationsCopilotEnabled } from "@/lib/operations-copilot/feature-flag";
import {
  guardSupplifyMutation,
  jsonNoStore,
} from "@/lib/operations-copilot/governance";
import {
  listOperationsCopilotApprovals,
  resolveOperationsCopilotActionRequest,
} from "@/lib/operations-copilot/intelligence";

export const dynamic = "force-dynamic";

const approvalDecisionSchema = z.object({
  requestId: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
});

export async function GET() {
  if (!isOperationsCopilotEnabled()) {
    return jsonNoStore({ error: "Not found" }, { status: 404 });
  }

  const user = await getOperationsCopilotSessionUser();
  if (!user) return jsonNoStore({ error: "Unauthorized" }, { status: 401 });

  const approvals = await listOperationsCopilotApprovals(user.id);
  return jsonNoStore({ approvals });
}

export async function PATCH(req: Request) {
  if (!isOperationsCopilotEnabled()) {
    return jsonNoStore({ error: "Not found" }, { status: 404 });
  }

  const user = await getOperationsCopilotSessionUser();
  if (!user) return jsonNoStore({ error: "Unauthorized" }, { status: 401 });

  const guard = guardSupplifyMutation(req, {
    key: "opcopilot_approval_decision",
    limit: 30,
    userId: user.id,
  });
  if (guard) return guard;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonNoStore({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = approvalDecisionSchema.safeParse(body);
  if (!parsed.success) {
    return jsonNoStore(
      { error: "requestId and decision are required", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const request = await resolveOperationsCopilotActionRequest({
    userId: user.id,
    requestId: parsed.data.requestId,
    decision: parsed.data.decision,
  });

  if (!request) {
    return jsonNoStore(
      { error: "Action request not found or is not pending approval" },
      { status: 404 }
    );
  }

  return jsonNoStore({ request });
}
