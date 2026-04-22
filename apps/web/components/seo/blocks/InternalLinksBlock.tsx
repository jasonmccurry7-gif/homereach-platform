import Link from "next/link";
import type { InternalLinksBlock } from "@/lib/seo/blocks";

export function InternalLinksBlockView({ data }: { data: InternalLinksBlock["data"] }) {
  const links = data.links ?? [];
  if (links.length === 0) return null;
  return (
    <section>
      <h2 className="text-xl font-bold text-white mb-3">Related</h2>
      <ul className="grid gap-2 sm:grid-cols-2">
        {links.map((l, i) => (
          <li key={i}>
            <Link
              href={l.href}
              className="block rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-3 text-sm text-gray-200 hover:border-blue-600 hover:text-white transition-colors"
            >
              {l.text} &rarr;
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
