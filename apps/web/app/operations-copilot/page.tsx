import { OperationsCommandCenter } from "@/components/operations-copilot/command-center";
import { getOperationsCopilotSessionUser } from "@/lib/operations-copilot/auth";
import { buildOperationsCopilotSnapshot } from "@/lib/operations-copilot/intelligence";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Inventory Purchasing Dashboard - HomeReach",
  description:
    "Inventory, supplier pricing, purchasing approvals, savings opportunities, and operational purchasing intelligence for HomeReach customers.",
};

export default async function OperationsCopilotPage() {
  const user = await getOperationsCopilotSessionUser();
  if (!user) return null;

  const snapshot = await buildOperationsCopilotSnapshot(user.id);

  return <OperationsCommandCenter snapshot={snapshot} />;
}
