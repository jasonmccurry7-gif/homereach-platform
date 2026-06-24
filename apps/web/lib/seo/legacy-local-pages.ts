export type LegacyLocalCity = {
  slug: string;
  display: string;
  county: string;
  state: string;
};

export type LegacyLocalCategory = {
  slug: string;
  display: string;
  headline: string;
  pain: string;
  cta: string;
  stats: string;
  avgJob: string;
};

export type LegacyLocalLink = {
  label: string;
  href: string;
};

export type LegacyLocalFaq = {
  question: string;
  answer: string;
};

export type LegacyLocalPage = {
  slug: string;
  path: string;
  advertiseSlug: string;
  advertisePath: string;
  city: LegacyLocalCity;
  category: LegacyLocalCategory;
  title: string;
  description: string;
  faqs: LegacyLocalFaq[];
  internalLinks: LegacyLocalLink[];
};

const legacyCities: Record<string, LegacyLocalCity> = {
  wooster: { slug: "wooster", display: "Wooster", county: "Wayne County", state: "OH" },
  medina: { slug: "medina", display: "Medina", county: "Medina County", state: "OH" },
  ashland: { slug: "ashland", display: "Ashland", county: "Ashland County", state: "OH" },
  mansfield: { slug: "mansfield", display: "Mansfield", county: "Richland County", state: "OH" },
  "mount-vernon": { slug: "mount-vernon", display: "Mount Vernon", county: "Knox County", state: "OH" },
  coshocton: { slug: "coshocton", display: "Coshocton", county: "Coshocton County", state: "OH" },
  millersburg: { slug: "millersburg", display: "Millersburg", county: "Holmes County", state: "OH" },
  loudonville: { slug: "loudonville", display: "Loudonville", county: "Ashland County", state: "OH" },
  orrville: { slug: "orrville", display: "Orrville", county: "Wayne County", state: "OH" },
  rittman: { slug: "rittman", display: "Rittman", county: "Wayne County", state: "OH" },
  dover: { slug: "dover", display: "Dover", county: "Tuscarawas County", state: "OH" },
};

const legacyCategories: Record<string, LegacyLocalCategory> = {
  roofing: {
    slug: "roofing",
    display: "Roofing",
    headline: "The only roofer in {{city}} homeowners see every month",
    pain: "Homeowners in {{city}} need roofing help, but they usually call the names they recognize first. HomeReach keeps your business visible before that search starts.",
    cta: "Check the roofing spot in {{city}}",
    stats: "Common roofing project range: $8,000-$25,000. Final campaign economics depend on offer, timing, geography, and follow-up.",
    avgJob: "$8,000-$25,000",
  },
  hvac: {
    slug: "hvac",
    display: "HVAC",
    headline: "Be the HVAC company {{city}} homeowners know by name",
    pain: "When a furnace fails or AC goes down, people call the first trusted name they remember. HomeReach helps your company stay familiar before the emergency happens.",
    cta: "Check the HVAC spot in {{city}}",
    stats: "Common HVAC project range: $1,500-$8,000. Results depend on local demand, offer strength, seasonality, and follow-up.",
    avgJob: "$1,500-$8,000",
  },
  plumbing: {
    slug: "plumbing",
    display: "Plumbing",
    headline: "Own the plumbing category in {{city}}",
    pain: "Plumbing jobs are urgent and trust-based. HomeReach helps your business stay visible so homeowners already know who to call.",
    cta: "Check the plumbing spot in {{city}}",
    stats: "Average plumbing job: $500-$3,000. Emergency calls often come at premium rates.",
    avgJob: "$500-$3,000",
  },
  landscaping: {
    slug: "landscaping",
    display: "Landscaping",
    headline: "Be the landscaper every {{city}} homeowner calls first",
    pain: "Landscaping only compounds when homeowners remember you. Consistent local visibility helps your company stay top of mind through the season.",
    cta: "Check the landscaping spot in {{city}}",
    stats: "Average landscaping relationship: $2,000-$8,000 per year. One customer can turn into recurring revenue.",
    avgJob: "$2,000-$8,000/yr",
  },
  "pressure-washing": {
    slug: "pressure-washing",
    display: "Pressure Washing",
    headline: "The pressure washing company {{city}} sees every month",
    pain: "Pressure washing is seasonal and repeatable. HomeReach keeps your business in view before the homeowner starts shopping again.",
    cta: "Check the pressure washing spot in {{city}}",
    stats: "Average pressure washing job: $300-$800. Volume depends on seasonality, route selection, and offer quality.",
    avgJob: "$300-$800",
  },
  painting: {
    slug: "painting",
    display: "Painting",
    headline: "Own the painting category in {{city}}",
    pain: "Painting projects get delayed until homeowners trust a contractor enough to act. Repeated local visibility helps build that trust earlier.",
    cta: "Check the painting spot in {{city}}",
    stats: "Average painting project: $3,000-$15,000 across interior and exterior work.",
    avgJob: "$3,000-$15,000",
  },
  electrical: {
    slug: "electrical",
    display: "Electrical",
    headline: "Be {{city}}'s go-to electrician before homeowners search",
    pain: "Electrical work combines urgency with trust. HomeReach helps your company stay recognizable before the homeowner starts comparing options.",
    cta: "Check the electrical spot in {{city}}",
    stats: "Average electrical job: $800-$4,000. Larger upgrades and rewires often run higher.",
    avgJob: "$800-$4,000",
  },
  "concrete-masonry": {
    slug: "concrete-masonry",
    display: "Concrete and Masonry",
    headline: "Own concrete and masonry in {{city}}",
    pain: "Concrete and masonry projects are high-value and infrequent, which makes early awareness more important than last-minute bidding.",
    cta: "Check the concrete and masonry spot in {{city}}",
    stats: "Average concrete or masonry project: $5,000-$20,000.",
    avgJob: "$5,000-$20,000",
  },
  "junk-removal": {
    slug: "junk-removal",
    display: "Junk Removal",
    headline: "Be the junk removal company {{city}} calls without thinking",
    pain: "Junk removal is often impulse-driven. Consistent local visibility helps your business become the easy call.",
    cta: "Check the junk removal spot in {{city}}",
    stats: "Average junk removal job: $200-$800. Demand usually follows speed, trust, and local awareness.",
    avgJob: "$200-$800",
  },
  "windows-doors": {
    slug: "windows-doors",
    display: "Windows and Doors",
    headline: "Own windows and doors in {{city}}",
    pain: "Replacement projects take time to decide. HomeReach keeps your company visible during that consideration window.",
    cta: "Check the windows and doors spot in {{city}}",
    stats: "Average window or door project: $3,000-$15,000 with strong referral value.",
    avgJob: "$3,000-$15,000",
  },
  "garage-doors": {
    slug: "garage-doors",
    display: "Garage Doors",
    headline: "Be {{city}}'s garage door company in every mailbox",
    pain: "Garage door work often starts with urgency. HomeReach helps your number feel like the obvious one to call.",
    cta: "Check the garage door spot in {{city}}",
    stats: "Average garage door project: $500-$3,000. Emergency service can carry higher value.",
    avgJob: "$500-$3,000",
  },
  "home-remodeling": {
    slug: "home-remodeling",
    display: "Home Remodeling",
    headline: "Own home remodeling in {{city}}",
    pain: "Remodeling decisions build over time. Repeated local visibility helps your company stay credible while homeowners plan.",
    cta: "Check the remodeling spot in {{city}}",
    stats: "Common remodeling project range: $15,000-$75,000 or more. Visibility matters most when buyers are still deciding.",
    avgJob: "$15,000-$75,000+",
  },
};

