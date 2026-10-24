import "server-only";
import { ApiError, notFound } from "@/server/http";
import { query, transaction, type Row } from "@/server/db";
import type { ReviewInput } from "@/lib/validation/store";

/** What a visitor can do about reviewing one product. */
export type ReviewEligibility = "signed_out" | "not_buyer" | "can_review" | "pending" | "reviewed";

const BOUGHT_SQL = `SELECT 1 AS x FROM orders o JOIN order_items oi ON oi.order_id = o.id
                    WHERE o.customer_id = ? AND oi.product_id = ? AND o.status = 'DELIVERED' LIMIT 1`;

/**
 * Only a signed-in customer whose order for this product has been DELIVERED may review it, once per product.
 * (Delivered is set by the shop owner in Admin -> Orders, so it also covers cash-on-delivery orders.)
 */
export async function reviewEligibility(customerId: string | null, productId: string | number): Promise<ReviewEligibility> {
  if (!customerId) return "signed_out";
  const [mine] = await query("SELECT status FROM reviews WHERE product_id = ? AND customer_id = ? LIMIT 1", [productId, customerId]);
  if (mine) return String(mine.status).toUpperCase() === "PENDING" ? "pending" : "reviewed";
  const [bought] = await query(BOUGHT_SQL, [customerId, productId]);
  return bought ? "can_review" : "not_buyer";
}

/** Saves a new review as PENDING and hidden; the shop owner approves it in Admin -> Reviews. */
export async function submitReview(customerId: string, input: ReviewInput): Promise<{ status: "pending" }> {
  const [product] = await query("SELECT id FROM products WHERE slug = ? AND status = 'ACTIVE'", [input.productSlug]);
  if (!product) throw notFound("Product");

  await transaction(async (conn) => {
    // Serialise per product so a double click or two tabs can't create two reviews.
    await conn.query("SELECT id FROM products WHERE id = ? FOR UPDATE", [product.id]);
    const [mine] = await conn.query<Row[]>("SELECT id FROM reviews WHERE product_id = ? AND customer_id = ? LIMIT 1", [product.id, customerId]);
    if (mine[0]) throw new ApiError(409, "You have already reviewed this product.", "already_reviewed");
    const [bought] = await conn.query<Row[]>(BOUGHT_SQL, [customerId, product.id]);
    if (!bought[0]) throw new ApiError(403, "Only customers who have received this product can review it.", "not_a_buyer");
    await conn.query(
      `INSERT INTO reviews (product_id, customer_id, rating, title, comment, is_visible, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, 'PENDING', NOW(3), NOW(3))`,
      [product.id, customerId, input.rating, input.title || null, input.comment],
    );
  });
  return { status: "pending" };
}
