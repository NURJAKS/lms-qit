import type { NextConfig } from "next";

const backendUrl = process.env.BACKEND_URL || "http://localhost:8000";

const nextConfig: NextConfig = {
  rewrites: async () => [
    { source: "/api/:path*", destination: `${backendUrl}/api/:path*` },
    { source: "/uploads/:path*", destination: `${backendUrl}/uploads/:path*` },
  ],
};

export default nextConfig;
