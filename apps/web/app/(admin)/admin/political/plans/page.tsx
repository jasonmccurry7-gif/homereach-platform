import { loadPoliticalPlansSection } from "@/lib/political/admin-command";
import { CommandSection } from "../_components/CommandSection";

export const dynamic = "force-dynamic";
export const metadata = { title: "Plans - Political - HomeReach" };

export default async function PoliticalPlansPage() {
  const data = await loadPoliticalPlansSection();

  return (
    <CommandSection
      eyebrow="Decision Engine"
      title="Plans and Scenarios"
      subtitle="Saved campaign strategy plans, selected scenarios, route selections, and budget constraints used to generate client-ready proposals."
      primaryHref="/political/plan"
      primaryLabel="Create Plan"
      secondaryHref="/admin/political/routes"
      secondaryLabel="Route Catalog"
      data={data}
      emptyLabel="No stored political plans yet. Use the planner to generate coverage, optimized, budget-constrained, and hybrid scenarios."
    />
  );
}
