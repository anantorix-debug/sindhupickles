import "server-only";
import type { StockLevel } from "@/types";
import type {
  ProductListResult,
  ProductSort,
  PublicBusiness,
  StoreCategory,
  StoreProductCard,
  StoreProductDetail,
  StoreReview,
  StoreVariant,
} from "@/types/store";
import { iso, query, type Row } from "@/server/db";
import { toRupees } from "@/server/money";
import { getSettings } from "@/server/repositories/settings";
import { stockLevelOf } from "@/server/repositories/products";

/**
 * Seed data from the previous storefront points at /products/*.svg files this app doesn't
 * serve. Only images we can actually serve (uploads or https URLs) are shown publicly.
 */
const USABLE_IMAGE_SQL = "(pi.url LIKE '/uploads/%' OR pi.url LIKE 'https://%')";
const isUsableImage = (url: string) => url.startsWith("/uploads/") || url.startsWith("https://");

/** Selling and list price for a variant. A variant without its own price follows the product. */
function variantPricing(r: Row) {
  const list = r.v_price === null ? r.p_price : r.v_price;
  const selling = r.v_price === null ? (r.p_sale ?? r.p_price) : (r.v_sale ?? r.v_price);
  return { price: toRupees(selling), compareAtPrice: selling < list ? toRupees(list) : null };
}

const VARIANT_SQL = `
  SELECT v.id, v.product_id, v.sku, v.label,
         p.price_paise AS p_price, p.sale_price_paise AS p_sale, v.price_paise AS v_price, v.sale_price_paise AS v_sale,
         COALESCE(i.on_hand, 0) - COALESCE(i.reserved, 0) AS available, COALESCE(i.low_stock_threshold, 10) AS threshold
  FROM product_variants v
  JOIN products p ON p.id = v.product_id
  LEFT JOIN inventory i ON i.variant_id = v.id
  WHERE v.active = 1 AND v.product_id IN (?)
  ORDER BY v.position, v.id`;

interface VariantRow extends StoreVariant {
  productId: number;
  threshold: number;
}

async function loadVariants(productIds: number[]): Promise<Map<number, VariantRow[]>> {
  const map = new Map<number, VariantRow[]>();
  if (!productIds.length) return map;
  for (const r of await query(VARIANT_SQL, [productIds])) {
    const available = Math.max(Number(r.available), 0);
    const list = map.get(r.product_id) ?? [];
    list.push({
      id: String(r.id),
      productId: r.product_id,
      sku: r.sku,
      label: r.label,
      ...variantPricing(r),
      available,
      inStock: available > 0,
      threshold: r.threshold,
    });
    map.set(r.product_id, list);
  }
  return map;
}

function toCard(r: Row, variants: VariantRow[]): StoreProductCard {
  const firstBuyable = variants.find((v) => v.inStock) ?? variants[0];
  const totalAvailable = variants.reduce((s, v) => s + v.available, 0);
  const threshold = Math.max(...variants.map((v) => v.threshold), 0);
  const fallbackPrice = toRupees(r.p_sale ?? r.price_paise);
  return {
    id: String(r.id),
    slug: r.slug,
    name: r.name,
    category: r.category_name,
    categorySlug: r.category_slug,
    imageUrl: r.image_url ?? null,
    price: firstBuyable?.price ?? fallbackPrice,
    compareAtPrice: firstBuyable ? firstBuyable.compareAtPrice : r.sale_price_paise !== null ? toRupees(r.price_paise) : null,
    hasMultiplePacks: variants.length > 1,
    firstVariantId: firstBuyable?.id ?? null,
    firstVariantLabel: firstBuyable?.label ?? null,
    inStock: totalAvailable > 0,
    lowStock: totalAvailable > 0 && totalAvailable <= threshold,
    featured: Boolean(r.featured),
    ratingAvg: Number(r.rating_avg),
    reviewCount: r.review_count,
    shortDescription: r.short_description ?? "",
  };
}

