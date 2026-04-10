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
      // Stub all Node.js built-ins for the browser bundle.
      // Twilio, postgres, and other server packages import these at module
      // load time even though they're never called on the client.
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: false,
        tls: false,
        fs: false,
        dns: false,
        dgram: false,
        child_process: false,
        cluster: false,
        http2: false,
        perf_hooks: false,
        async_hooks: false,
        worker_threads: false,
        readline: false,
        repl: false,
        inspector: false,
        trace_events: false,
        v8: false,
        vm: false,
        wasi: false,
        crypto: false,
        stream: false,
        os: false,
        path: false,
        zlib: false,
        string_decoder: false,
        events: false,
        assert: false,
        constants: false,
        domain: false,
        punycode: false,
        querystring: false,
        timers: false,
        tty: false,
        url: false,
        util: false,
        sys: false,
      };
    }
    return config;
  },
};

export default nextConfig;
