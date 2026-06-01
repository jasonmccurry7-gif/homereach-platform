import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AuthorityPage } from "@/components/seo/AuthorityPage";
import { InteractiveToolCalculator } from "@/components/seo/InteractiveToolCalculator";
import { getInteractiveSeoTool, listInteractiveSeoTools } from "@/lib/seo/authority";
import {
  buildBreadcrumbLd,
  buildImageObjectLd,
  buildServiceLd,
  buildSoftwareApplicationLd,
  type JsonLd as JsonLdShape,
} from "@/lib/seo/schema";

export const dynamicParams = false;
export const revalidate = 86400;

const BASE = process.env.NEXT_PUBLIC_APP_URL || "https://www.home-reach.com";

type Props = { params: Promise<{ toolSlug: string }> };

export function generateStaticParams() {
  return listInteractiveSeoTools().map((tool) => ({ toolSlug: tool.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { toolSlug } = await params;
  const tool = getInteractiveSeoTool(toolSlug);
  if (!tool) return { title: "Not Found" };
  return {
    title: tool.metaTitle,
    description: tool.metaDescription,
    alternates: { canonical: `${BASE}${tool.path}` },
    openGraph: {
      title: tool.metaTitle,
      description: tool.metaDescription,
      url: `${BASE}${tool.path}`,
      images: [{ url: `${BASE}/seo-assets/${tool.visual.assetSlug}.svg`, alt: tool.visual.alt }],
    },
  };
}

export default async function ToolRoute({ params }: Props) {
  const { toolSlug } = await params;
  const tool = getInteractiveSeoTool(toolSlug);
  if (!tool) notFound();

  const fullUrl = `${BASE}${tool.path}`;
  const schemas: JsonLdShape[] = [
    buildServiceLd({
      name: tool.title,
      description: tool.summary,
      category: "Interactive SEO calculator",
      url: fullUrl,
    }),
    buildSoftwareApplicationLd({
      name: tool.title,
      description: tool.summary,
      url: fullUrl,
      applicationCategory: "BusinessApplication",
    }),
    buildBreadcrumbLd([
      { name: "Home", url: `${BASE}/` },
      { name: "Tools", url: `${BASE}/tools` },
      { name: tool.title, url: fullUrl },
    ]),
    buildImageObjectLd({
      name: tool.visual.title,
      contentUrl: `${BASE}/seo-assets/${tool.visual.assetSlug}.svg`,
      caption: tool.visual.caption,
    }),
  ];

  return (
    <AuthorityPage
      schemas={schemas}
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Tools", href: "/tools" },
        { label: tool.title, href: tool.path },
      ]}
      eyebrow={tool.eyebrow}
      title={tool.title}
      summary={tool.summary}
      visual={tool.visual}
      primaryCta={{ label: tool.ctaLabel, href: tool.ctaHref }}
      secondaryCta={{ label: "All Tools", href: "/tools" }}
      metrics={[
        { label: "Tool type", value: tool.calculatorType.replaceAll("_", " "), note: "Interactive SEO asset" },
        { label: "Inputs", value: String(tool.inputs.length), note: "Buyer-controlled estimate" },
        { label: "Output", value: "Estimate", note: "Proposal review still required" },
        { label: "CTA", value: tool.ctaLabel, note: "Lead path" },
      ]}
      sections={[
        { eyebrow: "Planning", title: "Use the estimate to start the conversation", body: tool.summary },
        { eyebrow: "Guardrails", title: "Keep final claims reviewed", items: tool.guidance },
        { eyebrow: "SEO value", title: "Interactive content earns attention", body: "Useful calculators increase engagement, support backlinks, and give AI search systems a concrete answer to cite." },
      ]}
      proofPoints={tool.guidance}
      links={tool.internalLinks}
    >
      <InteractiveToolCalculator tool={tool} />
    </AuthorityPage>
  );
}
