import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import { formatDate } from "@/lib/format";
import type { StoreBlogCard } from "@/types/store";

/** Blog post card, styled like the product cards: photo, category + date, title, excerpt. */
export function PostCard({ post, priority = false, headingLevel = 2 }: { post: StoreBlogCard; priority?: boolean; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const href = `/blog/${post.slug}`;
  return (
    <article className="reveal hover-lift group flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-card hover:border-primary/60">
      <Link href={href} className="relative block aspect-[16/9] w-full overflow-hidden bg-surface-raised" tabIndex={-1} aria-hidden>
        <PostImage src={post.featuredImage} sizes="(min-width:1280px) 400px, (min-width:768px) 50vw, 100vw" priority={priority} className="transition-transform duration-500 ease-out group-hover:scale-110" />
      </Link>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <p className="flex flex-wrap items-center gap-x-2 text-xs font-semibold uppercase text-accent">
          <span>{post.category}</span>
          <span aria-hidden className="text-muted">·</span>
          <time dateTime={post.publishedAt} className="text-muted">{formatDate(post.publishedAt)}</time>
        </p>
        <Heading className="font-display text-xl font-bold leading-snug">
          <Link href={href} className="line-clamp-2 hover:text-accent focus-visible:outline-2 focus-visible:outline-accent">
            {post.title}
          </Link>
        </Heading>
        {post.excerpt && <p className="line-clamp-3 text-sm leading-relaxed text-muted">{post.excerpt}</p>}
        <div className="mt-auto flex items-center justify-between gap-2 pt-2 text-sm">
          {post.readTime ? (
            <span className="flex items-center gap-1.5 text-muted">
              <Clock className="size-3.5" aria-hidden /> {post.readTime} min read
            </span>
          ) : <span />}
          <Link href={href} className="flex items-center gap-1 font-semibold text-accent hover:underline" aria-label={`Read: ${post.title}`}>
            Read <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
          </Link>
        </div>
      </div>
    </article>
  );
}

/** Featured image (uploaded in Admin -> Blog), or the brand mark when the post has none. */
export function PostImage({ src, sizes, priority, className }: { src: string | null; sizes: string; priority?: boolean; className?: string }) {
  if (!src) {
    return (
      <div className="flex size-full items-center justify-center bg-surface-raised">
        <Image src="/assets/images/logo.webp" alt="" width={490} height={640} sizes="80px" className="h-16 w-auto opacity-90" />
      </div>
    );
  }
  // Uploaded photos go through the image optimiser; an outside https link is shown as it is.
  return <Image src={src} alt="" fill sizes={sizes} priority={priority} unoptimized={!src.startsWith("/")} className={`object-cover ${className ?? ""}`} />;
}
