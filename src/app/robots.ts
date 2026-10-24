import type { MetadataRoute } from "next";

const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  if (process.env.NEXT_PUBLIC_NOINDEX === "true") return { rules: [{ userAgent: "*", disallow: "/" }] }; // staging
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/account", "/cart", "/checkout", "/login", "/register", "/forgot-password", "/reset-password"] }],
    sitemap: `${site}/sitemap.xml`,
    host: site,
  };
}
