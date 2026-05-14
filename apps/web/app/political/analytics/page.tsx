import type { Metadata } from "next";
import { PoliticalMailCommandCenter } from "@/app/(admin)/admin/political/_components/PoliticalMailCommandCenter";
import { loadPoliticalMailCommandCenter } from "@/lib/political/mail-command-center";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Political Mail Command Center - HomeReach Political",
  description:
    "Customer-safe campaign operations analytics for mail reach, route readiness, delivery windows, cost visibility, risk alerts, and safe engagement reporting.",
};

export default async function PoliticalAnalyticsPage() {
  const data = await loadPoliticalMailCommandCenter();

  return (
    <section className="mx-auto max-w-7xl px-5 py-8">
      <PoliticalMailCommandCenter data={data} audience="customer" />
    </section>
  );
}
