import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  assetPrefix: '/hair-color-changer',
  experimental: {
    optimizePackageImports: [] // Disable if present
  }};

export default nextConfig;
