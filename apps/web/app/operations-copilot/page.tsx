import { OperationsCommandCenter } from "@/components/operations-copilot/command-center";
import { getOperationsCopilotSessionUser } from "@/lib/operations-copilot/auth";
import { buildBestPriceDeliveryBoard } from "@/lib/operations-copilot/delivery-intelligence";
import { buildOperationsCopilotSnapshot } from "@/lib/operations-copilot/intelligence";
import { buildOwnerProcurementOs } from "@/lib/operations-copilot/savings-os";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Supplify Profitability Command Center - HomeReach",
  description:
    "AI-assisted profitability intelligence for margin protection, purchasing visibility, savings opportunities, risk alerts, and simple owner decisions.",
};

export default async function OperationsCopilotPage() {
  const user = await getOperationsCopilotSessionUser();
  if (!user) return null;

  const [snapshot, deliveryBoard] = await Promise.all([
    buildOperationsCopilotSnapshot(user.id),
    buildBestPriceDeliveryBoard({ userId: user.id, industryId: "roofing" }),
  ]);
  const ownerOs = buildOwnerProcurementOs({ deliveryBoard, snapshot });

  return <OperationsCommandCenter ownerOs={ownerOs} snapshot={snapshot} />;
}
