import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShopView } from "@/components/store/shop/shop-view";
import { listCategories } from "@/server/store/catalog";

type Props = PageProps<"/shop">;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams;
  const q = one(sp.q);
  const page = Number(one(sp.page)) || 1;
  // Search results and deep pages shouldn't compete with the main shop page in search engines.
  return {
    title: q ? `Search: ${q}` : "Shop Homemade Non-Veg Pickles",
    description: "Shop authentic homemade chicken, mutton, fish and prawn pickles. Small batches, cold-pressed gingelly oil, no artificial preservatives.",
    alternates: { canonical: "/shop" },
    robots: q || page > 1 ? { index: false, follow: true } : undefined,
  };
}

export default async function ShopPage({ searchParams }: Props) {
  const sp = await searchParams;
  const categories = await listCategories();
  const category = one(sp.category);

  // A category's canonical home is /categories/[slug].
  if (category && categories.some((c) => c.slug === category) && !one(sp.q) && !one(sp.sort) && !one(sp.page)) {
    redirect(`/categories/${category}`);
  }

  const q = one(sp.q)?.trim().slice(0, 80) || undefined;
  return (
    <ShopView
      title={q ? `Results for “${q}”` : "Shop All Pickles"}
      description={q ? undefined : "Fresh batches prepared weekly using classic recipes and wholesome ingredients."}
      basePath="/shop"
      categories={categories}
      categorySlug={category}
      q={q}
      sort={one(sp.sort)}
      page={Number(one(sp.page)) || 1}
    />
  );
}
