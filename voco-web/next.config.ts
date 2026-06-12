import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['172.20.10.11'],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "https://vocoshop.onrender.com/api/:path*",
      },
    ];
  },
};

export default nextConfig;
