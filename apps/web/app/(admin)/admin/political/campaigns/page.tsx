import { loadPoliticalCampaignsSection } from "@/lib/political/admin-command";
import { CommandSection } from "../_components/CommandSection";

export const dynamic = "force-dynamic";
export const metadata = { title: "Campaigns - Political - HomeReach" };

export default async function PoliticalCampaignsPage() {
  const data = await loadPoliticalCampaignsSection();

  return (
    <CommandSection
      eyebrow="Execution OS"
      title="Campaign Portfolio"
      subtitle="Organization-level campaign records, pipeline stage, geography, election date, budget signal, and route reservation context."
      primaryHref="/admin/political/leads"
      primaryLabel="Convert Leads"
      secondaryHref="/admin/political/organizations"
      secondaryLabel="Organizations"
      data={data}
      emptyLabel="No campaign execution records yet. Convert an inbound lead or attach a campaign to a candidate."
    />
  );
}