export const legacyLocalCitySlugs = Object.keys(legacyCities);
export const legacyLocalCategorySlugs = Object.keys(legacyCategories);

export function getLegacyLocalPageBySlug(slug: string): LegacyLocalPage | null {
  for (const citySlug of legacyLocalCitySlugs) {
    if (!slug.startsWith(`${citySlug}-`)) continue;
    const categorySlug = slug.slice(citySlug.length + 1);
    const city = legacyCities[citySlug];
    const category = legacyCategories[categorySlug];
    if (!city || !category) return null;

    const title = `${category.display} in ${city.display}, ${city.state}`;
    const description = `Premium shared postcard visibility for ${category.display.toLowerCase()} businesses in ${city.display}, ${city.state}. Availability, pricing, and route counts are confirmed before checkout.`;
    const advertiseSlug = `advertise/${city.slug}/${category.slug}`;
    const path = `/${slug}`;

    return {
      slug,
      path,
      advertiseSlug,
      advertisePath: `/${advertiseSlug}`,
      city,
      category,
      title,
      description,
      faqs: buildLegacyLocalFaqs(city, category),
      internalLinks: buildLegacyLocalLinks(city, category),
    };
  }

  return null;
}

export function listLegacyCityCategoryPages(): LegacyLocalPage[] {
  const pages: LegacyLocalPage[] = [];
  for (const citySlug of legacyLocalCitySlugs) {
    for (const categorySlug of legacyLocalCategorySlugs) {
      const page = getLegacyLocalPageBySlug(`${citySlug}-${categorySlug}`);
      if (page) pages.push(page);
    }
  }
  return pages;
}

function buildLegacyLocalFaqs(city: LegacyLocalCity, category: LegacyLocalCategory): LegacyLocalFaq[] {
  const categoryName = category.display.toLowerCase();
  return [
    {
      question: `How does HomeReach help ${categoryName} businesses in ${city.display}?`,
      answer:
        `HomeReach helps ${categoryName} businesses stay visible in ${city.display} through shared postcards, targeted campaigns, local visibility support, and approval-gated follow-up systems.`,
    },
    {
      question: `Is the ${categoryName} spot in ${city.display} guaranteed?`,
      answer:
        `No. HomeReach confirms category availability, route coverage, and pricing before checkout. If the protected placement is already active, the next step shifts to a waitlist or another approved campaign option.`,
    },
    {
      question: `Should a ${categoryName} company start with shared postcards or targeted campaigns?`,
      answer:
        "Shared postcards are useful for steady recurring awareness. Targeted campaigns are stronger when geography, timing, or a specific offer matters more than broad monthly coverage.",
    },
    {
      question: `What happens after someone checks availability in ${city.display}?`,
      answer:
        "The next step is an approval-safe intake or campaign request. HomeReach confirms route fit, category status, pricing, and the right follow-up path before any payment or fulfillment commitment is made.",
    },
  ];
}

function buildLegacyLocalLinks(city: LegacyLocalCity, category: LegacyLocalCategory): LegacyLocalLink[] {
  return [
    { label: `${city.display} local visibility`, href: "/local-visibility" },
    { label: "Shared postcard overview", href: "/shared-postcards" },
    { label: "Targeted neighborhood campaigns", href: "/targeted" },
    { label: `${category.display} lead capture with AI Web Assistant`, href: "/services/ai-website-assistant" },
    { label: "HomeReach answers", href: "/answers" },
  ];
}
