export type LearningSourceStatus = "ready" | "partial" | "manual_only" | "blocked";
export type LearningSourceMethod = "api" | "rss" | "manual" | "browser_assisted" | "webhook";

export interface LearningSourceDefinition {
  id: string;
  label: string;
  method: LearningSourceMethod;
  status: LearningSourceStatus;
  priority: "high" | "medium" | "low";
  requiredEnv: string[];
  optionalEnv: string[];
  categories: string[];
  safety: string;
  reviewGate: string;
  nextStep: string;
}

function envReady(key: string) {
  return Boolean(process.env[key]?.trim());
}

function sourceStatus(requiredEnv: string[], manualFallback = false): LearningSourceStatus {
  if (requiredEnv.length === 0) return manualFallback ? "manual_only" : "ready";
  const ready = requiredEnv.filter(envReady).length;
  if (ready === requiredEnv.length) return "ready";
  if (ready > 0 || manualFallback) return "partial";
  return "blocked";
}

function defineSource(args: Omit<LearningSourceDefinition, "status"> & { manualFallback?: boolean }): LearningSourceDefinition {
  return {
    ...args,
    status: sourceStatus(args.requiredEnv, args.manualFallback),
  };
}

export function getLearningSourceRegistry(): LearningSourceDefinition[] {
  return [
    defineSource({
      id: "youtube-transcripts",
      label: "YouTube Strategy Videos",
      method: "api",
      priority: "high",
      requiredEnv: ["YOUTUBE_API_KEY", "YT_TRANSCRIPT_API_KEY"],
      optionalEnv: ["CONTENT_INTEL_DAILY_CAP"],
      categories: ["AI agents", "SEO", "outreach", "sales", "procurement", "political", "dashboard UX"],
      safety: "Uses API/transcript ingestion first. Browser automation is not required for normal operation.",
      reviewGate: "All extracted ideas remain pending until approved in the Learning Engine.",
      nextStep: "Configure YouTube and transcript credentials, then run ingestion in review-only mode.",
    }),
    defineSource({
      id: "trusted-channels",
      label: "Trusted Creator Channels",
      method: "api",
      priority: "high",
      requiredEnv: ["YOUTUBE_API_KEY"],
      optionalEnv: ["CONTENT_INTEL_DAILY_CAP"],
      categories: ["AI automation", "lead generation", "small business systems", "multi-agent operations"],
      safety: "Only approved channels and configured topics should feed the queue.",
      reviewGate: "Channel output is scored and must be approved before promotion.",
      nextStep: "Review trusted channels and confirm active categories before scheduled ingestion.",
    }),
    defineSource({
      id: "competitor-websites",
      label: "Competitor Websites",
      method: "manual",
      priority: "medium",
      requiredEnv: [],
      optionalEnv: ["SERPAPI_KEY"],
      categories: ["shared postcards", "targeted campaigns", "political mail", "procurement", "sales"],
      safety: "Manual/API-first competitor tracking. No automated account login or terms-risky scraping.",
      reviewGate: "Competitor insights stay advisory and cannot change public pages automatically.",
      nextStep: "Add high-value competitor sources and review duplicate/conflict matches before implementing ideas.",
      manualFallback: true,
    }),
    defineSource({
      id: "rss-publishing",
      label: "RSS and Published Content",
      method: "rss",
      priority: "medium",
      requiredEnv: [],
      optionalEnv: ["CMS_WEBHOOK_URL", "SEO_WEBHOOK_SECRET"],
      categories: ["SEO", "social repurposing", "email newsletter", "postcard concepts"],
      safety: "Repurposes approved published content only. No auto-publishing by default.",
      reviewGate: "Generated social/email/postcard ideas enter human review.",
      nextStep: "Connect CMS/RSS when publishing workflow is ready; keep social posts in review queue.",
      manualFallback: true,
    }),
    defineSource({
      id: "browser-assisted-research",
      label: "Browser-Assisted Research",
      method: "browser_assisted",
      priority: "low",
      requiredEnv: [],
      optionalEnv: ["BROWSER_MCP_ENABLED", "COMPOSIO_API_KEY"],
      categories: ["visual UX", "competitor screenshots", "workflow discovery"],
      safety: "Secondary path only. Use APIs first and never bypass site terms, auth, or approval.",
      reviewGate: "Screenshots/observations become notes, not production changes.",
      nextStep: "Use only for approved research tasks where API/transcript data is insufficient.",
      manualFallback: true,
    }),
    defineSource({
      id: "implementation-backlog",
      label: "Approved Implementation Backlog",
      method: "webhook",
      priority: "high",
      requiredEnv: [],
      optionalEnv: ["LINEAR_API_KEY", "GITHUB_TOKEN"],
      categories: ["AI Workforce OS", "revenue operations", "system reliability", "dashboard UX"],
      safety: "Creates internal tasks only. No autonomous code deployment.",
      reviewGate: "Approved insights must still pass planning, coding, testing, and deployment review.",
      nextStep: "Use Action Center promotion first, then connect task tooling when ready.",
      manualFallback: true,
    }),
  ];
}

export function getLearningSourceRegistrySummary(sources = getLearningSourceRegistry()) {
  return {
    total: sources.length,
    ready: sources.filter((source) => source.status === "ready").length,
    partial: sources.filter((source) => source.status === "partial").length,
    manualOnly: sources.filter((source) => source.status === "manual_only").length,
    blocked: sources.filter((source) => source.status === "blocked").length,
  };
}
