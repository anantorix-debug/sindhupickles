import type { NextConfig } from "next";
import { legacyPrefixRedirects, legacyRedirects, legacySitemapTypes } from "./src/config/legacy-redirects";

// A plain object on purpose: Hostinger's Next.js deployment ignores a function config (and then loses these settings).
const nextConfig: NextConfig = {
  // Lets automated tests build to a separate folder without disturbing a running dev server.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Only for testing the standalone build locally. Hostinger sets its own `output` before it builds.
  ...(process.env.NEXT_OUTPUT === "standalone" ? { output: "standalone" as const } : {}),
  // Dev mode only: lets the site be opened through a Cloudflare quick tunnel (needed to test Razorpay webhooks locally).
  allowedDevOrigins: ["*.trycloudflare.com"],
  poweredByHeader: false,
  // Safe, widely supported hardening headers. (No Content-Security-Policy yet: it must be tuned for Razorpay Checkout first.)
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=31536000" },
        ],
      },
    ];
  },
  // We strip trailing slashes ourselves (last rule below) so old URLs redirect in ONE hop.
  skipTrailingSlashRedirect: true,
  // Shared hosting caps how many threads one account may run, so the build uses a single worker. (The compiler's
  // own thread pools are capped in scripts/build.mjs, before anything loads.)
  experimental: { cpus: 1, webpackBuildWorker: false, staticGenerationMaxConcurrency: 2, parallelServerCompiles: false, parallelServerBuildTraces: false },
  async redirects() {
    return [
      // Both the trailing-slash and plain form of each old path, straight to the destination.
      ...legacyRedirects.flatMap(({ from, to }) => [
        { source: `${from}/`, destination: to, permanent: true },
        { source: from, destination: to, permanent: true },
      ]),
      ...legacyPrefixRedirects.flatMap(({ prefix, to }) => [
        { source: `${prefix}/:rest*/`, destination: to, permanent: true },
        { source: `${prefix}/:rest*`, destination: to, permanent: true },
      ]),
      { source: `/:type(${legacySitemapTypes.join("|")})-sitemap.xml`, destination: "/sitemap.xml", permanent: true },
      // Everything else: /path/ -> /path
      { source: "/:path+/", destination: "/:path+", permanent: true },
    ];
  },
};

export default nextConfig;
