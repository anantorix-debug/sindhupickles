import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Star } from "lucide-react";
import { PageHeader } from "@/components/admin/common/page-header";
import { DetailCard } from "@/components/admin/common/detail-list";
import { ProductStatusBadge, StockBadge } from "@/components/admin/badges/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductImages } from "@/components/admin/forms/product-images";
import { formatCurrency, formatDate } from "@/lib/format";
import { getProduct } from "@/server/repositories/products";

export async function generateMetadata({ params }: PageProps<"/admin/products/[id]">): Promise<Metadata> {
  const product = await getProduct((await params).id);
  return { title: product?.name ?? "Product" };
}

export default async function ProductDetailPage({ params }: PageProps<"/admin/products/[id]">) {
  const product = await getProduct((await params).id);
  if (!product) notFound();

  return (
    <>
      <PageHeader
        title={product.name}
        description={`${product.sku} · ${product.category}${product.subcategory ? ` › ${product.subcategory}` : ""}`}
        backHref="/admin/products"
        backLabel="Products"
        actions={
          <Button asChild>
            <Link href={`/admin/products/${product.id}/edit`}>
              <Pencil className="size-4" aria-hidden /> Edit
            </Link>
          </Button>
        }
      />
      <div className="space-y-6">
        <DetailCard
          title="Details"
          rows={[
            { label: "Price", value: formatCurrency(product.price) },
            { label: "Sale price", value: product.salePrice !== null ? formatCurrency(product.salePrice) : "—" },
            { label: "Status", value: <ProductStatusBadge status={product.status} /> },
            { label: "Featured", value: product.featured ? "Yes" : "No" },
            {
              label: "Rating",
              value: product.reviewCount ? (
                <span className="inline-flex items-center gap-1">
                  <Star className="size-3.5 fill-accent text-accent" aria-hidden /> {product.ratingAvg.toFixed(1)} ({product.reviewCount} reviews)
                </span>
              ) : (
                "No reviews yet"
              ),
            },
            { label: "Spice level", value: `${product.spiceLevel} / 5` },
            { label: "Added on", value: formatDate(product.createdAt) },
            { label: "Short description", value: product.shortDescription || "—" },
            { label: "Description", value: product.description },
          ]}
        />

        <ProductImages product={product} />

        <Card>
          <CardHeader>
            <CardTitle>Pack sizes &amp; stock</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/inventory">Manage stock</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <caption className="sr-only">Pack sizes</caption>
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                    <th scope="col" className="py-2 pr-4 font-semibold">Pack</th>
                    <th scope="col" className="py-2 pr-4 font-semibold">SKU</th>
                    <th scope="col" className="py-2 pr-4 text-right font-semibold">Price</th>
                    <th scope="col" className="py-2 pr-4 text-right font-semibold">On hand</th>
                    <th scope="col" className="py-2 pr-4 text-right font-semibold">Reserved</th>
                    <th scope="col" className="py-2 font-semibold">Level</th>
                  </tr>
                </thead>
                <tbody>
                  {product.variants.map((v) => (
                    <tr key={v.id} className="border-b border-border last:border-0">
                      <td className="py-3 pr-4 font-semibold">{v.label}</td>
                      <td className="py-3 pr-4 text-muted">{v.sku}</td>
                      <td className="py-3 pr-4 text-right">{formatCurrency(v.price ?? product.price)}</td>
                      <td className="py-3 pr-4 text-right tabular-nums">{v.onHand}</td>
                      <td className="py-3 pr-4 text-right tabular-nums">{v.reserved}</td>
                      <td className="py-3"><StockBadge level={v.level} /></td>
                    </tr>
                  ))}
                  {product.variants.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-muted">This product has no pack sizes yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
