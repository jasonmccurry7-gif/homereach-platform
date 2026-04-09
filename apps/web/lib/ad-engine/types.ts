// ─────────────────────────────────────────────────────────────────────────────
// HomeReach Automated Ad Design Engine — Type Definitions
// ─────────────────────────────────────────────────────────────────────────────

// ── Slot Types ────────────────────────────────────────────────────────────────

export type AdSlotType = "anchor" | "standard";
export type CardSide   = "front" | "back";
export type DesignStatus = "draft" | "edited" | "approved" | "exported";

// ── Print Dimensions ──────────────────────────────────────────────────────────

export interface AdDimensions {
  widthIn:       number;  // inches
  heightIn:      number;  // inches
  bleedIn:       number;  // standard bleed = 0.125"
  safeMarginIn:  number;  // inside bleed = 0.125"
}

/** Exact dimensions for each slot type */
export const AD_DIMENSIONS: Record<AdSlotType, AdDimensions> = {
  anchor: {
    widthIn: 12, heightIn: 6.5,
    bleedIn: 0.125, safeMarginIn: 0.125,
  },
  standard: {
    widthIn: 4, heightIn: 3.5,
    bleedIn: 0.125, safeMarginIn: 0.125,
  },
};

/** Preview pixel size at 65px/inch (screen display) */
export const PREVIEW_SCALE_PPI = 65;

// ── Color Palette ─────────────────────────────────────────────────────────────

export interface ColorPalette {
  primary:      string;   // main background
  primaryText:  string;   // text on primary (white or near-white)
  secondary:    string;   // CTA button / accent color
  secondaryText: string;  // text on secondary button
  accent:       string;   // offer box / badge highlight
  accentText:   string;   // text on accent area
  imageBg:      string;   // image placeholder background
  muted:        string;   // sub-text, meta info
}

// ── Copy ──────────────────────────────────────────────────────────────────────

export interface AdCopy {
  headline:      string;
  subheadline?:  string;
  offer?:        string;
  cta:           string;
  tagline?:      string;
  phone?:        string;
  website?:      string;
  badgeText?:    string;  // e.g. "NEW", "LIMITED TIME", "EXCLUSIVE OFFER"
}

// ── Layout Schemas ─────────────────────────────────────────────────────────────

/**
 * Anchor Ad schema — premium layout (12" × 6.5")
 * Split: left content pane + right image pane
 */
export interface AnchorAdSchema {
  type:         "anchor";
  palette:      ColorPalette;
  contentSide: {
    logoText:       string;   // initials or business name abbreviated
    businessName:   string;
    headline:       string;
    subheadline:    string;
    offerText?:     string;
    ctaText:        string;
    phone?:         string;
    website?:       string;
    badgeText?:     string;
    hasQr:          boolean;
  };
  imageSide: {
    placeholderLabel: string; // e.g. "ADD YOUR BEST PHOTO"
    categoryIcon:     string; // emoji representing the category
  };
  printDimensions: AdDimensions;
}

/**
 * Standard Ad schema — compact layout (4" × 3.5")
 */
export interface StandardAdSchema {
  type:         "standard";
  palette:      ColorPalette;
  header: {
    businessName:   string;
    logoText:       string;
  };
  body: {
    headline:       string;
    offerLine?:     string;
  };
  footer: {
    ctaText:        string;
    phone?:         string;
    hasQr:          boolean;
  };
  printDimensions: AdDimensions;
}

export type AdSchema = AnchorAdSchema | StandardAdSchema;

// ── Input + Output ────────────────────────────────────────────────────────────

export interface AdDesignInput {
  businessName:  string;
  category:      string;      // must match a CategoryKey
  slotType:      AdSlotType;
  phone?:        string;
  email?:        string;
  website?:      string;
  offer?:        string;      // custom offer override
  notes?:        string;      // additional guidance
  logoUrl?:      string;      // future: render actual logo
  hasQr?:        boolean;
}

export interface GeneratedAd {
  id:            string;
  input:         AdDesignInput;
  copy:          AdCopy;
  schema:        AdSchema;
  status:        DesignStatus;
  generatedAt:   string;
  approvedAt?:   string;
  variantIndex:  number;      // for A/B — which template variant was used
}

// ── Category Template Definition ──────────────────────────────────────────────

export interface CategoryTemplate {
  key:              string;
  label:            string;
  icon:             string;    // emoji
  imageIdeal:       string;    // description for image placeholder
  palette:          ColorPalette;
  headlines:        string[];
  subheadlines:     string[];
  offers:           string[];
  ctas:             string[];
  taglines:         string[];
  badges:           string[];
  anchorHeadlines:  string[];  // larger, bolder variants for anchor slot
}

// ── Export Schema ─────────────────────────────────────────────────────────────

/** Portable export format for Canva / PDF integration */
export interface AdExportSchema {
  adId:           string;
  slotType:       AdSlotType;
  dimensions:     AdDimensions;
  elements: ExportElement[];
  colorPalette:   ColorPalette;
  exportedAt:     string;
}

export interface ExportElement {
  id:             string;
  type:           "text" | "image" | "shape" | "button" | "qr";
  content?:       string;
  x:              number;   // % from left (0–100)
  y:              number;   // % from top (0–100)
  width:          number;   // % of canvas width
  height:         number;   // % of canvas height
  style: {
    fontSize?:     number;  // pt
    fontWeight?:   string;
    color?:        string;
    bgColor?:      string;
    textAlign?:    string;
    borderRadius?: number;
  };
}
