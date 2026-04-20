// ─────────────────────────────────────────────────────────────────────────────
// HomeReach SEO — JSON-LD schema builders
//
// V0 foundation: Organization + WebSite emitted from the root layout.
// Per-page builders (Service, FAQPage, BreadcrumbList, LocalBusiness) are
// added in Prompt 4 alongside the SEO engine scaffolding.
//
// These builders are UNGATED on purpose. Organization + WebSite are brand
// primitives that should always emit regardless of any feature flag.
// ─────────────────────────────────────────────────────────────────────────────

export type JsonLd = Record<string, unknown>;

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://www.home-reach.com";
}

/** Organization JSON-LD for the site identity. Emitted from root layout. */
export function buildOrganizationLd(): JsonLd {
  const base = getBaseUrl();
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "HomeReach",
    url: base,
    logo: `${base}/icons/icon-512.png`,
    sameAs: [],
  };
}

/** WebSite JSON-LD. Emitted from root layout alongside Organization. */
export function buildWebsiteLd(): JsonLd {
  const base = getBaseUrl();
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "HomeReach",
    url: base,
  };
}
