type EnvLike = Record<string, string | undefined>;

export function isLegacyStripeCheckoutEnabled(env: EnvLike = process.env): boolean {
  return env.ENABLE_LEGACY_STRIPE_CHECKOUT === "true";
}
