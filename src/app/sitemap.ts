import type { MetadataRoute } from "next";
import { listPublishedPostSlugs } from "@/server/store/blog";
import { listCategories, listProductSlugs } from "@/server/store/catalog";

const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

// Built from the database on request, so new products appear immediately and the build never needs the database.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories, posts] = await Promise.all([listProductSlugs(), listCategories(), listPublishedPostSlugs()]);
  const fixed = ["/", "/shop", "/categories", "/about", "/blog", "/contact", "/policies/shipping-return-refund", "/policies/privacy", "/policies/terms"];
  return [
    ...fixed.map((p) => ({ url: `${site}${p}`, changeFrequency: "weekly" as const, priority: p === "/" ? 1 : 0.6 })),
    ...categories.filter((c) => c.productCount > 0).map((c) => ({ url: `${site}/categories/${c.slug}`, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...products.map((p) => ({ url: `${site}/product/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.9 })),
    ...posts.map((p) => ({ url: `${site}/blog/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "monthly" as const, priority: 0.5 })),
  ];
}
