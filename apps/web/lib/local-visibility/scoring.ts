export type LocalVisibilityScanInput = {
  businessName: string;
  website?: string;
  phone?: string;
  city: string;
  state: string;
  category: string;
  googleBusinessProfileUrl?: string;
};

export type LocalVisibilityFix = {
  title: string;
  whyItMatters: string;
  recommendedAction: string;
  impact: "high" | "medium" | "low";
};

export type LocalVisibilityScorecard = {
  generatedAt: string;
  overallVisibilityScore: number;
  trustScore: number;
  listingsScore: number;
  reviewMomentumScore: number;
  googleProfileCompleteness: number;
  estimatedRevenueOpportunity: string;
  dataQuality: "estimated" | "partial" | "connected";
  topFixes: LocalVisibilityFix[];
  assumptions: string[];
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function hasValue(value: string | undefined) {
  return Boolean(value?.trim());
}

function normalizeUrl(url: string | undefined) {
  if (!url?.trim()) return "";
  const trimmed = url.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return `https://${trimmed}`;
}

export function buildLocalVisibilityScorecard(input: LocalVisibilityScanInput): LocalVisibilityScorecard {
  const website = normalizeUrl(input.website);
  const hasWebsite = hasValue(website);
  const hasPhone = hasValue(input.phone);
  const hasGbp = hasValue(input.googleBusinessProfileUrl);
  const hasCategory = hasValue(input.category);
  const hasLocation = hasValue(input.city) && hasValue(input.state);

  const googleProfileCompleteness = clampScore(
    42 +
      (hasGbp ? 24 : 0) +
      (hasWebsite ? 12 : 0) +
      (hasPhone ? 8 : 0) +
      (hasCategory ? 8 : 0) +
      (hasLocation ? 6 : 0),
  );

  const listingsScore = clampScore(
    45 +
      (hasPhone ? 16 : 0) +
      (hasWebsite ? 16 : 0) +
      (hasLocation ? 15 : 0) +
      (hasCategory ? 8 : 0),
  );

  const reviewMomentumScore = clampScore(38 + (hasGbp ? 18 : 0) + (hasWebsite ? 8 : 0) + (hasPhone ? 6 : 0));
  const trustScore = clampScore(44 + (hasGbp ? 18 : 0) + (hasWebsite ? 12 : 0) + (hasPhone ? 10 : 0) + (hasCategory ? 6 : 0));
  const overallVisibilityScore = clampScore(
    googleProfileCompleteness * 0.34 + listingsScore * 0.22 + reviewMomentumScore * 0.22 + trustScore * 0.22,
  );

  const topFixes: LocalVisibilityFix[] = [
    !hasGbp
      ? {
          title: "Add or verify the Google Business Profile link",
          whyItMatters: "The scan cannot confirm profile strength until the profile is connected.",
          recommendedAction: "Add the Google Business Profile URL and request a profile audit.",
          impact: "high",
        }
      : {
          title: "Audit Google profile photos, services, categories, and posts",
          whyItMatters: "Complete profiles tend to look more active and trustworthy to local customers.",
          recommendedAction: "Review photos, service list, business description, hours, appointment link, and recent posts.",
          impact: "high",
        },
    {
      title: "Start a steady review request rhythm",
      whyItMatters: "Review recency and velocity influence trust before a customer calls or books.",
      recommendedAction: "Send approved review requests after completed jobs, visits, or happy customer interactions.",
      impact: "high",
    },
    {
      title: "Create a fast review response workflow",
      whyItMatters: "Unanswered reviews make the business look less attentive, especially after negative feedback.",
      recommendedAction: "Use AI-drafted replies with human approval before posting to Google, Facebook, or Yelp.",
      impact: "medium",
    },
    !hasWebsite
      ? {
          title: "Add the business website",
          whyItMatters: "The scan cannot check local SEO basics without the website URL.",
          recommendedAction: "Add the website and review homepage title, service pages, city signals, and contact CTAs.",
          impact: "high",
        }
      : {
          title: "Check service and city page coverage",
          whyItMatters: "Local search often needs specific service and city signals, not only a general homepage.",
          recommendedAction: "Create or improve the top service pages, city pages, FAQs, and internal links.",
          impact: "medium",
        },
    {
      title: "Confirm name, address, phone, hours, and service categories",
      whyItMatters: "Inconsistent listings can confuse customers and weaken trust.",
      recommendedAction: "Audit core listing information across Google, Facebook, Yelp, Apple Maps, Bing, and major directories.",
      impact: "medium",
    },
  ];

  const assumptions = [
    "This first scan is an estimate until Google Business Profile, listings, reviews, and analytics APIs are connected.",
    "No public replies, Google posts, listing changes, or review requests are sent without human approval.",
    "Revenue opportunity is directional and should be validated with call, website, direction, message, and lead data.",
  ];

  const estimatedRevenueOpportunity =
    overallVisibilityScore < 55
      ? "$1,500 to $5,000/month in possible local visibility upside after profile, reviews, and service pages are improved."
      : overallVisibilityScore < 75
        ? "$750 to $2,500/month in possible upside from review velocity, profile activity, and city/service page improvements."
        : "$250 to $1,500/month in possible upside from ongoing review momentum and local SEO refinement.";

  return {
    generatedAt: new Date().toISOString(),
    overallVisibilityScore,
    trustScore,
    listingsScore,
    reviewMomentumScore,
    googleProfileCompleteness,
    estimatedRevenueOpportunity,
    dataQuality: "estimated",
    topFixes,
    assumptions,
  };
}

