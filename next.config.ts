import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import { legacyPrefixRedirects, legacyRedirects, legacySitemapTypes } from "./src/config/legacy-redirects";

const nextConfig: NextConfig = {
  // Lets automated tests build to a separate folder without disturbing a running dev server.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Dev mode only: lets the site be opened through a Cloudflare quick tunnel (needed to test Razorpay webhooks locally).
  allowedDevOrigins: ["*.trycloudflare.com"],
  // We strip trailing slashes ourselves (last rule below) so old URLs redirect in ONE hop.
  skipTrailingSlashRedirect: true,
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

/**
 * Shared hosting (e.g. Hostinger) caps how many threads one account may run, and the compiler normally starts
 * one per CPU core in every worker ("OS can't spawn worker thread"). So production builds are kept small.
 * Only the build is limited; `next dev` and `next start` are unaffected.
 */
export default function config(phase: string): NextConfig {
  if (phase !== PHASE_PRODUCTION_BUILD) return nextConfig;
  process.env.TOKIO_WORKER_THREADS ??= "2";
  process.env.RAYON_NUM_THREADS ??= "2";
  return {
    ...nextConfig,
    experimental: { cpus: 2, staticGenerationMaxConcurrency: 4, parallelServerCompiles: false, parallelServerBuildTraces: false },
  };
}
