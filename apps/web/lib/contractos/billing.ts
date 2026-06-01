import "server-only";

import { CONTRACTOS_PRICING_PLANS, type ContractOSPlanKey } from "./pricing";

export type ContractOSBillingPlanKey = ContractOSPlanKey;

export type ContractOSBillingPlan = {
  key: ContractOSBillingPlanKey;
  label: string;
  publicLabel: string;
  description: string;
  mode: "payment" | "subscription";
  priceEnvKey: string;
  standardPriceLabel: string;
  founderPriceLabel: string;
  checkoutPriceCents: number;
  cadenceLabel: string;
  checkoutAmountLabel: string;
  includedAiSummaries: string;
  aiSummaryOverageLabel: string;
  bestFor: string;
  highlights: string[];
  priceId: string | null;
  configured: boolean;
};

export function getContractOSBillingPlans(): ContractOSBillingPlan[] {
  return CONTRACTOS_PRICING_PLANS.map((plan) => {
    const priceId = process.env[plan.priceEnvKey]?.trim() || null;
    return {
      ...plan,
      priceId,
      configured: Boolean(priceId),
    };
  });
}

export function getContractOSBillingPlan(key: ContractOSBillingPlanKey) {
  return getContractOSBillingPlans().find((plan) => plan.key === key) ?? null;
}

export function getContractOSBillingStatus() {
  const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY);
  const plans = getContractOSBillingPlans();
  return {
    stripeConfigured,
    anyPlanConfigured: plans.some((plan) => plan.configured),
    fullyConfigured: stripeConfigured && plans.every((plan) => plan.configured),
    plans,
    missingEnv: [
      ...(stripeConfigured ? [] : ["STRIPE_SECRET_KEY"]),
      ...plans.filter((plan) => !plan.configured).map((plan) => plan.priceEnvKey),
    ],
  };
}
