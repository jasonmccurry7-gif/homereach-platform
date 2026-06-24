import {
  matchIndustriesForEvent,
  normalizeIndustry,
  STORMREACH_INDUSTRY_RULES,
  topIndustriesForEvent,
} from "./industry-matching";

export {
  matchIndustriesForEvent,
  normalizeIndustry,
  STORMREACH_INDUSTRY_RULES,
  topIndustriesForEvent,
};

export const HOME_SERVICE_OPPORTUNITY_ENGINE_GUARDRAILS = {
  rulesGoverned: true,
  adminOverridesAllowed: true,
  noIndividualHomeDamageClaims: true,
};
