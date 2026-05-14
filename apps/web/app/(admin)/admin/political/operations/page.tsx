import { loadPoliticalOverviewSection } from "@/lib/political/admin-command";
import { CommandSection } from "../_components/CommandSection";

export const dynamic = "force-dynamic";
export const metadata = { title: "Operations - Political - HomeReach" };

export default async function PoliticalOperationsPage() {
  const data = await loadPoliticalOverviewSection();

  return (
    <CommandSection
      eyebrow="Command Operations"
      title="Political Operations"
      subtitle="Imports, routes, reservations, proposals, approvals, payments, fulfillment, and reporting controls for the campaign execution workflow."
      primaryHref="/admin/political/imports"
      primaryLabel="Imports"
      secondaryHref="/admin/political/routes"
      secondaryLabel="Routes"
      data={data}
    />
  );
}
