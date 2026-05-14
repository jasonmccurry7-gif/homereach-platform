import { loadPoliticalProposalsSection } from "@/lib/political/admin-command";
import { CommandSection } from "../_components/CommandSection";

export const dynamic = "force-dynamic";
export const metadata = { title: "Proposals - Political - HomeReach" };

export default async function PoliticalProposalsPage() {
  const data = await loadPoliticalProposalsSection();

  return (
    <CommandSection
      eyebrow="Revenue Core"
      title="Proposal Pipeline"
      subtitle="Client-facing campaign proposals, view signals, approval state, expiration risk, and public proposal links."
      primaryHref="/political/plan"
      primaryLabel="Generate Proposal"
      secondaryHref="/admin/political/reporting"
      secondaryLabel="Approval Log"
      data={data}
      emptyLabel="No proposals yet. Generate a proposal from the campaign planner or candidate command workflow."
    />
  );
}
