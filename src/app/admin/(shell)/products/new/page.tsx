import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/common/page-header";
import { ProductForm } from "@/components/admin/forms/product-form";
import { listCategories } from "@/server/repositories/categories";

export const metadata: Metadata = { title: "New product" };

export default async function NewProductPage() {
  return (
    <>
      <PageHeader title="New product" description="Add a pickle to the catalogue." backHref="/admin/products" backLabel="Products" />
      <ProductForm categories={await listCategories()} />
    </>
  );
}
