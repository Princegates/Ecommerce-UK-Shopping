import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pages read live data (catalogue, settings, carts), so they render per request.
  cacheComponents: false,
  partialPrefetching: false,
  serverExternalPackages: ["better-sqlite3"],
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
