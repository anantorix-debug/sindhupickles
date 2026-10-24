import "server-only";
import type { PoolConnection } from "mysql2/promise";
import type { Product, ProductImage, ProductStatus, ProductVariant, StockLevel } from "@/types";
import type { ProductInput } from "@/lib/validation/product";
import { ApiError, notFound } from "@/server/http";
import { execute, iso, query, transaction, type Row } from "@/server/db";
import { toPaise, toRupees, toRupeesOrNull } from "@/server/money";
import { slugify } from "@/server/slug";

export const stockLevelOf = (available: number, threshold: number): StockLevel =>
  available <= 0 ? "out" : available <= threshold ? "low" : "in-stock";

const worstLevel = (levels: StockLevel[]): StockLevel =>
  levels.includes("out") && !levels.includes("in-stock") && !levels.includes("low")
    ? "out"
    : levels.includes("low") || levels.includes("out")
      ? "low"
      : "in-stock";

const SELECT_PRODUCTS = `
  SELECT p.*, c.name AS category_name, sc.name AS subcategory_name
  FROM products p
  JOIN categories c ON c.id = p.category_id
  LEFT JOIN categories sc ON sc.id = p.subcategory_id`;

async function loadVariants(productIds: number[]): Promise<Map<number, ProductVariant[]>> {
  const map = new Map<number, ProductVariant[]>();
  if (productIds.length === 0) return map;
  const rows = await query(
    `SELECT v.id, v.product_id, v.sku, v.label, v.price_paise, v.active,
            COALESCE(i.on_hand, 0) AS on_hand, COALESCE(i.reserved, 0) AS reserved,
            COALESCE(i.low_stock_threshold, 10) AS threshold
     FROM product_variants v LEFT JOIN inventory i ON i.variant_id = v.id
     WHERE v.product_id IN (?) ORDER BY v.position, v.id`,
    [productIds],
  );
  for (const r of rows) {
    const available = r.on_hand - r.reserved;
    const variant: ProductVariant = {
      id: String(r.id),
      sku: r.sku,
      label: r.label,
      price: toRupeesOrNull(r.price_paise),
      onHand: r.on_hand,
      reserved: r.reserved,
      available,
      lowStockThreshold: r.threshold,
      active: Boolean(r.active),
      level: stockLevelOf(available, r.threshold),
    };
    const list = map.get(r.product_id) ?? [];
    list.push(variant);
    map.set(r.product_id, list);
  }
  return map;
}

async function loadImages(productIds: number[]): Promise<Map<number, ProductImage[]>> {
  const map = new Map<number, ProductImage[]>();
  if (productIds.length === 0) return map;
  const rows = await query("SELECT * FROM product_images WHERE product_id IN (?) ORDER BY position, id", [productIds]);
  for (const r of rows) {
    const list = map.get(r.product_id) ?? [];
    list.push({ id: String(r.id), url: r.url, alt: r.alt, position: r.position });
    map.set(r.product_id, list);
  }
  return map;
}

function mapProduct(r: Row, variants: ProductVariant[], images: ProductImage[]): Product {
  const active = variants.filter((v) => v.active);
  return {
    id: String(r.id),
    slug: r.slug,
    sku: r.sku,
    name: r.name,
    category: r.category_name,
    categoryId: String(r.category_id),
    subcategory: r.subcategory_name ?? null,
    subcategoryId: r.subcategory_id === null ? null : String(r.subcategory_id),
    price: toRupees(r.price_paise),
    salePrice: toRupeesOrNull(r.sale_price_paise),
    status: String(r.status).toLowerCase() as ProductStatus,
    featured: Boolean(r.featured),
    ratingAvg: Number(r.rating_avg),
    reviewCount: r.review_count,
    spiceLevel: r.spice_level,
    shortDescription: r.short_description ?? "",
    description: r.description,
    images,
    variants,
    totalStock: active.reduce((s, v) => s + v.available, 0),
    stockLevel: active.length ? worstLevel(active.map((v) => v.level)) : "out",
    createdAt: iso(r.created_at)!,
    updatedAt: iso(r.updated_at)!,
  };
}

export async function listProducts(): Promise<Product[]> {
  const rows = await query(`${SELECT_PRODUCTS} ORDER BY p.id`);
  const ids = rows.map((r) => r.id);
  const [variants, images] = await Promise.all([loadVariants(ids), loadImages(ids)]);
  return rows.map((r) => mapProduct(r, variants.get(r.id) ?? [], images.get(r.id) ?? []));
}

