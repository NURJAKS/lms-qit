import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const backendUrl = process.env.BACKEND_URL || "http://localhost:8000";

const turbopackRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.10.216", "192.168.10.220", "localhost", "127.0.0.1"],
  turbopack: {
    root: turbopackRoot,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  rewrites: async () => [
    { source: "/api/:path*", destination: `${backendUrl}/api/:path*` },
    { source: "/uploads/:path*", destination: `${backendUrl}/uploads/:path*` },
  ],
};

export default nextConfig;
