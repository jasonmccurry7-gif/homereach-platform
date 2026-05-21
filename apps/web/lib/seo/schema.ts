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

export function buildServiceLd(args: {
  name: string;
  description?: string;
  city?: string;
  category?: string;
  url: string;
}): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: args.name,
    description: args.description,
    url: args.url,
    serviceType: args.category,
    areaServed: args.city
      ? {
          "@type": "City",
          name: args.city,
        }
      : undefined,
    provider: {
      "@type": "Organization",
      name: "HomeReach",
      url: getBaseUrl(),
    },
  };
}

export function buildBreadcrumbLd(items: Array<{ name: string; url: string }>): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function buildLocalBusinessLd(args: {
  name: string;
  url: string;
  city?: string;
  region?: string | null;
  areaServed?: string;
}): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: args.name,
    url: args.url,
    areaServed: args.areaServed,
    address: args.city
      ? {
          "@type": "PostalAddress",
          addressLocality: args.city,
          addressRegion: args.region ?? undefined,
          addressCountry: "US",
        }
      : undefined,
  };
}

export function buildFaqPageLd(pairs: Array<{ question: string; answer: string }>): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: pairs.map((pair) => ({
      "@type": "Question",
      name: pair.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: pair.answer,
      },
    })),
  };
}

export function buildItemListLd(args: {
  name: string;
  url: string;
  items: Array<{ name: string; url: string }>;
}): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: args.name,
    url: args.url,
    itemListElement: args.items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      url: item.url,
    })),
  };
}

export function buildArticleLd(args: {
  headline: string;
  description: string;
  url: string;
  image?: string;
  dateModified?: string;
}): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: args.headline,
    description: args.description,
    url: args.url,
    image: args.image,
    dateModified: args.dateModified,
    author: {
      "@type": "Organization",
      name: "HomeReach",
      url: getBaseUrl(),
    },
    publisher: {
      "@type": "Organization",
      name: "HomeReach",
      logo: {
        "@type": "ImageObject",
        url: `${getBaseUrl()}/icons/icon-512.png`,
      },
    },
  };
}

export function buildImageObjectLd(args: {
  name: string;
  contentUrl: string;
  caption?: string;
  representativeOfPage?: boolean;
}): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "ImageObject",
    name: args.name,
    contentUrl: args.contentUrl,
    caption: args.caption,
    representativeOfPage: args.representativeOfPage ?? true,
  };
}

export function buildSoftwareApplicationLd(args: {
  name: string;
  description: string;
  url: string;
  applicationCategory?: string;
}): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: args.name,
    description: args.description,
    url: args.url,
    applicationCategory: args.applicationCategory ?? "BusinessApplication",
    operatingSystem: "Web",
    provider: {
      "@type": "Organization",
      name: "HomeReach",
      url: getBaseUrl(),
    },
  };
}

export function buildDatasetLd(args: {
  name: string;
  description: string;
  url: string;
  keywords?: string[];
}): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: args.name,
    description: args.description,
    url: args.url,
    keywords: args.keywords?.join(", "),
    creator: {
      "@type": "Organization",
      name: "HomeReach",
      url: getBaseUrl(),
    },
  };
}
