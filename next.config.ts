import type { NextConfig } from "next";
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

export default nextConfig;
