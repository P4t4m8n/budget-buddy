import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // e2e tests run their own dev server next to yours, so they need a separate build folder
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