export async function getProduct(id: string): Promise<Product | null> {
  const [row] = await query(`${SELECT_PRODUCTS} WHERE p.id = ?`, [id]);
  if (!row) return null;
  const [variants, images] = await Promise.all([loadVariants([row.id]), loadImages([row.id])]);
  return mapProduct(row, variants.get(row.id) ?? [], images.get(row.id) ?? []);
}

/** The category must be a top-level one; the subcategory must belong to it. */
async function assertCategories(conn: PoolConnection, categoryId: number, subcategoryId: number | null) {
  const [cat] = await conn.query<Row[]>("SELECT id FROM categories WHERE id = ? AND parent_id IS NULL", [categoryId]);
  if (!cat[0]) throw new ApiError(422, "Choose a valid category", "bad_category", { categoryId: "Choose a valid category" });
  if (subcategoryId !== null) {
    const [sub] = await conn.query<Row[]>("SELECT id FROM categories WHERE id = ? AND parent_id = ?", [subcategoryId, categoryId]);
    if (!sub[0]) throw new ApiError(422, "That subcategory isn't under the chosen category", "bad_category", { subcategoryId: "Not under the chosen category" });
  }
}

async function assertSkuFree(conn: PoolConnection, sku: string, exceptId?: string) {
  const [rows] = await conn.query<Row[]>("SELECT id FROM products WHERE sku = ? AND id <> ?", [sku, exceptId ?? 0]);
  if (rows.length) throw new ApiError(409, "That SKU is already in use", "duplicate_sku", { sku: "That SKU is already in use" });
}

