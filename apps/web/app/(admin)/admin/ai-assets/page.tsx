import type { Metadata } from "next";
import { AiAssetsCommandCenter } from "@/components/ai-assets/ai-assets-command-center";
import { loadAiAssetsCommandCenter } from "@/lib/ai-assets/repository";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AI Assets Command Center | HomeReach Admin",
  description:
    "Central HomeReach AI business context, SOP prompts, data sources, agent instructions, prompt chains, verification, and daily output review.",
};

export default async function AiAssetsAdminPage() {
  const data = await loadAiAssetsCommandCenter();

  return <AiAssetsCommandCenter data={data} />;
}
