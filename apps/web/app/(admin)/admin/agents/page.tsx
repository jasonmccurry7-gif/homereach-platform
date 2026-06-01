import { AiWorkforceCommandCenter } from "@/components/ai-workforce/ai-workforce-command-center";
import { loadAiWorkforceCommandCenter } from "@/lib/ai-workforce/repository";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const data = await loadAiWorkforceCommandCenter();
  return <AiWorkforceCommandCenter data={data} />;
}
