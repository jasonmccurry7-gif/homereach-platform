import { loadPoliticalPaymentsSection } from "@/lib/political/admin-command";
import { CommandSection } from "../_components/CommandSection";

export const dynamic = "force-dynamic";
export const metadata = { title: "Delivery - Political - HomeReach" };

export default async function PoliticalDeliveryPage() {
  const data = await loadPoliticalPaymentsSection();

  return (
    <CommandSection
      eyebrow="Mail Execution"
      title="Delivery and Fulfillment"
      subtitle="Approved orders, production state, payment readiness, mail drop status, delivery confidence, and post-mail completion tracking."
      primaryHref="/admin/political/payments"
      primaryLabel="Payment Readiness"
      secondaryHref="/admin/political/calendar"
      secondaryLabel="Drop Calendar"
      data={data}
      emptyLabel="Delivery rows appear after proposal approval creates political orders."
    />
  );
}
