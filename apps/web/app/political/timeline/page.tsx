import type { Metadata } from "next";
import { MailTimelineCalculator } from "../_components/MailTimelineCalculator";
import { PublicHero } from "../_components/PublicCommand";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Political Mail Timeline Calculator - HomeReach Political",
  description:
    "Calculate a five-phase political postcard drop schedule by office, election date, early vote window, and production deadline.",
};

export default function PoliticalTimelinePage() {
  return (
    <>
      <PublicHero
        eyebrow="Timing Intelligence"
        title="Calculate a Five-Phase Political Mail Timeline"
        subtitle="Build office-specific postcard drop dates around Election Day, early voting, print deadlines, proof approvals, and in-home windows."
        primaryHref="/political/plan"
        primaryLabel="Build Coverage Plan"
        primaryRequiresAccount={false}
        secondaryHref="/political/data-sources"
        secondaryLabel="Data Sources"
      />
      <section className="mx-auto max-w-7xl px-5 py-12">
        <MailTimelineCalculator />
      </section>
    </>
  );
}
