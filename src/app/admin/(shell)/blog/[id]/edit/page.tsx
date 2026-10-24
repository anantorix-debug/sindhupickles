import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/common/page-header";
import { BlogForm } from "@/components/admin/forms/blog-form";
import { getPost, listBlogCategories } from "@/server/repositories/blog";

export const metadata: Metadata = { title: "Edit post" };

export default async function EditPostPage({ params }: PageProps<"/admin/blog/[id]/edit">) {
  const { id } = await params;
  const [post, categories] = await Promise.all([getPost(id), listBlogCategories()]);
  if (!post) notFound();
  return (
    <>
      <PageHeader title={`Edit “${post.title}”`} backHref="/admin/blog" backLabel="Blog" />
      <BlogForm post={post} categories={categories} />
    </>
  );
}
