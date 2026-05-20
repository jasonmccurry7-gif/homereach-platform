import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: false,
  typescript: {
    ignoreBuildErrors: true,
  },

  // Transpile internal workspace packages
  transpilePackages: ["@homereach/db", "@homereach/services", "@homereach/types"],
  serverExternalPackages: ["postgres"],

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

  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = false;
    }

    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };

    return config;
  },
};

export default nextConfig;
