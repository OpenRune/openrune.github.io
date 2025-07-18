import type { NextConfig } from "next";

if (!process.env.API_PROXY_DESTINATION) {
  throw new Error("API_PROXY_DESTINATION environment variable is not set. Please define it in your .env.local file.");
}

const nextConfig: {
  devIndicators: { errorIndicator: boolean; position: string };
  rewrites(): Promise<[{ destination: string; source: string }]>
} = {
  devIndicators: {
    position: 'top-right',
    errorIndicator: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: process.env.API_PROXY_DESTINATION!,
      },
    ];
  },
  /* config options here */
};

export default nextConfig;
