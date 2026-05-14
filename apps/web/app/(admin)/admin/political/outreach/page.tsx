import { loadPoliticalFollowUpsSection } from "@/lib/political/admin-command";
import { CommandSection } from "../_components/CommandSection";

export const dynamic = "force-dynamic";
export const metadata = { title: "Outreach - Political - HomeReach" };

export default async function PoliticalOutreachPage() {
  const data = await loadPoliticalFollowUpsSection();

  return (
    <CommandSection
      eyebrow="Acquisition Engine"
      title="Outreach Action Center"
      subtitle="Follow-up automation, message variation scripts, response-driven proposal triggers, and manual engagement tasks."
      primaryHref="/admin/political/leads"
      primaryLabel="Inbound Leads"
      secondaryHref="/admin/political"
      secondaryLabel="Candidate Queue"
      data={data}
      emptyLabel="No political follow-up tasks are scheduled yet. Lead submissions and proposal views will populate this action center."
    />
  );
}
