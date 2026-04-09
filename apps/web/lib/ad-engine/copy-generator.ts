// ─────────────────────────────────────────────────────────────────────────────
// CopyGenerator — Business-Type-Aware Ad Copy Generation
//
// Selects headlines, CTAs, and offers from category templates.
// Injects business name where natural, uses custom offer if provided.
// Falls back to "general" template for unknown categories.
// ─────────────────────────────────────────────────────────────────────────────

import type { AdCopy, AdDesignInput, AdSlotType, CategoryTemplate } from "./types";
import { getTemplate } from "./templates/category-templates";

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

/** Abbreviate business name to max 2 words for logo initials */
function getLogoText(businessName: string): string {
  const words = businessName.trim().split(/\s+/);
  return words
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/** Format phone number for display */
function formatPhone(phone?: string): string | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === "1") {
    return `(${digits.slice(1,4)}) ${digits.slice(4,7)}-${digits.slice(7)}`;
  }
  return phone;
}

/** Strip protocol from website URL for cleaner display */
function cleanWebsite(website?: string): string | undefined {
  if (!website) return undefined;
  return website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
}

// ─────────────────────────────────────────────────────────────────────────────
// CopyGenerator
// ─────────────────────────────────────────────────────────────────────────────

export class CopyGenerator {
  /**
   * Generate ad copy for an anchor or standard slot.
   * @param input  - Business input data
   * @param variant - 0, 1, 2... to pick different template variants (A/B)
   */
  static generate(input: AdDesignInput, variant = 0): AdCopy {
    const template = getTemplate(input.category);
    return input.slotType === "anchor"
      ? this._generateAnchor(input, template, variant)
      : this._generateStandard(input, template, variant);
  }

  /**
   * Generate all available variants for a business/slot combo.
   * Returns up to 3 variants for A/B testing.
   */
  static generateVariants(input: AdDesignInput): AdCopy[] {
    return [0, 1, 2].map((v) => this.generate(input, v));
  }

  // ── Private: Anchor Copy ────────────────────────────────────────────────────

  private static _generateAnchor(
    input: AdDesignInput,
    template: CategoryTemplate,
    variant: number
  ): AdCopy {
    // Anchor ads use larger, bolder headline variants when available
    const headlinePool = template.anchorHeadlines.length > 0
      ? template.anchorHeadlines
      : template.headlines;

    const headline    = pick(headlinePool,     variant);
    const subheadline = pick(template.subheadlines, variant);
    const cta         = pick(template.ctas,        variant);
    const badge       = pick(template.badges,      variant);

    // Use custom offer if provided, otherwise pick from template
    const offer = input.offer
      ? this._formatOffer(input.offer)
      : pick(template.offers, variant);

    return {
      headline,
      subheadline,
      offer,
      cta,
      tagline:    pick(template.taglines, variant),
      badgeText:  badge,
      phone:      formatPhone(input.phone),
      website:    cleanWebsite(input.website),
    };
  }

  // ── Private: Standard Copy ──────────────────────────────────────────────────

  private static _generateStandard(
    input: AdDesignInput,
    template: CategoryTemplate,
    variant: number
  ): AdCopy {
    const headline = pick(template.headlines, variant);
    const cta      = pick(template.ctas,      variant);

    // Standard ads lead with the offer — make it punchy
    const offer = input.offer
      ? this._formatOffer(input.offer)
      : pick(template.offers, variant);

    return {
      headline,
      offer,
      cta,
      phone:   formatPhone(input.phone),
      website: cleanWebsite(input.website),
    };
  }

  // ── Private: Formatting ─────────────────────────────────────────────────────

  private static _formatOffer(rawOffer: string): string {
    // Capitalize first letter, ensure it reads as a punchy offer line
    const trimmed = rawOffer.trim();
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  }

  // ── Public Helpers ──────────────────────────────────────────────────────────

  /** Get logo initials for a business name */
  static getLogoText(businessName: string): string {
    return getLogoText(businessName);
  }

  /** Get the template for a given category (for admin preview) */
  static getTemplateInfo(category: string): CategoryTemplate {
    return getTemplate(category);
  }

  /** Validate that copy is complete and renderable */
  static validate(copy: AdCopy): { ok: boolean; missing: string[] } {
    const missing: string[] = [];
    if (!copy.headline?.trim()) missing.push("headline");
    if (!copy.cta?.trim())      missing.push("cta");
    return { ok: missing.length === 0, missing };
  }

  /**
   * Merge a partial copy edit into an existing copy object.
   * Used for inline editing in the preview UI.
   */
  static applyEdit(existing: AdCopy, patch: Partial<AdCopy>): AdCopy {
    return { ...existing, ...patch };
  }
}
