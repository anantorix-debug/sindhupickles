import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Flame } from "lucide-react";
import { PageContainer } from "@/components/store/common/section-heading";
import { Rating } from "@/components/store/common/rating";
import { ProductGrid } from "@/components/store/home/product-section";
import { ProductGallery } from "@/components/store/product/product-gallery";
import { PurchasePanel } from "@/components/store/product/purchase-panel";
import { formatDate } from "@/lib/format";
import { legacySeo } from "@/content/legacy-seo";
import { getProductBySlug } from "@/server/store/catalog";

type Props = PageProps<"/product/[slug]">;


export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProductBySlug((await params).slug);
  if (!product) return { title: "Product not found" };
  // Rank Math title/description from the old site win when present, so migrated pages keep their search snippets.
  const legacy = legacySeo[product.slug];
  // Order of preference: what an admin set in the database, the proven snippet from the old site, then generated text.
  const description = product.metaDescription || legacy?.description || product.shortDescription || product.description.slice(0, 160);
  const image = product.images[0]?.url;
  return {
    title: { absolute: product.metaTitle || (legacy?.title ? `${legacy.title} | Sindhu's` : `${product.name} | Sindhu's Pickles`) },
    description,
    ...(legacy?.keywords.length ? { keywords: legacy.keywords } : {}),
    alternates: { canonical: `/product/${product.slug}` },
    openGraph: { type: "website", title: product.name, description, url: `/product/${product.slug}`, ...(image ? { images: [{ url: image, alt: product.name }] } : {}) },
    twitter: { card: "summary_large_image", title: product.name, description, ...(image ? { images: [image] } : {}) },
  };
}

export default async function ProductPage({ params }: Props) {
  const product = await getProductBySlug((await params).slug);
  if (!product) notFound();

  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const abs = (u: string) => (u.startsWith("http") ? u : `${site}${u}`);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.shortDescription || product.description,
    sku: product.sku,
    category: product.category,
    ...(legacySeo[product.slug]?.keywords.length ? { keywords: legacySeo[product.slug].keywords.join(", ") } : {}),
    ...(product.images.length ? { image: product.images.map((i) => abs(i.url)) } : {}),
    brand: { "@type": "Brand", name: "Sindhu's Pickles" },
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "INR",
      lowPrice: Math.min(...product.variants.map((v) => v.price), product.price),
      highPrice: Math.max(...product.variants.map((v) => v.price), product.price),
      offerCount: product.variants.length,
      availability: product.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: `${site}/product/${product.slug}`,
    },
    ...(product.reviewCount > 0 ? { aggregateRating: { "@type": "AggregateRating", ratingValue: product.ratingAvg, reviewCount: product.reviewCount } } : {}),
  };

  return (
    <PageContainer className="py-8 sm:py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li><Link href="/" className="hover:text-accent">Home</Link></li>
          <ChevronRight className="size-3.5" aria-hidden />
          <li><Link href="/shop" className="hover:text-accent">Shop</Link></li>
          <ChevronRight className="size-3.5" aria-hidden />
          <li><Link href={`/categories/${product.categorySlug}`} className="hover:text-accent">{product.category}</Link></li>
          <ChevronRight className="size-3.5" aria-hidden />
          <li aria-current="page" className="text-foreground">{product.name}</li>
        </ol>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-14">
        <ProductGallery images={product.images} name={product.name} />

        <div className="space-y-6">
          <div className="space-y-3">
            <Link href={`/categories/${product.categorySlug}`} className="text-xs font-bold uppercase tracking-wide text-accent hover:underline">
              {product.subcategory ? `${product.category} · ${product.subcategory}` : product.category}
            </Link>
            <h1 className="font-display text-3xl font-black sm:text-4xl">{product.name}</h1>
            {product.reviewCount > 0 && <Rating value={product.ratingAvg} count={product.reviewCount} className="text-sm" />}
            {product.shortDescription && <p className="text-lg text-muted">{product.shortDescription}</p>}
          </div>

          <PurchasePanel product={{ slug: product.slug, name: product.name, imageUrl: product.images[0]?.url ?? null }} variants={product.variants} />

          <section aria-labelledby="about-title" className="space-y-3 border-t border-border pt-6">
            <h2 id="about-title" className="font-display text-xl font-bold">About this pickle</h2>
            <p className="whitespace-pre-line leading-relaxed text-muted">{product.description}</p>
          </section>

          <dl className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-surface p-5 text-sm">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">SKU</dt>
              <dd className="mt-1">{product.sku}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Category</dt>
              <dd className="mt-1">{product.category}</dd>
            </div>
            {product.spiceLevel > 0 && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Spice level</dt>
                <dd className="mt-1 flex items-center gap-0.5" aria-label={`${product.spiceLevel} out of 5`}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Flame key={i} className={i <= product.spiceLevel ? "size-4 fill-primary text-primary" : "size-4 text-muted/40"} aria-hidden />
                  ))}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Pack sizes</dt>
              <dd className="mt-1">{product.variants.map((v) => v.label).join(", ") || "—"}</dd>
            </div>
          </dl>
        </div>
      </div>

      {product.reviews.length > 0 && (
        <section aria-labelledby="reviews-title" className="mt-16 space-y-6">
          <h2 id="reviews-title" className="font-display text-2xl font-bold">Customer reviews</h2>
          <ul className="grid gap-4 md:grid-cols-2">
            {product.reviews.map((r) => (
              <li key={r.id} className="space-y-2 rounded-lg border border-border bg-surface p-5">
                <Rating value={r.rating} />
                {r.title && <p className="font-semibold">{r.title}</p>}
                {r.comment && <p className="text-sm text-muted">{r.comment}</p>}
                <p className="text-xs text-muted">{r.customerName} · {formatDate(r.createdAt)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {product.related.length > 0 && (
        <section aria-labelledby="related-title" className="mt-16 space-y-6">
          <h2 id="related-title" className="font-display text-2xl font-bold">You may also like</h2>
          <ProductGrid products={product.related} />
        </section>
      )}
    </PageContainer>
  );
}
