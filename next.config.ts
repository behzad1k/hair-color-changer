import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: '/hair-color-changer',
  assetPrefix: '/hair-color-changer',
  experimental: {
    optimizePackageImports: [] // Disable if present
  }};

export default nextConfig;
