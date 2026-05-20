import { OperationsCommandCenter } from "@/components/operations-copilot/command-center";
import { getOperationsCopilotSessionUser } from "@/lib/operations-copilot/auth";
import { buildOperationsCopilotSnapshot } from "@/lib/operations-copilot/intelligence";

export const dynamic = "force-dynamic";

export default async function OperationsCopilotPage() {
  const user = await getOperationsCopilotSessionUser();
  if (!user) return null;

  const snapshot = await buildOperationsCopilotSnapshot(user.id);

  return <OperationsCommandCenter snapshot={snapshot} />;
}
