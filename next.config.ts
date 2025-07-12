import type { NextConfig } from "next";

const nextConfig: {
  devIndicators: { errorIndicator: boolean; buildActivityPosition: string };
  rewrites(): Promise<[{ destination: string; source: string }]>
} = {
  devIndicators: {
    buildActivityPosition: 'top-right',
    errorIndicator: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8090/:path*',
      },
    ];
  },
  /* config options here */
};

export default nextConfig;
