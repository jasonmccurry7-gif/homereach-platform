import { loadPoliticalLeadsSection } from "@/lib/political/admin-command";
import { CommandSection } from "../_components/CommandSection";

export const dynamic = "force-dynamic";
export const metadata = { title: "Inbound Leads - Political - HomeReach" };

export default async function PoliticalLeadsPage() {
  const data = await loadPoliticalLeadsSection();

  return (
    <CommandSection
      eyebrow="Growth Engine"
      title="Inbound Lead Command"
      subtitle="Self-service plans from the public campaign portal, including strategy snapshots, budgets, route coverage summaries, proposal handoffs, and follow-up readiness."
      primaryHref="/political/plan"
      primaryLabel="Open Public Planner"
      secondaryHref="/admin/political/outreach"
      secondaryLabel="Outreach Queue"
      data={data}
      emptyLabel="No campaign planner leads yet. Send prospects to /political/plan to capture live strategy snapshots."
    />
  );
}
