import { loadPoliticalOverviewSection } from "@/lib/political/admin-command";
import { CommandSection } from "../_components/CommandSection";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings - Political - HomeReach" };

export default async function PoliticalSettingsPage() {
  const data = await loadPoliticalOverviewSection();

  return (
    <CommandSection
      eyebrow="Configuration"
      title="Political Platform Settings"
      subtitle="Operational configuration visibility for routes, data imports, proposals, payment readiness, follow-up systems, and source transparency."
      primaryHref="/admin/political/data-sources"
      primaryLabel="Data Sources"
      secondaryHref="/admin/political/imports"
      secondaryLabel="Imports"
      data={data}
    />
  );
}
