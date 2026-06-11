import type { NextConfig } from "next";

const APIBackend = process.env.API_BACKEND_URL || "http://localhost:4000";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['172.20.10.11'],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${APIBackend}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
