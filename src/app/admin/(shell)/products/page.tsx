import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/admin/common/page-header";
import { ProductsTable } from "@/components/admin/tables/products-table";
import { Button } from "@/components/ui/button";
import { listProducts } from "@/server/repositories/products";

export const metadata: Metadata = { title: "Products" };

export default async function ProductsPage() {
  const products = await listProducts();
  return (
    <>
      <PageHeader
        title="Products"
        description={`${products.length} pickles in your catalogue.`}
        actions={
          <Button asChild>
            <Link href="/admin/products/new">
              <Plus className="size-4" aria-hidden /> Add product
            </Link>
          </Button>
        }
      />
      <ProductsTable products={products} />
    </>
  );
}
