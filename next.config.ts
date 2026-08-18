import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Pin the workspace root: a package-lock.json above the repo would otherwise
  // make Turbopack infer the wrong root.
  turbopack: {
    root: import.meta.dirname,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "tr.rbxcdn.com" },
    ],
  },
};

export default nextConfig;
