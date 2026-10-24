import "server-only";
import type { BlogPost, BlogPostSummary, BlogStatus } from "@/types";
import type { BlogPostInput } from "@/lib/validation/content";
import { ApiError, notFound } from "@/server/http";
import { execute, iso, query, type Row } from "@/server/db";
import { slugify } from "@/server/slug";

const wordsToMinutes = (text: string) => Math.max(1, Math.ceil(text.trim().split(/\s+/).length / 200));

const mapSummary = (r: Row): BlogPostSummary => ({
  id: String(r.id),
  title: r.title,
  slug: r.slug,
  category: r.category,
  authorName: r.author_name,
  featuredImage: r.featured_image,
  status: String(r.status).toLowerCase() as BlogStatus,
  viewCount: r.view_count,
  readTime: r.read_time,
  publishedAt: iso(r.published_at),
  createdAt: iso(r.created_at)!,
});

const mapPost = (r: Row): BlogPost => ({
  ...mapSummary(r),
  content: r.content,
  excerpt: r.excerpt ?? "",
  tags: Array.isArray(r.tags) ? r.tags : [],
  metaTitle: r.meta_title ?? "",
  metaDescription: r.meta_description ?? "",
  focusKeyword: r.focus_keyword ?? "",
});

export async function listPosts(): Promise<BlogPostSummary[]> {
  const rows = await query(
    `SELECT id, title, slug, category, author_name, featured_image, status, view_count, read_time, published_at, created_at
     FROM blog_posts ORDER BY created_at DESC, id DESC LIMIT 1000`,
  );
  return rows.map(mapSummary);
}

export async function getPost(id: string): Promise<BlogPost | null> {
  const [row] = await query("SELECT * FROM blog_posts WHERE id = ?", [id]);
  return row ? mapPost(row) : null;
}

export async function listBlogCategories(): Promise<string[]> {
  const rows = await query("SELECT DISTINCT category FROM blog_posts ORDER BY category");
  return rows.map((r) => r.category);
}

async function resolveSlug(input: BlogPostInput, exceptId?: string) {
  const slug = input.slug || slugify(input.title, 180) || "post";
  const [taken] = await query("SELECT id FROM blog_posts WHERE slug = ? AND id <> ?", [slug, exceptId ?? 0]);
  if (taken) {
    if (input.slug) throw new ApiError(409, "That slug is already used", "duplicate_slug", { slug: "That slug is already used" });
    return `${slug}-${Date.now().toString(36)}`;
  }
  return slug;
}

export async function createPost(input: BlogPostInput): Promise<BlogPost> {
  const slug = await resolveSlug(input);
  const res = await execute(
    `INSERT INTO blog_posts (title, slug, content, excerpt, featured_image, category, author_name, tags, status, published_at,
                             meta_title, meta_description, focus_keyword, read_time)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ${input.status === "published" ? "NOW(3)" : "NULL"}, ?, ?, ?, ?)`,
    [
      input.title, slug, input.content, input.excerpt || null, input.featuredImage || null, input.category,
      input.authorName || null, JSON.stringify(input.tags), input.status.toUpperCase(),
      input.metaTitle || null, input.metaDescription || null, input.focusKeyword || null, wordsToMinutes(input.content),
    ],
  );
  return (await getPost(String(res.insertId)))!;
}

export async function updatePost(id: string, input: BlogPostInput): Promise<BlogPost> {
  const existing = await getPost(id);
  if (!existing) throw notFound("Post");
  const slug = await resolveSlug({ ...input, slug: input.slug || existing.slug }, id);
  // published_at is stamped the first time a post goes live and kept afterwards.
  await execute(
    `UPDATE blog_posts SET title = ?, slug = ?, content = ?, excerpt = ?, featured_image = ?, category = ?, author_name = ?,
            tags = ?, status = ?, published_at = ${input.status === "published" ? "COALESCE(published_at, NOW(3))" : "published_at"},
            meta_title = ?, meta_description = ?, focus_keyword = ?, read_time = ?
     WHERE id = ?`,
    [
      input.title, slug, input.content, input.excerpt || null, input.featuredImage || null, input.category,
      input.authorName || null, JSON.stringify(input.tags), input.status.toUpperCase(),
      input.metaTitle || null, input.metaDescription || null, input.focusKeyword || null, wordsToMinutes(input.content), id,
    ],
  );
  return (await getPost(id))!;
}

export async function deletePost(id: string): Promise<void> {
  const res = await execute("DELETE FROM blog_posts WHERE id = ?", [id]);
  if (res.affectedRows === 0) throw notFound("Post");
}
