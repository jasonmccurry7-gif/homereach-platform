import type { IntakeTriggerBlock } from "@/lib/seo/blocks";

// Renders a static informational block. Actual form interaction is v2 work;
// for now this simply renders a CTA to the funnel if the admin inserts a
// copy message. Kept minimal to avoid client-side state in v1.
export function IntakeTriggerBlockView({ data }: { data: IntakeTriggerBlock["data"] }) {
  return (
    <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
      <p className="text-sm font-semibold text-blue-300 uppercase tracking-wide">Not ready yet?</p>
      <p className="mt-2 text-gray-200 leading-relaxed">
        {data.copy ?? "We can send a reminder when pricing or availability changes. Reach out through the main CTA above and ask for a notification."}
      </p>
    </section>
  );
}
