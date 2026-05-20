import { z } from "zod";
import {
  EMPTY_CONTEXT_FLAGS,
  type GrowthOsContextFlags,
} from "./types";

const moneyInput = z.coerce.number().min(0).max(10_000_000);
const countInput = z.coerce.number().int().min(0).max(1_000_000);

export const businessProfileSchema = z.object({
  companyName: z.string().trim().min(1, "Company name is required").max(120),
  locationZip: z.string().trim().min(5, "ZIP code is required").max(12),
  businessType: z.string().trim().min(1, "Business type is required").max(80),
  weeklyRevenue: moneyInput,
  avgOrderValue: moneyInput,
  dailyCustomers: countInput,
  laborCostWeekly: moneyInput,
  ingredientCostWeekly: moneyInput,
  overheadMonthly: moneyInput,
  ownerGoal: z.string().trim().min(1, "Owner goal is required").max(160),
  timezone: z.string().trim().min(1).max(80).default("America/New_York"),
});

export const weeklyInputSchema = z.object({
  weekStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  weeklyRevenue: moneyInput,
  weeklyOrders: countInput,
  weeklyLaborCost: moneyInput,
  weeklyIngredientCost: moneyInput,
  weeklyWasteEstimate: moneyInput,
  notes: z.string().trim().max(800).optional().default(""),
  contextFlags: z
    .object({
      badWeather: z.boolean().optional(),
      holidaySpike: z.boolean().optional(),
      equipmentIssue: z.boolean().optional(),
      staffingIssue: z.boolean().optional(),
      promotionRunning: z.boolean().optional(),
    })
    .optional()
    .default({}),
  sameAsPrevious: z.boolean().optional().default(false),
});

export const applyRecommendationSchema = z.object({
  triggerKey: z.string().min(1).max(120),
});

export const growthOsChatSchema = z.object({
  message: z.string().trim().min(1).max(1200),
});

export const growthOsActionArtifactSchema = z.object({
  artifactType: z
    .enum([
      "pricing_script",
      "weekly_action_plan",
      "bundle_configuration",
      "staffing_schedule",
      "customer_message",
    ])
    .default("weekly_action_plan"),
});

export const growthOsAbTestSchema = z.object({
  testType: z.enum(["pricing", "bundle"]),
  hypothesis: z.string().trim().min(8).max(240),
  variantAName: z.string().trim().min(1).max(80),
  variantADescription: z.string().trim().min(1).max(300),
  variantAPrice: moneyInput.optional(),
  variantBName: z.string().trim().min(1).max(80),
  variantBDescription: z.string().trim().min(1).max(300),
  variantBPrice: moneyInput.optional(),
  primaryMetric: z
    .enum(["aov_cents", "revenue_cents", "orders"])
    .default("aov_cents"),
});

export function normalizeContextFlags(
  flags: Partial<GrowthOsContextFlags> | null | undefined
): GrowthOsContextFlags {
  return {
    ...EMPTY_CONTEXT_FLAGS,
    ...(flags ?? {}),
  };
}

export type BusinessProfileInput = z.infer<typeof businessProfileSchema>;
export type WeeklyInput = z.infer<typeof weeklyInputSchema>;
