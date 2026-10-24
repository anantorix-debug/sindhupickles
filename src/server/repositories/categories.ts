import "server-only";
import type { Category } from "@/types";
import type { CategoryInput } from "@/lib/validation/content";
import { ApiError, notFound } from "@/server/http";
import { query, transaction, type Row } from "@/server/db";
import { slugify } from "@/server/slug";

const SELECT_CATEGORIES = `
  SELECT c.*, p.name AS parent_name,
    (SELECT COUNT(*) FROM products x WHERE x.category_id = c.id OR x.subcategory_id = c.id) AS product_count
  FROM categories c LEFT JOIN categories p ON p.id = c.parent_id`;

const mapCategory = (r: Row): Category => ({
  id: String(r.id),
  parentId: r.parent_id === null ? null : String(r.parent_id),
  parentName: r.parent_name,
  name: r.name,
  slug: r.slug,
  description: r.description ?? "",
  active: Boolean(r.active),
  position: r.position,
  productCount: Number(r.product_count),
});

/** Top-level categories, each followed by its subcategories. */
export async function listCategories(): Promise<Category[]> {
  const rows = await query(`${SELECT_CATEGORIES} ORDER BY COALESCE(c.parent_id, c.id), c.parent_id IS NOT NULL, c.position, c.id`);
  return rows.map(mapCategory);
}

export async function getCategory(id: string): Promise<Category | null> {
  const [row] = await query(`${SELECT_CATEGORIES} WHERE c.id = ?`, [id]);
  return row ? mapCategory(row) : null;
}

/** An explicitly typed slug must be free; an auto-generated one gets a suffix on collision. */
async function uniqueSlug(conn: import("mysql2/promise").PoolConnection, desired: string, explicit: boolean, exceptId?: string) {
  const slug = desired || "category";
  const [taken] = await conn.query<Row[]>("SELECT id FROM categories WHERE slug = ? AND id <> ?", [slug, exceptId ?? 0]);
  if (!taken.length) return slug;
  if (explicit) throw new ApiError(409, "That slug is already used", "duplicate_slug", { slug: "That slug is already used" });
  return `${slug}-${Date.now().toString(36)}`;
}

async function assertParent(conn: import("mysql2/promise").PoolConnection, parentId: number | null, selfId?: string) {
  if (parentId === null) return;
  if (selfId && String(parentId) === selfId) throw new ApiError(422, "A category can't be its own parent", "bad_parent", { parentId: "Invalid parent" });
  const [rows] = await conn.query<Row[]>("SELECT id FROM categories WHERE id = ? AND parent_id IS NULL", [parentId]);
  if (!rows[0]) throw new ApiError(422, "Parent must be a top-level category", "bad_parent", { parentId: "Choose a top-level category" });
  if (selfId) {
    const [kids] = await conn.query<Row[]>("SELECT id FROM categories WHERE parent_id = ? LIMIT 1", [selfId]);
    if (kids[0]) throw new ApiError(422, "This category has subcategories, so it can't become a subcategory", "bad_parent", { parentId: "Has subcategories" });
  }
}

export async function createCategory(input: CategoryInput): Promise<Category> {
  const id = await transaction(async (conn) => {
    await assertParent(conn, input.parentId);
    const slug = await uniqueSlug(conn, input.slug || slugify(input.name, 180), Boolean(input.slug));
    const [name] = await conn.query<Row[]>("SELECT id FROM categories WHERE name = ? AND parent_id <=> ?", [input.name, input.parentId]);
    if (name[0]) throw new ApiError(409, "A category with that name already exists here", "duplicate_name", { name: "Already exists" });
    const [pos] = await conn.query<Row[]>("SELECT COALESCE(MAX(position), -1) + 1 AS next FROM categories WHERE parent_id <=> ?", [input.parentId]);
    const [res] = await conn.query<import("mysql2").ResultSetHeader>(
      `INSERT INTO categories (parent_id, name, slug, description, position, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(3), NOW(3))`,
      [input.parentId, input.name, slug, input.description || null, pos[0].next, input.active ? 1 : 0],
    );
    return String(res.insertId);
  });
  return (await getCategory(id))!;
}

export async function updateCategory(id: string, input: CategoryInput): Promise<Category> {
  await transaction(async (conn) => {
    const [existing] = await conn.query<Row[]>("SELECT id, slug FROM categories WHERE id = ? FOR UPDATE", [id]);
    if (!existing[0]) throw notFound("Category");
    await assertParent(conn, input.parentId, id);
    const slug = await uniqueSlug(conn, input.slug || existing[0].slug, Boolean(input.slug), id);
    await conn.query(
      "UPDATE categories SET parent_id = ?, name = ?, slug = ?, description = ?, active = ?, updated_at = NOW(3) WHERE id = ?",
      [input.parentId, input.name, slug, input.description || null, input.active ? 1 : 0, id],
    );
  });
  return (await getCategory(id))!;
}

/** Refused while the category still has products or subcategories. */
export async function deleteCategory(id: string): Promise<void> {
  const cat = await getCategory(id);
  if (!cat) throw notFound("Category");
  const [kids] = await query("SELECT COUNT(*) AS n FROM categories WHERE parent_id = ?", [id]);
  if (cat.productCount > 0 || kids.n > 0) {
    throw new ApiError(409, "This category still has products or subcategories. Move or remove them first.", "in_use");
  }
  await query("DELETE FROM categories WHERE id = ?", [id]);
}
