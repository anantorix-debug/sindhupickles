import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/common/page-header";
import { BlogTable } from "@/components/admin/tables/blog-table";
import { formatNumber } from "@/lib/format";
import { listPosts } from "@/server/repositories/blog";

export const metadata: Metadata = { title: "Blog" };

export default async function BlogPage() {
  const posts = await listPosts();
  const stats = [
    { label: "Total posts", value: posts.length },
    { label: "Published", value: posts.filter((p) => p.status === "published").length },
    { label: "Drafts", value: posts.filter((p) => p.status === "draft").length },
    { label: "Total views", value: posts.reduce((s, p) => s + p.viewCount, 0) },
  ];
  return (
    <>
      <PageHeader
        title="Blog"
        description="Recipes, stories and news for the storefront."
        actions={
          <Button asChild>
            <Link href="/admin/blog/new">
              <Plus className="size-4" aria-hidden /> New post
            </Link>
          </Button>
        }
      />
      <section aria-label="Blog summary" className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-5">
            <p className="text-sm font-medium text-muted">{s.label}</p>
            <p className="mt-2 font-display text-2xl font-black">{formatNumber(s.value)}</p>
          </Card>
        ))}
      </section>
      <BlogTable posts={posts} />
    </>
  );
}
