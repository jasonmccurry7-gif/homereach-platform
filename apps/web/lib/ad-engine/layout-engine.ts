// ─────────────────────────────────────────────────────────────────────────────
// LayoutEngine — Ad Layout Schema Generation
//
// Produces AnchorAdSchema / StandardAdSchema from copy + category template.
// Schemas are used directly by the React preview renderer and the export layer.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  AdCopy, AdDesignInput, AdSlotType,
  AnchorAdSchema, StandardAdSchema, AdSchema,
  AdDimensions, ColorPalette,
} from "./types";
import { AD_DIMENSIONS } from "./types";
import { getTemplate }   from "./templates/category-templates";
import { CopyGenerator } from "./copy-generator";

// ─────────────────────────────────────────────────────────────────────────────
// LayoutEngine
// ─────────────────────────────────────────────────────────────────────────────

export class LayoutEngine {

  /**
   * Generate a layout schema for the given input and copy.
   * Delegates to anchor or standard layout builder.
   */
  static generate(input: AdDesignInput, copy: AdCopy): AdSchema {
    const template = getTemplate(input.category);
    return input.slotType === "anchor"
      ? this._buildAnchor(input, copy, template.palette, template.icon, template.imageIdeal)
      : this._buildStandard(input, copy, template.palette);
  }

  // ── Anchor Layout ───────────────────────────────────────────────────────────

  private static _buildAnchor(
    input: AdDesignInput,
    copy: AdCopy,
    palette: ColorPalette,
    categoryIcon: string,
    imageIdeal: string
  ): AnchorAdSchema {
    return {
      type: "anchor",
      palette,
      contentSide: {
        logoText:     CopyGenerator.getLogoText(input.businessName),
        businessName: input.businessName,
        headline:     copy.headline,
        subheadline:  copy.subheadline ?? "",
        offerText:    copy.offer,
        ctaText:      copy.cta,
        phone:        copy.phone,
        website:      copy.website,
        badgeText:    copy.badgeText,
        hasQr:        input.hasQr ?? false,
      },
      imageSide: {
        placeholderLabel: "ADD YOUR BEST PHOTO",
        categoryIcon,
      },
      printDimensions: AD_DIMENSIONS.anchor,
    };
  }

  // ── Standard Layout ─────────────────────────────────────────────────────────

  private static _buildStandard(
    input: AdDesignInput,
    copy: AdCopy,
    palette: ColorPalette
  ): StandardAdSchema {
    return {
      type: "standard",
      palette,
      header: {
        businessName: input.businessName,
        logoText:     CopyGenerator.getLogoText(input.businessName),
      },
      body: {
        headline:  copy.headline,
        offerLine: copy.offer,
      },
      footer: {
        ctaText: copy.cta,
        phone:   copy.phone,
        hasQr:   input.hasQr ?? false,
      },
      printDimensions: AD_DIMENSIONS.standard,
    };
  }

  // ── Export Helpers ──────────────────────────────────────────────────────────

  /**
   * Convert a layout schema to a flat list of positioned elements
   * for Canva / PDF export. Uses percentage-based coordinates.
   */
  static toExportElements(schema: AdSchema): Array<{
    id: string; type: string; content?: string;
    x: number; y: number; width: number; height: number;
    style: Record<string, string | number>;
  }> {
    if (schema.type === "anchor") {
      return this._anchorToExport(schema);
    }
    return this._standardToExport(schema);
  }

