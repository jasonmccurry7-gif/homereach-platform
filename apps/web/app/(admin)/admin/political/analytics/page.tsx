import { loadPoliticalMailCommandCenter } from "@/lib/political/mail-command-center";
import { PoliticalMailCommandCenter } from "../_components/PoliticalMailCommandCenter";

export const dynamic = "force-dynamic";
export const metadata = { title: "Analytics - Political - HomeReach" };

export default async function PoliticalAnalyticsPage() {
  const data = await loadPoliticalMailCommandCenter();

  return <PoliticalMailCommandCenter data={data} />;
}
