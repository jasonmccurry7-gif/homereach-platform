import type { CategoryPainBlock } from "@/lib/seo/blocks";

export function CategoryPainBlockView({ data }: { data: CategoryPainBlock["data"] }) {
  const points = data.pain_points ?? [];
  if (points.length === 0) return null;
  return (
    <section>
      <h2 className="text-2xl font-bold text-white mb-4">Why advertising this category is hard</h2>
      <ul className="space-y-3">
        {points.map((p, i) => (
          <li key={i} className="flex gap-3 text-gray-200">
            <span className="mt-1 flex-shrink-0 text-red-400">&#9888;</span>
            <span>{p}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
