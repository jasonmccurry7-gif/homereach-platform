import { loadPoliticalOverviewSection } from "@/lib/political/admin-command";
import { CommandSection } from "../_components/CommandSection";

export const dynamic = "force-dynamic";
export const metadata = { title: "Compliance - Political - HomeReach" };

export default async function PoliticalCompliancePage() {
  const data = await loadPoliticalOverviewSection();

  return (
    <CommandSection
      eyebrow="Compliance"
      title="Data Sources and Compliance Control"
      subtitle="Aggregate-only route logistics, public data provenance, no voter prediction, no ideology inference, no individual persuasion scoring."
      primaryHref="/admin/political/data-sources"
      primaryLabel="Data Sources"
      secondaryHref="/political/data-sources"
      secondaryLabel="Public Methodology"
      data={data}
    />
  );
}