  private static _anchorToExport(schema: AnchorAdSchema) {
    const { contentSide: c, palette: p } = schema;
    return [
      // Content pane background
      { id: "bg_content", type: "shape", x: 0, y: 0, width: 55, height: 100,
        style: { bgColor: p.primary } },
      // Image pane background
      { id: "bg_image", type: "shape", x: 55, y: 0, width: 45, height: 100,
        style: { bgColor: p.imageBg } },
      // Logo circle
      { id: "logo", type: "shape", x: 4, y: 8, width: 8, height: 15,
        style: { bgColor: p.secondary, borderRadius: 4 } },
      { id: "logo_text", type: "text", content: c.logoText, x: 4, y: 8, width: 8, height: 15,
        style: { color: p.secondaryText, fontSize: 18, fontWeight: "700", textAlign: "center" } },
      // Business name
      { id: "biz_name", type: "text", content: c.businessName, x: 14, y: 10, width: 38, height: 10,
        style: { color: p.muted, fontSize: 9, fontWeight: "600", textAlign: "left" } },
      // Badge
      ...(c.badgeText ? [{
        id: "badge", type: "shape", x: 37, y: 6, width: 16, height: 8,
        style: { bgColor: p.accent, borderRadius: 4 }
      }, {
        id: "badge_text", type: "text", content: c.badgeText, x: 37, y: 6, width: 16, height: 8,
        style: { color: p.accentText, fontSize: 7, fontWeight: "800", textAlign: "center" }
      }] : []),
      // Headline
      { id: "headline", type: "text", content: c.headline, x: 4, y: 24, width: 48, height: 20,
        style: { color: p.primaryText, fontSize: 22, fontWeight: "800", textAlign: "left" } },
      // Subheadline
      { id: "subheadline", type: "text", content: c.subheadline, x: 4, y: 44, width: 48, height: 10,
        style: { color: p.muted, fontSize: 11, fontWeight: "500", textAlign: "left" } },
      // Offer box
      ...(c.offerText ? [{
        id: "offer_bg", type: "shape", x: 4, y: 56, width: 48, height: 12,
        style: { bgColor: p.accent + "33", borderRadius: 3 }
      }, {
        id: "offer_text", type: "text", content: `⭐ ${c.offerText}`, x: 6, y: 58, width: 44, height: 10,
        style: { color: p.accentText, fontSize: 10, fontWeight: "700", textAlign: "left" }
      }] : []),
      // CTA button
      { id: "cta_bg", type: "shape", x: 4, y: 72, width: 28, height: 11,
        style: { bgColor: p.secondary, borderRadius: 4 } },
      { id: "cta_text", type: "text", content: c.ctaText, x: 4, y: 73, width: 28, height: 9,
        style: { color: p.secondaryText, fontSize: 10, fontWeight: "700", textAlign: "center" } },
      // Contact
      { id: "contact", type: "text",
        content: [c.phone, c.website].filter(Boolean).join("  ·  "),
        x: 4, y: 87, width: 48, height: 8,
        style: { color: p.muted, fontSize: 9, fontWeight: "400", textAlign: "left" } },
      // Image placeholder
      { id: "image_icon", type: "text", content: schema.imageSide.categoryIcon,
        x: 65, y: 35, width: 20, height: 30,
        style: { fontSize: 48, textAlign: "center" } },
      { id: "image_label", type: "text", content: schema.imageSide.placeholderLabel,
        x: 58, y: 68, width: 36, height: 8,
        style: { color: "#FFFFFF40", fontSize: 8, fontWeight: "600", textAlign: "center" } },
    ];
  }

  private static _standardToExport(schema: StandardAdSchema) {
    const { header: h, body: b, footer: f, palette: p } = schema;
    return [
      { id: "bg", type: "shape", x: 0, y: 0, width: 100, height: 100,
        style: { bgColor: p.primary } },
      { id: "header_bg", type: "shape", x: 0, y: 0, width: 100, height: 20,
        style: { bgColor: "#00000033" } },
      { id: "logo", type: "shape", x: 3, y: 3, width: 12, height: 14,
        style: { bgColor: p.secondary, borderRadius: 3 } },
      { id: "logo_text", type: "text", content: h.logoText, x: 3, y: 4, width: 12, height: 12,
        style: { color: p.secondaryText, fontSize: 12, fontWeight: "700", textAlign: "center" } },
      { id: "biz_name", type: "text", content: h.businessName, x: 18, y: 7, width: 76, height: 10,
        style: { color: p.primaryText, fontSize: 10, fontWeight: "700", textAlign: "left" } },
      { id: "headline", type: "text", content: b.headline, x: 5, y: 25, width: 90, height: 20,
        style: { color: p.primaryText, fontSize: 16, fontWeight: "800", textAlign: "center" } },
      ...(b.offerLine ? [{
        id: "offer", type: "text", content: b.offerLine, x: 5, y: 48, width: 90, height: 12,
        style: { color: p.accentText, fontSize: 11, fontWeight: "700", textAlign: "center" }
      }] : []),
      { id: "footer_bg", type: "shape", x: 0, y: 78, width: 100, height: 22,
        style: { bgColor: p.secondary } },
      { id: "cta", type: "text", content: f.ctaText, x: 3, y: 80, width: 60, height: 18,
        style: { color: p.secondaryText, fontSize: 10, fontWeight: "700", textAlign: "center" } },
      ...(f.phone ? [{
        id: "phone", type: "text", content: `📞 ${f.phone}`, x: 60, y: 82, width: 37, height: 14,
        style: { color: p.secondaryText, fontSize: 8, fontWeight: "600", textAlign: "right" }
      }] : []),
    ];
  }
}
