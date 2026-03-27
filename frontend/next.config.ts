import type { NextConfig } from "next";

const nextConfig: NextConfig = {
   eslint: {
    ignoreDuringBuilds: true, // ? allow build even with lint errors
  },
  typescript: {
    ignoreBuildErrors: true, // ? skip type errors in production build
  },
};

export default nextConfig;