export async function createProduct(input: ProductInput): Promise<Product> {
  const id = await transaction(async (conn) => {
    await assertSkuFree(conn, input.sku);
    await assertCategories(conn, input.categoryId, input.subcategoryId);

    // A typed address is used exactly as written (and refused if another product has it); otherwise it comes from the name.
    let slug = input.slug || slugify(input.name) || "product";
    const [taken] = await conn.query<Row[]>("SELECT id FROM products WHERE slug = ?", [slug]);
    if (taken.length) {
      if (input.slug) throw new ApiError(409, "That page address is already used by another product", "duplicate_slug", { slug: "That page address is already used by another product" });
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    const [res] = await conn.query<import("mysql2").ResultSetHeader>(
      `INSERT INTO products (name, slug, description, short_description, sku, category_id, subcategory_id, price_paise, sale_price_paise,
                             status, featured, rating_avg, review_count, spice_level, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, NOW(3), NOW(3))`,
      [
        input.name, slug, input.description, input.shortDescription || null, input.sku, input.categoryId, input.subcategoryId,
        toPaise(input.price), input.salePrice === null ? null : toPaise(input.salePrice),
        input.status.toUpperCase(), input.featured ? 1 : 0, input.spiceLevel,
      ],
    );

    // A product can't be sold without a variant, so seed one default pack with empty stock.
    const [v] = await conn.query<import("mysql2").ResultSetHeader>(
      `INSERT INTO product_variants (product_id, sku, label, position, active, created_at, updated_at)
       VALUES (?, ?, '250g', 0, 1, NOW(3), NOW(3))`,
      [res.insertId, `${input.sku}-250`],
    );
    await conn.query(
      "INSERT INTO inventory (variant_id, on_hand, reserved, low_stock_threshold, updated_at) VALUES (?, 0, 0, 10, NOW(3))",
      [v.insertId],
    );
    return String(res.insertId);
  });
  return (await getProduct(id))!;
}

export async function updateProduct(id: string, input: ProductInput): Promise<Product> {
  await transaction(async (conn) => {
    const [existing] = await conn.query<Row[]>("SELECT id, slug FROM products WHERE id = ? FOR UPDATE", [id]);
    if (!existing[0]) throw notFound("Product");
    await assertSkuFree(conn, input.sku, id);
    await assertCategories(conn, input.categoryId, input.subcategoryId);

    // Empty keeps the current address. A typed one must not belong to another product.
    const slug = input.slug || existing[0].slug;
    if (slug !== existing[0].slug) {
      const [taken] = await conn.query<Row[]>("SELECT id FROM products WHERE slug = ? AND id <> ?", [slug, id]);
      if (taken.length) throw new ApiError(409, "That page address is already used by another product", "duplicate_slug", { slug: "That page address is already used by another product" });
    }

    await conn.query(
      `UPDATE products SET name = ?, slug = ?, description = ?, short_description = ?, sku = ?, price_paise = ?, sale_price_paise = ?,
              status = ?, featured = ?, spice_level = ?, category_id = ?, subcategory_id = ?, updated_at = NOW(3)
       WHERE id = ?`,
      [
        input.name, slug, input.description, input.shortDescription || null, input.sku,
        toPaise(input.price), input.salePrice === null ? null : toPaise(input.salePrice),
        input.status.toUpperCase(), input.featured ? 1 : 0, input.spiceLevel, input.categoryId, input.subcategoryId,
        id,
      ],
    );
  });
  return (await getProduct(id))!;
}

/**
 * Hard delete, only for products that have never been ordered or stocked.
 * The database cascades deletes into stock history and nulls order-line links,
 * so those cases must be refused here — never rely on the FKs to stop it.
 */
export async function deleteProduct(id: string): Promise<void> {
  try {
    await transaction(async (conn) => {
      const [found] = await conn.query<Row[]>("SELECT id FROM products WHERE id = ? FOR UPDATE", [id]);
      if (!found[0]) throw notFound("Product");
      const [used] = await conn.query<Row[]>(
        `SELECT 1 FROM order_items WHERE product_id = ?
         UNION ALL
         SELECT 1 FROM inventory_movements m JOIN inventory i ON i.id = m.inventory_id
           JOIN product_variants v ON v.id = i.variant_id WHERE v.product_id = ?
         UNION ALL
         SELECT 1 FROM cart_items ci JOIN product_variants v ON v.id = ci.variant_id WHERE v.product_id = ?
         LIMIT 1`,
        [id, id, id],
      );
      if (used[0]) {
        throw new ApiError(409, "This product has orders, carts or stock history and can't be deleted. Set it to Draft instead.", "in_use");
      }
      await conn.query("DELETE FROM inventory WHERE variant_id IN (SELECT id FROM product_variants WHERE product_id = ?)", [id]);
      await conn.query("DELETE FROM product_variants WHERE product_id = ?", [id]);
      await conn.query("DELETE FROM product_images WHERE product_id = ?", [id]);
      await conn.query("DELETE FROM product_relations WHERE source_id = ? OR target_id = ?", [id, id]);
      await conn.query("DELETE FROM products WHERE id = ?", [id]);
    });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "ER_ROW_IS_REFERENCED_2" || code === "ER_ROW_IS_REFERENCED") {
      throw new ApiError(409, "This product has orders or stock history and can't be deleted. Set it to Draft instead.", "in_use");
    }
    throw err;
  }
}

export async function addProductImage(productId: string, url: string, alt: string): Promise<Product> {
  const product = await getProduct(productId);
  if (!product) throw notFound("Product");
  await execute(
    "INSERT INTO product_images (product_id, url, alt, position) SELECT ?, ?, ?, COALESCE(MAX(position) + 1, 0) FROM product_images WHERE product_id = ?",
    [productId, url, alt || product.name, productId],
  );
  return (await getProduct(productId))!;
}

export async function removeProductImage(productId: string, imageId: string): Promise<Product> {
  const res = await execute("DELETE FROM product_images WHERE id = ? AND product_id = ?", [imageId, productId]);
  if (res.affectedRows === 0) throw notFound("Image");
  return (await getProduct(productId))!;
}

/** Moves the chosen image to position 0 (the storefront's main image), keeping the others in order. */
export async function setPrimaryImage(productId: string, imageId: string): Promise<Product> {
  await transaction(async (conn) => {
    const [rows] = await conn.query<Row[]>("SELECT id FROM product_images WHERE product_id = ? ORDER BY position, id", [productId]);
    if (!rows.some((r) => String(r.id) === imageId)) throw notFound("Image");
    const ordered = [imageId, ...rows.map((r) => String(r.id)).filter((i) => i !== imageId)];
    for (let i = 0; i < ordered.length; i++) {
      await conn.query("UPDATE product_images SET position = ? WHERE id = ?", [i, ordered[i]]);
    }
  });
  return (await getProduct(productId))!;
}
