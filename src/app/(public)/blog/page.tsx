import type { Metadata } from "next";
import Link from "next/link";
import { NotebookPen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PostCard } from "@/components/store/blog/post-card";
import { PageContainer, SectionHeading } from "@/components/store/common/section-heading";
import { StateMessage } from "@/components/store/common/state-message";
import { cn } from "@/lib/utils";
import { listPublishedPosts } from "@/server/store/blog";

type Props = PageProps<"/blog">;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const DESCRIPTION = "Recipes, serving ideas and stories from the Sindhu's Pickles kitchen: homemade non-veg pickles from Salem, Tamil Nadu.";

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams;
  const filtered = Boolean(one(sp.category)) || Number(one(sp.page)) > 1;
  return {
    title: "Blog",
    description: DESCRIPTION,
    alternates: { canonical: "/blog" },
    openGraph: { title: "Blog | Sindhu's Pickles", description: DESCRIPTION, url: "/blog" },
    // Category and page 2+ views list the same posts as /blog, so only /blog itself is indexed.
    robots: filtered ? { index: false, follow: true } : undefined,
  };
}

function href(params: { category?: string; page?: number }) {
  const sp = new URLSearchParams();
  if (params.category) sp.set("category", params.category);
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  const qs = sp.toString();
  return qs ? `/blog?${qs}` : "/blog";
}

const chip = (active: boolean) =>
  cn(
    "inline-flex h-9 items-center whitespace-nowrap rounded-pill border px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent",
    active ? "border-primary bg-primary text-white" : "border-border bg-surface text-foreground hover:border-primary",
  );

export default async function BlogPage({ searchParams }: Props) {
  const sp = await searchParams;
  const category = one(sp.category) || undefined;
  const result = await listPublishedPosts({ category, page: Number(one(sp.page)) || 1 });

  return (
    <PageContainer className="py-10 sm:py-14">
      <SectionHeading as="h1" eyebrow="From our kitchen" title="The Sindhu's Pickles Blog" description="Recipes, serving ideas and stories behind every jar." />

      {result.categories.length > 1 && (
        <nav aria-label="Blog categories" className="-mx-4 mt-8 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <ul className="flex gap-2 sm:justify-center">
            <li>
              <Link href="/blog" className={chip(!category)} aria-current={!category ? "page" : undefined}>All</Link>
            </li>
            {result.categories.map((c) => (
              <li key={c.name}>
                <Link href={href({ category: c.name })} className={chip(category === c.name)} aria-current={category === c.name ? "page" : undefined}>
                  {c.name} <span className="ml-1.5 text-xs opacity-75">{c.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {result.posts.length === 0 ? (
        <StateMessage
          icon={NotebookPen}
          title={category ? "No posts in this category" : "Stories coming soon"}
          description={category ? "Try another category, or see all posts." : "We're writing our first recipes and kitchen stories. Meanwhile, our pickles are ready for you."}
          action={
            <Button asChild>
              <Link href={category ? "/blog" : "/shop"}>{category ? "See all posts" : "Shop pickles"}</Link>
            </Button>
          }
        />
      ) : (
        <ul className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {result.posts.map((p, i) => (
            <li key={p.slug}>
              <PostCard post={p} priority={i < 3} />
            </li>
          ))}
        </ul>
      )}

      {result.pageCount > 1 && (
        <nav aria-label="Pagination" className="mt-12 flex items-center justify-center gap-2">
          {result.page > 1 && (
            <Button asChild variant="secondary" size="sm">
              <Link href={href({ category, page: result.page - 1 })} rel="prev">Previous</Link>
            </Button>
          )}
          <span className="px-3 text-sm text-muted">
            Page {result.page} of {result.pageCount}
          </span>
          {result.page < result.pageCount && (
            <Button asChild variant="secondary" size="sm">
              <Link href={href({ category, page: result.page + 1 })} rel="next">Next</Link>
            </Button>
          )}
        </nav>
      )}
    </PageContainer>
  );
}
