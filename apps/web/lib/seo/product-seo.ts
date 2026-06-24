import type { GrowthServiceModule } from "@/lib/growth-execution/services";

export type ProductSeoProfile = {
  primaryKeyword: string;
  secondaryKeywords: string[];
  searchIntent: "local service" | "commercial" | "comparison" | "lead capture" | "operations";
  seoTitle: string;
  seoDescription: string;
  answerSummary: string;
  faqs: Array<{ question: string; answer: string }>;
};

const fallbackProfile = (service: GrowthServiceModule): ProductSeoProfile => ({
  primaryKeyword: `${service.shortTitle} for local businesses`,
  secondaryKeywords: [service.title, service.category.replaceAll("_", " "), "HomeReach"],
  searchIntent: "commercial",
  seoTitle: `${service.shortTitle} for Local Businesses | HomeReach`,
  seoDescription: service.outcome,
  answerSummary: service.publicPromise,
  faqs: [
    {
      question: `What is ${service.shortTitle}?`,
      answer: service.outcome,
    },
    {
      question: `Who is ${service.shortTitle} best for?`,
      answer: service.whoFor,
    },
    {
      question: `What does HomeReach do for ${service.shortTitle}?`,
      answer: service.whatItDoes,
    },
  ],
});

const serviceSeoProfiles: Record<string, ProductSeoProfile> = {
  "direct-mail-postcards": {
    primaryKeyword: "direct mail postcards for local businesses",
    secondaryKeywords: [
      "shared postcard advertising",
      "targeted postcard campaigns",
      "local direct mail marketing",
      "neighborhood postcard advertising",
      "postcard campaign execution",
    ],
    searchIntent: "local service",
    seoTitle: "Direct Mail Postcards for Local Businesses | HomeReach",
    seoDescription:
      "HomeReach plans shared, targeted, route-based, and political postcard campaigns with clear approval workflows and local execution support.",
    answerSummary:
      "HomeReach helps local businesses and campaigns use direct mail postcards to stay visible in specific neighborhoods, routes, service areas, and local markets.",
    faqs: [
      {
        question: "What direct mail postcard services does HomeReach offer?",
        answer:
          "HomeReach supports shared postcard campaigns, targeted route campaigns, political mail, neighborhood saturation, QR tracking, postcard creative, and approval-gated fulfillment.",
      },
      {
        question: "Who should use HomeReach postcard campaigns?",
        answer:
          "HomeReach postcard campaigns fit local businesses, home service companies, real estate teams, nonprofits, and campaigns that need repeated local visibility in defined neighborhoods or routes.",
      },
      {
        question: "Does HomeReach only sell postcards?",
        answer:
          "No. Postcards are the core visibility wedge, but HomeReach also connects campaigns to lead capture, follow-up, local SEO, reputation, content, and operations workflows.",
      },
    ],
  },
  "ai-website-assistant": {
    primaryKeyword: "AI website assistant for local businesses",
    secondaryKeywords: [
      "AI web assistant",
      "AI lead capture",
      "AI front desk for website",
      "website visitor lead capture",
      "24/7 website assistant",
    ],
    searchIntent: "lead capture",
    seoTitle: "AI Website Assistant for Local Businesses | HomeReach",
    seoDescription:
      "HomeReach AI Web Assistant answers common questions, captures leads, routes urgent requests, and summarizes website conversations for local businesses.",
    answerSummary:
      "HomeReach AI Web Assistant acts as a supervised website front desk that captures visitor information, identifies service needs, and creates follow-up actions.",
    faqs: [
      {
        question: "What does the HomeReach AI Web Assistant do?",
        answer:
          "It answers approved business questions, captures name, phone, email, service need, location, urgency, and preferred contact method, then routes the lead into follow-up workflows.",
      },
      {
        question: "Can the AI Web Assistant send messages or book appointments automatically?",
        answer:
          "The assistant can collect information and prepare summaries. Outbound messages, pricing promises, and appointment confirmations require approved rules or human review.",
      },
      {
        question: "Why is an AI Web Assistant useful for local businesses?",
        answer:
          "It reduces missed website opportunities by responding after hours, collecting lead details, and telling the business which conversations need follow-up.",
      },
    ],
  },
  "local-seo-landing-pages": {
    primaryKeyword: "local SEO for small businesses",
    secondaryKeywords: [
      "local SEO landing pages",
      "city service pages",
      "Google visibility for local businesses",
      "answer engine optimization",
      "local business SEO strategy",
    ],
    searchIntent: "commercial",
    seoTitle: "Local SEO and AEO for Small Businesses | HomeReach",
    seoDescription:
      "HomeReach builds local SEO, answer-engine, city, service, QR, and campaign landing pages that help businesses get found and convert traffic into leads.",
    answerSummary:
      "HomeReach local SEO focuses on useful, crawlable service pages, local authority pages, structured data, internal links, and conversion paths.",
    faqs: [
      {
        question: "How does HomeReach help with local SEO?",
        answer:
          "HomeReach creates and improves service pages, city pages, authority hubs, FAQs, structured data, internal links, and lead paths so local buyers and search systems understand the offer.",
      },
      {
        question: "Does HomeReach use AI for SEO content?",
        answer:
          "AI can draft, organize, and analyze SEO opportunities, but pages should be reviewed for accuracy, usefulness, proof, internal links, and approval before publishing.",
      },
      {
        question: "What is AEO for HomeReach?",
        answer:
          "AEO means making HomeReach easy for answer engines and AI search systems to understand by publishing clear answers, structured data, product pages, and source-backed content.",
      },
    ],
  },
  "reputation-review-management": {
    primaryKeyword: "reputation management for local businesses",
    secondaryKeywords: [
      "review management",
      "Google review requests",
      "AI review replies",
      "local reputation dashboard",
      "review generation for small businesses",
    ],
    searchIntent: "commercial",
    seoTitle: "Reputation Management for Local Businesses | HomeReach",
    seoDescription:
      "HomeReach helps local businesses request reviews, draft review replies, monitor reputation signals, and turn customer trust into local visibility.",
    answerSummary:
      "HomeReach reputation management helps businesses look more trusted online with review requests, response guidance, reputation alerts, and local visibility support.",
    faqs: [
      {
        question: "What reputation management services does HomeReach provide?",
        answer:
          "HomeReach supports review request workflows, AI-assisted response drafts, reputation alerts, local visibility scorecards, testimonial reminders, and approval-first review actions.",
      },
      {
        question: "Can HomeReach automatically respond to reviews?",
        answer:
          "HomeReach can draft review replies, but public posting and sensitive responses should be reviewed and approved before publication.",
      },
      {
        question: "Why do reviews matter for local SEO?",
        answer:
          "Reviews influence trust, conversion, and local decision-making. Strong review velocity and thoughtful responses can help a business look more credible when customers compare options.",
      },
    ],
  },
  "social-content-engine": {
    primaryKeyword: "AI social content for local businesses",
    secondaryKeywords: [
      "local business social media content",
      "Google Business Profile posts",
      "AI content engine",
      "social posts for small business",
      "local content marketing",
    ],
    searchIntent: "commercial",
    seoTitle: "AI Social Content for Local Businesses | HomeReach",
    seoDescription:
      "HomeReach creates approval-ready local social posts, Google profile post ideas, creative briefs, captions, and campaign content for small businesses.",
    answerSummary:
      "HomeReach social content turns local business offers, seasonal moments, reviews, campaigns, and customer questions into approval-ready posts and creative briefs.",
    faqs: [
      {
        question: "What content can HomeReach create?",
        answer:
          "HomeReach can draft social posts, local visibility posts, Google profile post ideas, captions, seasonal campaigns, postcard copy, and creative briefs for review.",
      },
      {
        question: "Does HomeReach auto-publish social content?",
        answer:
          "Publishing stays approval-first. HomeReach can draft and organize content, while public posting requires review or a connected approved publishing workflow.",
      },
      {
        question: "How does social content support SEO?",
        answer:
          "Recurring customer questions, local topics, reviews, and service updates can become FAQ ideas, service page sections, Google profile posts, and authority signals.",
      },
    ],
  },
  "procurement-inventory-intelligence": {
    primaryKeyword: "procurement savings for small businesses",
    secondaryKeywords: [
      "inventory purchasing intelligence",
      "supplier price comparison",
      "small business cost reduction",
      "vendor savings dashboard",
      "restaurant supply cost savings",
    ],
    searchIntent: "operations",
    seoTitle: "Procurement Savings and Inventory Intelligence | HomeReach",
    seoDescription:
      "HomeReach helps small businesses compare suppliers, spot price changes, review inventory risk, and identify purchasing savings without committing spend automatically.",
    answerSummary:
      "HomeReach procurement intelligence helps businesses see where supplies, vendors, inventory, and recurring purchases may be creating avoidable cost leaks.",
    faqs: [
      {
        question: "What is HomeReach procurement intelligence?",
        answer:
          "It is a purchasing visibility layer that compares suppliers, tracks prices, surfaces smart-buy recommendations, and shows potential savings for recurring business supplies.",
      },
      {
        question: "Does HomeReach place inventory orders automatically?",
        answer:
          "No. HomeReach may recommend savings and prepare smart-buy workflows, but vendor switches, orders, and spend commitments require approval.",
      },
      {
        question: "What businesses benefit from procurement savings?",
        answer:
          "Restaurants, bakeries, contractors, landscapers, salons, med spas, auto repair shops, and service businesses with recurring supplies can benefit from better purchasing visibility.",
      },
    ],
  },
  "government-contracts": {
    primaryKeyword: "government contract support for small businesses",
    secondaryKeywords: [
      "SAM.gov opportunity tracking",
      "government bid support",
      "contract opportunity intelligence",
      "small business government contracts",
      "bid room workflow",
    ],
    searchIntent: "operations",
    seoTitle: "Government Contract Support for Small Businesses | HomeReach",
    seoDescription:
      "HomeReach ContractOS helps small businesses track opportunities, score fit, organize bid rooms, manage deadlines, and prepare proposal materials with human approval.",
    answerSummary:
      "ContractOS helps small businesses understand public-sector opportunities, organize bid/no-bid decisions, and prepare compliant proposal workflows without autonomous submissions.",
    faqs: [
      {
        question: "What does ContractOS do?",
        answer:
          "ContractOS tracks government opportunities, summarizes requirements, scores fit, organizes bid rooms, manages checklists, and supports proposal preparation.",
      },
      {
        question: "Does HomeReach submit government bids automatically?",
        answer:
          "No. AI may summarize and prepare materials, but bid submissions, certifications, pricing, legal acknowledgements, and commitments require explicit human approval.",
      },
      {
        question: "Who is ContractOS for?",
        answer:
          "ContractOS is for small businesses, subcontractors, vendors, and HomeReach operators who need a safer way to evaluate and manage public-sector opportunities.",
      },
    ],
  },
};

export function getProductSeoProfile(service: GrowthServiceModule): ProductSeoProfile {
  return serviceSeoProfiles[service.slug] ?? fallbackProfile(service);
}

export function listMainProductSeoTargets(services: GrowthServiceModule[]) {
  return services
    .filter((service) => service.publicExposure !== "admin_only")
    .map((service) => {
      const profile = getProductSeoProfile(service);
      return {
        slug: service.slug,
        title: service.shortTitle,
        path: service.publicPath,
        primaryKeyword: profile.primaryKeyword,
        secondaryKeywords: profile.secondaryKeywords,
        searchIntent: profile.searchIntent,
        answerSummary: profile.answerSummary,
      };
    });
}
