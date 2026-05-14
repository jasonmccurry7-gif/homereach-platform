import { loadPoliticalOverviewSection } from "@/lib/political/admin-command";
import { CommandSection } from "../_components/CommandSection";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reporting - Political - HomeReach" };

export default async function PoliticalReportingPage() {
  const data = await loadPoliticalOverviewSection();

  return (
    <CommandSection
      eyebrow="Executive Reporting"
      title="Political Revenue and Operations Summary"
      subtitle="A live command view of pipeline inventory, proposals, approvals, payments, outreach, and route operations."
      primaryHref="/admin/political/payments"
      primaryLabel="Payment Ledger"
      secondaryHref="/admin/political/analytics"
      secondaryLabel="Analytics"
      data={data}
    />
  );
}
