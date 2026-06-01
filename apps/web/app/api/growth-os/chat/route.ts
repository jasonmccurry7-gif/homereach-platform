import { NextResponse } from "next/server";
import { buildGrowthOsAiContext } from "@/lib/growth-os/ai-context";
import { getGrowthOsSessionUser } from "@/lib/growth-os/auth";
import { generateGrowthOsChatAnswer } from "@/lib/growth-os/chat";
import { isGrowthOsEnabled } from "@/lib/growth-os/feature-flag";
import { growthOsChatSchema } from "@/lib/growth-os/validators";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isGrowthOsEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const user = await getGrowthOsSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = growthOsChatSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid message" },
      { status: 400 }
    );
  }

  const context = await buildGrowthOsAiContext(user.id);
  if (!context) {
    return NextResponse.json(
      { error: "Business profile is required first" },
      { status: 409 }
    );
  }

  const answer = await generateGrowthOsChatAnswer({
    context,
    question: parsed.data.message,
  });

  return NextResponse.json({
    answer,
    usedFallback: !process.env.FSGOS_ANTHROPIC_API_KEY,
  });
}
