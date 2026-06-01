import { notFound, redirect } from "next/navigation";
import { OperationsCopilotShell } from "@/components/operations-copilot/operations-copilot-shell";
import { getOperationsCopilotSessionUser } from "@/lib/operations-copilot/auth";
import { isOperationsCopilotEnabled } from "@/lib/operations-copilot/feature-flag";

export const dynamic = "force-dynamic";

export default async function OperationsCopilotLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isOperationsCopilotEnabled()) notFound();

  const user = await getOperationsCopilotSessionUser();
  if (!user) redirect("/login?redirect=/operations-copilot");

  return <OperationsCopilotShell>{children}</OperationsCopilotShell>;
}
