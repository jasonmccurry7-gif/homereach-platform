import type { WaitlistBlock } from "@/lib/seo/blocks";

export function WaitlistBlockView({ data }: { data: WaitlistBlock["data"] }) {
  return (
    <section className="rounded-xl border border-amber-600/30 bg-amber-950/20 p-6">
      <p className="text-sm font-semibold text-amber-300 uppercase tracking-wide">Waitlist</p>
      <p className="mt-2 text-gray-100 leading-relaxed">{data.copy}</p>
      <p className="mt-3 text-sm text-gray-400">
        {data.cta_label ?? "Join the waitlist via the main CTA above."}
      </p>
    </section>
  );
}
