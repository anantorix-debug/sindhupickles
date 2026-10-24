/**
 * Old-site (WordPress) paths that now live somewhere else. This is the ONLY place old paths are listed; the
 * redirects are generated from it in next.config.ts. Paths only — no domain names.
 * Product pages keep the same /product/<slug> path, so they need no entry here.
 * Full reasoning: docs/SEO_URL_REDIRECT_MAP.csv
 */
export const legacyRedirects: { from: string; to: string }[] = [
  { from: "/my-account", to: "/account" },
  { from: "/privacy-policy", to: "/policies/privacy" },
  { from: "/terms-and-conditions", to: "/policies/terms" },
  { from: "/shipping-return-refund-policy", to: "/policies/shipping-return-refund" },
  // WordPress sample content with no value to keep.
  { from: "/hello-world", to: "/" },
  { from: "/category/uncategorized", to: "/" },
  // Old sitemaps (possibly still registered in Search Console) -> the new sitemap.
  { from: "/sitemap_index.xml", to: "/sitemap.xml" },
];

/** Prefix patterns (everything below the prefix goes to one place). */
export const legacyPrefixRedirects: { prefix: string; to: string }[] = [
  // Category archives -> the shop, until the owner decides how weight-based categories map to flavours.
  { prefix: "/product-category", to: "/shop" },
];

/** Sitemap files the old SEO plugin generated, by type. */
export const legacySitemapTypes = ["post", "page", "product", "category", "product_cat"];
