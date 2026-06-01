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
    legalName: "HomeReach",
    url: base,
    logo: `${base}/icons/icon-512.png`,
    description:
      "AI-powered local growth, direct mail, political mail, purchasing intelligence, and campaign execution platform for local businesses, campaigns, and organizations.",
    areaServed: [
      {
        "@type": "State",
        name: "Ohio",
      },
      {
        "@type": "Country",
        name: "United States",
      },
    ],
    knowsAbout: [
      "Direct mail marketing",
      "Shared postcard advertising",
      "Targeted neighborhood campaigns",
      "Political mail",
      "Local SEO",
      "Review and reputation management",
      "Procurement savings intelligence",
      "Government contract opportunity tracking",
    ],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "sales",
      areaServed: "US",
      availableLanguage: "English",
    },
    sameAs: buildSameAsLinks(),
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
    inLanguage: "en-US",
    publisher: {
      "@type": "Organization",
      name: "HomeReach",
      url: base,
    },
  };
}

export function buildWebPageLd(args: {
  name: string;
  description: string;
  url: string;
  primaryImage?: string;
  dateModified?: string;
  about?: string[];
}): JsonLd {
  const base = getBaseUrl();
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: args.name,
    description: args.description,
    url: args.url,
    inLanguage: "en-US",
    isPartOf: {
      "@type": "WebSite",
      name: "HomeReach",
      url: base,
    },
    about: args.about,
    primaryImageOfPage: args.primaryImage
      ? {
          "@type": "ImageObject",
          url: args.primaryImage,
        }
      : undefined,
    dateModified: args.dateModified,
  };
}

export function buildServiceCatalogLd(args: {
  name: string;
  description: string;
  url: string;
  services: Array<{ name: string; description: string; url: string; category?: string }>;
}): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "OfferCatalog",
    name: args.name,
    description: args.description,
    url: args.url,
    itemListElement: args.services.map((service, index) => ({
      "@type": "Offer",
      position: index + 1,
      itemOffered: {
        "@type": "Service",
        name: service.name,
        description: service.description,
        serviceType: service.category,
        url: service.url,
        provider: {
          "@type": "Organization",
          name: "HomeReach",
          url: getBaseUrl(),
        },
      },
    })),
  };
}

export function buildSiteNavigationLd(items: Array<{ name: string; url: string }>): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "HomeReach site navigation",
    itemListElement: items.map((item, index) => ({
      "@type": "SiteNavigationElement",
      position: index + 1,
      name: item.name,
      url: item.url,
    })),
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

function buildSameAsLinks() {
  return [
    process.env.NEXT_PUBLIC_FACEBOOK_URL,
    process.env.NEXT_PUBLIC_LINKEDIN_URL,
    process.env.NEXT_PUBLIC_INSTAGRAM_URL,
    process.env.NEXT_PUBLIC_TIKTOK_URL,
    process.env.NEXT_PUBLIC_YOUTUBE_URL,
  ].filter((value): value is string => Boolean(value));
}
