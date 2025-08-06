import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: [] // Disable if present
  }};

export default nextConfig;
