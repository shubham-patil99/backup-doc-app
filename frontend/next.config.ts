import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",  // ✅ Static export for Electron packaging
  assetPrefix: "./", // ✅ Load generated assets relative to index.html when packaged
  eslint: {
    ignoreDuringBuilds: true, // Allow build even with lint errors
  },
  typescript: {
    ignoreBuildErrors: true, // Skip type errors in production build
  },
  trailingSlash: false,
};

export default nextConfig;
