import { getOperationsCopilotSessionUser } from "@/lib/operations-copilot/auth";
import { isOperationsCopilotEnabled } from "@/lib/operations-copilot/feature-flag";
import {
  guardSupplifyMutation,
  jsonNoStore,
} from "@/lib/operations-copilot/governance";
import { seedOperationsCopilotDemoData } from "@/lib/operations-copilot/intelligence";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isOperationsCopilotEnabled()) {
    return jsonNoStore({ error: "Not found" }, { status: 404 });
  }

  const user = await getOperationsCopilotSessionUser();
  if (!user) return jsonNoStore({ error: "Unauthorized" }, { status: 401 });

  const guard = guardSupplifyMutation(req, {
    key: "opcopilot_demo_seed",
    limit: 5,
    userId: user.id,
    windowMs: 10 * 60_000,
  });
  if (guard) return guard;

  const result = await seedOperationsCopilotDemoData(user.id);
  return jsonNoStore(result);
}
