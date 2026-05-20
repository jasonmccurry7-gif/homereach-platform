// ─────────────────────────────────────────────────────────────────────────────
// HomeReach SEO Engine - JSON-LD emitter
//
// Takes an array of JsonLd objects and emits each as a <script type="application/ld+json">.
// Safe against XSS via JSON.stringify (no user-controlled strings unescaped).
// ─────────────────────────────────────────────────────────────────────────────

import type { JsonLd } from "@/lib/seo/schema";

export function JsonLd({ schemas }: { schemas: JsonLd[] }) {
  if (!schemas || schemas.length === 0) return null;
  return (
    <>
      {schemas.map((schema, idx) => (
        <script
          key={idx}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
    </>
  );
}
