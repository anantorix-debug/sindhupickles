import Link from "next/link";
import { AddToCartButton } from "@/components/store/cart/add-to-cart-button";
import { Price } from "@/components/store/common/price";
import { ProductImage } from "@/components/store/common/product-image";
import { Rating } from "@/components/store/common/rating";
import type { StoreProductCard } from "@/types/store";

/** Product card from the Figma grid: photo, pack + rating row, name, price and add-to-cart. */
export function ProductCard({ product, priority = false, headingLevel = 3 }: { product: StoreProductCard; priority?: boolean; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const href = `/product/${product.slug}`;
  const badge = !product.inStock ? "Out of stock" : product.compareAtPrice ? "Sale" : product.lowStock ? "Few left" : null;

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-card transition-colors hover:border-primary/60">
      <Link href={href} className="relative block aspect-[7/5] w-full overflow-hidden bg-surface-raised sm:aspect-[7/5]" tabIndex={-1} aria-hidden>
        <ProductImage src={product.imageUrl} alt="" sizes="(min-width:1280px) 280px, (min-width:768px) 33vw, 50vw" priority={priority} className="transition-transform duration-300 group-hover:scale-105" />
        {badge && (
          <span className={`absolute left-2 top-2 rounded-sm px-2 py-1 text-[11px] font-bold uppercase tracking-wide ${badge === "Out of stock" ? "bg-danger text-white" : "bg-primary text-white"}`}>
            {badge}
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase text-accent">{product.firstVariantLabel ?? product.category}</p>
          {product.reviewCount > 0 && <Rating value={product.ratingAvg} />}
        </div>
        <Heading className="font-display text-base font-bold leading-snug sm:text-lg">
          <Link href={href} className="line-clamp-2 hover:text-accent focus-visible:outline-2 focus-visible:outline-accent">
            {product.name}
          </Link>
        </Heading>
        {product.hasMultiplePacks && <p className="-mt-1 text-xs text-muted">More pack sizes available</p>}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-2 gap-y-2 pt-1">
          <Price price={product.price} compareAt={product.compareAtPrice} />
          {product.inStock && product.firstVariantId ? (
            <AddToCartButton
              variantId={product.firstVariantId}
              snapshot={{ slug: product.slug, name: product.name, variantLabel: product.firstVariantLabel ?? "", price: product.price, imageUrl: product.imageUrl }}
              aria-label={`Add ${product.name} to cart`}
              className="px-2.5 sm:px-3"
            />
          ) : (
            <span className="text-xs font-semibold text-danger">Sold out</span>
          )}
        </div>
      </div>
    </article>
  );
}