/** Product-card query; `extraColumns` (with trailing comma) lets the detail page add heavier columns. */
const cardSql = (extraColumns = "") => `
  SELECT ${extraColumns}p.id, p.name, p.slug, p.price_paise, p.sale_price_paise, p.featured, p.rating_avg, p.review_count, p.short_description,
         p.created_at, c.name AS category_name, c.slug AS category_slug,
         p.price_paise AS p_price, p.sale_price_paise AS p_sale,
         (SELECT pi.url FROM product_images pi WHERE pi.product_id = p.id AND ${USABLE_IMAGE_SQL} ORDER BY pi.position, pi.id LIMIT 1) AS image_url,
         (SELECT MIN(CASE WHEN v.price_paise IS NULL THEN COALESCE(p.sale_price_paise, p.price_paise)
                          ELSE COALESCE(v.sale_price_paise, v.price_paise) END)
          FROM product_variants v WHERE v.product_id = p.id AND v.active = 1) AS min_price
  FROM products p
  JOIN categories c ON c.id = p.category_id
  LEFT JOIN categories sc ON sc.id = p.subcategory_id
  WHERE p.status = 'ACTIVE' AND c.active = 1`;
const CARD_SQL = cardSql();

async function cardsFromRows(rows: Row[]): Promise<StoreProductCard[]> {
  const variants = await loadVariants(rows.map((r) => r.id));
  return rows.map((r) => toCard(r, variants.get(r.id) ?? []));
}

const SORTS: Record<ProductSort, string> = {
  featured: "p.featured DESC, p.rating_avg DESC, p.id ASC",
  newest: "p.created_at DESC, p.id DESC",
  "price-asc": "COALESCE(min_price, p.price_paise) ASC, p.id ASC",
  "price-desc": "COALESCE(min_price, p.price_paise) DESC, p.id ASC",
  rating: "p.rating_avg DESC, p.review_count DESC, p.id ASC",
  name: "p.name ASC",
};
export const isProductSort = (v: string | undefined): v is ProductSort => !!v && v in SORTS;

const like = (s: string) => `%${s.replace(/[\\%_]/g, "\\$&")}%`;

export interface ProductQuery {
  category?: string;
  q?: string;
  sort?: ProductSort;
  page?: number;
  pageSize?: number;
}

export async function listProducts(opts: ProductQuery = {}): Promise<ProductListResult> {
  const pageSize = Math.min(Math.max(opts.pageSize ?? 12, 1), 48);
  const page = Math.max(opts.page ?? 1, 1);
  const where: string[] = [];
  const params: unknown[] = [];

  if (opts.category) {
    where.push("(c.slug = ? OR sc.slug = ?)");
    params.push(opts.category, opts.category);
  }
  const tokens = (opts.q ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 5);
  for (const t of tokens) {
    where.push("(p.name LIKE ? OR p.sku LIKE ? OR c.name LIKE ? OR sc.name LIKE ? OR p.short_description LIKE ?)");
    params.push(like(t), like(t), like(t), like(t), like(t));
  }
  const filter = where.length ? ` AND ${where.join(" AND ")}` : "";

  const [rows, [count]] = await Promise.all([
    query(`${CARD_SQL}${filter} ORDER BY ${SORTS[opts.sort ?? "featured"]} LIMIT ? OFFSET ?`, [...params, pageSize, (page - 1) * pageSize]),
    query(
      `SELECT COUNT(*) AS n FROM products p JOIN categories c ON c.id = p.category_id LEFT JOIN categories sc ON sc.id = p.subcategory_id
       WHERE p.status = 'ACTIVE' AND c.active = 1${filter}`,
      params,
    ),
  ]);
  const total = Number(count.n);
  return { items: await cardsFromRows(rows), total, page, pageSize, pageCount: Math.max(Math.ceil(total / pageSize), 1) };
}

export async function getFeaturedProducts(limit = 8): Promise<StoreProductCard[]> {
  return cardsFromRows(await query(`${CARD_SQL} AND p.featured = 1 ORDER BY p.rating_avg DESC, p.id ASC LIMIT ?`, [limit]));
}

