import { z } from "zod";
import { getOperationsCopilotSessionUser } from "@/lib/operations-copilot/auth";
import { isOperationsCopilotEnabled } from "@/lib/operations-copilot/feature-flag";
import {
  guardSupplifyMutation,
  jsonNoStore,
} from "@/lib/operations-copilot/governance";
import {
  answerOperationsQuestion,
  buildOperationsCopilotSnapshot,
} from "@/lib/operations-copilot/intelligence";

export const dynamic = "force-dynamic";

const chatSchema = z.object({
  message: z.string().trim().min(2).max(600),
});

export async function POST(req: Request) {
  if (!isOperationsCopilotEnabled()) {
    return jsonNoStore({ error: "Not found" }, { status: 404 });
  }

  const user = await getOperationsCopilotSessionUser();
  if (!user) return jsonNoStore({ error: "Unauthorized" }, { status: 401 });

  const guard = guardSupplifyMutation(req, {
    key: "opcopilot_chat",
    limit: 20,
    userId: user.id,
  });
  if (guard) return guard;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonNoStore({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = chatSchema.safeParse(body);
  if (!parsed.success) {
    return jsonNoStore(
      { error: "Message is required", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const snapshot = await buildOperationsCopilotSnapshot(user.id);
  const answer = answerOperationsQuestion({ snapshot, message: parsed.data.message });

  return jsonNoStore({
    answer,
    source: "deterministic_operations_engine",
    confidence: "medium",
  });
}
