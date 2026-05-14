import { loadPoliticalPaymentsSection } from "@/lib/political/admin-command";
import { CommandSection } from "../_components/CommandSection";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payments - Political - HomeReach" };

export default async function PoliticalPaymentsPage() {
  const data = await loadPoliticalPaymentsSection();

  return (
    <CommandSection
      eyebrow="Payment Control"
      title="Stripe and Order Ledger"
      subtitle="Payment status, deposit or full-pay mode, collected revenue, outstanding balances, and fulfillment readiness."
      primaryHref="/admin/political/proposals"
      primaryLabel="Open Proposals"
      secondaryHref="/admin/political/reporting"
      secondaryLabel="Revenue Report"
      data={data}
      emptyLabel="No political orders yet. Orders are created after proposal approval and checkout initiation."
    />
  );
}
