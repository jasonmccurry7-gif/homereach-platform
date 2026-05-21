"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import type { VisualGallery } from "@/lib/seo/authority";

export function VisualGallerySearch({ gallery }: { gallery: VisualGallery }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [location, setLocation] = useState("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return gallery.items.filter((item) => {
      const matchesQuery =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.tags.some((tag) => tag.toLowerCase().includes(q));
      const matchesCategory = category === "all" || item.category === category;
      const matchesLocation = location === "all" || item.location === location;
      return matchesQuery && matchesCategory && matchesLocation;
    });
  }, [category, gallery.items, location, query]);

  return (
    <section className="bg-slate-950 px-4 py-16 text-white lg:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-3 rounded-lg border border-white/10 bg-white/[0.06] p-4 md:grid-cols-3">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search visuals"
            className="min-h-11 rounded-lg border border-white/10 bg-slate-950/70 px-3 text-sm font-semibold text-white outline-none placeholder:text-slate-500"
          />
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="min-h-11 rounded-lg border border-white/10 bg-slate-950/70 px-3 text-sm font-semibold text-white outline-none"
          >
            <option value="all">All categories</option>
            {gallery.categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            className="min-h-11 rounded-lg border border-white/10 bg-slate-950/70 px-3 text-sm font-semibold text-white outline-none"
          >
            <option value="all">All locations</option>
            {gallery.locations.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {filtered.map((item) => (
            <article key={item.visual.assetSlug} className="overflow-hidden rounded-lg border border-white/10 bg-white text-slate-950 shadow-xl shadow-black/20">
              <div className="relative aspect-[1.55]">
                <Image
                  src={`/seo-assets/${item.visual.assetSlug}.svg`}
                  alt={item.visual.alt}
                  fill
                  sizes="(min-width: 1280px) 25vw, (min-width: 768px) 50vw, 100vw"
                  unoptimized
                  className="object-cover"
                />
              </div>
              <div className="p-4">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-700">{item.category}</p>
                <h2 className="mt-2 text-lg font-black">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
                <p className="mt-3 text-xs font-bold text-slate-500">{item.location}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
