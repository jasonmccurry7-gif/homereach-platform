import { loadPoliticalCampaignsSection } from "@/lib/political/admin-command";
import { CommandSection } from "../_components/CommandSection";

export const dynamic = "force-dynamic";
export const metadata = { title: "CRM - Political - HomeReach" };

export default async function PoliticalCrmPage() {
  const data = await loadPoliticalCampaignsSection();

  return (
    <CommandSection
      eyebrow="Relationship Layer"
      title="Political CRM"
      subtitle="Candidates, campaign managers, consultants, agencies, PACs, organizations, contacts, and repeat campaign memory."
      primaryHref="/admin/political/organizations"
      primaryLabel="Organizations"
      secondaryHref="/admin/political/leads"
      secondaryLabel="Inbound Leads"
      data={data}
      emptyLabel="CRM records will appear after organizations, contacts, and campaign records are imported or created."
    />
  );
}
