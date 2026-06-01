import type { Metadata } from "next";
import { CreativeStudioCommandCenter } from "@/components/creative-studio/creative-studio-command-center";
import { loadCreativeStudioCommandCenter } from "@/lib/creative-studio/repository";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AI Creative Production Studio | HomeReach Admin",
  description:
    "Generate, review, score, store, and reuse approval-first HomeReach creative assets across campaigns, procurement, political, government contracts, and social.",
};

export default async function CreativeStudioPage() {
  const data = await loadCreativeStudioCommandCenter();

  return <CreativeStudioCommandCenter data={data} />;
}

