import "server-only";

import { generateProspectsForStormEvent } from "./repository";
import {
  applySuppression,
  dedupeProspects,
  industryMatchesCategory,
  isCoreStormReachContractorIndustry,
  searchRadiusForEvent,
  STORMREACH_CORE_CONTRACTOR_INDUSTRIES,
  stormReachContractorSearchRadiusMiles,
} from "./prospecting";

export {
  applySuppression,
  dedupeProspects,
  generateProspectsForStormEvent,
  industryMatchesCategory,
  isCoreStormReachContractorIndustry,
  searchRadiusForEvent,
  STORMREACH_CORE_CONTRACTOR_INDUSTRIES,
  stormReachContractorSearchRadiusMiles,
};

export const BUSINESS_PROSPECT_ENGINE_GUARDRAILS = {
  defaultContractorRadiusMiles: 50,
  existingHomeReachDataFirst: true,
  suppressionRequiredBeforeOutreach: true,
  noPurchasedListByDefault: true,
};
