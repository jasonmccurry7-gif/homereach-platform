import { listGrowthServiceModules } from "@/lib/growth-execution/services";
import { listMainProductSeoTargets } from "@/lib/seo/product-seo";

export type SeoRankTarget = {
  product: string;
  path: string;
  primaryKeyword: string;
  intent: string;
  rankObjective: string;
  autonomousNextMove: string;
  humanRequirement: string;
};

export type SeoOperatingLane = {
  lane: string;
  cadence: string;
  mission: string;
  autonomousWork: string[];
  blockedBy: string[];
};

export type SeoQualityGate = {
  gate: string;
  requirement: string;
  reason: string;
};

export type AutonomousSeoStrategy = {
  title: string;
  objective: string;
  rankTargets: SeoRankTarget[];
  operatingLanes: SeoOperatingLane[];
  qualityGates: SeoQualityGate[];
  measurementModel: Array<{ metric: string; source: string; use: string }>;
};

export function getAutonomousSeoStrategy(): AutonomousSeoStrategy {
  const publicServices = listGrowthServiceModules().filter((service) => service.publicExposure !== "admin_only");
  const rankTargets = listMainProductSeoTargets(publicServices).map((target): SeoRankTarget => ({
    product: target.title,
    path: target.path,
    primaryKeyword: target.primaryKeyword,
    intent: target.searchIntent,
    rankObjective: "Win qualified commercial visibility for the core product, then expand through supporting authority pages.",
    autonomousNextMove:
      "Audit metadata, FAQ coverage, schema, internal links, conversion path, proof assets, and Search Console query gaps for this page.",
    humanRequirement:
      "Approve public copy changes and provide real proof assets, customer examples, citations, or connector credentials when needed.",
  }));

  return {
    title: "HomeReach Autonomous SEO/AEO Ranking Strategy",
    objective:
      "Build topical authority around HomeReach's main products by improving crawl clarity, answer coverage, product pages, internal links, proof signals, and conversion attribution without creating doorway pages or unapproved public claims.",
    rankTargets,
    operatingLanes: [
      {
        lane: "Morning opportunity pass",
        cadence: "Daily at 8:00 AM",
        mission: "Find the highest-value product SEO move for the day.",
        autonomousWork: [
          "Review core product targets and SEO Command Center gaps.",
          "Compare product pages against visible FAQ, schema, sitemap, internal link, and CTA requirements.",
          "Identify one deployable technical/content improvement and one proof/authority need.",
          "Prepare implementation-ready changes or a review queue item.",
        ],
        blockedBy: ["Search Console gaps", "missing proof assets", "human approval for public copy"],
      },
      {
        lane: "Evening validation pass",
        cadence: "Daily at 5:00 PM",
        mission: "Validate SEO work and keep the rank plan clean.",
        autonomousWork: [
          "Run focused lint, type-check, build, and route checks where feasible.",
          "Confirm sitemap, robots, llms.txt, schema, and answer pages remain consistent.",
          "Summarize deploy-ready changes, unresolved risks, and owner action items.",
          "Update next best SEO action based on data availability.",
        ],
        blockedBy: ["unmerged worktree conflicts", "missing analytics import", "production deploy approval"],
      },
      {
        lane: "Authority expansion",
        cadence: "Weekly planning, daily execution when safe",
        mission: "Grow supporting authority around core product pages.",
        autonomousWork: [
          "Draft useful supporting pages, FAQs, tools, case-study shells, and internal link improvements.",
          "Avoid thin city/category duplication and consolidate weak pages when safer.",
          "Use answers, learn, tools, insights, visuals, case studies, and benchmarks to support product pages.",
        ],
        blockedBy: ["source support", "customer proof", "approval before publish"],
      },
      {
        lane: "Measurement and conversion loop",
        cadence: "Continuous once connectors are active",
        mission: "Connect ranking movement to leads and revenue.",
        autonomousWork: [
          "Import Google Search Console page/query metrics.",
          "Tie organic landing pages to leads, forms, proposals, calls, and payments.",
          "Prioritize pages with impressions but weak CTR or traffic but weak conversion.",
        ],
        blockedBy: ["GSC credentials", "analytics/attribution connection", "event mapping"],
      },
    ],
    qualityGates: [
      {
        gate: "No ranking guarantees",
        requirement: "Use rank objectives and measured targets, not guaranteed #1 claims.",
        reason: "Google does not guarantee rankings, and unsupported claims damage trust.",
      },
      {
        gate: "Visible content matches schema",
        requirement: "FAQPage, Service, Article, Dataset, and Organization schema must reflect visible page content.",
        reason: "Structured data should help search engines understand the page, not describe hidden or unrelated content.",
      },
      {
        gate: "No doorway pages",
        requirement: "Local/service pages need distinct value, proof, examples, internal links, and a real user purpose.",
        reason: "Scaled near-duplicate pages created only to rank are a spam risk.",
      },
      {
        gate: "Human approval before publishing",
        requirement: "Public SEO copy, redirects, indexation changes, and claims require review before go-live.",
        reason: "SEO moves can affect revenue paths, compliance, brand positioning, and search trust.",
      },
    ],
    measurementModel: [
      { metric: "Indexed pages", source: "Google Search Console", use: "Confirm crawl and index coverage." },
      { metric: "Queries and impressions", source: "Google Search Console", use: "Find where Google is testing HomeReach." },
      { metric: "CTR", source: "Google Search Console", use: "Improve titles, descriptions, and page intent match." },
      { metric: "Organic leads", source: "Analytics and HomeReach events", use: "Prioritize pages that create demand." },
      { metric: "Revenue attribution", source: "CRM, Stripe, proposals, and intake events", use: "Focus SEO work on product lines that can close." },
    ],
  };
}
