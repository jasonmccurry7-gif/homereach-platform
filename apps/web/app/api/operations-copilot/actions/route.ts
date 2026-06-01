import { z } from "zod";
import { getOperationsCopilotSessionUser } from "@/lib/operations-copilot/auth";
import { isOperationsCopilotEnabled } from "@/lib/operations-copilot/feature-flag";
import {
  approvalLockedPayload,
  guardSupplifyMutation,
  jsonNoStore,
  sanitizeActionType,
  sanitizeText,
} from "@/lib/operations-copilot/governance";
import { createOperationsCopilotActionRequest } from "@/lib/operations-copilot/intelligence";

export const dynamic = "force-dynamic";

const actionRequestSchema = z.object({
  actionType: z.string().min(2).max(120),
  title: z.string().max(180).optional(),
  payload: z.record(z.unknown()).optional(),
});

export async function POST(req: Request) {
  if (!isOperationsCopilotEnabled()) {
    return jsonNoStore({ error: "Not found" }, { status: 404 });
  }

  const user = await getOperationsCopilotSessionUser();
  if (!user) return jsonNoStore({ error: "Unauthorized" }, { status: 401 });

  const guard = guardSupplifyMutation(req, {
    key: "opcopilot_action_request",
    limit: 40,
    userId: user.id,
  });
  if (guard) return guard;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonNoStore({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = actionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonNoStore(
      { error: "Invalid action request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const actionType = sanitizeActionType(parsed.data.actionType);
  if (!actionType) {
    return jsonNoStore({ error: "Action type is required" }, { status: 400 });
  }
  const requestPayload = approvalLockedPayload({
    requestedFrom: "operations_copilot_console",
    ...(parsed.data.payload ?? {}),
  });

  const request = await createOperationsCopilotActionRequest({
    userId: user.id,
    actionType,
    title: sanitizeText(parsed.data.title, actionType.replaceAll("_", " "), 180),
    payload: requestPayload,
  });

  if (!request) {
    return jsonNoStore(
      { error: "Action request could not be created" },
      { status: 500 }
    );
  }

  return jsonNoStore({
    id: request.id,
    title: request.title,
    status: request.status,
    approvalRequired: request.approvalRequired,
  });
}
