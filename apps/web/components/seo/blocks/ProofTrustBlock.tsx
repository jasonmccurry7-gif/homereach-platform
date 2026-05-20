import type { ProofTrustBlock } from "@/lib/seo/blocks";

export function ProofTrustBlockView({ data }: { data: ProofTrustBlock["data"] }) {
  if (data.mode === "testimonial" && data.testimonial_text) {
    return (
      <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
        <blockquote className="text-gray-200 italic leading-relaxed">
          &ldquo;{data.testimonial_text}&rdquo;
        </blockquote>
        {data.testimonial_attribution && (
          <p className="mt-3 text-sm text-gray-400">&mdash; {data.testimonial_attribution}</p>
        )}
      </section>
    );
  }

  // Early access framing (honest placeholder mode)
  if (data.early_access_framing) {
    return (
      <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
        <p className="text-sm font-semibold text-blue-300 uppercase tracking-wide">Early access</p>
        <p className="mt-2 text-gray-200 leading-relaxed">{data.early_access_framing}</p>
      </section>
    );
  }

  return null;
}
