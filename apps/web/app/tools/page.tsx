import type { Metadata } from "next";
import Link from "next/link";
import { AuthorityPage } from "@/components/seo/AuthorityPage";
import { listInteractiveSeoTools } from "@/lib/seo/authority";
import { buildBreadcrumbLd, buildItemListLd, type JsonLd as JsonLdShape } from "@/lib/seo/schema";

const BASE = process.env.NEXT_PUBLIC_APP_URL || "https://www.home-reach.com";

export const metadata: Metadata = {
  title: "Direct Mail, Political Mail, and Procurement Calculators | HomeReach",
  description:
    "Interactive HomeReach calculators for postcard ROI, household reach, political mail, campaign coverage, procurement savings, and neighborhood saturation.",
  alternates: { canonical: `${BASE}/tools` },
};

export default function ToolsHub() {
  const tools = listInteractiveSeoTools();
  const hero = tools[0]!;
  const schemas: JsonLdShape[] = [
    buildBreadcrumbLd([
      { name: "Home", url: `${BASE}/` },
      { name: "Tools", url: `${BASE}/tools` },
    ]),
    buildItemListLd({
      name: "HomeReach Interactive SEO Tools",
      url: `${BASE}/tools`,
      items: tools.map((tool) => ({ name: tool.title, url: `${BASE}${tool.path}` })),
    }),
  ];

  return (
    <AuthorityPage
      schemas={schemas}
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Tools", href: "/tools" },
      ]}
      eyebrow="Interactive SEO tools"
      title="Calculators that educate buyers and create proposal-ready leads"
      summary="Interactive tools improve dwell time, earn links, and help visitors estimate ROI, coverage, political mail volume, savings, and saturation before asking for a proposal."
      visual={hero.visual}
      primaryCta={{ label: "Get My Proposal", href: "/get-started" }}
      secondaryCta={{ label: "See Benchmarks", href: "/benchmarks" }}
      metrics={[
        { label: "Tools", value: String(tools.length), note: "Lead-oriented calculators" },
        { label: "SEO role", value: "Dwell time", note: "Useful interactive assets" },
        { label: "Lead path", value: "Proposal", note: "Every tool has a next action" },
        { label: "Review", value: "Required", note: "Estimates are not guarantees" },
      ]}
      sections={[
        { eyebrow: "Conversion", title: "Make the value concrete", body: "Calculators turn abstract campaign ideas into a number a buyer can discuss." },
        { eyebrow: "Authority", title: "Useful assets earn links", body: "Planning tools can attract backlinks and AI search citations when they provide clear, structured answers." },
        { eyebrow: "Safety", title: "Estimates stay reviewed", body: "Tools educate publicly while final pricing, route maps, savings, and political plans stay reviewed before sending." },
      ]}
      proofPoints={["ROI and reach estimates", "Political mail and procurement tools", "CTA paths into proposals"]}
      links={tools.map((tool) => ({ label: tool.title, href: tool.path }))}
    >
      <section className="bg-slate-950 px-4 py-16 text-white lg:px-6">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tools.map((tool) => (
            <Link key={tool.slug} href={tool.path} className="rounded-lg border border-white/10 bg-white/[0.06] p-5 transition hover:bg-white hover:text-slate-950">
              <p className="text-xs font-black uppercase tracking-[0.14em] opacity-70">{tool.eyebrow}</p>
              <h2 className="mt-3 text-xl font-black">{tool.title}</h2>
              <p className="mt-3 text-sm leading-7 opacity-80">{tool.summary}</p>
            </Link>
          ))}
        </div>
      </section>
    </AuthorityPage>
  );
}
