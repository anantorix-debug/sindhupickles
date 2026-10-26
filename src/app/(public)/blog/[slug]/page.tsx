import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { cache } from "react";
import { ChevronRight, Clock, PenLine } from "lucide-react";
import { PostBody } from "@/components/store/blog/post-body";
import { PostCard, PostImage } from "@/components/store/blog/post-card";
import { PageContainer } from "@/components/store/common/section-heading";
import { CtaBand } from "@/components/store/home/cta-band";
import { formatDate } from "@/lib/format";
import { getPublishedPost, recordPostView, relatedPosts } from "@/server/store/blog";

type Props = PageProps<"/blog/[slug]">;

// One database read shared by generateMetadata and the page.
const loadPost = cache(getPublishedPost);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await loadPost((await params).slug);
  if (!post) return { title: "Post not found" };
  const description = post.metaDescription || post.excerpt;
  const url = `/blog/${post.slug}`;
  return {
    title: { absolute: post.metaTitle || `${post.title} | Sindhu's Pickles` },
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title: post.title,
      description,
      url,
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      ...(post.authorName ? { authors: [post.authorName] } : {}),
      ...(post.tags.length ? { tags: post.tags } : {}),
      ...(post.featuredImage ? { images: [{ url: post.featuredImage, alt: post.title }] } : {}),
    },
    twitter: { card: "summary_large_image", title: post.title, description, ...(post.featuredImage ? { images: [post.featuredImage] } : {}) },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const post = await loadPost((await params).slug);
  if (!post) notFound();
  const related = await relatedPosts(post);
  // Counted after the page is sent, so the reader never waits for it.
  after(() => recordPostView(post.id).catch(() => {}));

  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const abs = (u: string) => (u.startsWith("http") ? u : `${site}${u}`);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.metaDescription || post.excerpt,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    mainEntityOfPage: `${site}/blog/${post.slug}`,
    articleSection: post.category,
    ...(post.tags.length ? { keywords: post.tags.join(", ") } : {}),
    ...(post.featuredImage ? { image: [abs(post.featuredImage)] } : {}),
    author: post.authorName ? { "@type": "Person", name: post.authorName } : { "@type": "Organization", name: "Sindhu's Pickles", url: site },
    publisher: { "@type": "Organization", name: "Sindhu's Pickles", logo: { "@type": "ImageObject", url: `${site}/assets/images/logo.webp` } },
  };

  return (
    <>
      <PageContainer className="py-8 sm:py-12">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

        <nav aria-label="Breadcrumb" className="mx-auto mb-8 max-w-3xl text-sm text-muted">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li><Link href="/" className="hover:text-accent">Home</Link></li>
            <ChevronRight className="size-3.5" aria-hidden />
            <li><Link href="/blog" className="hover:text-accent">Blog</Link></li>
            <ChevronRight className="size-3.5" aria-hidden />
            <li aria-current="page" className="line-clamp-1 text-foreground">{post.title}</li>
          </ol>
        </nav>

        <article className="mx-auto max-w-3xl">
          <header className="space-y-4">
            <Link href={`/blog?category=${encodeURIComponent(post.category)}`} className="inline-block rounded-sm bg-accent-soft px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-accent hover:underline">
              {post.category}
            </Link>
            <h1 className="font-display text-3xl font-black leading-tight sm:text-5xl">{post.title}</h1>
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
              <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
              {post.readTime ? (
                <span className="flex items-center gap-1.5"><Clock className="size-3.5" aria-hidden /> {post.readTime} min read</span>
              ) : null}
              {post.authorName && (
                <span className="flex items-center gap-1.5"><PenLine className="size-3.5" aria-hidden /> {post.authorName}</span>
              )}
            </p>
          </header>

          {post.featuredImage && (
            <div className="relative mt-8 aspect-[16/9] overflow-hidden rounded-lg border border-border bg-surface-raised">
              <PostImage src={post.featuredImage} sizes="(min-width:768px) 768px, 100vw" priority />
            </div>
          )}

          <div className="mt-8">
            <PostBody content={post.content} />
          </div>

          {post.tags.length > 0 && (
            <ul className="mt-10 flex flex-wrap gap-2 border-t border-border pt-6" aria-label="Tags">
              {post.tags.map((t) => (
                <li key={t} className="rounded-pill border border-border bg-surface px-3 py-1 text-xs text-muted">{`#${t}`}</li>
              ))}
            </ul>
          )}
        </article>

        {related.length > 0 && (
          <section aria-labelledby="more-posts" className="mt-16 space-y-6">
            <h2 id="more-posts" className="font-display text-2xl font-bold">More from our kitchen</h2>
            <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {related.map((p) => (
                <li key={p.slug}>
                  <PostCard post={p} headingLevel={3} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </PageContainer>
      <CtaBand />
    </>
  );
}
