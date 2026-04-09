// ─────────────────────────────────────────────────────────────────────────────
// DesignEngine — Ad Design Orchestrator
//
// Combines CopyGenerator + LayoutEngine to produce a GeneratedAd.
// Handles the full lifecycle: generate → edit → approve → export.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  AdDesignInput, AdCopy, AdSchema,
  GeneratedAd, AdExportSchema, DesignStatus,
} from "./types";
import { AD_DIMENSIONS } from "./types";
import { CopyGenerator } from "./copy-generator";
import { LayoutEngine }  from "./layout-engine";
import { getTemplate }   from "./templates/category-templates";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

let _idCounter = 0;
function generateId(): string {
  return `ad-${Date.now()}-${++_idCounter}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// DesignEngine
// ─────────────────────────────────────────────────────────────────────────────

export class DesignEngine {

  // ── Generate ────────────────────────────────────────────────────────────────

  /**
   * Generate a complete ad design from business input.
   * @param input    - Business details + slot preferences
   * @param variant  - Template variant index (0, 1, 2) for A/B testing
   */
  static generate(input: AdDesignInput, variant = 0): GeneratedAd {
    this._validateInput(input);
    const copy   = CopyGenerator.generate(input, variant);
    const schema = LayoutEngine.generate(input, copy);

    return {
      id:           generateId(),
      input,
      copy,
      schema,
      status:       "draft",
      generatedAt:  new Date().toISOString(),
      variantIndex: variant,
    };
  }

  /**
   * Generate all A/B variants (up to 3) for a business/slot combo.
   */
  static generateVariants(input: AdDesignInput): GeneratedAd[] {
    this._validateInput(input);
    return [0, 1, 2].map((v) => this.generate(input, v));
  }

  // ── Edit ────────────────────────────────────────────────────────────────────

  /**
   * Apply inline text edits to an existing ad.
   * Updates both the copy record AND the schema's text fields.
   */
  static applyEdit(ad: GeneratedAd, patch: Partial<AdCopy>): GeneratedAd {
    const newCopy   = CopyGenerator.applyEdit(ad.copy, patch);
    // Rebuild the layout schema with the updated copy to keep it in sync
    const newSchema = LayoutEngine.generate(ad.input, newCopy);
    return {
      ...ad,
      copy:   newCopy,
      schema: newSchema,
      status: "edited",
    };
  }

  /**
   * Regenerate copy from a new template variant.
   * Useful when the user wants to try a different headline style.
   */
  static regenerateCopy(ad: GeneratedAd, variant?: number): GeneratedAd {
    const nextVariant = variant ?? ((ad.variantIndex + 1) % 3);
    return this.generate(ad.input, nextVariant);
  }

  /**
   * Update the input data (e.g. user corrected phone number) and regenerate.
   */
  static updateInput(ad: GeneratedAd, patch: Partial<AdDesignInput>): GeneratedAd {
    const newInput = { ...ad.input, ...patch };
    return this.generate(newInput, ad.variantIndex);
  }

  // ── Approve ─────────────────────────────────────────────────────────────────

  /**
   * Mark an ad as approved for print.
   * Validates completeness before approving.
   */
  static approve(ad: GeneratedAd): { ad: GeneratedAd; ok: boolean; errors: string[] } {
    const validation = this.validate(ad);
    if (!validation.ok) {
      return { ad, ok: false, errors: validation.errors };
    }
    return {
      ad: { ...ad, status: "approved", approvedAt: new Date().toISOString() },
      ok: true,
      errors: [],
    };
  }

  // ── Export ──────────────────────────────────────────────────────────────────

  /**
   * Export the ad to a portable schema for Canva / PDF integration.
   * All element positions expressed as % of canvas (0–100).
   */
  static export(ad: GeneratedAd): AdExportSchema {
    return {
      adId:         ad.id,
      slotType:     ad.input.slotType,
      dimensions:   AD_DIMENSIONS[ad.input.slotType],
      elements:     LayoutEngine.toExportElements(ad.schema),
      colorPalette: ad.schema.palette,
      exportedAt:   new Date().toISOString(),
    };
  }

  // ── Validation ──────────────────────────────────────────────────────────────

  static validate(ad: GeneratedAd): { ok: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!ad.input.businessName?.trim()) errors.push("Business name is required");
    if (!ad.copy.headline?.trim())      errors.push("Headline is missing");
    if (!ad.copy.cta?.trim())           errors.push("Call-to-action is missing");
    if (!ad.input.phone && !ad.input.website) {
      errors.push("At least one contact method (phone or website) is recommended");
    }
    return { ok: errors.length === 0, errors };
  }

  // ── Display Helpers ─────────────────────────────────────────────────────────

  static getStatusLabel(status: DesignStatus): { label: string; color: string } {
    const map: Record<DesignStatus, { label: string; color: string }> = {
      draft:    { label: "Draft",    color: "text-gray-400"   },
      edited:   { label: "Edited",   color: "text-blue-400"   },
      approved: { label: "Approved", color: "text-green-400"  },
      exported: { label: "Exported", color: "text-purple-400" },
    };
    return map[status];
  }

  static getSlotLabel(slotType: string): string {
    return slotType === "anchor" ? "Anchor Ad (12″ × 6.5″)" : "Standard Ad (4″ × 3.5″)";
  }

  static getCategoryMeta(category: string): { label: string; icon: string; palette: string } {
    const t = getTemplate(category);
    return { label: t.label, icon: t.icon, palette: t.palette.primary };
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  private static _validateInput(input: AdDesignInput): void {
    if (!input.businessName?.trim()) {
      throw new Error("Business name is required to generate an ad.");
    }
    if (!input.category?.trim()) {
      throw new Error("Business category is required to generate an ad.");
    }
    if (!["anchor", "standard"].includes(input.slotType)) {
      throw new Error(`Invalid slot type: ${input.slotType}. Must be "anchor" or "standard".`);
    }
  }
}
