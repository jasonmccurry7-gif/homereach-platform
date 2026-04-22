import Link from "next/link";
import type { HeroBlock } from "@/lib/seo/blocks";

export function HeroBlockView({ data }: { data: HeroBlock["data"] }) {
  return (
    <section className="text-center py-10">
      <h1 className="text-4xl sm:text-5xl font-black text-white leading-tight">
        {data.headline}
      </h1>
      <p className="mt-6 text-lg sm:text-xl text-gray-300 max-w-2xl mx-auto">
        {data.subheadline}
      </p>
      <Link
        href={data.primary_cta_url}
        className="mt-8 inline-flex items-center rounded-lg bg-blue-600 px-6 py-3 text-base font-bold text-white hover:bg-blue-500 transition-colors"
      >
        {data.primary_cta_label} &rarr;
      </Link>
    </section>
  );
}
