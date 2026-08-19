import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * `standalone` emits the minimal server bundle that `Dockerfile` copies out
   * of `.next/standalone`, so it is required for self-hosting.
   *
   * It must NOT be set on Vercel. Vercel runs its own file tracing and expects
   * `.next/next-server.js.nft.json`, which standalone output does not emit —
   * the build fails with ENOENT on that exact path. Scoping it to non-Vercel
   * builds keeps Docker working and unblocks the platform.
   */
  output: process.env.VERCEL ? undefined : "standalone",
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
