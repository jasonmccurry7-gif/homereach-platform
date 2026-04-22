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

// ─────────────────────────────────────────────────────────────────────────────
// Per-page builders (added in Step 5 scaffolding for use by /advertise/*
// render routes in Step 10). Each accepts a minimal set of inputs so builders
// remain pure functions that don't reach into the registry.
// ─────────────────────────────────────────────────────────────────────────────

export type ServiceLdInput = {
  name: string;
  description: string;
  city: string;
  category: string;
  url: string;
};

/** Service JSON-LD for a category+city or anchor page. */
export function buildServiceLd(input: ServiceLdInput): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: input.name,
    description: input.description,
    provider: {
      "@type": "Organization",
      name: "HomeReach",
      url: getBaseUrl(),
    },
    areaServed: {
      "@type": "City",
      name: input.city,
    },
    serviceType: input.category,
    url: input.url,
  };
}

export type FaqPair = { question: string; answer: string };

/** FAQPage JSON-LD built from a page's FAQ block. */
export function buildFaqPageLd(pairs: FaqPair[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: pairs.map((p) => ({
      "@type": "Question",
      name: p.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: p.answer,
      },
    })),
  };
}

export type BreadcrumbItem = { name: string; url: string };

/** BreadcrumbList JSON-LD for site navigation context. */
export function buildBreadcrumbLd(items: BreadcrumbItem[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export type LocalBusinessLdInput = {
  name: string;
  url: string;
  city: string;
  region: string;
  areaServed: string;
};

/** LocalBusiness JSON-LD for high-value pages that need local-intent signals. */
export function buildLocalBusinessLd(input: LocalBusinessLdInput): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: input.name,
    url: input.url,
    address: {
      "@type": "PostalAddress",
      addressLocality: input.city,
      addressRegion: input.region,
      addressCountry: "US",
    },
    areaServed: input.areaServed,
  };
}
