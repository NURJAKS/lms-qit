import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const backendUrl = process.env.BACKEND_URL || "http://localhost:8000";

const turbopackRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: turbopackRoot,
  },
  rewrites: async () => [
    { source: "/api/:path*", destination: `${backendUrl}/api/:path*` },
    { source: "/uploads/:path*", destination: `${backendUrl}/uploads/:path*` },
  ],
};

export default nextConfig;
