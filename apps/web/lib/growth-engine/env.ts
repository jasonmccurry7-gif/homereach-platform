export function isGrowthEngineEnabled() {
  return process.env.ENABLE_HOMEREACH_GROWTH_ENGINE !== "false";
}

export function isGrowthEngineReviewRequired() {
  return process.env.GROWTH_ENGINE_REVIEW_REQUIRED !== "false";
}

export function isGrowthEngineAutoPublishEnabled() {
  return process.env.GROWTH_ENGINE_AUTO_PUBLISH === "true";
}

export function getGrowthEnginePublishingMode() {
  return process.env.SEO_PUBLISHING_MODE ?? "review_only";
}

export function getGrowthEngineSocialPublishingMode() {
  return process.env.SOCIAL_PUBLISHING_MODE ?? "review_only";
}
