import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  async rewrites() {
    return [
      {
        source: '/api/piston/:path*',
        destination: 'http://localhost:2000/api/:path*',
      },
    ];
  },
};

export default nextConfig;