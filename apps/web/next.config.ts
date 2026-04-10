import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Transpile internal workspace packages
  transpilePackages: ["@homereach/db", "@homereach/services", "@homereach/types"],

  // Image optimization — allow Supabase storage domain
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },

  // Ensure Stripe webhook raw body is available
  // (handled via route config in the webhook handler)
  // serverComponentsExternalPackages moved out of experimental in Next.js 15
  serverExternalPackages: ["postgres", "twilio"],
};

export default nextConfig;
