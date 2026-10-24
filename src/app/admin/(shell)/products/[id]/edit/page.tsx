import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/common/page-header";
import { ProductForm } from "@/components/admin/forms/product-form";
import { getProduct } from "@/server/repositories/products";
import { listCategories } from "@/server/repositories/categories";
export const metadata: Metadata = { title: "Edit product" };

export default async function EditProductPage({ params }: PageProps<"/admin/products/[id]/edit">) {
  const { id } = await params;
  const [product, categories] = await Promise.all([getProduct(id), listCategories()]);
  if (!product) notFound();

  return (
    <>
      <PageHeader title={`Edit ${product.name}`} backHref={`/admin/products/${product.id}`} backLabel="Product" />
      <ProductForm product={product} categories={categories} />
    </>
  );
}
