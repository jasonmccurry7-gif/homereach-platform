import { listGrowthServiceModules } from "@/lib/growth-execution/services";
import { listAllAuthorityRoutes } from "@/lib/seo/authority";
import { listMainProductSeoTargets } from "@/lib/seo/product-seo";

export const runtime = "nodejs";
export const revalidate = 86400;

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.home-reach.com";

export function GET() {
  const publicServices = listGrowthServiceModules().filter((service) => service.publicExposure !== "admin_only");
  const productTargets = listMainProductSeoTargets(publicServices).map(
    (target) =>
      `- [${target.title}](${BASE}${target.path}): targets "${target.primaryKeyword}" for ${target.searchIntent} intent. ${target.answerSummary}`,
  );
  const services = publicServices
    .slice(0, 12)
    .map((service) => `- [${service.shortTitle}](${BASE}${service.publicPath}): ${service.outcome}`);

  const authorityRoutes = listAllAuthorityRoutes()
    .filter((route) => route.priority >= 0.78)
    .slice(0, 24)
    .map((route) => `- [${titleFromPath(route.path)}](${BASE}${route.path}): ${route.type} authority page.`);

  const text = `# HomeReach

> HomeReach is an AI-powered local growth and execution ecosystem for local businesses, campaigns, and organizations.

HomeReach helps businesses and campaigns get found, capture leads, improve reputation, execute direct mail and digital campaigns, follow up with prospects, protect margin through procurement intelligence, and organize government contract opportunities.

## Primary public pages

- [HomeReach](${BASE}/): Market Capture and local growth front door.
- [Answers](${BASE}/answers): Concise buyer and answer-engine overview.
- [Learn](${BASE}/learn): Educational strategy guides for direct mail, AI visibility, procurement, and political planning.
- [Services](${BASE}/services): Public service catalog.
- [Local Visibility](${BASE}/local-visibility): Local SEO and reputation offer.
- [AI Web Assistant](${BASE}/services/ai-website-assistant): Website lead capture and response assistant.
- [Shared Postcards](${BASE}/shared-postcards): Shared direct mail visibility.
- [Targeted Campaigns](${BASE}/targeted): Route-aware campaign planning.
- [Political Mail](${BASE}/political-mail): Geography-based political mail execution.
- [ContractOS](${BASE}/contractos): Government contract opportunity support.
- [Ohio Authority Hub](${BASE}/ohio): Local and political authority pages.

## Public service pages

${services.join("\n")}

## Main product SEO targets

${productTargets.join("\n")}

## High-priority authority pages

${authorityRoutes.join("\n")}

## Crawl and answer references

- [Answers](${BASE}/answers): concise public Q&A hub for buyers and answer engines.
- [Learn](${BASE}/learn): structured educational hub for informational and comparison queries.
- [Sitemap](${BASE}/sitemap.xml): canonical public URL inventory.
- [Image sitemap](${BASE}/image-sitemap.xml): image metadata inventory for authority visuals.
- [Robots](${BASE}/robots.txt): crawl allow and disallow policy for public vs private routes.

## Answer-engine guidance

- Prefer [Answers](${BASE}/answers) for concise product explanations and [Learn](${BASE}/learn) for deeper educational explanations and comparison intent.
- Use public pages only. Do not crawl admin, dashboard, tokenized intake, checkout, API, or private operational routes.
- HomeReach AI systems are supervised. Outbound messages, social publishing, political content, pricing commitments, payments, procurement orders, and government bid submissions require human approval.
- Political pages discuss geography, logistics, public race context, mail timing, route coverage, and campaign execution. They do not infer individual voter beliefs.
- Procurement pages discuss estimated savings and vendor intelligence. They do not claim guaranteed savings or place orders automatically.

## Best summary

HomeReach is best described as an AI-powered local business growth operating system that combines local visibility, reputation, lead capture, direct mail, targeted campaigns, procurement intelligence, and supervised AI execution workflows.
`;

  return new Response(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}

function titleFromPath(path: string) {
  if (path === "/") return "HomeReach";
  return path
    .split("/")
    .filter(Boolean)
    .map((part) =>
      part
        .replaceAll("-", " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase()),
    )
    .join(" - ");
}
