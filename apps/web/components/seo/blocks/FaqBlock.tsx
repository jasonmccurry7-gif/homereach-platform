import type { FaqBlock } from "@/lib/seo/blocks";

export function FaqBlockView({ data }: { data: FaqBlock["data"] }) {
  const pairs = data.pairs ?? [];
  if (pairs.length === 0) return null;
  return (
    <section>
      <h2 className="text-2xl font-bold text-white mb-4">Frequently asked questions</h2>
      <div className="space-y-4">
        {pairs.map((pair, idx) => (
          <details key={idx} className="rounded-xl border border-gray-800 bg-gray-900/50 p-5 group">
            <summary className="cursor-pointer font-semibold text-white text-base group-open:mb-2">
              {pair.question}
            </summary>
            <p className="mt-2 text-gray-300 leading-relaxed">{pair.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
