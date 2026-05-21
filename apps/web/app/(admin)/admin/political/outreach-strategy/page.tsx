import { PoliticalOutreachStrategyCommand } from "../_components/PoliticalOutreachStrategyCommand";
import { loadPoliticalOutreachCommand } from "@/lib/political/outreach-strategy-command";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Outreach Strategy - Political - HomeReach",
};

export default async function PoliticalOutreachStrategyPage() {
  const data = await loadPoliticalOutreachCommand();
  return <PoliticalOutreachStrategyCommand data={data} />;
}
