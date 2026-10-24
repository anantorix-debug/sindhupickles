import Link from "next/link";
import { ChevronDown, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/store/common/section-heading";
import { StateMessage } from "@/components/store/common/state-message";
import { ProductGrid } from "@/components/store/home/product-section";
import { SORT_OPTIONS } from "@/config/store-nav";
import { cn } from "@/lib/utils";
import { isProductSort, listProducts } from "@/server/store/catalog";
import type { ProductSort, StoreCategory } from "@/types/store";

interface ShopViewProps {
  title: string;
  description?: string;
  /** Path this view lives at, used to build filter/sort/pagination links. */
  basePath: string;
  categories: StoreCategory[];
  /** Selected category slug (root or sub). */
  categorySlug?: string;
  q?: string;
  sort?: string;
  page?: number;
}

function href(basePath: string, params: Record<string, string | number | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "" && !(k === "page" && v === 1)) sp.set(k, String(v));
  const qs = sp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

const chip = (active: boolean) =>
  cn(
    "inline-flex h-9 items-center whitespace-nowrap rounded-pill border px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent",
    active ? "border-primary bg-primary text-white" : "border-border bg-surface text-foreground hover:border-primary",
  );

/** Server-rendered listing: category chips, search, sort and pagination are all plain links. */
export async function ShopView({ title, description, basePath, categories, categorySlug, q, sort, page = 1 }: ShopViewProps) {
  const sortKey: ProductSort = isProductSort(sort) ? sort : "featured";
  const result = await listProducts({ category: categorySlug, q, sort: sortKey, page, pageSize: 12 });

  const roots = categories.filter((c) => c.parentId === null && c.productCount > 0);
  const selected = categories.find((c) => c.slug === categorySlug);
  const activeRootId = selected ? (selected.parentId ?? selected.id) : null;
  const subs = activeRootId ? categories.filter((c) => c.parentId === activeRootId) : [];
  const keep = { q: q || undefined, sort: sortKey === "featured" ? undefined : sortKey };
  const currentSort = SORT_OPTIONS.find((o) => o.value === sortKey)!;

  return (
    <PageContainer className="py-8 sm:py-12">
      <header className="mb-8 space-y-2">
        <h1 className="font-display text-3xl font-black sm:text-4xl">{title}</h1>
        {description && <p className="max-w-2xl text-muted">{description}</p>}
      </header>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label="Categories" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <ul className="flex gap-2">
            <li>
              <Link href={href("/shop", keep)} className={chip(!categorySlug)} aria-current={!categorySlug ? "page" : undefined}>
                All
              </Link>
            </li>
            {roots.map((c) => (
              <li key={c.id}>
                <Link href={href("/shop", { category: c.slug, ...keep })} className={chip(activeRootId === c.id)} aria-current={activeRootId === c.id ? "page" : undefined}>
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <details className="relative shrink-0 self-start lg:self-auto [&[open]>summary_svg]:rotate-180">
          <summary className="flex h-9 cursor-pointer list-none items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm font-medium hover:border-primary">
            Sort: {currentSort.label} <ChevronDown className="size-4 transition-transform" aria-hidden />
          </summary>
          <ul className="absolute right-0 z-20 mt-2 w-52 rounded-md border border-border bg-surface-raised p-1 shadow-pop">
            {SORT_OPTIONS.map((o) => (
              <li key={o.value}>
                <Link
                  href={href(basePath, { category: basePath === "/shop" ? categorySlug : undefined, q: q || undefined, sort: o.value === "featured" ? undefined : o.value })}
                  className={cn("block rounded-sm px-3 py-2 text-sm hover:bg-border", o.value === sortKey && "font-bold text-accent")}
                >
                  {o.label}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      </div>

      {subs.length > 0 && (
        <ul className="-mt-2 mb-6 flex flex-wrap gap-2" aria-label="Subcategories">
          {subs.map((s) => (
            <li key={s.id}>
              <Link href={`/categories/${s.slug}`} className={cn(chip(s.slug === categorySlug), "h-8 text-xs")}>
                {s.name}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="mb-5 text-sm text-muted" aria-live="polite">
        {q ? `${result.total} ${result.total === 1 ? "result" : "results"} for “${q}”` : `${result.total} ${result.total === 1 ? "product" : "products"}`}
      </p>

      {result.items.length === 0 ? (
        <StateMessage
          icon={SearchX}
          title="No pickles found"
          description={q ? "Try a different word, or browse all our pickles." : "There's nothing in this category yet. Check back soon!"}
          action={
            <Button asChild>
              <Link href="/shop">Browse all pickles</Link>
            </Button>
          }
        />
      ) : (
        <ProductGrid products={result.items} priority headingLevel={2} />
      )}

      {result.pageCount > 1 && (
        <nav aria-label="Pagination" className="mt-12 flex items-center justify-center gap-2">
          {result.page > 1 && (
            <Button asChild variant="secondary" size="sm">
              <Link href={href(basePath, { category: basePath === "/shop" ? categorySlug : undefined, ...keep, page: result.page - 1 })} rel="prev">
                Previous
              </Link>
            </Button>
          )}
          <span className="px-3 text-sm text-muted">
            Page {result.page} of {result.pageCount}
          </span>
          {result.page < result.pageCount && (
            <Button asChild variant="secondary" size="sm">
              <Link href={href(basePath, { category: basePath === "/shop" ? categorySlug : undefined, ...keep, page: result.page + 1 })} rel="next">
                Next
              </Link>
            </Button>
          )}
        </nav>
      )}
    </PageContainer>
  );
}
