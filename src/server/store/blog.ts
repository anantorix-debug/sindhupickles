import "server-only";
import type { BlogListResult, StoreBlogCard, StoreBlogPost } from "@/types/store";
import { execute, iso, parseJson, query, type Row } from "@/server/db";

/** Only posts the owner published in Admin -> Blog are public. Drafts stay hidden. */
const PUBLISHED = "status = 'PUBLISHED' AND published_at IS NOT NULL";
const PER_PAGE = 9;

const usableImage = (url: string | null) => (url && (url.startsWith("/uploads/") || url.startsWith("https://")) ? url : null);
/** First ~160 characters of the body when the post has no excerpt (markup characters removed). */
const autoExcerpt = (content: string) => {
  const text = content.replace(/^#{2,3}\s+/gm, "").replace(/\*\*|\[|\]\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
  return text.length > 160 ? `${text.slice(0, 157).trimEnd()}…` : text;
};

const mapCard = (r: Row): StoreBlogCard => ({
  slug: r.slug,
  title: r.title,
  excerpt: r.excerpt || autoExcerpt(r.content ?? ""),
  category: r.category,
  featuredImage: usableImage(r.featured_image),
  authorName: r.author_name || null,
  readTime: r.read_time,
  publishedAt: iso(r.published_at)!,
});

const CARD_COLUMNS = "id, slug, title, excerpt, LEFT(content, 600) AS content, category, featured_image, author_name, read_time, published_at";

export async function listPublishedPosts({ category, page = 1 }: { category?: string; page?: number }): Promise<BlogListResult> {
  const where = category ? `${PUBLISHED} AND category = ?` : PUBLISHED;
  const args = category ? [category] : [];
  const [[{ total }], cats] = await Promise.all([
    query(`SELECT COUNT(*) AS total FROM blog_posts WHERE ${where}`, args),
    query(`SELECT category, COUNT(*) AS n FROM blog_posts WHERE ${PUBLISHED} GROUP BY category ORDER BY category`),
  ]);
  const pageCount = Math.max(1, Math.ceil(Number(total) / PER_PAGE));
  const current = Math.min(Math.max(1, Math.floor(page)), pageCount);
  const rows = await query(`SELECT ${CARD_COLUMNS} FROM blog_posts WHERE ${where} ORDER BY published_at DESC, id DESC LIMIT ? OFFSET ?`, [
    ...args,
    PER_PAGE,
    (current - 1) * PER_PAGE,
  ]);
  return {
    posts: rows.map(mapCard),
    total: Number(total),
    page: current,
    pageCount,
    categories: cats.map((c) => ({ name: c.category, count: Number(c.n) })),
  };
}

export async function getPublishedPost(slug: string): Promise<StoreBlogPost | null> {
  const [r] = await query(`SELECT * FROM blog_posts WHERE slug = ? AND ${PUBLISHED}`, [slug]);
  if (!r) return null;
  return {
    ...mapCard(r),
    id: String(r.id),
    content: r.content,
    tags: parseJson<string[]>(r.tags, []),
    metaTitle: r.meta_title ?? "",
    metaDescription: r.meta_description ?? "",
    updatedAt: iso(r.updated_at) ?? iso(r.published_at)!,
  };
}

/** Up to `limit` other published posts, same category first. */
export async function relatedPosts(post: { id: string; category: string }, limit = 3): Promise<StoreBlogCard[]> {
  const rows = await query(
    `SELECT ${CARD_COLUMNS} FROM blog_posts WHERE ${PUBLISHED} AND id <> ? ORDER BY category = ? DESC, published_at DESC LIMIT ?`,
    [post.id, post.category, limit],
  );
  return rows.map(mapCard);
}

export async function recordPostView(id: string): Promise<void> {
  await execute("UPDATE blog_posts SET view_count = view_count + 1 WHERE id = ?", [id]);
}

export async function listPublishedPostSlugs(): Promise<{ slug: string; updatedAt: string }[]> {
  const rows = await query(`SELECT slug, updated_at, published_at FROM blog_posts WHERE ${PUBLISHED} ORDER BY published_at DESC`);
  return rows.map((r) => ({ slug: r.slug, updatedAt: iso(r.updated_at) ?? iso(r.published_at)! }));
}
