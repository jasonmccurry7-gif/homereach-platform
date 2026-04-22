import type { ExclusivityExplainerBlock } from "@/lib/seo/blocks";

export function ExclusivityExplainerBlockView({ data }: { data: ExclusivityExplainerBlock["data"] }) {
  return (
    <section className="rounded-xl border border-blue-600/30 bg-blue-950/20 p-6">
      <h2 className="text-xl font-bold text-white">
        One {data.category} business. Every {data.city} homeowner.
      </h2>
      <p className="mt-3 text-gray-300 leading-relaxed">
        HomeReach&apos;s {data.category} slot in {data.city} is exclusive. One business holds it at a time.
        When homeowners see our postcard, they see you &mdash; not you and four competitors.
        When the slot is taken, it&apos;s taken: no second-tier placement, no sharing, no bidding wars.
      </p>
    </section>
  );
}
