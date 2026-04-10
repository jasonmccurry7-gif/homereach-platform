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

  // Server-only packages — excluded from client bundle
  serverExternalPackages: ["postgres", "twilio"],

  // Webpack: stub out Node.js built-ins when bundling for the browser.
  // Twilio and postgres import net/tls/fs which only exist in Node.
  // Client components that import these through server modules won't
  // actually call the code at runtime — we just need the build to succeed.
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: false,
        tls: false,
        fs: false,
        dns: false,
        child_process: false,
        dgram: false,
      };
    }
    return config;
  },
};

export default nextConfig;
