// ─────────────────────────────────────────────────────────────────────────────
// HomeReach SEO Engine - PageBlocks renderer
//
// Maps each block.kind to its renderer component. Server component; live
// blocks (scarcity, pricing) read DB at request time.
//
// `srcParam` is appended to the primary CTA's URL at render time so that
// funnel entry can attribute the session back to the seo_pages row.
// ─────────────────────────────────────────────────────────────────────────────

import type { BlockInstance } from "@/lib/seo/blocks";
import { HeroBlockView } from "./blocks/HeroBlock";
import { CityRelevanceBlockView } from "./blocks/CityRelevanceBlock";
import { CategoryPainBlockView } from "./blocks/CategoryPainBlock";
import { HowItWorksBlockView } from "./blocks/HowItWorksBlock";
import { ExclusivityExplainerBlockView } from "./blocks/ExclusivityExplainerBlock";
import { HomeownerAudienceBlockView } from "./blocks/HomeownerAudienceBlock";
import { RouteTargetingBlockView } from "./blocks/RouteTargetingBlock";
import { ProofTrustBlockView } from "./blocks/ProofTrustBlock";
import { FaqBlockView } from "./blocks/FaqBlock";
import { CtaFinalBlockView } from "./blocks/CtaFinalBlock";
import { InternalLinksBlockView } from "./blocks/InternalLinksBlock";
import { IntakeTriggerBlockView } from "./blocks/IntakeTriggerBlock";
import { WaitlistBlockView } from "./blocks/WaitlistBlock";
import { ScarcityLive } from "./ScarcityLive";
import { PricingLive } from "./PricingLive";

export type PageContext = {
  cityId: string;
  categoryId: string | null;
  cityName: string;
  categoryName: string | null;
  srcParam: string; // e.g. "seo_<pageId>"
};

function appendSrcToUrl(url: string, srcParam: string): string {
  if (!url) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}src=${encodeURIComponent(srcParam)}`;
}

export function PageBlocks({
  blocks,
  context,
}: {
  blocks: BlockInstance[];
  context: PageContext;
}) {
  return (
    <div className="flex flex-col gap-10 px-6 py-10 max-w-3xl mx-auto">
      {blocks.map((block, idx) => {
        const key = `${block.kind}-${idx}`;
        switch (block.kind) {
          case "hero":
            return (
              <HeroBlockView
                key={key}
                data={{
                  ...block.data,
                  primary_cta_url: appendSrcToUrl(block.data.primary_cta_url, context.srcParam),
                }}
              />
            );
          case "city_relevance":
            return <CityRelevanceBlockView key={key} data={block.data} />;
          case "category_pain":
            return <CategoryPainBlockView key={key} data={block.data} />;
          case "how_it_works":
            return <HowItWorksBlockView key={key} />;
          case "exclusivity_explainer":
            return <ExclusivityExplainerBlockView key={key} data={block.data} />;
          case "scarcity_availability":
            return (
              <ScarcityLive
                key={key}
                cityId={context.cityId}
                categoryId={context.categoryId}
                cityName={context.cityName}
                categoryName={context.categoryName}
              />
            );
          case "homeowner_audience":
            return <HomeownerAudienceBlockView key={key} data={block.data} cityName={context.cityName} />;
          case "pricing_offer":
            return <PricingLive key={key} cityId={context.cityId} categoryId={context.categoryId} />;
          case "route_targeting":
            return <RouteTargetingBlockView key={key} data={block.data} cityName={context.cityName} />;
          case "proof_trust":
            return <ProofTrustBlockView key={key} data={block.data} />;
          case "faq":
            return <FaqBlockView key={key} data={block.data} />;
          case "cta_final":
            return (
              <CtaFinalBlockView
                key={key}
                data={{
                  ...block.data,
                  primary_cta_url: appendSrcToUrl(block.data.primary_cta_url, context.srcParam),
                }}
              />
            );
          case "internal_links":
            return <InternalLinksBlockView key={key} data={block.data} />;
          case "intake_trigger":
            return <IntakeTriggerBlockView key={key} data={block.data} />;
          case "waitlist":
            return <WaitlistBlockView key={key} data={block.data} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
