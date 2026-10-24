import type { Metadata } from "next";
import { PageContainer, SectionHeading } from "@/components/store/common/section-heading";
import { CategoryTile } from "@/components/store/home/category-tiles";
import { StateMessage } from "@/components/store/common/state-message";
import { listCategories } from "@/server/store/catalog";
import Link from "next/link";


export const metadata: Metadata = {
  title: "Pickle Categories",
  description: "Browse our homemade pickles by flavour: chicken, mutton, fish and prawn.",
  alternates: { canonical: "/categories" },
};

export default async function CategoriesPage() {
  const categories = await listCategories();
  const roots = categories.filter((c) => c.parentId === null && c.productCount > 0);

  return (
    <PageContainer className="py-10 sm:py-14">
      <SectionHeading as="h1" title="Choose Your Favorite Flavor" description="Every category is made in small batches with cold-pressed gingelly oil." />
      {roots.length === 0 ? (
        <StateMessage title="No categories yet" description="Check back soon!" />
      ) : (
        <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {roots.map((c) => {
            const subs = categories.filter((s) => s.parentId === c.id && s.productCount > 0);
            return (
              <li key={c.id} className="space-y-3">
                <CategoryTile category={c} />
                {subs.length > 0 && (
                  <ul className="flex flex-wrap justify-center gap-2">
                    {subs.map((s) => (
                      <li key={s.id}>
                        <Link href={`/categories/${s.slug}`} className="rounded-pill border border-border px-3 py-1 text-xs text-muted hover:border-primary hover:text-accent">
                          {s.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </PageContainer>
  );
}
