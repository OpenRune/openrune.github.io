import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        // Prevent rewriting the proxy endpoint itself.
        source: "/api/:path((?!cache-proxy|server).*)",
        destination: "/api/cache-proxy/:path*",
      },
    ];
  },
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  output: "standalone",
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: process.env.NODE_ENV === "development" ? 0 : 31_536_000,
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  compiler: {
    removeConsole:
      process.env.NODE_ENV === "production"
        ? {
            exclude: ["error", "warn"],
          }
        : false,
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "@base-ui/react", "@tabler/icons-react"],
  },
  async headers() {
    const isDev = process.env.NODE_ENV === "development";

    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "origin-when-cross-origin",
          },
        ],
      },
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: isDev
              ? "no-cache, no-store, must-revalidate, max-age=0"
              : "public, s-maxage=60, stale-while-revalidate=300",
          },
          ...(isDev
            ? [
                {
                  key: "Pragma",
                  value: "no-cache",
                },
                {
                  key: "Expires",
                  value: "0",
                },
              ]
            : []),
        ],
      },
      {
        source: "/updates/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: isDev
              ? "no-cache, no-store, must-revalidate, max-age=0"
              : "public, max-age=3600, stale-while-revalidate=86400",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
