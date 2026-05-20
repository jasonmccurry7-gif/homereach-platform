// ─────────────────────────────────────────────────────────────────────────────
// HomeReach SEO Engine - Block Types
//
// The 15-block catalog from SEO_Page_System_Design.md section 4.
// Each published page is an ordered array of block instances stored as
// JSONB in seo_pages.content_blocks.
//
// Three tiers of distinctiveness:
//   - Shared primitives (how_it_works, exclusivity_explainer, cta_final)
//     are identical across pages; reuse is correct.
//   - Hand-authored blocks (hero subhead, city_relevance, category_pain,
//     proof_trust, faq) MUST be hand-written per page. Publish gate rejects
//     placeholder content.
//   - Computed truth (scarcity_availability, pricing_offer, internal_links)
//     reads live DB state at render time.
//
// Stub renderers return JSX placeholders; real rendering lives in
// components/seo/PageBlocks.tsx (Step 10).
// ─────────────────────────────────────────────────────────────────────────────

export type BlockKind =
  | "hero"
  | "city_relevance"
  | "category_pain"
  | "how_it_works"
  | "exclusivity_explainer"
  | "scarcity_availability"
  | "homeowner_audience"
  | "pricing_offer"
  | "route_targeting"
  | "proof_trust"
  | "faq"
  | "cta_final"
  | "internal_links"
  | "intake_trigger"
  | "waitlist";

export interface BaseBlock {
  kind: BlockKind;
  /** Free-text body used by word-count + overlap quality checks. */
  text?: string;
  /** True when this block must be human-edited before publish. */
  requires_human_authoring?: boolean;
  /** Arbitrary block-specific config. */
  data?: Record<string, unknown>;
}

export interface HeroBlock extends BaseBlock {
  kind: "hero";
  data: {
    headline: string;
    subheadline: string;
    primary_cta_label: string;
    primary_cta_url: string;
  };
}

export interface CityRelevanceBlock extends BaseBlock {
  kind: "city_relevance";
  requires_human_authoring: true;
  data: {
    paragraph: string;
    neighborhoods?: string[];
    homeowner_count?: number;
    local_anchors?: string[];
  };
}

export interface CategoryPainBlock extends BaseBlock {
  kind: "category_pain";
  requires_human_authoring: true;
  data: {
    pain_points: string[];
  };
}

export interface HowItWorksBlock extends BaseBlock {
  kind: "how_it_works";
}

export interface ExclusivityExplainerBlock extends BaseBlock {
  kind: "exclusivity_explainer";
  data: {
    city: string;
    category: string;
  };
}

export interface ScarcityAvailabilityBlock extends BaseBlock {
  kind: "scarcity_availability";
  // Rendered live from spot_assignments; no stored data required.
}

export interface HomeownerAudienceBlock extends BaseBlock {
  kind: "homeowner_audience";
  data: {
    demographic_profile?: string;
    homeowner_count?: number;
    neighborhoods?: string[];
  };
}

export interface PricingOfferBlock extends BaseBlock {
  kind: "pricing_offer";
  // Rendered live from bundles + resolvePrice() at request time.
}

export interface RouteTargetingBlock extends BaseBlock {
  kind: "route_targeting";
  data: {
    route_map_description: string;
    household_count?: number;
    frequency?: string;
    postcard_format?: string;
  };
}

export interface ProofTrustBlock extends BaseBlock {
  kind: "proof_trust";
  requires_human_authoring: true;
  data: {
    mode: "testimonial" | "early_access";
    testimonial_text?: string;
    testimonial_attribution?: string;
    early_access_framing?: string;
  };
}

export interface FaqBlock extends BaseBlock {
  kind: "faq";
  requires_human_authoring: true;
  data: {
    pairs: Array<{ question: string; answer: string }>;
  };
}

export interface CtaFinalBlock extends BaseBlock {
  kind: "cta_final";
  data: {
    primary_cta_label: string;
    primary_cta_url: string;
  };
}

export interface InternalLinksBlock extends BaseBlock {
  kind: "internal_links";
  data: {
    links: Array<{ text: string; href: string }>;
  };
}

export interface IntakeTriggerBlock extends BaseBlock {
  kind: "intake_trigger";
  data: {
    form_mode: "email_only" | "email_phone";
    copy?: string;
  };
}

export interface WaitlistBlock extends BaseBlock {
  kind: "waitlist";
  data: {
    copy: string;
    cta_label: string;
  };
}

export type BlockInstance =
  | HeroBlock
  | CityRelevanceBlock
  | CategoryPainBlock
  | HowItWorksBlock
  | ExclusivityExplainerBlock
  | ScarcityAvailabilityBlock
  | HomeownerAudienceBlock
  | PricingOfferBlock
  | RouteTargetingBlock
  | ProofTrustBlock
  | FaqBlock
  | CtaFinalBlock
  | InternalLinksBlock
  | IntakeTriggerBlock
  | WaitlistBlock;

/** Blocks that must contain human-authored content before publish. */
export const HUMAN_AUTHORED_BLOCK_KINDS: ReadonlyArray<BlockKind> = [
  "city_relevance",
  "category_pain",
  "proof_trust",
  "faq",
];

/** Blocks that render live DB state at request time (never cached as JSONB). */
export const LIVE_BLOCK_KINDS: ReadonlyArray<BlockKind> = [
  "scarcity_availability",
  "pricing_offer",
];
