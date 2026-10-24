import Image from "next/image";
import Link from "next/link";
import { PageContainer } from "@/components/store/common/section-heading";
import type { StoreCategory } from "@/types/store";

export function CategoryTile({ category }: { category: StoreCategory }) {
  // The picture set in Admin → Categories, else the first product photo in the category, else the initial letter.
  const src = category.imageUrl;
  return (
    <Link
      href={`/categories/${category.slug}`}
      className="reveal hover-lift group flex flex-col items-center gap-3 rounded-lg border border-border bg-surface p-4 text-center hover:border-primary sm:gap-4 sm:p-6"
    >
      <span className="relative size-16 overflow-hidden rounded-full bg-surface-raised sm:size-20">
        {src ? (
          <Image src={src} alt="" fill sizes="80px" className="object-cover transition-transform duration-500 ease-out group-hover:rotate-6 group-hover:scale-110" />
        ) : (
          <span className="flex size-full items-center justify-center font-display text-2xl font-bold text-accent">{category.name[0]}</span>
        )}
      </span>
      <span className="font-display text-base font-bold sm:text-lg">{category.name}</span>
    </Link>
  );
}

/** "Choose Your Favorite Flavor" — the top-level categories managed in Admin → Categories. */
export function CategoryTiles({ categories }: { categories: StoreCategory[] }) {
  const roots = categories.filter((c) => c.parentId === null && c.productCount > 0);
  if (roots.length === 0) return null;
  return (
    <section aria-labelledby="flavours-title">
      <PageContainer className="py-12 sm:py-16">
        <h2 id="flavours-title" className="text-center font-display text-3xl font-bold sm:text-[32px]">
          Choose Your Favorite Flavor
        </h2>
        <ul className="mt-8 grid grid-cols-2 gap-3 sm:gap-6 lg:flex lg:flex-wrap lg:justify-center">
          {roots.map((c) => (
            <li key={c.id} className="lg:w-[260px]">
              <CategoryTile category={c} />
            </li>
          ))}
        </ul>
      </PageContainer>
    </section>
  );
}