/** Most-ordered products; topped up with the best-rated ones while there are few sales. */
export async function getBestSellers(limit = 4): Promise<StoreProductCard[]> {
  const sold = await query(
    `SELECT oi.product_id, SUM(oi.quantity) AS units
     FROM order_items oi JOIN orders o ON o.id = oi.order_id
     WHERE oi.product_id IS NOT NULL AND o.status NOT IN ('CANCELLED','PAYMENT_FAILED','PENDING_PAYMENT')
     GROUP BY oi.product_id ORDER BY units DESC LIMIT ?`,
    [limit * 3],
  );
  const ids = sold.map((r) => r.product_id as number);
  const rows = ids.length ? await query(`${CARD_SQL} AND p.id IN (?)`, [ids]) : [];
  const ranked = ids.map((id) => rows.find((r) => r.id === id)).filter((r): r is Row => Boolean(r)).slice(0, limit);
  if (ranked.length < limit) {
    const more = await query(`${CARD_SQL} ${ranked.length ? "AND p.id NOT IN (?)" : ""} ORDER BY p.rating_avg DESC, p.review_count DESC LIMIT ?`, [
      ...(ranked.length ? [ranked.map((r) => r.id)] : []),
      limit - ranked.length,
    ]);
    ranked.push(...more);
  }
  return cardsFromRows(ranked);
}

export async function searchSuggestions(q: string, limit = 6): Promise<StoreProductCard[]> {
  if (q.trim().length < 2) return [];
  return (await listProducts({ q, pageSize: limit, sort: "featured" })).items;
}

const CATEGORY_SQL = `
  SELECT c.id, c.parent_id, c.name, c.slug, c.description, c.image_url,
         (SELECT COUNT(*) FROM products x WHERE x.status = 'ACTIVE' AND (x.category_id = c.id OR x.subcategory_id = c.id)) AS product_count,
         (SELECT pi.url FROM product_images pi JOIN products x ON x.id = pi.product_id
           WHERE x.status = 'ACTIVE' AND (x.category_id = c.id OR x.subcategory_id = c.id) AND ${USABLE_IMAGE_SQL}
           ORDER BY x.featured DESC, pi.position, pi.id LIMIT 1) AS product_image
  FROM categories c WHERE c.active = 1`;

const mapCategory = (r: Row): StoreCategory => ({
  id: String(r.id),
  parentId: r.parent_id === null ? null : String(r.parent_id),
  name: r.name,
  slug: r.slug,
  description: r.description ?? "",
  imageUrl: r.image_url ?? r.product_image ?? null,
  productCount: Number(r.product_count),
});

/** Active categories, top-level first with each one's subcategories after it. */
export async function listCategories(): Promise<StoreCategory[]> {
  return (await query(`${CATEGORY_SQL} ORDER BY COALESCE(c.parent_id, c.id), c.parent_id IS NOT NULL, c.position, c.id`)).map(mapCategory);
}

export async function getCategoryBySlug(slug: string): Promise<StoreCategory | null> {
  const [row] = await query(`${CATEGORY_SQL} AND c.slug = ?`, [slug]);
  return row ? mapCategory(row) : null;
}

async function reviewsFor(productId: number): Promise<StoreReview[]> {
  const rows = await query(
    `SELECT r.id, r.rating, r.title, r.comment, r.created_at, c.name AS customer_name
     FROM reviews r JOIN customers c ON c.id = r.customer_id
     WHERE r.product_id = ? AND r.is_visible = 1 AND r.status = 'APPROVED' ORDER BY r.created_at DESC LIMIT 6`,
    [productId],
  );
  return rows.map((r) => ({
    id: String(r.id),
    customerName: String(r.customer_name).split(" ")[0],
    rating: r.rating,
    title: r.title,
    comment: r.comment,
    createdAt: iso(r.created_at)!,
  }));
}

