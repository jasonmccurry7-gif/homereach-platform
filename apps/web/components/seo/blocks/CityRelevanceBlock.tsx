import type { CityRelevanceBlock } from "@/lib/seo/blocks";

export function CityRelevanceBlockView({ data }: { data: CityRelevanceBlock["data"] }) {
  return (
    <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
      <p className="text-base text-gray-200 leading-relaxed whitespace-pre-line">
        {data.paragraph}
      </p>
      {data.neighborhoods && data.neighborhoods.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {data.neighborhoods.map((n) => (
            <span
              key={n}
              className="rounded-full bg-gray-800 px-3 py-1 text-xs font-medium text-gray-300"
            >
              {n}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
