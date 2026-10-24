import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/common/page-header";
import { CategoriesTable } from "@/components/admin/tables/categories-table";
import { listCategories } from "@/server/repositories/categories";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const categories = await listCategories();
  return (
    <>
      <PageHeader title="Categories" description="Organise products into categories and subcategories." />
      <CategoriesTable categories={categories} />
    </>
  );
}