/** Recent visible reviews across the store, for the home page (empty until customers review). */
export async function getLatestReviews(limit = 3): Promise<(StoreReview & { productName: string })[]> {
  const rows = await query(
    `SELECT r.id, r.rating, r.title, r.comment, r.created_at, c.name AS customer_name, p.name AS product_name
     FROM reviews r JOIN customers c ON c.id = r.customer_id JOIN products p ON p.id = r.product_id
     WHERE r.is_visible = 1 AND r.status = 'APPROVED' AND r.rating >= 4 AND r.comment IS NOT NULL AND p.status = 'ACTIVE'
     ORDER BY r.created_at DESC LIMIT ?`,
    [limit],
  );
  return rows.map((r) => ({
    id: String(r.id),
    customerName: String(r.customer_name),
    productName: r.product_name,
    rating: r.rating,
    title: r.title,
    comment: r.comment,
    createdAt: iso(r.created_at)!,
  }));
}

export async function getProductBySlug(slug: string): Promise<StoreProductDetail | null> {
  const [row] = await query(
    `${cardSql("p.description, p.sku, p.spice_level, p.updated_at, sc.name AS subcategory_name, (SELECT s.meta_title FROM product_seo s WHERE s.product_id = p.id) AS meta_title, (SELECT s.meta_description FROM product_seo s WHERE s.product_id = p.id) AS meta_description, ")} AND p.slug = ?`,
    [slug],
  );
  if (!row) return null;

  const [variantMap, images, relatedRows, reviews] = await Promise.all([
    loadVariants([row.id]),
    query("SELECT pi.url, pi.alt FROM product_images pi WHERE pi.product_id = ? ORDER BY pi.position, pi.id", [row.id]),
    query(
      `${CARD_SQL} AND p.id <> ? AND (p.id IN (SELECT target_id FROM product_relations WHERE source_id = ?) OR p.category_id = (SELECT category_id FROM products WHERE id = ?))
       ORDER BY (p.id IN (SELECT target_id FROM product_relations WHERE source_id = ?)) DESC, p.featured DESC, p.rating_avg DESC LIMIT 4`,
      [row.id, row.id, row.id, row.id],
    ),
    reviewsFor(row.id),
  ]);
  const variants = variantMap.get(row.id) ?? [];
  const card = toCard(row, variants);
  const totalAvailable = variants.reduce((s, v) => s + v.available, 0);
  const threshold = Math.max(...variants.map((v) => v.threshold), 10);
  const stockLevel: StockLevel = stockLevelOf(totalAvailable, threshold);

  return {
    ...card,
    sku: row.sku,
    description: row.description,
    spiceLevel: row.spice_level,
    metaTitle: row.meta_title ?? null,
    metaDescription: row.meta_description ?? null,
    subcategory: row.subcategory_name ?? null,
    images: images.filter((i) => isUsableImage(i.url)).map((i) => ({ url: i.url, alt: i.alt })),
    variants: variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      label: v.label,
      price: v.price,
      compareAtPrice: v.compareAtPrice,
      available: v.available,
      inStock: v.inStock,
    })),
    stockLevel,
    related: await cardsFromRows(relatedRows),
    reviews,
    updatedAt: iso(row.updated_at)!,
  };
}

/** Slugs for the sitemap. */
export async function listProductSlugs(): Promise<{ slug: string; updatedAt: string }[]> {
  const rows = await query(
    "SELECT p.slug, p.updated_at FROM products p JOIN categories c ON c.id = p.category_id WHERE p.status = 'ACTIVE' AND c.active = 1 ORDER BY p.id",
  );
  return rows.map((r) => ({ slug: r.slug, updatedAt: iso(r.updated_at)! }));
}

/** Business info that header/footer/contact share; edited in Admin → Settings. */
export async function getPublicBusiness(): Promise<PublicBusiness> {
  const s = await getSettings();
  return {
    name: s.storeName,
    tagline: s.tagline,
    email: s.supportEmail,
    phone: s.supportPhone,
    address: s.address,
    freeShippingThreshold: s.freeShippingThreshold,
    shippingFee: s.shippingFee,
    welcomeCoupon: s.welcomeCoupon,
    welcomeCouponPct: s.welcomeCouponPct,
  };
}
