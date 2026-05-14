import { loadPoliticalFollowUpsSection } from "@/lib/political/admin-command";
import { CommandSection } from "../_components/CommandSection";

export const dynamic = "force-dynamic";
export const metadata = { title: "Calendar - Political - HomeReach" };

export default async function PoliticalCalendarPage() {
  const data = await loadPoliticalFollowUpsSection();

  return (
    <CommandSection
      eyebrow="Timing Intelligence"
      title="Political Calendar"
      subtitle="Follow-ups, election proximity, route reservation windows, print deadlines, mail cutoffs, and in-home delivery timing."
      primaryHref="/political/calendar"
      primaryLabel="Public Calendar"
      secondaryHref="/admin/political/outreach"
      secondaryLabel="Follow-Ups"
      data={data}
      emptyLabel="Calendar tasks will appear after campaigns, follow-ups, or reservations are created."
    />
  );
}
