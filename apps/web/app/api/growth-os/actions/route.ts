import { NextResponse } from "next/server";
import { buildGrowthOsAiContext } from "@/lib/growth-os/ai-context";
import { generateGrowthOsActionArtifact } from "@/lib/growth-os/actions";
import { getGrowthOsSessionUser } from "@/lib/growth-os/auth";
import { isGrowthOsEnabled } from "@/lib/growth-os/feature-flag";
import { growthOsActionArtifactSchema } from "@/lib/growth-os/validators";

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

  const parsed = growthOsActionArtifactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid artifact type" },
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

  const artifact = await generateGrowthOsActionArtifact({
    context,
    artifactType: parsed.data.artifactType,
  });

  return NextResponse.json(artifact);
}
