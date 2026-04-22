import Link from "next/link";
import type { CtaFinalBlock } from "@/lib/seo/blocks";

export function CtaFinalBlockView({ data }: { data: CtaFinalBlock["data"] }) {
  return (
    <section className="rounded-xl border border-blue-600/30 bg-blue-950/30 p-8 text-center">
      <Link
        href={data.primary_cta_url}
        className="inline-flex items-center rounded-lg bg-blue-600 px-6 py-3 text-base font-bold text-white hover:bg-blue-500 transition-colors"
      >
        {data.primary_cta_label} &rarr;
      </Link>
    </section>
  );
}
