import type { NextConfig } from "next";

// Toggle rewrites based on demo mode. In real mode, use Next API routes directly.
const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE !== 'false';

const nextConfig: NextConfig = {
  async rewrites() {
    if (!isDemo) {
      return [];
    }
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3006/api/:path*',
      },
    ];
  },
};

export default nextConfig;
