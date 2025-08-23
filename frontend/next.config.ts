import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // In demo mode we proxy all /api/* to the demo server on 3006
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3006/api/:path*',
      },
    ];
  },
};

export default nextConfig;
