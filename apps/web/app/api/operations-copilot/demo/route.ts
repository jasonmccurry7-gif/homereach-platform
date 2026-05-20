import { NextResponse } from "next/server";
import { getOperationsCopilotSessionUser } from "@/lib/operations-copilot/auth";
import { isOperationsCopilotEnabled } from "@/lib/operations-copilot/feature-flag";
import { seedOperationsCopilotDemoData } from "@/lib/operations-copilot/intelligence";

export const dynamic = "force-dynamic";

export async function POST() {
  if (!isOperationsCopilotEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const user = await getOperationsCopilotSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await seedOperationsCopilotDemoData(user.id);
  return NextResponse.json(result);
}
