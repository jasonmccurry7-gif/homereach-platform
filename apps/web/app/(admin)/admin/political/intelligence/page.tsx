import { loadPoliticalOverviewSection } from "@/lib/political/admin-command";
import { CommandSection } from "../_components/CommandSection";

export const dynamic = "force-dynamic";
export const metadata = { title: "Intelligence - Political - HomeReach" };

export default async function PoliticalIntelligencePage() {
  const data = await loadPoliticalOverviewSection();

  return (
    <CommandSection
      eyebrow="Strategic Guidance"
      title="Political Intelligence"
      subtitle="Decision engine outputs, route density, district intelligence, priority scoring, timing urgency, and compliant geographic recommendations."
      primaryHref="/political/simulator"
      primaryLabel="Strategy Simulator"
      secondaryHref="/admin/political/data-sources"
      secondaryLabel="Data Sources"
      data={data}
    />
  );
}
