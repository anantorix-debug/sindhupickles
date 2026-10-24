import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/common/page-header";
import { BlogForm } from "@/components/admin/forms/blog-form";
import { listBlogCategories } from "@/server/repositories/blog";

export const metadata: Metadata = { title: "New post" };

export default async function NewPostPage() {
  return (
    <>
      <PageHeader title="New post" backHref="/admin/blog" backLabel="Blog" />
      <BlogForm categories={await listBlogCategories()} />
    </>
  );
}
