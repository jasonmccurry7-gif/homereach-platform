function enabled(key: string) {
  return process.env[key] !== "false";
}

export function isReputationEngineEnabled() {
  return enabled("ENABLE_REPUTATION_ENGINE");
}

export function isReviewCampaignsEnabled() {
  return isReputationEngineEnabled() && enabled("ENABLE_REVIEW_CAMPAIGNS");
}

export function isReferralCampaignsEnabled() {
  return isReputationEngineEnabled() && enabled("ENABLE_REFERRAL_CAMPAIGNS");
}

export function isTestimonialLibraryEnabled() {
  return isReputationEngineEnabled() && enabled("ENABLE_TESTIMONIAL_LIBRARY");
}

export function isReputationScoreEnabled() {
  return isReputationEngineEnabled() && enabled("ENABLE_REPUTATION_SCORE");
}

export function isReputationReportingEnabled() {
  return isReputationEngineEnabled() && enabled("ENABLE_REPUTATION_REPORTING");
}

export function isReputationQueueEnabled() {
  return isReputationEngineEnabled() && enabled("ENABLE_REPUTATION_QUEUE");
}

export function hasReputationPersistence() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function formatReputationMoney(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  });
}
