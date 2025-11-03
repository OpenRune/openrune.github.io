import type { NextConfig } from "next";

const nextConfig: {
  devIndicators: { errorIndicator: boolean; position: string };
  rewrites(): Promise<[{ destination: string; source: string }]>
} = {
  devIndicators: {
    position: 'top-right',
    errorIndicator: true,
  },
  async rewrites() {
    // Use cache-proxy route for dynamic cache type routing
    // Route handlers (like /api/share) take precedence over rewrites
    return [
      {
        source: '/api/:path*',
        destination: '/api/cache-proxy/:path*',
      },
    ];
  },
  /* config options here */
};

export default nextConfig;
