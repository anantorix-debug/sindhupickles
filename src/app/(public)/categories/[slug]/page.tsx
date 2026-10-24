import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShopView } from "@/components/store/shop/shop-view";
import { getCategoryBySlug, listCategories } from "@/server/store/catalog";

type Props = PageProps<"/categories/[slug]">;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const category = await getCategoryBySlug(slug);
  if (!category) return { title: "Category not found" };
  const description = category.description || `Shop homemade ${category.name.toLowerCase()} — small batches, cold-pressed gingelly oil, no artificial preservatives.`;
  return {
    title: category.name,
    description,
    alternates: { canonical: `/categories/${slug}` },
    openGraph: { title: category.name, description, url: `/categories/${slug}`, ...(category.imageUrl ? { images: [category.imageUrl] } : {}) },
    robots: Number(one(sp.page)) > 1 ? { index: false, follow: true } : undefined,
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const [category, categories] = await Promise.all([getCategoryBySlug(slug), listCategories()]);
  if (!category) notFound();

  return (
    <ShopView
      title={category.name}
      description={category.description || undefined}
      basePath={`/categories/${slug}`}
      categories={categories}
      categorySlug={slug}
      sort={one(sp.sort)}
      page={Number(one(sp.page)) || 1}
    />
  );
}
